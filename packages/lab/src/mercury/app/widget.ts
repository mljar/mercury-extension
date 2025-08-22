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
import { Panel, SplitPanel } from '@lumino/widgets';
import { CellItemWidget } from './item/widget';
import { AppModel, MERCURY_MIMETYPE, type IWidgetUpdate } from './model';
import { codeCellExecute } from '../../executor/codecell';

function getPageConfig(): any {
  const el = document.getElementById('jupyter-config-data');
  if (!el) {
    throw new Error('Page config script not found');
  }
  // Parse its JSON content
  return JSON.parse(el.textContent || '{}');
}

async function fetchTheme(url: string) {
  console.log('fetch theme', url);
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

export class AppWidget extends Panel {
  private _showCode = false;
  private _split: SplitPanel;
  private _left: Panel;
  private _rightSplit: SplitPanel;
  private _rightTop: Panel;
  private _rightBottom: Panel;

  // +-------------------------------------------------------+
  // | mercury-main-panel                                    |
  // |                                                       |
  // |  +--------+---------------------------------------+   |
  // |  |        |      mercury-right-split-panel        |   |
  // |  |  Left  |   +-------------------------------+   |   |
  // |  | Panel  |   |      Right Top (Main)         |   |   |
  // |  | (20%)  |   |        (85% height)           |   |   |
  // |  |        |   +-------------------------------+   |   |
  // |  |        |   |    Right Bottom (Chat Input)  |   |   |
  // |  |        |   |         (15% height)          |   |   |
  // |  +--------+---+-------------------------------+---+   |
  // +-------------------------------------------------------+

  constructor(model: AppModel) {
    super();

    const pageConfig = getPageConfig();

    fetchTheme(pageConfig.baseUrl);

    this._showCode = pageConfig.showCode ?? false;

    this.id = 'mercury-main-panel';
    this.addClass('mercury-main-panel');
    this._model = model;

    this._model.ready.connect(() => {
      this._initCellItems();
    });

    // Create panels
    this._left = new Panel();
    this._left.addClass('mercury-left-panel');
    this._left.node.style.backgroundColor =
      pageConfig?.theme?.sidebar_background_color ?? '#f8f9fa';

    this._rightTop = new Panel();
    this._rightTop.addClass('mercury-right-top-panel'); // For main content

    this._rightBottom = new Panel();
    this._rightBottom.addClass('mercury-right-bottom-panel'); // For chat input

    this._rightSplit = new SplitPanel();
    this._rightSplit.orientation = 'vertical';
    this._rightSplit.addClass('mercury-right-split-panel');

    // Order: Top first (main), Bottom second (chat)
    this._rightSplit.addWidget(this._rightTop);
    this._rightSplit.addWidget(this._rightBottom);
    this._rightSplit.addClass('mercury-split-panel'); // add red split border

    // Create the main SplitPanel
    this._split = new SplitPanel();
    this._split.orientation = 'horizontal'; // left-right split
    this._split.addClass('mercury-split-panel');

    // Add the left and right panels to the split panel
    this._split.addWidget(this._left);
    this._split.addWidget(this._rightSplit);

    // Style the SplitPanel
    this._split.node.style.height = '100%';
    this._split.node.style.width = '100%';

    // Add the split panel to this main panel
    this.addWidget(this._split);

    // Collapse button
    const collapseBtn = document.createElement('button');
    collapseBtn.innerHTML = '«';
    collapseBtn.className = 'mercury-sidebar-toggle mercury-sidebar-collapse';
    collapseBtn.title = 'Hide sidebar';
    this._left.node.appendChild(collapseBtn); // Attach to sidebar

    // Expand button (starts hidden)
    const expandBtn = document.createElement('button');
    expandBtn.innerHTML = '»';
    expandBtn.className = 'mercury-sidebar-toggle mercury-sidebar-expand';
    expandBtn.title = 'Show sidebar';
    expandBtn.style.display = 'none';
    this.node.appendChild(expandBtn); // Attach to main container

    // Toggle logic
    collapseBtn.onclick = () => {
      this._left.hide();
      this._split.setRelativeSizes([0, 1]);
      collapseBtn.style.display = 'none';
      expandBtn.style.display = '';
    };

    expandBtn.onclick = () => {
      this._left.show();
      this._split.setRelativeSizes([0.2, 0.8]);
      collapseBtn.style.display = '';
      expandBtn.style.display = 'none';
    };

    this._model.mercuryWidgetAdded.connect((_, { cellId, position }) => {
      console.log('widget added');
      const cellWidget = this._cellItems.find(w => w.cellId === cellId);
      if (cellWidget && cellWidget.child instanceof CodeCell) {
        console.log('placeCell', cellId, position);
        this.placeCell(cellWidget.child, position);
      }
    });
  }

  placeCell(cell: CodeCell, posOverride?: string): void {
    console.log('do place cell');
    const oa = cell.outputArea;

    let sidebar = false;
    let bottom = false;
    let pos = posOverride;

    if (!pos) {
      for (let i = 0; i < oa.model.length; i++) {
        const output = oa.model.get(i);
        if (output.data && MERCURY_MIMETYPE in output.data) {
          try {
            const meta = JSON.parse(output.data[MERCURY_MIMETYPE] as string);
            pos = meta.position || 'sidebar';
          } catch {
            pos = 'sidebar';
          }
          break;
        }
      }
    }

    sidebar = pos === 'sidebar';
    bottom = pos === 'bottom';

    if (oa.parent && oa.parent.layout && 'removeWidget' in oa.parent.layout) {
      (oa.parent.layout as any).removeWidget(oa);
    }

    if (sidebar) {
      this._left.addWidget(oa);
    } else if (bottom) {
      this._rightBottom.addWidget(oa);
    } else {
      this._rightTop.addWidget(oa);
    }

    this._updatePanelVisibility();
  }


  /**
   * Create a new cell widget from a `CellModel`.
   *
   * @param cellModel - `ICellModel`.
   */
  protected createCell(cellModel: ICellModel): CellItemWidget {
    let item: Cell;
    let sidebar = false; // place cell in the sidebar
    let bottom = false; // place cell in the bottom panel

    switch (cellModel.type) {
      case 'code': {
        const codeCell = new CodeCell({
          model: cellModel as CodeCellModel,
          rendermime: this._model.rendermime,
          contentFactory: this._model.contentFactory,
          editorConfig: this._model.editorConfig.code
        });
        codeCell.readOnly = true;
        for (let i = 0; i < codeCell.outputArea.model.length; i++) {
          const output = codeCell.outputArea.model.get(i);
          const data = output.data;
          // Only widget marked as dashboard controller will have
          // output of type MERCURY_MIMETYPE. So we don't touch widget
          // unmarked.
          if (MERCURY_MIMETYPE in data) {
            try {
              const meta = JSON.parse(data[MERCURY_MIMETYPE] as string);
              const pos = meta.position || 'sidebar';
              sidebar = pos === 'sidebar';
              bottom = pos === 'bottom';
            } catch (err) {
              sidebar = true;
              bottom = false;
            }
            break;
          }
        }
        item = codeCell;
        break;
      }
      case 'markdown': {
        const markdownCell = new MarkdownCell({
          model: cellModel as MarkdownCellModel,
          rendermime: this._model.rendermime,
          contentFactory: this._model.contentFactory,
          editorConfig: this._model.editorConfig.markdown
        });
        markdownCell.inputHidden = false;
        markdownCell.rendered = true;
        Private.removeElements(markdownCell.node, 'jp-Collapser');
        Private.removeElements(markdownCell.node, 'jp-InputPrompt');
        item = markdownCell;
        break;
      }
      default: {
        const rawCell = new RawCell({
          model: cellModel as RawCellModel,
          contentFactory: this._model.contentFactory,
          editorConfig: this._model.editorConfig.raw
        });
        rawCell.inputHidden = false;
        Private.removeElements(rawCell.node, 'jp-Collapser');
        Private.removeElements(rawCell.node, 'jp-InputPrompt');
        item = rawCell;
        break;
      }
    }
    const options = {
      cellId: cellModel.id,
      cellWidget: item,
      sidebar,
      bottom
    };
    const widget = new CellItemWidget(item, options);
    return widget;
  }

  private _initCellItems(): void {
    console.log('init cells');
    const cells = this._model.cells;
    for (let i = 0; i < cells?.length; i++) {
      const model = cells.get(i);
      const item = this.createCell(model);
      this._cellItems.push(item);

      // If the cell is a code cell, use the output area
      if (item.child instanceof CodeCell) {
        const oa = item.child.outputArea;

        if (this._showCode) {
          // item.child.outputArea.hide();
          this._rightTop.addWidget(item.child);
          const outputEl = item.child.node.querySelector(
            '.jp-Cell-outputWrapper'
          ) as HTMLElement;
          if (outputEl) {
            outputEl.style.display = 'none';
          }
        }

        if (item.sidebar) {
          this._left.addWidget(oa);
        } else if (item.bottom) {
          this._rightBottom.addWidget(oa);
        } else {
          this._rightTop.addWidget(oa);
        }

        // this.placeCell(item.child as CodeCell);
      } else {
        // All non-code cells always go to _rightTop
        this._rightTop.addWidget(item.child);
      }
    }

    this._model.widgetUpdated.connect(this._onWidgetUpdate, this);

    this._updatePanelVisibility();

    this._model.cells.changed.connect((_, args) => {
      console.log('cells changed');
      if (args.type === 'add') {
        console.log('add');
      }
    });
  }

  private _updatePanelVisibility() {
    // Hide/show left panel
    if (this._left.widgets.length === 0) {
      this._left.hide();
      this._split.setRelativeSizes([0, 1]);
    } else {
      this._left.show();
      this._split.setRelativeSizes([0.2, 0.8]);
    }

    // Hide/show right bottom panel
    if (this._rightBottom.widgets.length === 0) {
      this._rightBottom.hide();
      this._rightSplit.setRelativeSizes([1, 0]);
    } else {
      this._rightBottom.show();
      this._rightSplit.setRelativeSizes([0.85, 0.15]);
    }

    // Margin logic for rightTop
    if (this._left.widgets.length === 0) {
      this._rightTop.addClass('mercury-panel-with-margin');
    } else {
      this._rightTop.removeClass('mercury-panel-with-margin');
    }
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    Signal.clearData(this);
    super.dispose();
  }

  /**
   * Handle `after-attach` messages sent to the widget.
   *
   * ### Note
   * Add event listeners for the drag and drop event.
   */
  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    // Block only JupyterLab/Lumino menu, keep browser menu
    this.node.addEventListener(
      'contextmenu',
      (event: MouseEvent) => {
        event.stopImmediatePropagation(); // kill JupyterLab menu
      },
      true
    );
    this._left.node.addEventListener('contextmenu', e => e.preventDefault());
    // Now the panel is attached, set split sizes
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._split.setRelativeSizes([0.2, 0.8]);
        this._rightSplit.setRelativeSizes([0.85, 0.15]);
      });
    });
  }

  /**
   * Handle `before-detach` messages sent to the widget.
   *
   * ### Note
   * Remove event listeners for the drag and drop event.
   */
  protected onBeforeDetach(msg: Message): void {
    super.onBeforeDetach(msg);
  }

  get cellWidgets(): CellItemWidget[] {
    return this._cellItems;
  }

  /*executeCellItems(): void {
    const cells = this._model.cells;
    this._model.executed = false;
    for (let i = 0; i < cells?.length; i++) {
      const model = cells.get(i);
      this._model.execute(model);
    }
    this._model.executed = true;
  }*/

  private _onWidgetUpdate(model: AppModel, update: IWidgetUpdate): void {
    console.log('onWidget update');
    if (!update.cellModelId) {
      // console.warn('A widget not linked to a specific cell has updated.');
      return;
    }

    const cells = this._model.cells;
    const cellCount = cells.length;
    let updatedIndex = -1;

    for (let i = 0; i < cellCount; i++) {
      if (cells.get(i).id === update.cellModelId) {
        updatedIndex = i;
        break;
      }
    }
    if (updatedIndex === -1) {
      // console.warn('Updated cellModelId not found in cell list');
      return;
    }
    // Execute all code cells below the updated cell
    for (let i = updatedIndex + 1; i < cellCount; i++) {
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
  }

  private _model: AppModel;
  private _cellItems: CellItemWidget[] = [];
}

/**
 * A namespace for private module data.
 */
namespace Private {
  /**
   * Remove children by className from an HTMLElement.
   */
  export function removeElements(node: HTMLElement, className: string): void {
    const elements = node.getElementsByClassName(className);
    for (let i = 0; i < elements.length; i++) {
      elements[i].remove();
    }
  }

  export function removePromptsOnChange(node: HTMLElement) {
    const remove = () => {
      Private.removeElements(node, 'jp-OutputPrompt');
      Private.removeElements(node, 'jp-OutputArea-promptOverlay');
    };
    remove();
    const observer = new MutationObserver(remove);
    observer.observe(node, { childList: true, subtree: true });
    return observer;
  }
}
