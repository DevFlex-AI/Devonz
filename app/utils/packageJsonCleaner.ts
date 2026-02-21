/**
 * Cleans up a package.json for WebContainer compatibility.
 *
 * Many v0-generated projects include unnecessary dependencies
 * (expo, react-native, vue-router in React projects, etc.)
 * that fail to install in WebContainer. This utility strips
 * them out so `npm install` succeeds without manual intervention.
 */

import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('PackageJsonCleaner');

/**
 * Dependencies that should NEVER be installed in WebContainer.
 * These are React Native / mobile-only packages that will fail.
 */
const BLOCKLISTED_DEPENDENCIES = [
  // React Native / Expo ecosystem (not compatible with WebContainer)
  'react-native',
  'react-native-web',
  'expo',
  'expo-asset',
  'expo-file-system',
  'expo-gl',
  'expo-constants',
  'expo-modules-core',
  'expo-linking',
  'expo-router',
  'expo-status-bar',
  'expo-splash-screen',

  // Misplaced framework deps (e.g. Vue deps in a React/Next.js project)
  '@nuxt/kit',
  '@nuxt/schema',
  'nuxi',
];

/**
 * Dependencies that should only be removed if the project
 * is NOT actually using the associated framework.
 */
const CONDITIONAL_BLOCKLIST: Record<string, { onlyRemoveIfMissing: string }> = {
  'vue-router': { onlyRemoveIfMissing: 'vue' },
  vue: { onlyRemoveIfMissing: 'vue' }, // only remove if no .vue files detected
};

/**
 * WebContainer-compatible Next.js version.
 *
 * Next.js >= 15 triggers "workUnitAsyncStorage InvariantError" in WebContainer
 * because WebContainer's AsyncLocalStorage doesn't fully support Next.js 15's
 * server component lifecycle. Turbopack mode also fails because
 * `turbo.createProject` needs native bindings (WebContainer only has WASM).
 *
 * Next.js 14.2.x is the last stable major version that works reliably.
 */
const WEBCONTAINER_NEXT_VERSION = '14.2.28';
const WEBCONTAINER_REACT_VERSION = '^18.3.1';

/**
 * Parse a semver-like version string to extract the major version.
 * Handles formats like "14.2.28", "^15.0.0", "~16.1.6", "latest", "*".
 */
