import { JupyterFrontEndPlugin } from '@jupyterlab/application';

import { mercury } from './mercury';

import { widgets } from './widgets';

import { commands } from './commands';

import { notebookCellExecutor } from './executor';

export {
  IMercuryTracker,
  MercuryWidget,
  MercuryWidgetFactory
} from './mercury';

const plugins: JupyterFrontEndPlugin<any>[] = [
  mercury,
  widgets,
  commands,
  notebookCellExecutor
];

export default plugins;
