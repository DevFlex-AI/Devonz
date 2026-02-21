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
 * Next.js 14.0.x/14.1.x lack proper SWC WASM fallback — they try to load
 * native SWC binaries which aren't available in WebContainer.
 * Next.js 14.2+ automatically falls back to @next/swc-wasm-nodejs.
 *
 * Version 14.2.28 is the target: last patch of the 14.2.x series.
 */
const WEBCONTAINER_NEXT_VERSION = '14.2.28';
const WEBCONTAINER_REACT_VERSION = '^18.3.1';

/**
 * When React is capped to 18.x, @react-three/fiber must stay at 8.x.
 * Version 9.x uses React 19's reconciler internals and crashes with:
 * "TypeError: Cannot read properties of undefined (reading 'S')"
 */
const WEBCONTAINER_R3F_VERSION = '^8.17.10';

/**
 * The minimum Next.js 14.x minor version with SWC WASM fallback support.
 * Versions below this (14.0.x, 14.1.x) fail in WebContainer with:
 * "Failed to load SWC binary for linux/x64"
 */
const MIN_NEXT14_MINOR_FOR_WASM = 2;

/**
 * Parse a semver-like version string to extract major and minor versions.
 * Handles formats like "14.2.28", "^15.0.0", "~16.1.6", "latest", "*".
 */
function parseVersion(version: string): { major: number; minor: number } | null {
  const match = version.replace(/^[\^~>=<]+/, '').match(/^(\d+)(?:\.(\d+))?/);
  return match ? { major: parseInt(match[1], 10), minor: match[2] ? parseInt(match[2], 10) : 0 } : null;
}

/** Convenience: extract just the major version number. */
function parseMajorVersion(version: string): number | null {
  const v = parseVersion(version);
  return v ? v.major : null;
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
     * Pin Next.js to 14.2.28 for WebContainer compatibility:
     * - Next.js 15+: causes "workUnitAsyncStorage" InvariantError (HTTP 500)
     *   and Turbopack requires native bindings not available in WebContainer.
     * - Next.js 14.0.x/14.1.x: tries to load native SWC binaries which aren't
     *   available in WebContainer. 14.2+ falls back to @next/swc-wasm-nodejs.
     */
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};
    let versionCapped = false;

    for (const depsObj of [deps, devDeps]) {
      if (depsObj.next) {
        const ver = parseVersion(depsObj.next);

        if (ver !== null) {
          const needsCap = ver.major >= 15 || (ver.major === 14 && ver.minor < MIN_NEXT14_MINOR_FOR_WASM);

          if (needsCap) {
            logger.info(`Pinning Next.js from ${depsObj.next} to ${WEBCONTAINER_NEXT_VERSION} for WebContainer`);
            depsObj.next = WEBCONTAINER_NEXT_VERSION;
            versionCapped = true;
          }
        }
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

        /*
         * Cap @react-three/fiber to 8.x when React is pinned to 18.
         * Version 9.x uses React 19 reconciler internals and crashes with:
         * "TypeError: Cannot read properties of undefined (reading 'S')"
         *
         * Also cap 'latest' / '*' since those resolve to 9.x at install time.
         */
        if (depsObj['@react-three/fiber']) {
          const r3fMajor = parseMajorVersion(depsObj['@react-three/fiber']);
          const needsR3fCap = r3fMajor === null || r3fMajor >= 9;

          if (needsR3fCap) {
            logger.info(
              `Capping @react-three/fiber from ${depsObj['@react-three/fiber']} to ${WEBCONTAINER_R3F_VERSION} (React 18)`,
            );
            depsObj['@react-three/fiber'] = WEBCONTAINER_R3F_VERSION;
            removedDeps.push('@react-three/fiber capped to 8.x (React 18 compat)');
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
