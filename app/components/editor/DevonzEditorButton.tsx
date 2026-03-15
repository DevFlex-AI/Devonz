import { memo, useState, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { toast } from 'react-toastify';

interface DevonzEditorButtonProps {
  className?: string;
}

export const DevonzEditorButton = memo(({ className }: DevonzEditorButtonProps) => {
  const [isOpening, setIsOpening] = useState(false);

  const handleOpenInDevonzEditor = useCallback(async () => {
    setIsOpening(true);

    try {
      const files = workbenchStore.files.get();
      const fileCount = Object.keys(files).length;

      // Get session info for the bridge
      const sessionToken = localStorage.getItem('devonz_session_token') ?? '';
      const projectId = localStorage.getItem('devonz_project_id') ?? Date.now().toString();

      // Store project ID for future use
      localStorage.setItem('devonz_project_id', projectId);

      const editorUrl = new URL(import.meta.env.VITE_DEVONZ_EDITOR_URL ?? 'http://localhost:3000');
      editorUrl.searchParams.set('token', sessionToken);
      editorUrl.searchParams.set('projectId', projectId);
      editorUrl.searchParams.set('folder', '/home/workspace');

      // Open Devonz Editor in a new tab
      const editorWindow = window.open(editorUrl.toString(), '_blank', 'noopener,noreferrer');

      if (!editorWindow) {
        toast.error('Popup blocked — please allow popups for Devonz Editor');
        return;
      }

      toast.success(`Opening Devonz Editor with ${fileCount} files…`, {
        autoClose: 3000,
      });
    } catch (error) {
      console.error('[DevonzEditorButton] Error:', error);
      toast.error('Failed to open Devonz Editor');
    } finally {
      setIsOpening(false);
    }
  }, []);

  return (
    <button
      onClick={handleOpenInDevonzEditor}
      disabled={isOpening}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
        bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3
        border border-bolt-elements-borderColor
        text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary
        transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
        ${className ?? ''}
      `}
      title="Open in Devonz Editor (full VS Code experience)"
    >
      {isOpening ? (
        <div className="i-svg-spinners:180-ring-with-bg w-3.5 h-3.5" />
      ) : (
        <div className="i-ph:code-block w-3.5 h-3.5" />
      )}
      <span>Devonz Editor</span>
    </button>
  );
});

DevonzEditorButton.displayName = 'DevonzEditorButton';