function parseMajorVersion(version: string): number | null {
  const match = version.replace(/^[\^~>=<]+/, '').match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

interface CleanupResult {
  cleaned: boolean;
  removedDeps: string[];
  content: string;
}

/**
 * Cleans a package.json string for WebContainer compatibility.
 * Removes dependencies that are known to fail in WebContainer.
 * Also caps Next.js to 14.x to avoid server rendering issues.
 *
 * @param packageJsonContent - The raw package.json file content
 * @param projectFiles - Optional list of project file paths to help detect framework usage
 * @returns Cleaned package.json content and metadata about what was removed
 */
export function cleanPackageJsonForWebContainer(packageJsonContent: string, projectFiles?: string[]): CleanupResult {
  try {
    const pkg = JSON.parse(packageJsonContent);
    const removedDeps: string[] = [];
    const hasVueFiles = projectFiles?.some((f) => f.endsWith('.vue')) ?? false;

    // Process both dependencies and devDependencies
    for (const depType of ['dependencies', 'devDependencies'] as const) {
      const deps = pkg[depType];

      if (!deps || typeof deps !== 'object') {
        continue;
      }

      // Remove blocklisted dependencies
      for (const dep of BLOCKLISTED_DEPENDENCIES) {
        if (deps[dep]) {
          delete deps[dep];
          removedDeps.push(`${dep} (${depType})`);
        }
      }

      // Remove conditional blocklist items
      for (const [dep, condition] of Object.entries(CONDITIONAL_BLOCKLIST)) {
        if (deps[dep]) {
          // Check if the framework is actually used
          const frameworkDep = condition.onlyRemoveIfMissing;

          if (dep === 'vue-router' || dep === 'vue') {
            // Only remove vue-related deps if no .vue files exist
            if (!hasVueFiles && !pkg.dependencies?.vue && !pkg.devDependencies?.vue) {
              delete deps[dep];
              removedDeps.push(`${dep} (${depType}, unused)`);
            }
          } else if (!deps[frameworkDep] && !pkg.dependencies?.[frameworkDep] && !pkg.devDependencies?.[frameworkDep]) {
            delete deps[dep];
            removedDeps.push(`${dep} (${depType}, unused)`);
          }
        }
      }

      // Remove expo-prefixed dependencies dynamically
      for (const dep of Object.keys(deps)) {
        if (dep.startsWith('expo-') && !BLOCKLISTED_DEPENDENCIES.includes(dep)) {
          delete deps[dep];
          removedDeps.push(`${dep} (${depType})`);
        }
      }
    }

    if (removedDeps.length > 0) {
      logger.info(`Cleaned package.json: removed ${removedDeps.length} incompatible deps:`, removedDeps);
    }

    /*
     * Cap Next.js version to 14.x for WebContainer compatibility.
     * Next.js 15+ causes "workUnitAsyncStorage" InvariantError (HTTP 500)
     * and Turbopack requires native bindings not available in WebContainer.
     */
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};
    let versionCapped = false;

    if (deps.next) {
      const major = parseMajorVersion(deps.next);

      if (major !== null && major >= 15) {
        logger.info(`Capping Next.js from ${deps.next} to ${WEBCONTAINER_NEXT_VERSION} for WebContainer`);
        deps.next = WEBCONTAINER_NEXT_VERSION;
        versionCapped = true;
      }
    }

    if (devDeps.next) {
      const major = parseMajorVersion(devDeps.next);

      if (major !== null && major >= 15) {
        devDeps.next = WEBCONTAINER_NEXT_VERSION;
        versionCapped = true;
      }
    }

    // When Next.js is capped to 14.x, React/React-DOM must be 18.x (not 19.x)
    if (versionCapped) {
      for (const depsObj of [deps, devDeps]) {
        if (depsObj.react) {
          const reactMajor = parseMajorVersion(depsObj.react);

          if (reactMajor !== null && reactMajor >= 19) {
            depsObj.react = WEBCONTAINER_REACT_VERSION;
          }
        }

        if (depsObj['react-dom']) {
          const rdMajor = parseMajorVersion(depsObj['react-dom']);

          if (rdMajor !== null && rdMajor >= 19) {
            depsObj['react-dom'] = WEBCONTAINER_REACT_VERSION;
          }
        }

        if (depsObj['@types/react']) {
          const trMajor = parseMajorVersion(depsObj['@types/react']);

          if (trMajor !== null && trMajor >= 19) {
            depsObj['@types/react'] = WEBCONTAINER_REACT_VERSION;
          }
        }

        if (depsObj['@types/react-dom']) {
          const trdMajor = parseMajorVersion(depsObj['@types/react-dom']);

          if (trdMajor !== null && trdMajor >= 19) {
            depsObj['@types/react-dom'] = WEBCONTAINER_REACT_VERSION;
          }
        }
      }

      removedDeps.push('next version capped to 14.x (WebContainer compat)');
    }

    return {
      cleaned: removedDeps.length > 0 || versionCapped,
      removedDeps,
      content: JSON.stringify(pkg, null, 2),
    };
  } catch (error) {
    logger.error('Failed to clean package.json:', error);

    // Return original content if parsing fails
    return {
      cleaned: false,
      removedDeps: [],
      content: packageJsonContent,
    };
  }
}

/**
 * Fonts unsupported by Next.js 14's `next/font/google` built-in font list.
 * These were added in Next.js 15+ and must be swapped to compatible alternatives.
 */
const FONT_REPLACEMENTS: [RegExp, string][] = [
  /*
   * Order matters: replace multiword names first to avoid partial matches.
   * e.g. "Geist_Mono" must be replaced before "Geist".
   */
  [/\bGeist_Mono\b/g, 'Roboto_Mono'],
  [/\bGeist\b/g, 'Inter'],
];

/**
 * Replaces unsupported Google Font references in source files for
 * WebContainer compatibility with Next.js 14.
 *
 * When Next.js is capped to 14.x, fonts like `Geist` and `Geist_Mono`
 * (added in 15+) cause `Unknown font` build errors. This replaces
 * them with visually similar fonts available in all versions.
 *
 * Only modifies files that import from `next/font/google`.
 */
export function replaceUnsupportedFonts(content: string): { content: string; replaced: boolean } {
  if (!content.includes('next/font/google')) {
    return { content, replaced: false };
  }

  let result = content;
  let replaced = false;

  for (const [pattern, replacement] of FONT_REPLACEMENTS) {
    const updated = result.replace(pattern, replacement);

    if (updated !== result) {
      result = updated;
      replaced = true;
    }
  }

  if (replaced) {
    logger.info('Replaced unsupported fonts in next/font/google usage');
  }

  return { content: result, replaced };
}
