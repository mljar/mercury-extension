import { JupyterFrontEndPlugin } from '@jupyterlab/application';

import { mercury } from './mercury';

import { widgets } from './widgets';

import { commands } from './commands';

import { mercuryCellExecutor, defaultCellExecutor } from './executor';

export {
  IMercuryTracker,
  MercuryWidget,
  MercuryWidgetFactory
} from './mercury';

const plugins: JupyterFrontEndPlugin<any>[] = [
  mercury,
  widgets,
  commands,
  mercuryCellExecutor,
  defaultCellExecutor
];

export default plugins;
