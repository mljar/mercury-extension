import { Widget, Panel } from '@lumino/widgets';

import { CellItemModel } from './model';

export class CellItemWidget extends Panel {
  constructor(cell: Widget, options: CellItemModel.IOptions) {
    super();
    this.removeClass('lm-Widget');
    this.removeClass('p-Widget');
    this.addClass('cell-item-widget');

    this._model = new CellItemModel(options);

    const content = new Panel();
    content.addClass('cell-item-content');

    cell.addClass('cell-item-widget');
    content.addWidget(cell);
    this.addWidget(content);
  }

  dispose() {
    if (this.isDisposed) {
      return;
    }
    this._model.dispose();
    super.dispose();
  }

  get cellId(): string {
    return this._model.cellId;
  }

  get sidebar(): boolean {
    return this._model.sidebar;
  }

  private _model: CellItemModel;
}
