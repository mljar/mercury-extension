import {
  CellList,
  INotebookModel,
  NotebookPanel,
  StaticNotebook
} from '@jupyterlab/notebook';

import {
  ICellModel,
  CodeCell,
  CodeCellModel,
  MarkdownCell,
  MarkdownCellModel,
  RawCell,
  RawCellModel,
  InputArea
} from '@jupyterlab/cells';

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { IEditorMimeTypeService } from '@jupyterlab/codeeditor';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { SimplifiedOutputArea } from '@jupyterlab/outputarea';

import { CellChange, YNotebook, createMutex } from '@jupyter/ydoc';

import { Widget } from '@lumino/widgets';

import { Signal, ISignal } from '@lumino/signaling';

import * as Y from 'yjs';

import { CellItemWidget } from './item/widget';

export class AppModel {
  constructor(options: AppModel.IOptions) {
    this._context = options.context;
    this.rendermime = options.rendermime;
    this.contentFactory = options.contentFactory;
    this.mimeTypeService = options.mimeTypeService;
    this._editorConfig = options.editorConfig;
    this._notebookConfig = options.notebookConfig;

    this._ready = new Signal<this, null>(this);
    this._cellRemoved = new Signal<this, CellChange>(this);
    this._stateChanged = new Signal<this, null>(this);
    this._contentChanged = new Signal<this, null>(this);

    this._context.sessionContext.ready.then(() => {
      const ymodel = this._context.model.sharedModel as YNotebook;
      this._ystate = ymodel.ystate;
      if (this._ystate.get('executed') !== true) {
        ymodel.transact(() => {
          this._ystate.set('executed', false);
        }, false);
      }

      this._context.save().then(v => {
        this._ready.emit(null);
      });
    });

    this._context.model.contentChanged.connect(this._updateCells, this);
  }

  /**
   * A signal emitted when the model is ready.
   */
  get ready(): ISignal<this, null> {
    return this._ready;
  }

  /**
   * A signal emitted when a cell is removed.
   */
  get cellRemoved(): ISignal<this, CellChange> {
    return this._cellRemoved;
  }

  /**
   * A signal emitted when the model state changes.
   */
  get stateChanged(): ISignal<this, null> {
    return this._stateChanged;
  }

  /**
   * A signal emitted when the model content changes.
   */
  get contentChanged(): ISignal<this, null> {
    return this._contentChanged;
  }

  /**
   * The rendermime instance for this context.
   */
  readonly rendermime: IRenderMimeRegistry;
  /**
   * A notebook panel content factory.
   */
  readonly contentFactory: NotebookPanel.IContentFactory;
  /**
   * The service used to look up mime types.
   */
  readonly mimeTypeService: IEditorMimeTypeService;

  /**
   * A config object for cell editors.
   */
  get editorConfig(): StaticNotebook.IEditorConfig {
    return this._editorConfig;
  }
  /**
   * A config object for cell editors.
   *
   * @param value - A `StaticNotebook.IEditorConfig`.
   */
  set editorConfig(value: StaticNotebook.IEditorConfig) {
    this._editorConfig = value;
  }

  /**
   * A config object for notebook widget.
   */
  get notebookConfig(): StaticNotebook.INotebookConfig {
    return this._notebookConfig;
  }
  /**
   * A config object for notebook widget.
   *
   * @param value - A `StaticNotebook.INotebookConfig`.
   */
  set notebookConfig(value: StaticNotebook.INotebookConfig) {
    this._notebookConfig = value;
  }

  set executed(value: boolean) {
    this._ystate.set('executed', value);
  }

  /**
   * The Notebook's cells.
   */
  get cells(): CellList {
    return this._context.model.cells;
  }

  /**
   * Ids of the notebooks's deleted cells.
   */
  get deletedCells(): string[] {
    return this._context.model.deletedCells;
  }

