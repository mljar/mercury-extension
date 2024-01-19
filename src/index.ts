import { JupyterFrontEndPlugin } from '@jupyterlab/application';

import { mercury } from './mercury';

import { widgets } from './widgets';

import { commands } from './commands';

const plugins: JupyterFrontEndPlugin<any>[] = [mercury, widgets, commands];

export default plugins;
