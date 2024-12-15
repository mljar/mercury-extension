import { CellChange, YNotebook, createMutex } from '@jupyter/ydoc';
import type { ISessionContext } from '@jupyterlab/apputils';
import {
  CodeCell,
  CodeCellModel,
  ICellModel,
  InputArea,
  MarkdownCell,
  MarkdownCellModel,
  RawCell,
  RawCellModel,
  type ICodeCellModel
} from '@jupyterlab/cells';
import { IEditorMimeTypeService } from '@jupyterlab/codeeditor';
import type { IChangedArgs } from '@jupyterlab/coreutils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import {
  CellList,
  INotebookModel,
  NotebookPanel,
  StaticNotebook
} from '@jupyterlab/notebook';
import { IObservableList } from '@jupyterlab/observables';
import { IOutputAreaModel, SimplifiedOutputArea } from '@jupyterlab/outputarea';
import { IRenderMimeRegistry, type IOutputModel } from '@jupyterlab/rendermime';
import type { Kernel } from '@jupyterlab/services';
import type {
  ICommMsgMsg,
  IHeader,
  IStatusMsg
} from '@jupyterlab/services/lib/kernel/messages';
import { ISignal, Signal } from '@lumino/signaling';
import { Widget } from '@lumino/widgets';
import * as Y from 'yjs';
import { CellItemWidget } from './item/widget';

const MERCURY_MIMETYPE = 'application/mercury+json';

/**
 * Widget update signal payload
 */
