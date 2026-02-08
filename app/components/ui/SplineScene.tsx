import React, { Suspense, lazy, useState, useEffect } from 'react';

// Lazy load Spline to avoid SSR issues
const Spline = lazy(() => import('@splinetool/react-spline'));

interface SplineSceneProps {
  scene: string; // Can be a scene ID or full URL
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

/**
 * SplineScene Component
 *
 * Renders a Spline 3D scene using the Spline SDK.
 * Uses the app's spline-proxy API to handle CORS in WebContainer environments.
 *
 * Usage:
 *   <SplineScene scene="Nnisc8PVo8Y24LsrYw7fkLGx" />
 *   or
 *   <SplineScene scene="https://prod.spline.design/xxx/scene.splinecode" />
 */
export function SplineScene({ scene, className, style, fallback }: SplineSceneProps) {
  const [sceneUrl, setSceneUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /*
     * Build the scene URL
     * If it's already a full URL, use it directly
     * Otherwise, construct the prod.spline.design URL
     */
    if (scene.startsWith('http')) {
      setSceneUrl(scene);
    } else {
      // Use the proxy to avoid CORS issues
      setSceneUrl(`/api/spline-proxy?scene=${scene}`);
    }
  }, [scene]);

  if (error) {
    return (
      <div className={className} style={style}>
        <div className="flex items-center justify-center h-full text-gray-400">
          <span>Failed to load 3D scene</span>
        </div>
      </div>
    );
  }

  if (!sceneUrl) {
    return (
      fallback || (
        <div className={className} style={style}>
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-gray-400">Loading 3D scene...</div>
          </div>
        </div>
      )
    );
  }

  return (
    <div className={className} style={style}>
      <Suspense
        fallback={
          fallback || (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-gray-400">Loading 3D scene...</div>
            </div>
          )
        }
      >
        <Spline
          scene={sceneUrl}
          onError={(e) => {
            console.error('Spline error:', e);
            setError('Failed to load scene');
          }}
        />
      </Suspense>
    </div>
  );
}

export default SplineScene;
