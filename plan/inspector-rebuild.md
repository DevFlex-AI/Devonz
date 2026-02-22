# Element Inspector — Full Rebuild Plan

> **Goal:** Build a Chrome DevTools-quality element inspector from scratch with proper architecture, type safety, extensibility, and offline support.
>
> **Approach:** Keep the proven injection mechanism (`local-filesystem.ts`), rebuild everything else with clean separation of concerns.
>
> **Commits:** Local only, no push to main until fully validated.

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────┐
│                 Inspector Store (Nanostore)           │
│  mode · selectedElement · panel · history · config   │
└───────────────┬─────────────────────────────────────┘
                │ reactive subscriptions
┌───────────────▼─────────────────────────────────────┐
│              useInspector() Hook                     │
│  toggle · select · editStyle · undo · redo          │
└───────┬───────────────────────┬─────────────────────┘
        │                       │
┌───────▼───────┐  ┌────────────▼──────────────────────┐
│ Preview.tsx   │  │      InspectorPanel (NEW)          │
│ (toggle btn   │  │  ┌─────────────────────────────┐  │
│  + iframe)    │  │  │ Tabs: Styles│Text│Box│AI│   │  │
│               │  │  │       Tree│Colors│Layout    │  │
└───────┬───────┘  │  └─────────────────────────────┘  │
        │          │  ┌─────────────────────────────┐  │
        │          │  │ Actions: Copy│Apply│Revert  │  │
        │          │  │          Delete│Undo│Redo    │  │
        │          │  └─────────────────────────────┘  │
        │          └───────────────────────────────────┘
        │ postMessage (typed protocol)