export interface IWidgetUpdate {
  /**
   * Widget model id
   */
  widgetModelId: string;
  /**
   * Cell model id
   */
  cellModelId?: string;
}

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

    // Initialize the mapping between ipywidgets model ID and cell ID
    this._onCellListChange(this._context.model.cells);
    this._context.model.cells.changed.connect(this._onCellListChange, this);

    // Start listening to kernel messages
    this._onKernelChanged(this._context.sessionContext, {
      name: 'kernel',
      newValue: this._context.sessionContext.session?.kernel ?? null,
      oldValue: null
    });
    this._context.sessionContext.kernelChanged.connect(
      this._onKernelChanged,
      this
    );
  }

  /**
   * Document context
   */
  get context(): DocumentRegistry.IContext<INotebookModel> {
    return this._context;
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
   * Signal emitted when a widget has updated.
   */
  get widgetUpdated(): ISignal<AppModel, IWidgetUpdate> {
    return this._widgetUpdated;
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
          if (MERCURY_MIMETYPE in data) {
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

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._ipywidgetToCellId.clear();
    Signal.clearData(this);
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
    cell.trusted = true;

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

  private _onCellListChange(
    cells: CellList,
    changes?: IObservableList.IChangedArgs<ICellModel>
  ): void {
    let toConnect: CellList | ICellModel[] = cells;
    let toDisconnect: ICellModel[] = [];

    if (changes) {
      switch (changes.type) {
        case 'add':
          toConnect = changes.newValues;
          break;
        case 'move':
          // Nothing to do
          break;
        case 'remove':
          toDisconnect = changes.oldValues;
          break;
        case 'set':
          toConnect = changes.newValues;
          toDisconnect = changes.oldValues;

          break;
      }
    }

    for (const cellModel of toDisconnect) {
      if (cellModel.type === 'code') {
        const codeModel = cellModel as ICodeCellModel;
        this._outputsToCell.delete(codeModel.outputs);
        codeModel.outputs.changed.disconnect(this._onOutputsChange, this);
      }
    }

    for (const cellModel of toConnect) {
      if (cellModel.type === 'code') {
        const codeModel = cellModel as ICodeCellModel;
        this._outputsToCell.set(codeModel.outputs, codeModel.id);
        this._onOutputsChange(codeModel.outputs);
        codeModel.outputs.changed.connect(this._onOutputsChange, this);
      }
    }
  }

  private _onKernelChanged(
    session: ISessionContext,
    changes: IChangedArgs<
      Kernel.IKernelConnection | null,
      Kernel.IKernelConnection | null,
      'kernel'
    >
  ): void {
    const previousConnection = changes.oldValue;
    if (previousConnection) {
      previousConnection.anyMessage.disconnect(this._onKernelMessage, this);
    }
    const newConnection = changes.newValue;
    if (newConnection) {
      newConnection.anyMessage.connect(this._onKernelMessage, this);
    }
  }

  private _onKernelMessage(
    sender: Kernel.IKernelConnection,
    args: Kernel.IAnyMessageArgs
  ): void {
    const { direction, msg } = args;

    switch (direction) {
      case 'send':
        if (
          msg.channel === 'shell' &&
          msg.header.msg_type === 'comm_msg' &&
          (msg as ICommMsgMsg<'shell'>).content.data.method === 'update'
        ) {
          this._updateMessages.set(
            (msg as ICommMsgMsg<'shell'>).content.comm_id,
            msg.header
          );
        }
        break;
      case 'recv':
        if (msg.channel === 'iopub') {
          let commId = '';
          switch (msg.header.msg_type) {
            case 'comm_msg':
              // Robust path by reacting to kernel update acknowledgement
              // https://github.com/jupyter-widgets/ipywidgets/blob/303cae4dc268640a01ce08bf6e22da6c5cd201e4/packages/schema/messages.md?plain=1#L292
              if (
                (msg as ICommMsgMsg<'iopub'>).content.data.method ===
                  'echo_update' &&
                this._updateMessages.has(
                  (msg as ICommMsgMsg<'iopub'>).content.comm_id
                )
              ) {
                commId = (msg as ICommMsgMsg<'iopub'>).content.comm_id;
              }
              break;
            case 'status':
              // Fallback by reacting to message processing end
              if ((msg as IStatusMsg).content.execution_state === 'idle') {
                const parentId = (msg as IStatusMsg).parent_header.msg_id;
                for (const [
                  widgetId,
                  message
                ] of this._updateMessages.entries()) {
                  if (message.msg_id === parentId) {
                    commId = widgetId;
                    break;
                  }
                }
              }
              break;
          }
          // Execute all cells below the widget
          if (commId) {
            const updateMessage = this._updateMessages.get(commId);
            if (msg.parent_header.msg_id === updateMessage?.msg_id) {
              this._updateMessages.delete(commId);

              this._widgetUpdated.emit({
                widgetModelId: commId,
                cellModelId: this._ipywidgetToCellId.get(commId)
              });
            }
          }
        }
        break;
    }
  }

  private _onOutputsChange(
    outputs: IOutputAreaModel,
    changes?: IOutputAreaModel.ChangedArgs
  ): void {
    const toList: IOutputModel[] = [];
    const toClean: IOutputModel[] = [];
    if (changes) {
      switch (changes.type) {
        case 'add':
          toList.push(...changes.newValues);
          break;
        case 'move':
          break;
        case 'remove':
          toClean.push(...changes.oldValues);
          break;
        case 'set':
          toList.push(...changes.newValues);
          toClean.push(...changes.oldValues);
          break;
      }
    } else {
      for (let index = 0; index < outputs.length; index++) {
        toList.push(outputs.get(index));
      }
    }

    for (const output of toClean) {
      if (MERCURY_MIMETYPE in (output.data ?? {})) {
        const modelId = (output.data[MERCURY_MIMETYPE] as any)['model_id'];
        if (modelId) {
          this._ipywidgetToCellId.delete(modelId);
          this._updateMessages.delete(modelId);
        }
      }
    }

    for (const output of toList) {
      if (MERCURY_MIMETYPE in (output.data ?? {})) {
        const cellId = this._outputsToCell.get(outputs);
        const modelId = (output.data[MERCURY_MIMETYPE] as any)['model_id'];
        if (cellId && modelId) {
          this._ipywidgetToCellId.set(modelId, cellId);
        } else {
          console.error(
            `Failed to find the cell model associated with ipywidget '${modelId}'.`
          );
        }
      }
    }
  }

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
  private _isDisposed = false;
  private _cellRemoved: Signal<this, CellChange>;
  private _stateChanged: Signal<this, null>;
  private _contentChanged: Signal<this, null>;
  private _ipywidgetToCellId = new Map<string, string>();
  private _outputsToCell = new WeakMap<IOutputAreaModel, string>();

  /**
   * Update ipywidget message per widget ID.
   *
   * We only keep track of the latest update message to limit cell execution.
   */
  private _updateMessages = new Map<string, IHeader>();
  private _widgetUpdated = new Signal<AppModel, IWidgetUpdate>(this);
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
