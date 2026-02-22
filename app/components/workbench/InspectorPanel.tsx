/**
 * Element Inspector detail panel.
 *
 * Consumes the `UseInspectorReturn` API returned by `useInspector()` as
 * a single prop, eliminating the previous 17-prop interface. All state is
 * read from the hook (backed by nanostores) and all commands are
 * dispatched through the hook's typed action functions.
 *
 * @module workbench/InspectorPanel
 */

import { useState, useCallback, memo } from 'react';
import type { UseInspectorReturn } from '~/lib/hooks/useInspector';
import type { InspectorTab } from '~/lib/inspector/types';
import { RELEVANT_STYLE_PROPS } from '~/lib/inspector/types';
import { setPendingChatMessage } from '~/lib/stores/chat';
import { BoxModelEditor } from './BoxModelEditor';
import { AiQuickActions } from './AIQuickActions';
import { ElementTreeNavigator } from './ElementTreeNavigator';
import { PageColorPalette } from './PageColorPalette';
import { BulkStyleSelector } from './BulkStyleSelector';

/* ─── Helpers ──────────────────────────────────────────────────────── */

const getRelevantStyles = (styles: Record<string, string>): Record<string, string> => {
  const result: Record<string, string> = {};

  for (const prop of RELEVANT_STYLE_PROPS) {
    const value = styles[prop];

    if (value) {
      result[prop] = value;
    }
  }

  return result;
};

const isColorProperty = (prop: string): boolean => {
  return prop.includes('color') || prop === 'background' || prop.includes('border');
};

const parseColorFromValue = (value: string): string | null => {
  const hexMatch = value.match(/#([0-9a-fA-F]{3,8})/);

  if (hexMatch) {
    return hexMatch[0];
  }

  const rgbMatch = value.match(/rgba?\([^)]+\)/);

  if (rgbMatch) {
    return rgbMatch[0];
  }

  return null;
};

/* ─── Tab config ───────────────────────────────────────────────────── */

const TABS: InspectorTab[] = ['styles', 'text', 'box', 'ai', 'tree', 'colors', 'layout'];

const TAB_LABELS: Record<InspectorTab, string> = {
  styles: 'styles',
  text: 'text',
  box: 'box',
  ai: 'AI',
  tree: '🌳',
  colors: '🎨',
  layout: '📐',
};

/* ─── Props ────────────────────────────────────────────────────────── */

interface InspectorPanelProps {
  /** The full return value from `useInspector()`. */
  inspector: UseInspectorReturn;
}

/* ─── Component ────────────────────────────────────────────────────── */