┌───────▼─────────────────────────────────────────────┐
│           Preview Iframe (User's App)                │
│  ┌──────────────────────────────────────────────┐   │
│  │     Inspector Bridge (modular scripts)        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │   │
│  │  │inspector │ │ error    │ │ screenshot   │ │   │
│  │  │-core.js  │ │-capture  │ │-capture.js   │ │   │
│  │  │          │ │.js       │ │ (bundled)    │ │   │
│  │  └──────────┘ └──────────┘ └──────────────┘ │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation (Types + Store + Message Protocol)

### 1.1 — Typed Message Protocol

**File:** `app/lib/inspector/protocol.ts`

Define a discriminated union for ALL messages between parent ↔ iframe:

```typescript
// Parent → Iframe messages
type InspectorCommand =
  | { type: 'INSPECTOR_ACTIVATE'; active: boolean }
  | { type: 'INSPECTOR_EDIT_STYLE'; property: string; value: string }
  | { type: 'INSPECTOR_EDIT_TEXT'; text: string }
  | { type: 'INSPECTOR_SELECT_BY_SELECTOR'; selector: string }
  | { type: 'INSPECTOR_REVERT' }
  | { type: 'INSPECTOR_BULK_STYLE'; selector: string; property: string; value: string }
  | { type: 'INSPECTOR_BULK_REVERT'; selector: string }
  | { type: 'INSPECTOR_COUNT_ELEMENTS'; selector: string }
  | { type: 'CAPTURE_SCREENSHOT_REQUEST'; requestId: string; options: ScreenshotOptions }

// Iframe → Parent messages
type InspectorEvent =
  | { type: 'INSPECTOR_READY' }
  | { type: 'INSPECTOR_HOVER'; elementInfo: ElementInfo }
  | { type: 'INSPECTOR_LEAVE' }
  | { type: 'INSPECTOR_CLICK'; elementInfo: ElementInfo }
  | { type: 'INSPECTOR_RESIZE'; width: number; height: number }
  | { type: 'INSPECTOR_RESIZE_END'; elementInfo: ElementInfo }
  | { type: 'INSPECTOR_EDIT_APPLIED'; property: string; value: string; success: boolean; error?: string }
  | { type: 'INSPECTOR_TEXT_APPLIED'; text: string; success: boolean; error?: string }
  | { type: 'INSPECTOR_REVERTED'; elementInfo?: ElementInfo; success: boolean; error?: string }
  | { type: 'INSPECTOR_BULK_APPLIED'; selector: string; count: number; success: boolean; error?: string }
  | { type: 'INSPECTOR_BULK_REVERTED'; selector: string; count: number; success: boolean; error?: string }
  | { type: 'INSPECTOR_ELEMENT_COUNT'; selector: string; count: number; error?: string }
  | { type: 'PREVIEW_CONSOLE_ERROR'; errorType: string; message: string; stack: string; url: string }
  | { type: 'PREVIEW_VITE_ERROR'; errorType: string; message: string; fullMessage: string; file: string; stack: string; url: string }
  | { type: 'PREVIEW_SCREENSHOT_RESPONSE'; requestId: string; dataUrl: string; isPlaceholder: boolean }

type InspectorMessage = InspectorCommand | InspectorEvent;
```

### 1.2 — Inspector Types (Enhanced)

**File:** `app/lib/inspector/types.ts`

Enhanced types with undo/redo support:

- `ElementInfo` — element data (keep existing + add `computedLayout`)
- `InspectorMode` — `'off' | 'inspect' | 'select'`
- `InspectorTab` — `'styles' | 'text' | 'box' | 'ai' | 'tree' | 'colors' | 'layout'`
- `StyleEdit` — `{ property, oldValue, newValue, timestamp }`
- `EditHistoryEntry` — for undo/redo stack
- `InspectorConfig` — user preferences (persisted)
- `BulkTarget` — bulk style target info
- `BulkStyleChange` — accumulated bulk change

### 1.3 — Inspector Store (Nanostore)

**File:** `app/lib/stores/inspector.ts`

Central store accessible from any component:

```typescript
// Core state
export const inspectorModeAtom = atom<InspectorMode>('off');
export const selectedElementAtom = atom<ElementInfo | null>(null);
export const hoveredElementAtom = atom<ElementInfo | null>(null);
export const inspectorPanelVisibleAtom = atom<boolean>(false);
export const activeTabAtom = atom<InspectorTab>('styles');

// Edit tracking
export const editHistoryAtom = atom<EditHistoryEntry[]>([]);
export const editIndexAtom = atom<number>(-1); // for undo/redo
export const pendingEditsAtom = atom<Record<string, string>>({});

// Bulk editing
export const bulkTargetAtom = atom<BulkTarget | null>(null);
export const accumulatedBulkChangesAtom = atom<BulkStyleChange[]>([]);
export const bulkAffectedCountAtom = atom<number | undefined>(undefined);

// Config (persisted to localStorage)
export const inspectorConfigAtom = atom<InspectorConfig>({
  showBoxModel: true,
  highlightColor: '#3b82f6',
  persistPanel: false,
});
```

### Tasks (Phase 1):

- [ ] 1.1: Create `app/lib/inspector/protocol.ts` — typed message unions + helpers
- [ ] 1.2: Create `app/lib/inspector/types.ts` — all inspector type definitions
- [ ] 1.3: Create `app/lib/stores/inspector.ts` — nanostore atoms + computed stores
- [ ] 1.4: Create `app/lib/inspector/index.ts` — barrel export

---

## Phase 2: Inspector Hook + Message Bridge

### 2.1 — useInspector() Hook

**File:** `app/lib/hooks/useInspector.ts`

Encapsulates all inspector logic, replaces scattered `useState` in Preview.tsx:

```typescript
export function useInspector(iframeRef: RefObject<HTMLIFrameElement | null>) {
  // Reads from inspector store
  // Sends typed messages to iframe
  // Handles incoming messages from iframe
  // Provides: toggle, selectElement, editStyle, editText, undo, redo, revert, etc.
}
```

Key methods:
- `toggle()` — activate/deactivate inspector
- `handleMessage(event: MessageEvent)` — typed message handler for ALL message types
- `editStyle(property, value)` — with undo support
- `editText(text)` — with undo support
- `undo()` / `redo()` — edit history navigation
- `revert()` — revert all changes
- `selectFromTree(selector)` — select by CSS selector
- `copyCSS()` — copy generated CSS
- `applyWithAI(changes)` — send to AI chat
- `deleteElement()` — remove element
- `bulkStyle(selector, property, value)` — bulk operations
- `bulkRevert(selector)` — bulk revert

### 2.2 — Message Bridge Utilities

**File:** `app/lib/inspector/message-bridge.ts`

Type-safe message sending/receiving:

```typescript
export function sendToIframe(iframe: HTMLIFrameElement, command: InspectorCommand): void
export function isInspectorEvent(data: unknown): data is InspectorEvent
export function createMessageHandler(handlers: Partial<InspectorEventHandlers>): (event: MessageEvent) => void
```

### Tasks (Phase 2):

- [ ] 2.1: Create `app/lib/inspector/message-bridge.ts` — typed send/receive
- [ ] 2.2: Create `app/lib/hooks/useInspector.ts` — main inspector hook
- [ ] 2.3: Create unit tests for message bridge
- [ ] 2.4: Create unit tests for useInspector hook

---

## Phase 3: Modular Iframe Scripts

Split the monolithic `inspector-script.js` into focused modules that get concatenated at build/injection time.

### 3.1 — Inspector Core (`inspector-core.js`)

Element selection, highlighting, and info capture:
- Activate/deactivate inspector mode
- Mouse hover highlighting
- Click selection with element info capture
- Element info creation (styles, box model, hierarchy, colors)
- CSS selector generation
- Element path/breadcrumb
- Resize handles

### 3.2 — Error Capture (`error-capture.js`)

Console error forwarding and Vite overlay detection:
- Console.error override with debouncing
- Global error/unhandledrejection listeners
- Vite error overlay MutationObserver
- Error pattern matching for auto-fix eligibility

### 3.3 — Screenshot Capture (`screenshot-capture.js`)

Page screenshot functionality:
- Bundle html2canvas as local dependency (no CDN)
- Screenshot request/response handling
- Placeholder generation
- Thumbnail resizing

### 3.4 — Script Bundler

**File:** `app/lib/inspector/build-inspector-script.ts`

Concatenates the modular scripts into a single IIFE for injection:

```typescript
export function buildInspectorScript(): string {
  return `(function() {
    ${inspectorCore}
    ${errorCapture}
    ${screenshotCapture}
    // Signal ready
    window.parent.postMessage({ type: 'INSPECTOR_READY' }, '*');
  })();`;
}
```

### Tasks (Phase 3):

- [ ] 3.1: Create `public/inspector/inspector-core.js` — element selection & info
- [ ] 3.2: Create `public/inspector/error-capture.js` — error forwarding
- [ ] 3.3: Create `public/inspector/screenshot-capture.js` — screenshots (bundled html2canvas)
- [ ] 3.4: Create build script to concatenate into single injectable
- [ ] 3.5: Update `local-filesystem.ts` injection to use new bundled script
- [ ] 3.6: Add tests for injection mechanism

---

## Phase 4: Inspector UI Components (Rebuild)

### 4.1 — InspectorPanel (New)

**File:** `app/components/workbench/inspector/InspectorPanel.tsx`

New directory structure for inspector UI:

```text
app/components/workbench/inspector/
├── InspectorPanel.tsx        — Main panel container + tab routing
├── InspectorHeader.tsx       — Element info display + close button
├── InspectorTabs.tsx         — Tab bar component
├── tabs/
│   ├── StylesTab.tsx         — CSS properties editor with color pickers
│   ├── TextTab.tsx           — Text content editor
│   ├── BoxModelTab.tsx       — Visual box model editor
│   ├── AITab.tsx             — AI quick actions
│   ├── TreeTab.tsx           — Element tree navigator
│   ├── ColorsTab.tsx         — Color palette
│   └── LayoutTab.tsx         — NEW: Flexbox/grid layout visualizer
├── actions/
│   ├── InspectorActions.tsx  — Footer action buttons
│   ├── BulkActions.tsx       — Bulk CSS apply/revert
│   └── UndoRedoBar.tsx       — Undo/redo controls
├── shared/
│   ├── StyleInput.tsx        — Single style property input with color picker
│   ├── ColorSwatch.tsx       — Color swatch component
│   └── SelectorBadge.tsx     — Element selector display
└── index.ts                  — Barrel export
```

### 4.2 — Updated Preview.tsx

Remove all inspector state and logic from Preview.tsx:
- Replace 15+ `useState` calls with `useInspector()` hook
- Remove inline message handler
- Keep only the toggle button and iframe ref connection

### 4.3 — Keyboard Shortcuts

- `Ctrl+Shift+C` / `Cmd+Shift+C` — Toggle inspector mode
- `Escape` — Close inspector panel / deactivate inspector
- `Ctrl+Z` / `Cmd+Z` — Undo style change
- `Ctrl+Shift+Z` / `Cmd+Shift+Z` — Redo style change
- `Delete` — Delete selected element (with confirmation)
- `Tab` — Cycle through inspector tabs

### Tasks (Phase 4):

- [ ] 4.1: Create inspector component directory structure
- [ ] 4.2: Build InspectorPanel container + InspectorHeader
- [ ] 4.3: Build InspectorTabs component
- [ ] 4.4: Build StylesTab with enhanced color picker
- [ ] 4.5: Build TextTab
- [ ] 4.6: Build BoxModelTab (keep existing BoxModelEditor logic)
- [ ] 4.7: Build AITab (keep existing AiQuickActions logic)
- [ ] 4.8: Build TreeTab (keep existing ElementTreeNavigator logic)
- [ ] 4.9: Build ColorsTab (keep existing PageColorPalette logic)
- [ ] 4.10: Build LayoutTab (NEW — flexbox/grid visualizer)
- [ ] 4.11: Build InspectorActions + BulkActions + UndoRedoBar
- [ ] 4.12: Build shared components (StyleInput, ColorSwatch, SelectorBadge)
- [ ] 4.13: Refactor Preview.tsx — remove inspector state, use hook
- [ ] 4.14: Add keyboard shortcuts
- [ ] 4.15: Create tests for key components

---

## Phase 5: Integration + Polish

### 5.1 — Wire everything together
- Connect new inspector components to store
- Connect useInspector hook to Preview iframe
- Update Workbench.client.tsx imports
- Ensure device mode + inspector mode coexist

### 5.2 — Offline Support
- Bundle html2canvas as npm dependency
- Remove CDN script loading
- Serve from project's node_modules or inline

### 5.3 — Performance Optimization
- Debounce hover events (16ms — one frame)
- Cache getComputedStyle results per element
- Lazy-load inspector panel components
- Remove all console.log from production inspector script
- Minimize getComputedStyle calls (single call, extract all props)

### 5.4 — Accessibility
- ARIA labels on all inspector controls
- Focus management when panel opens/closes
- Keyboard navigation within tabs
- Screen reader announcements for element selection
- High contrast mode support

### 5.5 — Remove Old Code
- Delete old `InspectorPanel.tsx`
- Delete old `inspector-types.ts`
- Delete old `inspector-script.js` (replaced by modular scripts)
- Clean up old imports
- Remove unused components if fully replaced

### Tasks (Phase 5):

- [ ] 5.1: Wire all components together
- [ ] 5.2: Bundle html2canvas as dependency
- [ ] 5.3: Performance optimization pass
- [ ] 5.4: Accessibility audit + fixes
- [ ] 5.5: Remove old inspector code
- [ ] 5.6: Full test suite (unit + integration)
- [ ] 5.7: Manual QA testing
- [ ] 5.8: Documentation update

---

## Phase 6: Advanced Features (Future)

These can be done in follow-up sessions:

- [ ] 6.1: Multi-element selection (Shift+Click)
- [ ] 6.2: CSS Grid / Flexbox visual overlay
- [ ] 6.3: Accessibility tree view tab
- [ ] 6.4: Element screenshot (single element capture)
- [ ] 6.5: Style diff view (current vs original)
- [ ] 6.6: CSS variable inspector
- [ ] 6.7: Animation timeline
- [ ] 6.8: Responsive breakpoint tester within inspector

---

## File Impact Summary

### New Files (Create)
```
app/lib/inspector/
├── protocol.ts
├── types.ts
├── message-bridge.ts
├── index.ts
└── build-inspector-script.ts (optional)

app/lib/stores/inspector.ts

app/lib/hooks/useInspector.ts

app/components/workbench/inspector/
├── InspectorPanel.tsx
├── InspectorHeader.tsx
├── InspectorTabs.tsx
├── tabs/
│   ├── StylesTab.tsx
│   ├── TextTab.tsx
│   ├── BoxModelTab.tsx
│   ├── AITab.tsx
│   ├── TreeTab.tsx
│   ├── ColorsTab.tsx
│   └── LayoutTab.tsx
├── actions/
│   ├── InspectorActions.tsx
│   ├── BulkActions.tsx
│   └── UndoRedoBar.tsx
├── shared/
│   ├── StyleInput.tsx
│   ├── ColorSwatch.tsx
│   └── SelectorBadge.tsx
└── index.ts

public/inspector/
├── inspector-core.js
├── error-capture.js
└── screenshot-capture.js
```

### Modified Files
```
app/components/workbench/Preview.tsx  — Heavy refactor (remove ~300 lines of inspector state)
app/lib/runtime/local-filesystem.ts   — Update injection to use new script
```

### Deleted Files (Phase 5.5)
```
app/components/workbench/InspectorPanel.tsx (old)
app/components/workbench/inspector-types.ts (old)
public/inspector-script.js (old — replaced by modular scripts)
```

### Preserved Files (No Changes)
```
app/components/workbench/BoxModelEditor.tsx     — Keep, import into new tab
app/components/workbench/AIQuickActions.tsx      — Keep, import into new tab
app/components/workbench/ElementTreeNavigator.tsx — Keep, import into new tab
app/components/workbench/PageColorPalette.tsx    — Keep, import into new tab
app/components/workbench/BulkStyleSelector.tsx   — Keep, import into new tab
```

---

## Commit Strategy (Local Only)

| Commit | Content |
|--------|---------|
| `feat(inspector): add typed message protocol and inspector types` | Phase 1 |
| `feat(inspector): add inspector store (nanostore)` | Phase 1 |
| `feat(inspector): add useInspector hook and message bridge` | Phase 2 |
| `refactor(inspector): split inspector-script into modular components` | Phase 3 |
| `feat(inspector): rebuild inspector UI components` | Phase 4 |
| `refactor(inspector): remove inspector state from Preview.tsx` | Phase 4 |
| `feat(inspector): add keyboard shortcuts` | Phase 4 |
| `feat(inspector): add undo/redo support` | Phase 4 |
| `chore(inspector): bundle html2canvas, remove CDN dependency` | Phase 5 |
| `perf(inspector): optimize getComputedStyle and hover debouncing` | Phase 5 |
| `fix(inspector): accessibility improvements` | Phase 5 |
| `chore(inspector): remove old inspector code` | Phase 5 |
| `test(inspector): add full test suite` | Phase 5 |

---

## Success Criteria

- [ ] Inspector toggle activates/deactivates cleanly with no state leaks
- [ ] Element selection works on all element types (text, images, buttons, inputs, SVGs)
- [ ] Live style editing with instant preview feedback
- [ ] Undo/redo works for all edits (styles + text)
- [ ] Bulk style changes apply to all matching elements
- [ ] AI integration sends correct element context
- [ ] Keyboard shortcuts work (Ctrl+Shift+C, Escape, Ctrl+Z)
- [ ] Inspector panel is accessible (ARIA labels, keyboard navigation)
- [ ] No CDN dependencies — works fully offline
- [ ] All 16+ message types handled with type safety
- [ ] Preview.tsx reduced by ~300 lines
- [ ] All tests pass
- [ ] No console.log in production
- [ ] Dark theme styling consistent with app palette
