import { describe, it, expect } from 'vitest';
import { cleanPackageJsonForWebContainer, replaceUnsupportedFonts } from './packageJsonCleaner';

describe('cleanPackageJsonForWebContainer', () => {
  it('should remove expo and react-native dependencies', () => {
    const pkg = JSON.stringify({
      dependencies: {
        react: '^19',
        'react-dom': '^19',
        next: '16.1.6',
        expo: 'latest',
        'expo-asset': 'latest',
        'expo-file-system': 'latest',
        'expo-gl': 'latest',
        'react-native': 'latest',
      },
    });

    const result = cleanPackageJsonForWebContainer(pkg);

    expect(result.cleaned).toBe(true);
    expect(result.removedDeps).toContain('expo (dependencies)');
    expect(result.removedDeps).toContain('expo-asset (dependencies)');
    expect(result.removedDeps).toContain('expo-file-system (dependencies)');
    expect(result.removedDeps).toContain('expo-gl (dependencies)');
    expect(result.removedDeps).toContain('react-native (dependencies)');

    const cleaned = JSON.parse(result.content);

    // Next.js 16 should be capped to 14.2.28 and react 19 → 18
    expect(cleaned.dependencies.next).toBe('14.2.28');
    expect(cleaned.dependencies.react).toBe('^18.3.1');
    expect(cleaned.dependencies['react-dom']).toBe('^18.3.1');
    expect(cleaned.dependencies.expo).toBeUndefined();
    expect(cleaned.dependencies['react-native']).toBeUndefined();
  });

  it('should remove @nuxt/kit from Next.js projects', () => {
    const pkg = JSON.stringify({
      dependencies: {
        next: '15.5.12',
        react: '^19',
        '@nuxt/kit': 'latest',
      },
    });

    const result = cleanPackageJsonForWebContainer(pkg);

    expect(result.cleaned).toBe(true);
    expect(result.removedDeps).toContain('@nuxt/kit (dependencies)');

    const cleaned = JSON.parse(result.content);
    expect(cleaned.dependencies['@nuxt/kit']).toBeUndefined();
  });

  it('should remove vue-router when no .vue files exist', () => {
    const pkg = JSON.stringify({
      dependencies: {
        next: '15.5.12',
        react: '^19',
        'vue-router': 'latest',
      },
    });

    const result = cleanPackageJsonForWebContainer(pkg, ['app/page.tsx', 'app/layout.tsx']);

    expect(result.cleaned).toBe(true);
    expect(result.removedDeps).toContain('vue-router (dependencies, unused)');
  });

  it('should keep vue-router when .vue files exist', () => {
    const pkg = JSON.stringify({
      dependencies: {
        vue: '^3',
        'vue-router': 'latest',
      },
    });

    const result = cleanPackageJsonForWebContainer(pkg, ['src/App.vue', 'src/Home.vue']);

    expect(result.cleaned).toBe(false);
    expect(result.removedDeps).toHaveLength(0);
  });

  it('should cap Next.js 15+ and React 19 for WebContainer compatibility', () => {
    const pkg = JSON.stringify({
      dependencies: {
        react: '^19',
        'react-dom': '^19',
        next: '15.5.12',
        'framer-motion': '12.23.12',
      },
      devDependencies: {
        typescript: '^5',
        tailwindcss: '^4.1.9',
        '@types/react': '^19',
        '@types/react-dom': '^19',
      },
    });

    const result = cleanPackageJsonForWebContainer(pkg);

    expect(result.cleaned).toBe(true);

    const cleaned = JSON.parse(result.content);
    expect(cleaned.dependencies.next).toBe('14.2.28');
    expect(cleaned.dependencies.react).toBe('^18.3.1');
    expect(cleaned.dependencies['react-dom']).toBe('^18.3.1');
    expect(cleaned.devDependencies['@types/react']).toBe('^18.3.1');
    expect(cleaned.devDependencies['@types/react-dom']).toBe('^18.3.1');

    // Non-React deps should be untouched
    expect(cleaned.dependencies['framer-motion']).toBe('12.23.12');
    expect(cleaned.devDependencies.typescript).toBe('^5');
  });

  it('should not cap Next.js 14.x (already compatible)', () => {
    const pkg = JSON.stringify({
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
        next: '14.2.28',
      },
    });

    const result = cleanPackageJsonForWebContainer(pkg);

    expect(result.cleaned).toBe(false);

    const cleaned = JSON.parse(result.content);
    expect(cleaned.dependencies.next).toBe('14.2.28');
    expect(cleaned.dependencies.react).toBe('^18.0.0');
  });

  it('should handle malformed package.json gracefully', () => {
    const result = cleanPackageJsonForWebContainer('not valid json');

    expect(result.cleaned).toBe(false);
    expect(result.content).toBe('not valid json');
  });

  it('should handle package.json with no dependencies', () => {
    const pkg = JSON.stringify({ name: 'test', version: '1.0.0' });
    const result = cleanPackageJsonForWebContainer(pkg);

    expect(result.cleaned).toBe(false);
  });

  it('should remove dynamically detected expo-prefixed packages', () => {
    const pkg = JSON.stringify({
      dependencies: {
        react: '^19',
        'expo-camera': 'latest',
        'expo-location': 'latest',
        'expo-notifications': 'latest',
      },
    });

    const result = cleanPackageJsonForWebContainer(pkg);

    expect(result.cleaned).toBe(true);
    expect(result.removedDeps).toContain('expo-camera (dependencies)');
    expect(result.removedDeps).toContain('expo-location (dependencies)');
    expect(result.removedDeps).toContain('expo-notifications (dependencies)');
  });

  it('should clean real 3d-model-generator template', () => {
    const pkg = JSON.stringify({
      scripts: { dev: 'next dev', build: 'next build' },
      dependencies: {
        '@react-three/drei': 'latest',
        '@react-three/fiber': 'latest',
        expo: 'latest',
        'expo-asset': 'latest',
        'expo-file-system': 'latest',
        'expo-gl': 'latest',
        next: '16.1.6',
        react: '^19.2.4',
        'react-dom': '^19.2.4',
        'react-native': 'latest',
        three: 'latest',
      },
    });

    const result = cleanPackageJsonForWebContainer(pkg);

    expect(result.cleaned).toBe(true);

    const cleaned = JSON.parse(result.content);
    expect(cleaned.dependencies['@react-three/drei']).toBe('latest');
    expect(cleaned.dependencies.three).toBe('latest');

    // Next.js 16 capped to 14 and react 19 → 18
    expect(cleaned.dependencies.next).toBe('14.2.28');
    expect(cleaned.dependencies.react).toBe('^18.3.1');
    expect(cleaned.dependencies['react-dom']).toBe('^18.3.1');
    expect(cleaned.dependencies.expo).toBeUndefined();
    expect(cleaned.dependencies['react-native']).toBeUndefined();
  });
});

