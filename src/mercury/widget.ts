import { IWidgetTracker } from '@jupyterlab/apputils';

import { DocumentWidget, DocumentRegistry } from '@jupyterlab/docregistry';

import { INotebookModel } from '@jupyterlab/notebook';

import { Token } from '@lumino/coreutils';

import { MercuryPanel } from './panel';

export class MercuryWidget extends DocumentWidget<
  MercuryPanel,
  INotebookModel
> {
  constructor(
    context: DocumentRegistry.IContext<INotebookModel>,
    content: MercuryPanel
  ) {
    super({ context, content });
    this.title.label = context.localPath;
    this.title.closable = true;
    this.addClass('jp-NotebookPanel');
  }
}

/**
 * A class that tracks cell item widgets.
 */
export interface IMercuryTracker extends IWidgetTracker<MercuryWidget> {}

/**
 * The Mercury tracker token.
 */
export const IMercuryTracker = new Token<IMercuryTracker>(
  '@mljar:IMercuryTracker'
);
