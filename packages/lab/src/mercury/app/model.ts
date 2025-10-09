import { showDialog, Dialog } from '@jupyterlab/apputils';
import { CellChange, YNotebook, createMutex } from '@jupyter/ydoc';
import type { ISessionContext } from '@jupyterlab/apputils';
import {
  CodeCell,
  CodeCellModel,
  ICellModel,
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
import { IAnyMessageArgs } from '@jupyterlab/services/lib/kernel/kernel';
import type {
  ICommMsgMsg,
  IHeader,
  IStatusMsg
} from '@jupyterlab/services/lib/kernel/messages';
import { ISignal, Signal } from '@lumino/signaling';
import * as Y from 'yjs';
import { ServerHealthMonitor } from './healthmonitor';

/*************************************************
 * Constants & Types
 *************************************************/
export const MERCURY_MIMETYPE = 'application/mercury+json' as const;
const YSTATE_EXECUTED_KEY = 'executed' as const;

export type WidgetPosition = 'sidebar' | 'inline' | string;

/** Strongly-typed Mercury output payload */
interface IMercuryPayload {
  model_id?: string;
  position?: WidgetPosition;
  widget?: string;
}

/**
 * Widget update signal payload
 */
export interface IWidgetUpdate {
  /** Widget model id */
  widgetModelId: string;
  /** Cell model id */
  cellModelId?: string;
}

/*************************************************
 * AppModel
 *************************************************/
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

    // Initialize ystate and ensure executed flag exists
    void this._context.sessionContext.ready.then(() => {
      const ymodel = this._context.model.sharedModel as YNotebook;
      this._ystate = ymodel.ystate;

      if (this._ystate.get(YSTATE_EXECUTED_KEY) !== true) {
        ymodel.transact(() => {
          this._ystate.set(YSTATE_EXECUTED_KEY, false);
        }, false);
      }

      void this._context.save().then(() => {
        this._ready.emit(null);
      });

      const baseUrl =
        this._context.sessionContext.session?.kernel?.serverSettings.baseUrl ??
        '/';

      // Start server health monitor
      // Keep a reference if you want to dispose it later.
      new ServerHealthMonitor(
        baseUrl,
        () => {
          this._notifyConnectionLost();
        },
        () => {
          console.log('Connection recovery ...');
        }
      );
    });

    // Keep widget ↔ cell mapping in sync with cell list changes
    this._onCellListChange(this._context.model.cells);
    this._context.model.cells.changed.connect(this._onCellListChange, this);

    // React to notebook content changes (debounced via mutex)
    this._context.model.contentChanged.connect(this._updateCells, this);

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

  /*************************************************
   * Public API
   *************************************************/

  /** Document context */
  get context(): DocumentRegistry.IContext<INotebookModel> {
    return this._context;
  }

  /** A signal emitted when the model is ready. */
  get ready(): ISignal<this, null> {
    return this._ready;
  }

  /** A signal emitted when a cell is removed. */
  get cellRemoved(): ISignal<this, CellChange> {
    return this._cellRemoved;
  }

  /** A signal emitted when the model state changes. */
  get stateChanged(): ISignal<this, null> {
    return this._stateChanged;
  }

  /** A signal emitted when the model content changes. */
  get contentChanged(): ISignal<this, null> {
    return this._contentChanged;
  }

  /** The rendermime instance for this context. */
  readonly rendermime: IRenderMimeRegistry;
  /** A notebook panel content factory. */
  readonly contentFactory: NotebookPanel.IContentFactory;
  /** The service used to look up mime types. */
  readonly mimeTypeService: IEditorMimeTypeService;

  /** A config object for cell editors. */
  get editorConfig(): StaticNotebook.IEditorConfig {
    return this._editorConfig;
  }

  set editorConfig(value: StaticNotebook.IEditorConfig) {
    this._editorConfig = value;
  }

  /** A config object for notebook widget. */
  get notebookConfig(): StaticNotebook.INotebookConfig {
    return this._notebookConfig;
  }

  set notebookConfig(value: StaticNotebook.INotebookConfig) {
    this._notebookConfig = value;
  }

  set executed(value: boolean) {
    this._ystate.set(YSTATE_EXECUTED_KEY, value);
  }

  /** The Notebook's cells. */
  get cells(): CellList {
    return this._context.model.cells;
  }

  /** Ids of the notebooks's deleted cells. */
  get deletedCells(): string[] {
    return this._context.model.deletedCells;
  }

  /** Signal emitted when a widget has updated. */
  get widgetUpdated(): ISignal<AppModel, IWidgetUpdate> {
    return this._widgetUpdated;
  }

  /** Signal when a Mercury widget is first seen / repositioned */
  get mercuryWidgetAdded(): ISignal<
    this,
    { cellId: string; position: string }
  > {
    return this._mercuryWidgetAdded;
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;

    // Disconnect kernel listener if any
    const kernel = this._context.sessionContext.session?.kernel;
    kernel?.anyMessage.disconnect(this._onKernelMessage, this);

    // Disconnect outputs listeners
    for (const [outputs] of this._outputsToCellEntries()) {
      outputs.changed.disconnect(this._onOutputsChange, this);
    }

    this._ipywidgetToCellId.clear();
    this._outputsToCell = new WeakMap();

    Signal.clearData(this);
  }

  /** Execute a CodeCell. */
  public execute(cell: ICellModel): void {
    if (cell.type !== 'code' || this._ystate.get(YSTATE_EXECUTED_KEY)) {
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

  /*************************************************
   * Internal: Cell list ↔ outputs mapping
   *************************************************/
  private _onCellListChange(
    cells: CellList,
    changes?: IObservableList.IChangedArgs<ICellModel>
  ): void {
    let toConnect: readonly ICellModel[] | CellList = cells;
    let toDisconnect: readonly ICellModel[] = [];

    if (!changes || typeof (changes as any).type !== 'string') {
      for (const cell of cells as unknown as readonly ICellModel[]) {
        if (!cell || cell.type !== 'code') {
          continue;
        }
        const code = cell as ICodeCellModel;
        code.outputs.changed.disconnect(this._onOutputsChange, this);
      }
      this._outputsToCell = new WeakMap();
      for (const cell of cells as unknown as readonly ICellModel[]) {
        if (!cell || cell.type !== 'code') {
          continue;
        }
        const code = cell as ICodeCellModel;
        this._outputsToCell.set(code.outputs, code.id);
        this._onOutputsChange(code.outputs); // prime
        code.outputs.changed.connect(this._onOutputsChange, this);
      }
      return;
    }

    // Normalna ścieżka
    switch (changes.type) {
      case 'add':
        toConnect = changes.newValues ?? [];
        break;
      case 'remove':
        toDisconnect = changes.oldValues ?? [];
        break;
      case 'set':
        toConnect = changes.newValues ?? [];
        toDisconnect = changes.oldValues ?? [];
        break;
      case 'move':
      default:
        break; // nothing
    }

    // Disconnect
    for (const cellModel of toDisconnect) {
      if (!cellModel || cellModel.type !== 'code') {
        continue;
      }
      const codeModel = cellModel as ICodeCellModel;
      this._outputsToCell.delete(codeModel.outputs);
      codeModel.outputs.changed.disconnect(this._onOutputsChange, this);
    }

    // Connect
    for (const cellModel of toConnect as readonly ICellModel[]) {
      if (!cellModel || cellModel.type !== 'code') {
        continue;
      }
      const codeModel = cellModel as ICodeCellModel;
      this._outputsToCell.set(codeModel.outputs, codeModel.id);
      this._onOutputsChange(codeModel.outputs); // prime istniejące outputy
      codeModel.outputs.changed.connect(this._onOutputsChange, this);
    }
  }

  // private _onCellListChange(
  //   cells: CellList,
  //   changes?: IObservableList.IChangedArgs<ICellModel>
  // ): void {
  //   let toConnect: readonly ICellModel[] | CellList = cells;
  //   let toDisconnect: readonly ICellModel[] = [];

  //   if (changes) {
  //     switch (changes.type) {
  //       case 'add':
  //         toConnect = changes.newValues;
  //         break;

  //       case 'remove':
  //         toDisconnect = changes.oldValues;
  //         break;
  //       case 'set':
  //         toConnect = changes.newValues;
  //         toDisconnect = changes.oldValues;

  //         break;
  //       case 'move':
  //       default:
  //         break; // nothing
  //     }
  //   }

  //   // Disconnect
  //   for (const cellModel of toDisconnect) {
  //     if (cellModel.type !== 'code') {
  //       continue;
  //     }
  //     const codeModel = cellModel as ICodeCellModel;
  //     this._outputsToCell.delete(codeModel.outputs);
  //     codeModel.outputs.changed.disconnect(this._onOutputsChange, this);
  //   }

  //   // Connect
  //   for (const cellModel of toConnect as readonly ICellModel[]) {
  //     if (cellModel.type !== 'code') {
  //       continue;
  //     }
  //     const codeModel = cellModel as ICodeCellModel;
  //     this._outputsToCell.set(codeModel.outputs, codeModel.id);
  //     // Prime any existing outputs
  //     this._onOutputsChange(codeModel.outputs);
  //     codeModel.outputs.changed.connect(this._onOutputsChange, this);
  //   }
  // }

  private _outputsToCellEntries(): Array<[IOutputAreaModel, string]> {
    // WeakMap is not iterable; maintain a side store when setting if you need iteration.
    // Here, we derive entries from current code cells.
    const entries: Array<[IOutputAreaModel, string]> = [];
    for (const cell of this._context.model.cells) {
      if (cell.type !== 'code') {
        continue;
      }
      const code = cell as ICodeCellModel;
      const id = this._outputsToCell.get(code.outputs);
      if (id) {
        entries.push([code.outputs, id]);
      }
    }
    return entries;
  }

  /*************************************************
   * Internal: Kernel wiring
   *************************************************/

  private _onConnectionStatusChanged = (
    _kernel: Kernel.IKernelConnection,
    status: Kernel.ConnectionStatus
  ): void => {
    console.log('kernel status', status);
    // status is one of: 'connecting' | 'connected' | 'disconnected'
    if (status === 'disconnected') {
      void this._notifyKernelDisconnected();
    }

    // Optional: warn on flaky network
    // if (status === 'connecting') { /* maybe show a non-blocking toast */ }
  };

  private _onKernelChanged(
    session: ISessionContext,
    changes: IChangedArgs<
      Kernel.IKernelConnection | null,
      Kernel.IKernelConnection | null,
      'kernel'
    >
  ): void {
    const prev = changes.oldValue;
    if (prev) {
      prev.anyMessage.disconnect(this._onKernelMessage, this);
      // remove old connectionStatus listener
      prev.connectionStatusChanged.disconnect(
        this._onConnectionStatusChanged,
        this
      );
    }

    const next = changes.newValue;
    if (next) {
      next.anyMessage.connect(this._onKernelMessage, this);
      // listen for connection changes
      next.connectionStatusChanged.connect(
        this._onConnectionStatusChanged,
        this
      );
    }
  }

  private _onKernelMessage(
    _sender: Kernel.IKernelConnection,
    args: IAnyMessageArgs
  ): void {
    const { direction, msg } = args;

    if (direction === 'send') {
      if (
        msg.channel === 'shell' &&
        msg.header.msg_type === 'comm_msg' &&
        (msg as ICommMsgMsg<'shell'>).content.data.method === 'update'
      ) {
        this._updateMessages.set(
          (msg as ICommMsgMsg<'shell'>).content.comm_id,
          msg.header as IHeader
        );
      }
      return;
    }

    if (direction !== 'recv' || msg.channel !== 'iopub') {
      return;
    }

    let commId = '';
    switch (msg.header.msg_type) {
      case 'comm_msg': {
        const content = (msg as ICommMsgMsg<'iopub'>).content;
        // Robust path: react to kernel echo_update
        if (
          content.data.method === 'echo_update' &&
          this._updateMessages.has(content.comm_id)
        ) {
          commId = content.comm_id;
        }
        break;
      }
      case 'status': {
        // Fallback: react to message processing end
        if ((msg as IStatusMsg).content.execution_state === 'idle') {
          const parentId = (msg as IStatusMsg).parent_header.msg_id;
          for (const [widgetId, message] of this._updateMessages.entries()) {
            if (message.msg_id === parentId) {
              commId = widgetId;
              break;
            }
          }
        }
        break;
      }
      default:
        break;
    }

    if (!commId) {
      return;
    }

    const updateMessage = this._updateMessages.get(commId);
    if (msg.parent_header.msg_id !== updateMessage?.msg_id) {
      return;
    }

    this._updateMessages.delete(commId);
    this._widgetUpdated.emit({
      widgetModelId: commId,
      cellModelId: this._ipywidgetToCellId.get(commId)
    });
  }

  /*************************************************
   * Internal: Outputs change handler
   *************************************************/

  private _onOutputsChange(
    outputs: IOutputAreaModel,
    changes?: IOutputAreaModel.ChangedArgs
  ): void {
    const toList: IOutputModel[] = [];
    const toClean: IOutputModel[] = [];

    if (!changes) {
      for (let i = 0; i < outputs.length; i++) {
        toList.push(outputs.get(i));
      }
    } else {
      switch (changes.type) {
        case 'add':
          toList.push(...changes.newValues);
          break;
        case 'remove':
          toClean.push(...changes.oldValues);
          break;
        case 'set':
          toList.push(...changes.newValues);
          toClean.push(...changes.oldValues);
          break;
        case 'move':
        default:
          break;
      }
    }

    // Clean removed
    for (const output of toClean) {
      const payload = this._readMercuryPayload(output);
      const modelId = payload?.model_id;
      if (modelId) {
        this._ipywidgetToCellId.delete(modelId);
        this._updateMessages.delete(modelId);
        this._widgetMeta.delete(modelId);
      }
    }

    // List new/updated
    for (const output of toList) {
      const payload = this._readMercuryPayload(output);
      if (!payload?.model_id) {
        continue;
      }

      const cellId = this._outputsToCell.get(outputs);
      const modelId = payload.model_id;
      const position: WidgetPosition = payload.position ?? 'sidebar';

      if (!cellId) {
        continue;
      }

      const prev = this._widgetMeta.get(modelId);
      if (!prev || prev.position !== position || prev.cellId !== cellId) {
        this._widgetMeta.set(modelId, { cellId, position });
        this._ipywidgetToCellId.set(modelId, cellId);
        this._mercuryWidgetAdded.emit({ cellId, position });
      }
    }
  }

  /** Safely parse and validate Mercury output */
  private _readMercuryPayload(output: IOutputModel): IMercuryPayload | null {
    const data = output.data ?? {};
    if (!(MERCURY_MIMETYPE in data)) {
      return null;
    }

    try {
      const raw = data[MERCURY_MIMETYPE] as unknown as string;
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== 'object' || parsed === null) {
        return null;
      }

      const { model_id, position, widget } = parsed as Record<string, unknown>;
      const payload: IMercuryPayload = {
        model_id: typeof model_id === 'string' ? model_id : undefined,
        position:
          typeof position === 'string'
            ? (position as WidgetPosition)
            : undefined,
        widget: typeof widget === 'string' ? widget : undefined
      };
      return payload;
    } catch (err) {
      console.warn('Failed to parse MERCURY payload', err);
      return null;
    }
  }

  /*************************************************
   * Internal: Notebook content change
   *************************************************/

  private _updateCells(): void {
    this._mutex(() => {
      this._contentChanged.emit(null);
    });
  }

  /*************************************************
   * Dialogs
   *************************************************/

  private async _notifyConnectionLost(): Promise<void> {
    await showDialog({
      title: 'Connection Lost',
      body: 'Oops! It looks like we lost connection to the computing backend. Please check your internet connection or try again in a moment.',
      buttons: [] // [Dialog.cancelButton({ label: 'Close' })]
    });
  }
  private async _notifyKernelDisconnected(): Promise<void> {
    if (this._disconnectedNotified) {
      return;
    }
    this._disconnectedNotified = true;

    const result = await showDialog({
      title: 'Connection lost',
      body: 'Computing backend disconnected.',
      buttons: [
        //Dialog.createButton({ label: 'Restart kernel', accept: true }),
        //Dialog.okButton({ label: 'OK' }),
        Dialog.cancelButton({ label: 'Close' })
      ]
    });

    // Handle the choice
    const label = result.button.label;
    try {
      if (label === 'OK') {
        // Reload is often the cleanest way to recover websocket/session state
        // window.location.reload();
      }
    } finally {
      // allow future notifications if user recovered successfully
      this._disconnectedNotified = false;
    }
  }

  /*************************************************
   * Private state
   *************************************************/

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
  private _outputsToCell: WeakMap<IOutputAreaModel, string> = new WeakMap();
  private _widgetMeta = new Map<string, { cellId: string; position: string }>();

  /** Update ipywidget message per widget ID (only keep latest). */
  private _updateMessages = new Map<string, IHeader>();
  private _widgetUpdated = new Signal<AppModel, IWidgetUpdate>(this);
  private _mercuryWidgetAdded = new Signal<
    this,
    { cellId: string; position: string }
  >(this);

  private readonly _mutex = createMutex();
  private _disconnectedNotified = false; // add this
}

/*************************************************
 * Namespace: Options
 *************************************************/
export namespace AppModel {
  export interface IOptions {
    /** The Notebook context. */
    context: DocumentRegistry.IContext<INotebookModel>;
    /** The rendermime instance for this context. */
    rendermime: IRenderMimeRegistry;
    /** A notebook panel content factory. */
    contentFactory: NotebookPanel.IContentFactory;
    /** The service used to look up mime types. */
    mimeTypeService: IEditorMimeTypeService;
    /** A config object for cell editors */
    editorConfig: StaticNotebook.IEditorConfig;
    /** A config object for notebook widget */
    notebookConfig: StaticNotebook.INotebookConfig;
  }
}