export const InspectorPanel = memo(({ inspector }: InspectorPanelProps) => {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const {
    selectedElement,
    isPanelVisible,
    activeTab,
    pendingEdits,
    pendingTextEdit,
    bulkTarget,
    accumulatedBulkChanges,
    bulkAffectedCount,
  } = inspector;

  /* ── Style / text routing ──────────────────────────────────────── */

  const handleStyleChange = useCallback(
    (property: string, value: string) => {
      if (bulkTarget) {
        inspector.bulkStyleChange(bulkTarget.selector, property, value);
      } else {
        inspector.editStyle(property, value);
      }
    },
    [inspector, bulkTarget],
  );

  const handleTextChange = useCallback(
    (text: string) => {
      inspector.editText(text);
    },
    [inspector],
  );

  /* ── Derived state ─────────────────────────────────────────────── */

  const hasChanges = Object.keys(pendingEdits).length > 0 || pendingTextEdit.length > 0;

  /* ── Clipboard ─────────────────────────────────────────────────── */

  const handleCopyCSS = useCallback(async () => {
    const ok = await inspector.copyCSS();
    setCopyFeedback(ok ? 'Copied!' : 'No changes to copy');
    setTimeout(() => setCopyFeedback(null), 2000);
  }, [inspector]);

  const handleCopyAllStyles = useCallback(async () => {
    const ok = await inspector.copyAllStyles();
    setCopyFeedback(ok ? 'All styles copied!' : 'No styles to copy');
    setTimeout(() => setCopyFeedback(null), 2000);
  }, [inspector]);

  /* ── Revert routing ────────────────────────────────────────────── */

  const handleRevert = useCallback(() => {
    if (bulkTarget) {
      inspector.revertBulk(bulkTarget.selector);
    } else {
      inspector.revert();
    }
  }, [inspector, bulkTarget]);

  /* ── AI action handler (for AiQuickActions sub-component) ──────── */

  const handleAIAction = useCallback(
    (message: string) => {
      setPendingChatMessage(message);
      inspector.closePanel();
    },
    [inspector],
  );

  /* ── Delete handler ────────────────────────────────────────────── */

  const handleDeleteElement = useCallback(() => {
    if (!selectedElement) {
      return;
    }

    const selectorParts = [selectedElement.tagName.toLowerCase()];

    if (selectedElement.id) {
      selectorParts.push(`#${selectedElement.id}`);
    }

    if (selectedElement.className) {
      const firstClass = selectedElement.className.split(' ')[0];

      if (firstClass) {
        selectorParts.push(`.${firstClass}`);
      }
    }

    const selector = selectorParts.join('');
    const textPreview = selectedElement.textContent?.slice(0, 50) || '';
    const textContext = textPreview
      ? ` with text "${textPreview}${selectedElement.textContent && selectedElement.textContent.length > 50 ? '...' : ''}"`
      : '';

    const message = `Please delete/remove the element \`${selector}\`${textContext} from the source code.\n\nRemove this element completely from the JSX/HTML.`;

    setPendingChatMessage(message);
    inspector.closePanel();
  }, [selectedElement, inspector]);

  /* ── Early return ──────────────────────────────────────────────── */

  if (!isPanelVisible || !selectedElement) {
    return null;
  }

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <div className="fixed right-4 top-20 w-80 bg-devonz-elements-background-depth-2 border border-devonz-elements-borderColor rounded-lg shadow-lg z-[9999] max-h-[calc(100vh-6rem)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-devonz-elements-borderColor bg-devonz-elements-background-depth-3">
        <div className="flex items-center gap-2">
          <div className="i-ph:cursor-click text-accent-400" aria-hidden="true" />
          <h3 className="font-medium text-devonz-elements-textPrimary text-sm">Element Inspector</h3>
        </div>
        <button
          onClick={inspector.closePanel}
          className="text-devonz-elements-textSecondary hover:text-devonz-elements-textPrimary transition-colors p-1 rounded hover:bg-devonz-elements-background-depth-4"
          aria-label="Close inspector panel"
        >
          <div className="i-ph:x w-4 h-4" />
        </button>
      </div>

      {/* Element info */}
      <div className="p-3 border-b border-devonz-elements-borderColor bg-devonz-elements-background-depth-2">
        <div className="text-sm">
          <div className="font-mono text-xs bg-devonz-elements-background-depth-3 px-2 py-1.5 rounded border border-devonz-elements-borderColor">
            <span className="text-blue-400">{selectedElement.tagName.toLowerCase()}</span>
            {selectedElement.id && <span className="text-green-400">#{selectedElement.id}</span>}
            {selectedElement.className && (
              <span className="text-yellow-400">.{selectedElement.className.split(' ')[0]}</span>
            )}
          </div>
        </div>
      </div>

      {/* Bulk style selector */}
      <div className="p-3 border-b border-devonz-elements-borderColor bg-devonz-elements-background-depth-2">
        <BulkStyleSelector
          currentTagName={selectedElement.tagName}
          selectedTarget={bulkTarget}
          onSelectTarget={inspector.setBulkTarget}
          affectedCount={bulkAffectedCount}
        />
      </div>

      {/* Tabs */}
      <div
        className="flex border-b border-devonz-elements-borderColor"
        style={{ background: 'var(--devonz-elements-bg-depth-3)' }}
        role="tablist"
        aria-label="Inspector tabs"
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`inspector-tabpanel-${tab}`}
            onClick={() => inspector.setActiveTab(tab)}
            className="flex-1 px-1.5 py-2 text-[10px] font-medium capitalize transition-colors"
            style={{
              background: activeTab === tab ? 'var(--devonz-elements-bg-depth-2)' : 'transparent',
              color: activeTab === tab ? 'var(--color-accent-500, #3b82f6)' : 'var(--devonz-elements-textSecondary)',
              borderBottom: activeTab === tab ? '2px solid var(--color-accent-500, #3b82f6)' : '2px solid transparent',
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        className="p-3 overflow-y-auto max-h-80 bg-devonz-elements-background-depth-2"
        role="tabpanel"
        id={`inspector-tabpanel-${activeTab}`}
      >
        {activeTab === 'styles' && (
          <div className="space-y-2">
            {/* Copy all computed styles */}
            <button
              onClick={handleCopyAllStyles}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded border border-devonz-elements-borderColor bg-devonz-elements-background-depth-3 text-devonz-elements-textSecondary hover:bg-devonz-elements-background-depth-4 hover:text-devonz-elements-textPrimary transition-colors mb-3"
            >
              <span className="i-ph:clipboard w-3.5 h-3.5" aria-hidden="true" />
              {copyFeedback || 'Copy All Styles'}
            </button>

            {Object.entries(getRelevantStyles(selectedElement.styles)).map(([prop, value]) => {
              const editedValue = pendingEdits[prop] ?? value;
              const color = isColorProperty(prop) ? parseColorFromValue(editedValue) : null;

              return (
                <div key={prop} className="flex items-center gap-2 text-xs">
                  <span className="text-devonz-elements-textSecondary min-w-[100px] truncate" title={prop}>
                    {prop}:
                  </span>
                  <div className="flex-1 flex items-center gap-1">
                    {color && (
                      <div className="relative w-6 h-6 rounded overflow-hidden border border-devonz-elements-borderColor">
                        <input
                          type="color"
                          value={color.startsWith('#') ? color : '#000000'}
                          onChange={(e) => handleStyleChange(prop, e.target.value)}
                          className="absolute inset-0 w-[200%] h-[200%] -top-1 -left-1 cursor-pointer border-0 p-0 m-0"
                          style={{ background: 'transparent' }}
                          title={`Pick color for ${prop}`}
                          aria-label={`Color picker for ${prop}`}
                        />
                      </div>
                    )}
                    <input
                      type="text"
                      spellCheck={false}
                      value={editedValue}
                      onChange={(e) => handleStyleChange(prop, e.target.value)}
                      className="flex-1 bg-devonz-elements-background-depth-3 border border-devonz-elements-borderColor rounded px-2 py-1 text-devonz-elements-textPrimary font-mono text-xs focus:outline-none focus:border-accent-400"
                      aria-label={`Value for ${prop}`}
                    />
                  </div>
                </div>
              );
            })}

            {Object.keys(getRelevantStyles(selectedElement.styles)).length === 0 && (
              <p className="text-devonz-elements-textSecondary text-xs italic">No editable styles found</p>
            )}
          </div>
        )}

        {activeTab === 'text' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="inspector-text-content" className="text-xs text-devonz-elements-textSecondary block mb-1">
                Text Content
              </label>
              <textarea
                id="inspector-text-content"
                value={pendingTextEdit || selectedElement.textContent}
                onChange={(e) => handleTextChange(e.target.value)}
                className="w-full bg-devonz-elements-background-depth-3 border border-devonz-elements-borderColor rounded px-2 py-2 text-devonz-elements-textPrimary text-sm focus:outline-none focus:border-accent-400 resize-none"
                rows={4}
                placeholder="Enter text content..."
              />
            </div>
            <p className="text-devonz-elements-textTertiary text-xs">
              Changes apply instantly to the preview. Note: Only works for simple text elements.
            </p>
          </div>
        )}

        {activeTab === 'box' && (
          <BoxModelEditor boxModel={selectedElement.boxModel ?? null} onValueChange={handleStyleChange} />
        )}

        {activeTab === 'ai' && <AiQuickActions selectedElement={selectedElement} onAIAction={handleAIAction} />}

        {activeTab === 'tree' && (
          <ElementTreeNavigator
            hierarchy={selectedElement.hierarchy ?? null}
            onSelectElement={inspector.selectFromTree}
          />
        )}

        {activeTab === 'colors' && (
          <PageColorPalette
            colors={selectedElement.colors ?? []}
            onColorSelect={(color) => handleStyleChange('background-color', color)}
          />
        )}

        {activeTab === 'layout' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-devonz-elements-textSecondary">
              <span className="i-ph:layout w-4 h-4" aria-hidden="true" />
              <span>Layout Inspector</span>
            </div>
            <p className="text-devonz-elements-textTertiary text-xs italic">
              Flexbox and Grid visualiser coming in a future update.
            </p>
          </div>
        )}
      </div>

      {/* Footer with action buttons */}
      <div className="p-3 border-t border-devonz-elements-borderColor bg-devonz-elements-background-depth-3 space-y-2">
        {/* Bulk CSS section */}
        {accumulatedBulkChanges.length > 0 && (
          <div className="space-y-2 p-2 rounded-lg border border-green-500/30 bg-green-500/5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-400 font-medium">
                {accumulatedBulkChanges.length} bulk {accumulatedBulkChanges.length === 1 ? 'change' : 'changes'}{' '}
                pending
              </span>
              <button
                onClick={inspector.clearBulkChanges}
                className="text-devonz-elements-textTertiary hover:text-red-400 transition-colors"
                title="Clear all bulk changes"
                aria-label="Clear all bulk changes"
              >
                <div className="i-ph:x-circle w-4 h-4" />
              </button>
            </div>
            <button
              onClick={inspector.applyBulkCSS}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              <div className="i-ph:code w-3.5 h-3.5" aria-hidden="true" />
              Apply All Bulk CSS
            </button>
          </div>
        )}

        {hasChanges ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={handleCopyCSS}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-devonz-elements-borderColor bg-devonz-elements-background-depth-2 text-devonz-elements-textPrimary hover:bg-devonz-elements-background-depth-4 transition-colors"
              >
                <div className="i-ph:clipboard w-3.5 h-3.5" aria-hidden="true" />
                {copyFeedback || 'Copy CSS'}
              </button>
              <button
                onClick={inspector.applyWithAI}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-accent-500 text-white hover:bg-accent-600 transition-colors"
              >
                <div className="i-ph:magic-wand w-3.5 h-3.5" aria-hidden="true" />
                Apply with AI
              </button>
            </div>

            {/* Revert */}
            <button
              onClick={handleRevert}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                bulkTarget
                  ? 'border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/50'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50'
              }`}
            >
              <div className="i-ph:arrow-counter-clockwise w-3.5 h-3.5" aria-hidden="true" />
              {bulkTarget ? `Revert All ${bulkTarget.label}` : 'Revert Changes'}
            </button>
          </div>
        ) : (
          <p className="text-devonz-elements-textTertiary text-xs text-center">Edit values above to see live changes</p>
        )}

        {/* Delete element */}
        <button
          onClick={handleDeleteElement}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
        >
          <div className="i-ph:trash w-3.5 h-3.5" aria-hidden="true" />
          Delete Element
        </button>
      </div>
    </div>
  );
});

InspectorPanel.displayName = 'InspectorPanel';
