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
import { Panel } from '@lumino/widgets';
import { CellItemWidget } from './item/widget';
import { AppModel, MERCURY_MIMETYPE, type IWidgetUpdate } from './model';

export class AppWidget extends Panel {
  private _left: Panel;
  private _right: Panel;
  constructor(model: AppModel) {
    super();
    this.id = 'mercury-main-panel';
    this.addClass('mercury-main-panel');
    this._model = model;

    this._model.ready.connect(() => {
      this._initCellItems();
    });

    this._left = new Panel();
    this._right = new Panel();
    this._left.addClass('mercury-left-panel');
    this._right.addClass('mercury-right-panel');

    this.addWidget(this._left);
    this.addWidget(this._right);
  }

  /**
   * Create a new cell widget from a `CellModel`.
   *
   * @param cellModel - `ICellModel`.
   */
  protected createCell(cellModel: ICellModel): CellItemWidget {
    let item: Cell;
    let sidebar = false;

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
            sidebar = true;
            // No need to introspect further
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
      sidebar
    };
    const widget = new CellItemWidget(item, options);
    return widget;
  }

  private _initCellItems(): void {
    const cells = this._model.cells;
    for (let i = 0; i < cells?.length; i++) {
      const model = cells.get(i);
      const item = this.createCell(model);
      this._cellItems.push(item);
      if (item.sidebar) {
        this._right.addWidget(item);
        // Detach the output area from main panel to sidebar
        this._left.addWidget((item.child as CodeCell).outputArea);
      } else {
        this._right.addWidget(item);
      }
    }

    this._model.widgetUpdated.connect(this._onWidgetUpdate, this);
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

  executeCellItems(): void {
    const cells = this._model.cells;
    this._model.executed = false;
    for (let i = 0; i < cells?.length; i++) {
      const model = cells.get(i);
      this._model.execute(model);
    }
    this._model.executed = true;
  }

  private _onWidgetUpdate(model: AppModel, update: IWidgetUpdate): void {
    if (update.cellModelId) {
      // Use this._right as it contains only the "notebook" cells when this._cellItems
      // contains all items including the one in the sidebar.
      for (let index = 0; index < this._right.widgets.length; index++) {
        const cellItem = this._right.widgets[index] as CellItemWidget;
        if (cellItem.cellId === update.cellModelId) {
          while (++index < this._right.widgets.length) {
            const cell = (this._right.widgets[index] as CellItemWidget).child;
            // FIXME This skip the execution of a cell outputting a widget
            // Unsure this is what the user wants.
            if (cell instanceof CodeCell) {
              CodeCell.execute(cell, this._model.context.sessionContext, {
                deletedCells: this._model.context.model?.deletedCells ?? []
              });
            }
          }
          break;
        }
      }
    } else {
      console.warn('A widget not linked to a specific cell has updated.');
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
}
