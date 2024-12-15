import type {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IRenderMimeRegistry, type IRenderMime } from '@jupyterlab/rendermime';
import { Token } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';

const MERCURY_MIMETYPE = 'application/mercury+json';

export const MercuryRendererTracker = new Token(
  '@mljar/mercury-extension:renderer-tracker',
  'Track Mercury dashboard controller.'
);

export interface IMercuryRendererTracker {
  has(value: string): boolean;
}

class MercuryRenderer extends Widget implements IRenderMime.IRenderer {
  constructor(
    options: IRenderMime.IRendererOptions,
    protected tracker: Set<string>
  ) {
    super();
  }

  async renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const view = model.data[MERCURY_MIMETYPE]
    if(view){
    this.tracker.add(view['model_id'])
    this.node.insertAdjacentHTML(
      'afterbegin',
      `<div style="background:purple; height: 200px; width: 400px;">${model.data[MERCURY_MIMETYPE]}</div>`
    );}
  }
}

export const mercuryMimeRenderer: JupyterFrontEndPlugin<IMercuryRendererTracker> =
  {
    id: '@mljar/mercury-extension:mimerenderer',
    autoStart: true,
    provides: MercuryRendererTracker,
    requires: [IRenderMimeRegistry],
    activate: (app: JupyterFrontEnd, rendermime: IRenderMimeRegistry) => {
      const tracker = new Set<string>();

      rendermime.addFactory({
        mimeTypes: [MERCURY_MIMETYPE],
        safe: false,
        createRenderer: options => new MercuryRenderer(options, tracker)
      });

      return tracker;
    }
  };
