// src/mercury/widget.ts

import { IWidgetTracker } from '@jupyterlab/apputils';
import { DocumentWidget, DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel } from '@jupyterlab/notebook'; 
import { Token } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';
import type { IObservableJSON } from '@jupyterlab/observables';

import { MercuryPanel } from './panel';

/* ────────────────────────────────────────────────────────────────────────────
 * Environment detector: show toolbar only in JupyterLab
 * ──────────────────────────────────────────────────────────────────────────── */
function inJupyterLab(): boolean {
  const res = !!(
    document.querySelector('.jp-LabShell') ||
    (window as any).jupyterlab ||
    (window as any).jupyterapp
  );
  return res;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Small debounce helper for autosave
 * ──────────────────────────────────────────────────────────────────────────── */
function debounce<T extends (...args: any[]) => any>(fn: T, ms = 1000) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Metadata helpers (prefer sharedModel; fallback to legacy observable)
 * ──────────────────────────────────────────────────────────────────────────── */

function readMercuryMeta(
  context: DocumentRegistry.IContext<INotebookModel>
): Record<string, any> {
  const shared = (context.model as any)?.sharedModel;
  if (shared?.getMetadata) {
    const meta = shared.getMetadata() ?? {};
    const val = (meta as any).mercury ?? {};
    return val && typeof val === 'object' ? val : {};
  }
  const md = context.model?.metadata as unknown as IObservableJSON | undefined;
  const hasGet = typeof md?.get === 'function';
  const val = hasGet ? (md!.get('mercury') as any) : {};
  return val && typeof val === 'object' ? val : {};
}

function patchMercuryMeta(
  context: DocumentRegistry.IContext<INotebookModel>,
  patch: Record<string, any>
): void {
  const shared = (context.model as any)?.sharedModel;

  // Preferred path: sharedModel (JupyterLab 4+)
  if (shared?.getMetadata && shared?.setMetadata) {
    const beforeAll = shared.getMetadata() ?? {};
    const prev = (beforeAll as any).mercury ?? {};
    const nextAll = { ...beforeAll, mercury: { ...prev, ...patch } };
    shared.setMetadata(nextAll);
    return;
  }

  // Fallback: legacy observable metadata (JupyterLab 3.x)
  const md = context.model?.metadata as unknown as IObservableJSON | undefined;
  const hasSet = typeof md?.set === 'function';
  if (!hasSet) {
    return;
  }
  // @ts-ignore toJSON exists at runtime
  const beforeAll = (md!.toJSON ? md!.toJSON() : {}) as Record<string, any>;
  const prev = (md!.get('mercury') as any) ?? {};
  const next = { ...prev, ...patch };
  md!.set('mercury', next);
  // @ts-ignore
  const afterAll = (md!.toJSON ? md!.toJSON() : {}) as Record<string, any>;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Document widget with Notebook-style toolbar
 * ──────────────────────────────────────────────────────────────────────────── */
export class MercuryWidget extends DocumentWidget<MercuryPanel, INotebookModel> {
  constructor(
    context: DocumentRegistry.IContext<INotebookModel>,
    content: MercuryPanel
  ) {
    super({ context, content });
    this.title.label = context.localPath;
    this.title.closable = true;
    this.addClass('jp-NotebookPanel');

    if (inJupyterLab()) {
      this.toolbar.addClass('jp-NotebookPanel-toolbar');

      const scheduleSave = debounce(() => {
        void context.save();
      }, 1000);

      /* ────────────────────────────────────────────────────────────────────
       * App Title input → metadata.mercury.title
       * ──────────────────────────────────────────────────────────────────── */
      const titleInput = document.createElement('input');
      titleInput.placeholder = 'App title';
      titleInput.className = 'mercury-toolbar-title jp-mod-styled';
      titleInput.setAttribute('aria-label', 'Mercury App Title');

      void context.ready.then(() => {
        const meta = readMercuryMeta(context);
        titleInput.value = String(meta.title ?? '');
      });

      titleInput.addEventListener('input', () => {
        if (!context.model) return;
        patchMercuryMeta(context, { title: titleInput.value });
        scheduleSave();
      });

      titleInput.addEventListener('change', () => void context.save());
      this.toolbar.addItem('app-title', new Widget({ node: titleInput }));

      /* ────────────────────────────────────────────────────────────────────
       * App Description input → metadata.mercury.description
       * ──────────────────────────────────────────────────────────────────── */
      const descInput = document.createElement('input');
      descInput.placeholder = 'App description';
      descInput.className = 'mercury-toolbar-desc jp-mod-styled';
      descInput.setAttribute('aria-label', 'Mercury App Description');

      void context.ready.then(() => {
        const meta = readMercuryMeta(context);
        descInput.value = String(meta.description ?? '');
      });

      descInput.addEventListener('input', () => {
        if (!context.model) return;
        patchMercuryMeta(context, { description: descInput.value });
        scheduleSave();
      });

      descInput.addEventListener('change', () => void context.save());
      this.toolbar.addItem('app-desc', new Widget({ node: descInput }));

      /* ────────────────────────────────────────────────────────────────────
       * Show code checkbox → metadata.mercury.showCode
       * ──────────────────────────────────────────────────────────────────── */
      const showCodeWrap = document.createElement('label');
      showCodeWrap.className = 'mercury-toolbar-checkbox';
      showCodeWrap.title = 'Show code cells';

      const showCodeInput = document.createElement('input');
      showCodeInput.type = 'checkbox';
      showCodeInput.setAttribute('aria-label', 'Show code');
      showCodeInput.style.marginRight = '6px';

      const showCodeText = document.createElement('span');
      showCodeText.textContent = 'Show code';
      showCodeWrap.append(showCodeInput, showCodeText);

      void context.ready.then(() => {
        const meta = readMercuryMeta(context);
        showCodeInput.checked = !!meta.showCode;
      });

      showCodeInput.addEventListener('change', () => {
        if (!context.model) return;
        patchMercuryMeta(context, { showCode: !!showCodeInput.checked });
        void context.save();
      });

      this.toolbar.addItem('show-code', new Widget({ node: showCodeWrap }));

      /* ────────────────────────────────────────────────────────────────────
       * Auto re-run checkbox → metadata.mercury.autoRerun (default true)
       * ──────────────────────────────────────────────────────────────────── */
      const autoRerunWrap = document.createElement('label');
      autoRerunWrap.className = 'mercury-toolbar-checkbox';
      autoRerunWrap.title = 'Automatically re-run cells when widgets change';

      const autoRerunInput = document.createElement('input');
      autoRerunInput.type = 'checkbox';
      autoRerunInput.setAttribute('aria-label', 'Auto re-run');
      autoRerunInput.style.marginRight = '6px';

      const autoRerunText = document.createElement('span');
      autoRerunText.textContent = 'Auto re-run';
      autoRerunWrap.append(autoRerunInput, autoRerunText);

      void context.ready.then(() => {
        const meta = readMercuryMeta(context);
        // Default to true if missing
        const initial = meta.autoRerun === undefined ? true : !!meta.autoRerun;
        autoRerunInput.checked = initial;
      });

      autoRerunInput.addEventListener('change', () => {
        const value = !!autoRerunInput.checked;
        if (!context.model) return;
        patchMercuryMeta(context, { autoRerun: value });
        void context.save();
      });

      this.toolbar.addItem('auto-rerun', new Widget({ node: autoRerunWrap }));
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tracker token
 * ──────────────────────────────────────────────────────────────────────────── */
export interface IMercuryTracker extends IWidgetTracker<MercuryWidget> {}

export const IMercuryTracker = new Token<IMercuryTracker>(
  '@mljar/mercury-extension:IMercuryTracker'
);