describe('replaceUnsupportedFonts', () => {
  it('should replace Geist and Geist_Mono in next/font/google imports', () => {
    const layout = `import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({ subsets: ['latin'] });
const geistMono = Geist_Mono({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  return <html className={\`\${geistSans.variable} \${geistMono.variable}\`}><body>{children}</body></html>;
}`;

    const result = replaceUnsupportedFonts(layout);

    expect(result.replaced).toBe(true);
    expect(result.content).toContain("import { Inter, Roboto_Mono } from 'next/font/google'");
    expect(result.content).toContain('const geistSans = Inter(');
    expect(result.content).toContain('const geistMono = Roboto_Mono(');
    expect(result.content).not.toContain('Geist');
  });

  it('should not modify files without next/font/google', () => {
    const component = `import React from 'react';
export default function Home() { return <div>Hello</div>; }`;

    const result = replaceUnsupportedFonts(component);

    expect(result.replaced).toBe(false);
    expect(result.content).toBe(component);
  });

  it('should handle Geist only (no Geist_Mono)', () => {
    const layout = `import { Geist } from "next/font/google";
const font = Geist({ subsets: ['latin'] });`;

    const result = replaceUnsupportedFonts(layout);

    expect(result.replaced).toBe(true);
    expect(result.content).toContain('import { Inter }');
    expect(result.content).toContain('const font = Inter(');
  });
});
