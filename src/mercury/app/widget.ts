import { Panel } from '@lumino/widgets';
import { Message } from '@lumino/messaging';
import { Signal } from '@lumino/signaling';
import { AppModel } from './model';
import { CellItemWidget } from './item/widget';

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

  private _initCellItems(): void {
    const cells = this._model.cells;
    for (let i = 0; i < cells?.length; i++) {
      const model = cells.get(i);
      const item = this._model.createCell(model);
      this._cellItems.push(item);
      if (item.sidebar) {
        this._left.addWidget(item);
        const item_only_input = this._model.createCell(model, true);
        this._right.addWidget(item_only_input);
        this._cellItems.push(item_only_input);
      } else {
        this._right.addWidget(item);
      }
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

  private _model: AppModel;
  private _cellItems: CellItemWidget[] = [];
}
