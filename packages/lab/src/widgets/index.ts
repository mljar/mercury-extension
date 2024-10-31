import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IJupyterWidgetRegistry } from '@jupyter-widgets/base';

import {
  registerWidgetManager,
  WidgetRenderer
} from '@jupyter-widgets/jupyterlab-manager';

import { MercuryPanel } from '../mercury/panel';

import { IMercuryTracker } from '../mercury/widget';

function* widgetRenderers(
  editor: MercuryPanel
): IterableIterator<WidgetRenderer> {
  for (const w of editor.cellWidgets) {
    if (w instanceof WidgetRenderer) {
      yield w;
    }
  }
}

/**
 * A plugin to add support for rendering Jupyter Widgets.
 */
export const widgets: JupyterFrontEndPlugin<void> = {
  id: '@mljar/mercury-support-ipywidgets',
  autoStart: true,
  optional: [IMercuryTracker, IJupyterWidgetRegistry],
  activate: (
    app: JupyterFrontEnd,
    mercuryTracker: IMercuryTracker | null,
    widgetRegistry: IJupyterWidgetRegistry | null
  ) => {
    if (!widgetRegistry) {
      return;
    }
    mercuryTracker?.forEach(widget => {
      registerWidgetManager(
        widget.context,
        widget.content.rendermime,
        widgetRenderers(widget.content)
      );
    });

    mercuryTracker?.widgetAdded.connect((sender, widget) => {
      registerWidgetManager(
        widget.context,
        widget.content.rendermime,
        widgetRenderers(widget.content)
      );
    });
  }
};
