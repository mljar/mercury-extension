/* eslint-disable no-inner-declarations */
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IEditorLanguageRegistry } from '@jupyterlab/codemirror';
import { PageConfig } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { MercuryWidget } from '@mljar/mercury-extension';

/**
 * Open the notebook with Mercury.
 */
export const plugin: JupyterFrontEndPlugin<void> = {
  id: 'mercury-application:opener',
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

    Promise.all([app.started, app.restored]).then(async ([settings]) => {
      const notebookPath = PageConfig.getOption('notebookPath');
      const mercuryPanel = documentManager.open(
        notebookPath,
        'Mercury'
      ) as MercuryWidget;

      mercuryPanel.context.ready.then(async () => {
        // await languages.getLanguage(mercuryPanel.content.codeMimetype);
      });

      // Remove the toolbar - fail due to the dynamic load of the toolbar items
      // notebookPanel.toolbar.dispose();
      mercuryPanel.toolbar.hide();

      app.shell.add(mercuryPanel, 'mercury');
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