  /**
   * Create a new cell widget from a `CellModel`.
   *
   * @param cellModel - `ICellModel`.
   */
  public createCell(cellModel: ICellModel, hideOutput = false): CellItemWidget {
    let item: Widget;
    let sidebar = false;

    switch (cellModel.type) {
      case 'code': {
        const codeCell = new CodeCell({
          model: cellModel as CodeCellModel,
          rendermime: this.rendermime,
          contentFactory: this.contentFactory,
          editorConfig: this._editorConfig.code
        });
        codeCell.readOnly = true;
        for (let i = 0; i < codeCell.outputArea.model.length; i++) {
          const output = codeCell.outputArea.model.get(i);
          const data = output.data;
          if ('application/vnd.jupyter.widget-view+json' in data) {
            sidebar = true;
          }
        }
        if (sidebar && !hideOutput) {
          item = new SimplifiedOutputArea({
            model: codeCell.outputArea.model,
            rendermime: codeCell.outputArea.rendermime,
            contentFactory: codeCell.outputArea.contentFactory
          });
        } else {
          item = codeCell;
          if (hideOutput) {
            const opts = {
              config: this._editorConfig.code
            };

            //codeCell.inputArea
            //  ?.contentFactory as InputArea.IContentFactory, // this.contentFactory,
            item = new InputArea({
              model: cellModel as CodeCellModel,
              contentFactory: this.contentFactory,
              editorOptions: opts
            });
          }
        }

        break;
      }
      case 'markdown': {
        const markdownCell = new MarkdownCell({
          model: cellModel as MarkdownCellModel,
          rendermime: this.rendermime,
          contentFactory: this.contentFactory,
          editorConfig: this._editorConfig.markdown
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
          contentFactory: this.contentFactory,
          editorConfig: this._editorConfig.raw
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

  /**
   * Execute a CodeCell.
   *
   * @param cell - `ICellModel`.
   */
  public execute(cell: ICellModel): void {
    if (cell.type !== 'code' || this._ystate.get('executed')) {
      return;
    }
    const codeCell = new CodeCell({
      model: cell as CodeCellModel,
      rendermime: this.rendermime,
      contentFactory: this.contentFactory,
      editorConfig: this._editorConfig.code
    });

    SimplifiedOutputArea.execute(
      cell.sharedModel.source,
      codeCell.outputArea,
      this._context.sessionContext
    )
      .then(resp => {
        if (
          resp?.header.msg_type === 'execute_reply' &&
          resp.content.status === 'ok'
        ) {
          (cell as CodeCellModel).executionCount = resp.content.execution_count;
        }
      })
      .catch(reason => console.error(reason));
  }

  private readonly _mutex = createMutex();

  /**
   * Update cells.
   */
  private _updateCells(): void {
    this._mutex(() => {
      this._contentChanged.emit(null);
      console.log('content changed');
    });
  }

  private _context: DocumentRegistry.IContext<INotebookModel>;
  private _editorConfig: StaticNotebook.IEditorConfig;
  private _notebookConfig: StaticNotebook.INotebookConfig;
  private _ystate: Y.Map<any> = new Y.Map();

  private _ready: Signal<this, null>;
  private _cellRemoved: Signal<this, CellChange>;
  private _stateChanged: Signal<this, null>;
  private _contentChanged: Signal<this, null>;
}

export namespace AppModel {
  export interface IOptions {
    /**
     * The Notebook context.
     */
    context: DocumentRegistry.IContext<INotebookModel>;
    /**
     * The rendermime instance for this context.
     */
    rendermime: IRenderMimeRegistry;
    /**
     * A notebook panel content factory.
     */
    contentFactory: NotebookPanel.IContentFactory;
    /**
     * The service used to look up mime types.
     */
    mimeTypeService: IEditorMimeTypeService;
    /**
     * A config object for cell editors
     */
    editorConfig: StaticNotebook.IEditorConfig;
    /**
     * A config object for notebook widget
     */
    notebookConfig: StaticNotebook.INotebookConfig;
  }
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
