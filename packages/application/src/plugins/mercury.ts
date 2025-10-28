/* eslint-disable no-inner-declarations */
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISessionContextDialogs } from '@jupyterlab/apputils';
import type { Cell } from '@jupyterlab/cells';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { PageConfig, signalToPromise } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { ITranslator } from '@jupyterlab/translation';
import { PromiseDelegate } from '@lumino/coreutils';
import { type AppWidget, type MercuryWidget } from '@mljar/mercury-extension';
import { IMercuryCellExecutor } from '@mljar/mercury-tokens';

/**
 * Open the notebook with Mercury.
 */
export const plugin: JupyterFrontEndPlugin<void> = {
  id: 'mercury-application:opener',
  autoStart: true,
  requires: [IDocumentManager, IMercuryCellExecutor],
  optional: [IEditorServices, ISessionContextDialogs, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    documentManager: IDocumentManager,
    executor: IMercuryCellExecutor,
    editorServices: IEditorServices | null,
    sessionContextDialogs: ISessionContextDialogs | null,
    translator: ITranslator | null
  ) => {
    const { mimeTypeService } = editorServices ?? {};
    Promise.all([app.started, app.restored]).then(async ([settings]) => {
      const notebookPath = PageConfig.getOption('notebookPath');
      const mercuryPanel = documentManager.open(
        notebookPath,
        'Mercury'
      ) as MercuryWidget;

      mercuryPanel.toolbar.hide();
      app.shell.add(mercuryPanel, 'mercury');

      mercuryPanel.context.ready.then(async () => {
        // await languages.getLanguage(mercuryPanel.content.codeMimetype);

        let session = mercuryPanel.context.sessionContext.session;
        if (!session) {
          const [, changes] = await signalToPromise(
            mercuryPanel.context.sessionContext.sessionChanged
          );
          session = changes.newValue!;
        }

        let kernelConnection = session?.kernel;
        if (!kernelConnection) {
          const [, changes] = await signalToPromise(session.kernelChanged);
          kernelConnection = changes.newValue!;
        }

        const executeAll = async () => {
          if (
            kernelConnection?.connectionStatus === 'connected' &&
            kernelConnection?.status === 'idle'
          ) {
            kernelConnection.connectionStatusChanged.disconnect(executeAll);
            kernelConnection.statusChanged.disconnect(executeAll);

            // Execute all cells and wait for the initial execution
            const scheduledForExecution = new Set<string>();
            const notebook = mercuryPanel.context.model;
            const info = notebook.getMetadata('language_info');
            const mimetype = info
              ? mimeTypeService?.getMimeTypeByLanguage(info)
              : undefined;

            const onCellExecutionScheduled = (args: { cell: Cell }) => {
              scheduledForExecution.add(args.cell.model.id);
            };

            const onCellExecuted = (args: { cell: Cell }) => {
              scheduledForExecution.delete(args.cell.model.id);
            };
            for (const cellItem of (
              mercuryPanel.content.widgets[0] as AppWidget
            ).cellWidgets) {
              // Set the mimetype to get the syntax highlighting.
              if (mimetype) {
                cellItem.child.model.mimeType = mimetype;
              }
              // Schedule execution
              await executor.runCell({
                cell: cellItem.child,
                notebook,
                notebookConfig: mercuryPanel.content.notebookConfig,
                onCellExecuted: onCellExecuted,
                onCellExecutionScheduled: onCellExecutionScheduled,
                sessionContext: mercuryPanel.context.sessionContext,
                sessionDialogs: sessionContextDialogs ?? undefined,
                translator: translator ?? undefined
              });
            }

            const waitForExecution = new PromiseDelegate();
            const pollExecution = setInterval(() => {
              if (scheduledForExecution.size === 0) {
                clearInterval(pollExecution);
                waitForExecution.resolve(undefined);
              }
            }, 500);

            await waitForExecution.promise;
          }
        };

        kernelConnection?.connectionStatusChanged.connect(executeAll);
        kernelConnection?.statusChanged.connect(executeAll);
        executeAll();
      });
    });
  }
};
