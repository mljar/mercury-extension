import { Widget } from '@lumino/widgets';
import { Signal } from '@lumino/signaling';

export class CellItemModel {
  constructor(options: CellItemModel.IOptions) {
    this._cellId = options.cellId;
    this._sidebar = options.sidebar;
  }

  get cellId(): string {
    return this._cellId;
  }
  get sidebar(): boolean {
    return this._sidebar;
  }
  dispose() {
    Signal.clearData(this);
  }
  private _cellId = '';
  // place cell in the sidebar or not
  private _sidebar = false;
}

export namespace CellItemModel {
  export interface IOptions {
    cellId: string;
    cellWidget: Widget;
    /**
     * Place cell in the sidebar.
     */
    sidebar: boolean;
  }
}
