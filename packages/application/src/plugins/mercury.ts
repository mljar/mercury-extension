/* eslint-disable no-inner-declarations */
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISessionContextDialogs } from '@jupyterlab/apputils';
import type { Cell } from '@jupyterlab/cells';
import { IEditorLanguageRegistry } from '@jupyterlab/codemirror';
import { PageConfig, signalToPromise } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { INotebookCellExecutor } from '@jupyterlab/notebook';
import { ITranslator } from '@jupyterlab/translation';
import { PromiseDelegate } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';
import { type AppWidget, type MercuryWidget } from '@mljar/mercury-extension';

class Error extends Widget {
  constructor() {
    super();
    this.node.insertAdjacentHTML('afterbegin', `<p>Failed to execute the dashboard</p>`);
  }
}

class Spinner extends Widget {
  constructor() {
    super();
    this.node.insertAdjacentHTML('afterbegin', '<div class="mercury-loader-container"><div class="mercury-loader"></div></div>');
  }
}

/**
 * Open the notebook with Mercury.
 */
export const plugin: JupyterFrontEndPlugin<void> = {
  id: 'mercury-application:opener',
  autoStart: true,
  requires: [IDocumentManager, INotebookCellExecutor, IEditorLanguageRegistry],
  optional: [ISessionContextDialogs, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    documentManager: IDocumentManager,
    executor: INotebookCellExecutor,
    languages: IEditorLanguageRegistry,
    sessionContextDialogs: ISessionContextDialogs | null,
    translator: ITranslator | null
  ) => {
    Promise.all([app.started, app.restored]).then(async ([settings]) => {
      const spinner = new Spinner();
      app.shell.add(spinner, 'mercury');

      const notebookPath = PageConfig.getOption('notebookPath');
      const mercuryPanel = documentManager.open(
        notebookPath,
        'Mercury'
      ) as MercuryWidget;

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
            kernelConnection.status === 'idle'
          ) {
            kernelConnection.connectionStatusChanged.disconnect(executeAll);
            kernelConnection.statusChanged.disconnect(executeAll);

            // Execute all cells and wait for the initial execution
            const scheduledForExecution = new Set<string>();
            const notebook = mercuryPanel.context.model;

            function onCellExecutionScheduled(args: { cell: Cell }) {
              scheduledForExecution.add(args.cell.model.id);
            }

            function onCellExecuted(args: { cell: Cell }) {
              scheduledForExecution.delete(args.cell.model.id);
            }

            for (const cellItem of (
              mercuryPanel.content.widgets[0] as AppWidget
            ).cellWidgets) {
              if (!cellItem.sidebar) {
                await executor.runCell({
                  cell: cellItem.child as Cell,
                  notebook,
                  notebookConfig: mercuryPanel.content.notebookConfig,
                  onCellExecuted: onCellExecuted,
                  onCellExecutionScheduled: onCellExecutionScheduled,
                  sessionContext: mercuryPanel.context.sessionContext,
                  sessionDialogs: sessionContextDialogs ?? undefined,
                  translator: translator ?? undefined
                });
              }
            }

            const waitForExecution = new PromiseDelegate();
            const pollExecution = setInterval(() => {
              if (scheduledForExecution.size == 0) {
                clearInterval(pollExecution);
                waitForExecution.resolve(undefined);
              }
            }, 500);

            await waitForExecution.promise;

            // Once everything is executed, clone the document in
            // order to place correctly the controllers in the sidebar.
            const executedPanel = documentManager.cloneWidget(mercuryPanel);
            spinner.dispose();
            if (executedPanel) {
              // Remove the toolbar
              executedPanel.toolbar.hide();
              app.shell.add(executedPanel, 'mercury');
              mercuryPanel.dispose();
            } else {
              app.shell.add(new Error());
            }
          }
        };

        kernelConnection?.connectionStatusChanged.connect(executeAll);
        kernelConnection?.statusChanged.connect(executeAll);
        executeAll();
      });
    });
  }
};
