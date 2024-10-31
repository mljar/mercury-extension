/* eslint-disable no-inner-declarations */
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IEditorLanguageRegistry } from '@jupyterlab/codemirror';
import { PageConfig } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { NotebookPanel } from '@jupyterlab/notebook';

/**
 * Open the notebook with Mercury.
 */
export const plugin: JupyterFrontEndPlugin<void> = {
  id: 'mercury-app:opener',
  autoStart: true,
  requires: [IDocumentManager, IEditorLanguageRegistry],
  optional: [],
  activate: (
    app: JupyterFrontEnd,
    documentManager: IDocumentManager,
    languages: IEditorLanguageRegistry
  ) => {
    // Uncomment in dev mode to send logs to the parent window
    //Private.setupLog();

    // // Get the active cell index from query argument
    // const url = new URL(window.location.toString());
    // const activeCellIndex = parseInt(
    //   url.searchParams.get('activeCellIndex') ?? '0',
    //   10
    // );

    // // Remove active cell from argument
    // url.searchParams.delete('activeCellIndex');
    // url.searchParams.delete('fullscreen');
    // window.history.pushState(null, '', url.toString());

    Promise.all([app.started, app.restored]).then(async ([settings]) => {
      const notebookPath = PageConfig.getOption('notebookPath');
      const notebookPanel = documentManager.open(
        notebookPath,
        'Notebook'
      ) as NotebookPanel;

      // // With the new windowing, some cells are not visible and we need
      // // to deactivate the windowing and wait for each cell to be ready.
      // notebookPanel.content.notebookConfig = {
      //   ...notebookPanel.content.notebookConfig,
      //   windowingMode: 'none'
      // };

      // Wait until the context is fully loaded
      notebookPanel.context.ready.then(async () => {
        await Promise.all(
          notebookPanel.content.widgets.map(cell => cell.ready)
        );

        await languages.getLanguage(notebookPanel.content.codeMimetype);
      });

      // Remove the toolbar - fail due to the dynamic load of the toolbar items
      // notebookPanel.toolbar.dispose();
      notebookPanel.toolbar.hide();

      app.shell.add(notebookPanel, 'mercury');
    });
  }
};

// @ts-expect-error 'Private' may never be read
namespace Private {
  export function setupLog(): void {
    const _debug = console.debug;
    const _info = console.info;
    const _warn = console.warn;
    const _error = console.error;

    function post(payload: any) {
      try {
        window.top?.postMessage(payload, '/');
      } catch (err) {
        window.top?.postMessage(
          {
            level: 'debug',
            msg: [
              '[Mercury]:',
              'Issue cloning object when posting log message, JSON stringify version is:',
              JSON.stringify(payload)
            ]
          },
          '/'
        );
      }
    }
    console.debug = (...args) => {
      post({ level: 'debug', msg: ['[Mercury]:', ...args] });
      _debug(...args);
    };

    console.info = console.info = (...args) => {
      post({ level: 'info', msg: ['[Mercury]:', ...args] });
      _info(...args);
    };

    console.warn = (...args) => {
      post({ level: 'warn', msg: ['[Mercury]:', ...args] });
      _warn(...args);
    };

    console.error = (...args) => {
      post({ level: 'error', msg: ['[Mercury]:', ...args] });
      _error(...args);
    };
  }
}
