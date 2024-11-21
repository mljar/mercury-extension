/* eslint-disable no-inner-declarations */
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IEditorLanguageRegistry } from '@jupyterlab/codemirror';
import { PageConfig, signalToPromise } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { type AppWidget, type MercuryWidget } from '@mljar/mercury-extension';

/**
 * Open the notebook with Mercury.
 */
export const plugin: JupyterFrontEndPlugin<void> = {
  id: 'mercury-application:opener',
  autoStart: true,
  requires: [IDocumentManager, IEditorLanguageRegistry],
  activate: (
    app: JupyterFrontEnd,
    documentManager: IDocumentManager,
    languages: IEditorLanguageRegistry
  ) => {
    Promise.all([app.started, app.restored]).then(async ([settings]) => {
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

        const executeAll = () => {
          if (
            kernelConnection?.connectionStatus === 'connected' &&
            kernelConnection.status === 'idle'
          ) {
            kernelConnection.connectionStatusChanged.disconnect(executeAll);
            kernelConnection.statusChanged.disconnect(executeAll);

            (mercuryPanel.content.widgets[0] as AppWidget).executeCellItems();
          }
        };

        //
        kernelConnection?.connectionStatusChanged.connect(executeAll);
        kernelConnection?.statusChanged.connect(executeAll);
        executeAll();
      });

      // Remove the toolbar - fail due to the dynamic load of the toolbar items
      // notebookPanel.toolbar.dispose();
      mercuryPanel.toolbar.hide();

      app.shell.add(mercuryPanel, 'mercury');
    });
  }
};
