/**
 * Comprehensive type definitions for the Element Inspector system.
 *
 * Covers element selection, style editing, box-model visualisation,
 * hierarchy navigation, undo/redo history, bulk operations, and
 * user-configurable preferences.
 *
 * @module inspector/types
 */

/* Box-model */

/** Pixel values for `top`, `right`, `bottom`, `left`. */
export interface BoxSides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Full box-model data used by the visual box-model editor. */
export interface BoxModelData {
  margin: BoxSides;
  padding: BoxSides;
  border: BoxSides;
  borderColor: string;
  borderStyle: string;
  width: number;
  height: number;
  boxSizing: string;
}

/* Element geometry */

/** Bounding-rect data for a DOM element. */
export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
}

/* Element descriptors */

/** Lightweight element descriptor used in tree views and breadcrumbs. */
export interface ElementSummary {
  tagName: string;
  id: string;
  classes: string[];
  selector: string;
  displayText: string;
  hasChildren: boolean;
}

/** Parent / child / sibling tree around the currently-selected element. */
export interface ElementHierarchy {
  parents: ElementSummary[];
  current: ElementSummary | null;
  children: ElementSummary[];
  siblings: ElementSummary[];
  totalChildren: number;
  totalSiblings: number;
}

/** Full element data returned by the inspector runtime. */
export interface ElementInfo {
  tagName: string;
  className: string;
  id: string;
  textContent: string;
  styles: Record<string, string>;
  boxModel: BoxModelData | null;
  rect: ElementRect;
  selector: string;
  displayText: string;
  elementPath?: string;
  hierarchy: ElementHierarchy | null;
  colors: string[];
}

/* Inspector modes & tabs */

/** Current operating mode of the inspector. */
export type InspectorMode = 'off' | 'inspect' | 'select';

/** Available detail-panel tabs. */
export type InspectorTab = 'styles' | 'text' | 'box' | 'ai' | 'tree' | 'colors' | 'layout';

/* Edits & history */

/** A single CSS property change with undo information. */
export interface StyleEdit {
  property: string;
  oldValue: string;
  newValue: string;
  timestamp: number;
}

/** A text-content change with undo information. */
export interface TextEdit {
  oldText: string;
  newText: string;
  timestamp: number;
}

/** Discriminated union for the undo / redo stack. */
export type EditHistoryEntry =
  | { kind: 'style'; edit: StyleEdit; elementSelector: string }
  | { kind: 'text'; edit: TextEdit; elementSelector: string }
  | { kind: 'delete'; elementSelector: string; elementHtml: string; timestamp: number }
  | {
      kind: 'bulk-style';
      selector: string;
      property: string;
      oldValues: Map<string, string>;
      newValue: string;
      timestamp: number;
    };

/* Bulk operations */

/** Target descriptor for bulk style operations. */
export interface BulkTarget {
  value: string;
  label: string;
  selector: string;
}

/** Accumulated bulk style change. */
export interface BulkStyleChange {
  selector: string;
  property: string;
  value: string;
}

/* Screenshot */

/** Options for the viewport screenshot capture. */
export interface ScreenshotOptions {
  width?: number;
  height?: number;
}

/* Configuration */

/** User-configurable inspector preferences (persisted to storage). */
export interface InspectorConfig {
  highlightColor: string;
  showBoxModel: boolean;
  persistPanel: boolean;
  defaultTab: InspectorTab;
}

/** Sensible defaults for {@link InspectorConfig}. */
export const DEFAULT_INSPECTOR_CONFIG: Readonly<InspectorConfig> = {
  highlightColor: 'rgba(59, 130, 246, 0.3)',
  showBoxModel: true,
  persistPanel: true,
  defaultTab: 'styles',
} as const;

/* Style property allow-list */

/** CSS properties the inspector displays and allows editing. */
export const RELEVANT_STYLE_PROPS = [
  'color',
  'background-color',
  'background',
  'font-size',
  'font-weight',
  'font-family',
  'text-align',
  'padding',
  'margin',
  'border',
  'border-radius',
  'width',
  'height',
  'display',
  'position',
  'flex-direction',
  'justify-content',
  'align-items',
  'gap',
  'box-shadow',
  'opacity',
  'overflow',
] as const;
