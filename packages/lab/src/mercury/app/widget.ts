import {
  CodeCell,
  MarkdownCell,
  RawCell,
  type Cell,
  type CodeCellModel,
  type ICellModel,
  type MarkdownCellModel,
  type RawCellModel
} from '@jupyterlab/cells';
import { Message } from '@lumino/messaging';
import { Signal } from '@lumino/signaling';
import { Panel, SplitPanel, Widget } from '@lumino/widgets';
import { CellItemWidget } from './item/widget';
import { AppModel, MERCURY_MIMETYPE, type IWidgetUpdate } from './model';
import { codeCellExecute } from '../../executor/codecell';
import {
  getWidgetManager,
  resolveIpyModel,
  getWidgetModelIdsFromCell
} from './ipyWidgetsHelpers';

import { removeElements } from './domHelpers';

/**
 * Default layout ratios and colors.
 */
const SIDEBAR_RATIO = 0.2; // 20% width
const MAIN_RATIO = 1 - SIDEBAR_RATIO; // 80% width
const TOP_RATIO = 0.85; // 85% height
const BOTTOM_RATIO = 1 - TOP_RATIO; // 15% height
const DEFAULT_SIDEBAR_BG = '#f8f9fa';

/**
 * Minimal page-config structure we actually consume.
 */
interface IPageConfigLike {
  baseUrl?: string;
  showCode?: boolean;
  theme?: {
    sidebar_background_color?: string;
  };
}

/**
 * Read the inline Jupyter page config JSON.
 * Throws if the element does not exist or contains invalid JSON.
 */
function getPageConfig(): IPageConfigLike {
  const el = document.getElementById('jupyter-config-data');
  if (!el) {
    throw new Error('Page config script not found');
  }

  try {
    return JSON.parse(el.textContent || '{}') as IPageConfigLike;
  } catch (err) {
    console.warn('Invalid page config JSON:', err);
    return {};
  }
}

/**
 * Fetch theme overrides.
 * The `url` parameter is accepted for future flexibility.
 */
