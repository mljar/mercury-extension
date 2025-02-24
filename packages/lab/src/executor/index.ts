import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { INotebookCellExecutor } from '@jupyterlab/notebook';

import { NotebookCellExecutor } from './notebookcell';

export const notebookCellExecutor: JupyterFrontEndPlugin<INotebookCellExecutor> =
  {
    id: '@mljar/mercury-extension:notebook-cell-executor',
    description: 'Mercury cell executor',
    autoStart: true,
    provides: INotebookCellExecutor,
    activate: (app: JupyterFrontEnd): INotebookCellExecutor => {
      console.log('cell executor');
      return new NotebookCellExecutor();
    }
  };