async function fetchTheme(_url: string) {
  try {
    const response = await fetch('http://localhost:8888/mercury/api/theme');
    if (!response.ok) {
      throw new Error(`Theme API error: ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.warn('Failed to fetch theme overrides', err);
    return {};
  }
}

/**
 * Main application widget that lays out notebook cells into
 * a sidebar (left), a main area (top-right), and a bottom panel (right).
 *
 * Layout sketch:
 *
 * +-------------------------------------------------------+
 * | mercury-main-panel                                    |
 * |                                                       |
 * |  +--------+---------------------------------------+   |
 * |  |        |      mercury-right-split-panel        |   |
 * |  |  Left  |   +-------------------------------+   |   |
 * |  | Panel  |   |      Right Top (Main)         |   |   |
 * |  | (20%)  |   |        (85% height)           |   |   |
 * |  |        |   +-------------------------------+   |   |
 * |  |        |   |    Right Bottom (Chat Input)  |   |   |
 * |  |        |   |         (15% height)          |   |   |
 * |  +--------+---+-------------------------------+---+   |
 * +-------------------------------------------------------+
 */
export class AppWidget extends Panel {
  // Layout containers
  private _split: SplitPanel; // left-right
  private _left: Panel; // sidebar
  private _rightSplit: SplitPanel; // top-bottom
  private _rightTop: Panel; // main
  private _rightBottom: Panel; // chat/bottom

  // State
  private _showCode = false;
  private _model: AppModel;
  private _cellItems: CellItemWidget[] = [];

  // Mapping: cellId -> notebook index to keep stable ordering for inline widgets.
  private _cellOrder = new Map<string, number>();

  // Visibility bookkeeping to avoid redundant size resets.
  private _lastLeftVisible = false;
  private _lastBottomVisible = false;

  constructor(model: AppModel) {
    super();

    const pageConfig = getPageConfig();
    void fetchTheme(pageConfig.baseUrl || '');

    this._showCode = !!pageConfig.showCode;
    this._model = model;

    this.id = 'mercury-main-panel';
    this.addClass('mercury-main-panel');

    // Build static layout containers
    this._left = this.createSidebar(pageConfig);
    const { rightSplit, rightTop, rightBottom } = this.createRightPanels();
    this._rightSplit = rightSplit;
    this._rightTop = rightTop;
    this._rightBottom = rightBottom;
    this._split = this.createMainSplit(this._left, this._rightSplit);

    // Add root container to this widget
    this.addWidget(this._split);

    // Sidebar toggle buttons
    this.installSidebarToggles();

    // When the model is ready, populate all cell widgets
    this._model.ready.connect(() => this.initializeCells());

    // When a mercury widget is added (from outputs), try to place it
    this._model.mercuryWidgetAdded.connect((_, { cellId, position }) => {
      const item = this._cellItems.find(w => w.cellId === cellId);
      if (item && item.child instanceof CodeCell) {
        this.placeCell(item.child, position);
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ────────────────────────────────────────────────────────────────────────────

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);

    // Keep browser context menu; block JupyterLab/Lumino menu only.
    this.node.addEventListener(
      'contextmenu',
      (event: MouseEvent) => event.stopImmediatePropagation(),
      true
    );
    this._left.node.addEventListener('contextmenu', e => e.preventDefault());

    // Set split sizes after first paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._split.setRelativeSizes([SIDEBAR_RATIO, MAIN_RATIO]);
        this._rightSplit.setRelativeSizes([TOP_RATIO, BOTTOM_RATIO]);
      });
    });
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    try {
      this._model?.ready?.disconnect(this.initializeCells, this);
      this._model?.widgetUpdated?.disconnect(this.onWidgetUpdate, this);
      this._model?.mercuryWidgetAdded?.disconnect(undefined as any, this);
      this._model?.cells?.changed?.disconnect(undefined as any, this);
    } catch {
      /* empty */
    }

    for (const item of this._cellItems) {
      try {
        item.child?.model?.stateChanged?.disconnect(undefined as any, this);
      } catch {
        /* empty */
      }
    }
    this._cellItems = [];
    this._left = null as any;
    this._rightTop = null as any;
    this._rightBottom = null as any;
    this._rightSplit = null as any;
    this._split = null as any;

    Signal.clearData(this);
    super.dispose();
  }
  // ────────────────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────────────────

  get cellWidgets(): CellItemWidget[] {
    return this._cellItems;
  }

  /**
   * Place a code cell's output area into the appropriate panel
   * based on its MERCURY_MIMETYPE metadata or an explicit override.
   * Keeps widgets ordered by notebook order in ALL targets.
   */
  placeCell(
    cell: CodeCell,
    posOverride?: 'sidebar' | 'bottom' | 'inline' | string
  ): void {
    if (this.isDisposed) {
      return;
    }

    const oa = cell.outputArea;

    // Determine target position
    let position = posOverride;
    if (!position) {
      for (let i = 0; i < oa.model.length; i++) {
        const output = oa.model.get(i);
        const data = output.data as Record<string, unknown> | undefined;
        if (data && MERCURY_MIMETYPE in data) {
          try {
            const meta = JSON.parse(String(data[MERCURY_MIMETYPE]));
            position = meta.position || 'sidebar';
          } catch {
            position = 'sidebar';
          }
          break;
        }
      }
    }

    // Map to target panel (default to inline/rightTop)
    const target: Panel =
      position === 'sidebar'
        ? this._left
        : position === 'bottom'
          ? this._rightBottom
          : this._rightTop;

    // Detach from old parent (if any) so we can reinsert in order
    if (oa.parent?.layout && 'removeWidget' in oa.parent.layout) {
      (oa.parent.layout as any).removeWidget(oa);
    }

    // Compute stable insertion index from notebook order
    const order = this._cellOrder.get(cell.model.id);
    const idx = this.insertionIndexFor(target, order);

    // Insert in order if possible; otherwise append
    if (typeof (target as any).insertWidget === 'function') {
      target.insertWidget(idx, oa);
    } else {
      target.addWidget(oa);
    }

    // Update visibility/sizing of panels after placement
    this.updatePanelVisibility();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Initialization
  // ────────────────────────────────────────────────────────────────────────────

  private initializeCells(): void {
    const cells = this._model.cells;

    this.rebuildCellOrder();

    for (let i = 0; i < cells.length; i++) {
      const model = cells.get(i);
      const item = this.createCell(model);
      this._cellItems.push(item);

      if (item.child instanceof CodeCell) {
        const code = item.child;
        const oa = code.outputArea;

        if (this._showCode) {
          // Show cell input; hide its outputs in the code view
          this._rightTop.addWidget(code);
          const outputEl = code.node.querySelector<HTMLElement>('.jp-Cell-outputWrapper');
          if (outputEl) outputEl.style.display = 'none';
        }

        if (item.sidebar) {
          this._left.addWidget(oa);
        } else if (item.bottom) {
          this._rightBottom.addWidget(oa);
        } else {
          this._rightTop.addWidget(oa);
        }
      } else {
        // Non-code cells go inline in the main area
        this._rightTop.addWidget(item.child);
      }
    }

    // React to per-widget updates (may trigger downstream re-execution)
    this._model.widgetUpdated.connect(this.onWidgetUpdate, this);

    // React to structural changes in the cell list
    this._model.cells.changed.connect((_, args) => this.onCellsChanged(args));

    this.updatePanelVisibility();
    void this.checkWidgetModels();
  }

  /**
   * Create a CellItemWidget for a given ICellModel.
   */
  private createCell(cellModel: ICellModel): CellItemWidget {
    let widget: Cell;
    let sidebar = false;
    let bottom = false;

    switch (cellModel.type) {
      case 'code': {
        const cell = new CodeCell({
          model: cellModel as CodeCellModel,
          rendermime: this._model.rendermime,
          contentFactory: this._model.contentFactory,
          editorConfig: this._model.editorConfig.code
        });
        cell.readOnly = true;

        // Look for MERCURY metadata to decide placement
        for (let i = 0; i < cell.outputArea.model.length; i++) {
          const output = cell.outputArea.model.get(i);
          const data = output.data as Record<string, unknown> | undefined;
          if (data && MERCURY_MIMETYPE in data) {
            try {
              const meta = JSON.parse(String(data[MERCURY_MIMETYPE]));
              const pos = meta.position || 'sidebar';
              sidebar = pos === 'sidebar';
              bottom = pos === 'bottom';
            } catch {
              sidebar = true;
              bottom = false;
            }
            break;
          }
        }
        widget = cell;
        break;
      }

      case 'markdown': {
        const cell = new MarkdownCell({
          model: cellModel as MarkdownCellModel,
          rendermime: this._model.rendermime,
          contentFactory: this._model.contentFactory,
          editorConfig: this._model.editorConfig.markdown
        });
        cell.inputHidden = false;
        cell.rendered = true;
        removeElements(cell.node, 'jp-Collapser');
        removeElements(cell.node, 'jp-InputPrompt');
        widget = cell;
        break;
      }

      default: {
        const cell = new RawCell({
          model: cellModel as RawCellModel,
          contentFactory: this._model.contentFactory,
          editorConfig: this._model.editorConfig.raw
        });
        cell.inputHidden = false;
        removeElements(cell.node, 'jp-Collapser');
        removeElements(cell.node, 'jp-InputPrompt');
        widget = cell;
        break;
      }
    }

    // executionCount updates when an execution finishes (reply received)
    widget.model.stateChanged.connect((_, args) => {
      if (args.name === 'executionCount') {
        this.updatePanelVisibility();
      }
    });

    return new CellItemWidget(widget, {
      cellId: cellModel.id,
      cellWidget: widget,
      sidebar,
      bottom
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Cell list / ordering utilities
  // ────────────────────────────────────────────────────────────────────────────

  private rebuildCellOrder(): void {
    const cells = this._model.cells;
    this._cellOrder.clear();
    for (let i = 0; i < cells.length; i++) {
      this._cellOrder.set(cells.get(i).id, i);
    }
  }

  private panelWidgets(panel: Panel | null | undefined): ReadonlyArray<Widget> {
    // po dispose panel.layout === null → zwróć pustą listę
    return ((panel as any)?.layout?.widgets ?? []) as ReadonlyArray<Widget>;
  }
  /**
   * Find insertion index inside `container` so that widgets maintain notebook order.
   * It works for:
   *  - markdown/raw cell widgets (ci.child === w)
   *  - code *output areas* (ci.child instanceof CodeCell && ci.child.outputArea === w)
   *  - (optionally) code input widgets when showCode=true (ci.child === w)
   */
  private insertionIndexFor(container: Panel, targetOrder?: number): number {
    if (targetOrder === undefined) {
      return this.panelWidgets(container).length;
    }

    let idx = 0;
    for (const w of this.panelWidgets(container)) {
      const ci = this._cellItems.find(
        c =>
          c.child === w ||
          (c.child instanceof CodeCell &&
            (c.child as CodeCell).outputArea === w)
      );
      if (!ci) {
        continue;
      }

      const otherOrder = this._cellOrder.get(ci.child.model.id);
      if (otherOrder !== undefined && otherOrder < targetOrder) {
        idx++;
      }
    }
    return idx;
  }

  // private indexFor(cell: CodeCell): number {
  //   const id = cell.model.id;
  //   const order = this._cellOrder.get(id);

  //   if (order === undefined) return this._rightTop.widgets.length; // append

  //   let idx = 0;
  //   for (const w of this._rightTop.widgets) {
  //     const widgetCell = this._cellItems.find(
  //       ci => ci.child instanceof CodeCell && (ci.child as CodeCell).outputArea === w
  //     );
  //     if (!widgetCell) continue;

  //     const otherId = widgetCell.child.model.id;
  //     const otherOrder = this._cellOrder.get(otherId);
  //     if (otherOrder !== undefined && otherOrder < order) idx++;
  //   }
  //   return idx;
  // }

  // private inlineIndexForOrder(order: number, container: Panel): number {
  //   let idx = 0;
  //   for (const w of container.widgets) {
  //     const ci = this._cellItems.find(
  //       c =>
  //         c.child === w ||
  //         (c.child instanceof CodeCell && (c.child as CodeCell).outputArea === w)
  //     );
  //     if (!ci) {
  //       continue;
  //     }
  //     const otherOrder = this._cellOrder.get(ci.child.model.id);
  //     if (otherOrder !== undefined && otherOrder < order) {
  //       idx++;
  //     }
  //   }
  //   return idx;
  // }

  // ────────────────────────────────────────────────────────────────────────────
  // Model reactions
  // ────────────────────────────────────────────────────────────────────────────

  private onCellsChanged(args: any): void {
    if (this.isDisposed) {
      return;
    }
    switch (args.type) {
      case 'add': {
        this.rebuildCellOrder();
        let insertAt = args.newIndex;
        for (const m of args.newValues as ICellModel[]) {
          const item = this.createCell(m);
          this._cellItems.splice(insertAt, 0, item);
          this.insertItem(item, insertAt);
          insertAt++;
        }
        this.rebuildCellOrder();
        this.updatePanelVisibility();
        void this.checkWidgetModels();
        break;
      }

      case 'remove': {
        for (let i = 0; i < (args.oldValues as ICellModel[]).length; i++) {
          const removed = this._cellItems.splice(args.oldIndex, 1)[0];
          if (removed) {
            this.disposeItem(removed);
          }
        }
        this.rebuildCellOrder();
        this.updatePanelVisibility();
        break;
      }

      case 'move': {
        const [moved] = this._cellItems.splice(args.oldIndex, 1);
        this._cellItems.splice(args.newIndex, 0, moved);
        this.rebuildCellOrder();

        if (moved.child instanceof CodeCell) {
          const cell = moved.child as CodeCell;
          const oa = cell.outputArea;
          if (oa.parent) {
            Widget.detach(oa);
          }

          const target = moved.sidebar
            ? this._left
            : moved.bottom
              ? this._rightBottom
              : this._rightTop;

          const order = this._cellOrder.get(cell.model.id);
          const idx = this.insertionIndexFor(target, order);
          // const idx = target === this._rightTop
          //   ? this.indexFor(cell)
          //   : this.inlineIndexForOrder(
          //     this._cellOrder.get(cell.model.id)!,
          //     target
          //   );
          target.insertWidget(idx, oa);
        } else {
          const w = moved.child;
          if (w.parent) {
            Widget.detach(w);
          }
          // const idx = this.inlineIndexForOrder(
          //   this._cellOrder.get(w.model.id)!,
          //   this._rightTop
          // );
          const order = this._cellOrder.get(w.model.id);
          const idx = this.insertionIndexFor(this._rightTop, order);
          this._rightTop.insertWidget(idx, w);
        }

        this.updatePanelVisibility();
        break;
      }

      case 'set': {
        const item = this._cellItems[args.newIndex];
        if (item?.child instanceof CodeCell) {
          this.placeCell(item.child as CodeCell);
        }
        this.updatePanelVisibility();
        break;
      }

      default: {
        this.rebuildCellOrder();
        this.updatePanelVisibility();
      }
    }
  }

  private onWidgetUpdate = (_model: AppModel, update: IWidgetUpdate) => {
    if (this.isDisposed) {
      return;
    }
    if (!update.cellModelId) {
      return;
    }

    const cells = this._model.cells;
    let updatedIndex = -1;
    for (let i = 0; i < cells.length; i++) {
      if (cells.get(i).id === update.cellModelId) {
        updatedIndex = i;
        break;
      }
    }
    if (updatedIndex === -1) {
      return;
    }

    // Execute all code cells _below_ the updated cell
    for (let i = updatedIndex + 1; i < cells.length; i++) {
      const cellModel = cells.get(i);
      if (cellModel.type === 'code') {
        const cellWidget = this._cellItems.find(w => w.cellId === cellModel.id);
        if (cellWidget && cellWidget.child instanceof CodeCell) {
          codeCellExecute(
            cellWidget.child as CodeCell,
            this._model.context.sessionContext,
            {
              deletedCells: this._model.context.model?.deletedCells ?? []
            }
          );
        }
      }
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Insert / dispose helpers
  // ────────────────────────────────────────────────────────────────────────────

  private insertItem(item: CellItemWidget, _modelIndex: number): void {
    if (this.isDisposed) {
      return;
    }
    const order = this._cellOrder.get(item.child.model.id);

    if (item.child instanceof CodeCell) {
      const cell = item.child as CodeCell;
      const oa = cell.outputArea;

      if (this._showCode) {
        this._rightTop.addWidget(cell);
        const outputEl = cell.node.querySelector<HTMLElement>('.jp-Cell-outputWrapper');
        if (outputEl) outputEl.style.display = 'none';
      }

      const target = item.sidebar
        ? this._left
        : item.bottom
          ? this._rightBottom
          : this._rightTop;

      const idx = this.insertionIndexFor(target, order);
      target.insertWidget(idx, oa);
    } else {
      // markdown / raw -> zawsze do rightTop, zgodnie z kolejnością notatnika
      const idx = this.insertionIndexFor(this._rightTop, order);
      this._rightTop.insertWidget(idx, item.child);
    }
  }

  private disposeItem(item: CellItemWidget): void {
    if (item.child instanceof CodeCell) {
      item.child.outputArea.dispose();
      item.child.dispose();
    } else {
      item.child.dispose();
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ipywidgets utilities
  // ────────────────────────────────────────────────────────────────────────────

  private reexecuteAllCodeCells(): void {
    const cells = this._model.cells;
    for (let i = 0; i < cells.length; i++) {
      const m = cells.get(i);
      if (m.type !== 'code') {
        continue;
      }

      const item = this._cellItems.find(w => w.cellId === m.id);
      if (item && item.child instanceof CodeCell) {
        codeCellExecute(
          item.child as CodeCell,
          this._model.context.sessionContext,
          {
            deletedCells: this._model.context.model?.deletedCells ?? []
          }
        );
      }
    }
  }

  private async checkWidgetModels(): Promise<void> {
    if (this.isDisposed) {
      return;
    }
    const manager = await getWidgetManager(this._model.rendermime);
    if (!manager) {
      console.warn('No widget manager - cannot check widget models');
      return;
    }

    let totalWithId = 0;
    let foundCount = 0;
    let hasCodeCells = false;
    let allOutputsEmpty = true;

    for (const item of this._cellItems) {
      if (!(item.child instanceof CodeCell)) {
        continue;
      }

      hasCodeCells = true;

      // check if outputs exist
      if (item.child.model.outputs.length > 0) {
        allOutputsEmpty = false;
      }

      const ids = getWidgetModelIdsFromCell(item.child);
      if (ids.length === 0) {
        continue;
      }

      totalWithId += ids.length;
      for (const id of ids) {
        const model = await resolveIpyModel(manager, id);
        if (model && !!(model as any).comm_live) {
          foundCount++;
        }
      }
    }

    // condition 1: we had widget ids but none were alive
    const noLiveModels = totalWithId > 0 && foundCount === 0;

    // condition 2: there are code cells but all outputs are empty
    const emptyOutputs = hasCodeCells && allOutputsEmpty;

    if (noLiveModels || emptyOutputs) {
      this.reexecuteAllCodeCells();
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Layout helpers
  // ────────────────────────────────────────────────────────────────────────────

  private createSidebar(pageConfig: IPageConfigLike): Panel {
    const left = new Panel();
    left.addClass('mercury-left-panel');
    left.node.style.backgroundColor = pageConfig?.theme?.sidebar_background_color ?? DEFAULT_SIDEBAR_BG;
    return left;
  }

  private createRightPanels() {
    const rightTop = new Panel();
    rightTop.addClass('mercury-right-top-panel');

    const rightBottom = new Panel();
    rightBottom.addClass('mercury-right-bottom-panel');

    const rightSplit = new SplitPanel();
    rightSplit.orientation = 'vertical';
    rightSplit.addClass('mercury-right-split-panel');
    rightSplit.addWidget(rightTop);
    rightSplit.addWidget(rightBottom);

    return { rightSplit, rightTop, rightBottom } as const;
  }

  private createMainSplit(left: Panel, right: SplitPanel): SplitPanel {
    const split = new SplitPanel();
    split.orientation = 'horizontal';
    split.addClass('mercury-split-panel');
    split.addWidget(left);
    split.addWidget(right);
    split.node.style.height = '100%';
    split.node.style.width = '100%';
    return split;
  }

  private installSidebarToggles(): void {
    const collapseBtn = document.createElement('button');
    collapseBtn.innerHTML = '«';
    collapseBtn.className = 'mercury-sidebar-toggle mercury-sidebar-collapse';
    collapseBtn.title = 'Hide sidebar';
    this._left.node.appendChild(collapseBtn);

    const expandBtn = document.createElement('button');
    expandBtn.innerHTML = '»';
    expandBtn.className = 'mercury-sidebar-toggle mercury-sidebar-expand';
    expandBtn.title = 'Show sidebar';
    expandBtn.style.display = 'none';
    this.node.appendChild(expandBtn);

    collapseBtn.onclick = () => {
      this._left.hide();
      this._split.setRelativeSizes([0, 1]);
      collapseBtn.style.display = 'none';
      expandBtn.style.display = '';
    };

    expandBtn.onclick = () => {
      this._left.show();
      this._split.setRelativeSizes([SIDEBAR_RATIO, MAIN_RATIO]);
      collapseBtn.style.display = '';
      expandBtn.style.display = 'none';
    };
  }

  private updatePanelVisibility(): void {
    if (this.isDisposed) {
      return;
    }
    const leftHasContent = this.panelWidgets(this._left).some(
      w => (w as any).model?.length > 0
    );
    const bottomHasContent = this.panelWidgets(this._rightBottom).some(
      w => (w as any).model?.length > 0
    );

    if (!leftHasContent) {
      this._left?.hide();
      if (this._lastLeftVisible !== false) {
        this._split?.setRelativeSizes([0, 1]);
      }
    } else {
      this._left?.show();
      if (this._lastLeftVisible !== true) {
        this._split?.setRelativeSizes([SIDEBAR_RATIO, MAIN_RATIO]);
      }
    }
    this._lastLeftVisible = leftHasContent;

    if (!bottomHasContent) {
      this._rightBottom?.hide();
      if (this._lastBottomVisible !== false) {
        this._rightSplit?.setRelativeSizes([1, 0]);
      }
    } else {
      this._rightBottom?.show();
      if (this._lastBottomVisible !== true) {
        this._rightSplit?.setRelativeSizes([TOP_RATIO, BOTTOM_RATIO]);
      }
    }
    this._lastBottomVisible = bottomHasContent;
  }
}
