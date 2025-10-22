// src/mercury/widget.ts

import { IWidgetTracker, ToolbarButton } from '@jupyterlab/apputils';
import { DocumentWidget, DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel } from '@jupyterlab/notebook';
import { saveIcon } from '@jupyterlab/ui-components';
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
  console.log('[Mercury][env] inJupyterLab =', res);
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
 * Every function logs verbosely for debugging.
 * ──────────────────────────────────────────────────────────────────────────── */
function snapshotAllMetadata(
  context: DocumentRegistry.IContext<INotebookModel>
): Record<string, any> {
  const shared = (context.model as any)?.sharedModel;
  if (shared?.getMetadata) {
    const snap = shared.getMetadata() ?? {};
    console.log('[Mercury][meta] snapshot via sharedModel:', snap);
    return snap as Record<string, any>;
  }
  const md = context.model?.metadata as unknown as IObservableJSON | undefined;
  // @ts-ignore toJSON exists at runtime
  const snap = (md?.toJSON ? md.toJSON() : {}) as Record<string, any>;
  console.log('[Mercury][meta] snapshot via observable metadata:', snap);
  return snap ?? {};
}

function readMercuryMeta(
  context: DocumentRegistry.IContext<INotebookModel>
): Record<string, any> {
  const shared = (context.model as any)?.sharedModel;
  if (shared?.getMetadata) {
    const meta = shared.getMetadata() ?? {};
    const val = (meta as any).mercury ?? {};
    console.log('[Mercury][meta][read] (sharedModel) mercury =', val);
    return val && typeof val === 'object' ? val : {};
  }
  const md = context.model?.metadata as unknown as IObservableJSON | undefined;
  const hasGet = typeof md?.get === 'function';
  const val = hasGet ? (md!.get('mercury') as any) : {};
  console.log('[Mercury][meta][read] (observable) mercury =', val);
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
    console.log(
      '[Mercury][meta][patch] (sharedModel) BEFORE =',
      beforeAll,
      'PATCH =',
      patch,
      'AFTER =',
      nextAll
    );
    shared.setMetadata(nextAll);
    return;
  }

  // Fallback: legacy observable metadata (JupyterLab 3.x)
  const md = context.model?.metadata as unknown as IObservableJSON | undefined;
  const hasSet = typeof md?.set === 'function';
  console.log('[Mercury][meta][patch] (observable) hasSet =', hasSet, 'PATCH =', patch);
  if (!hasSet) {
    console.warn('[Mercury][meta] no available writer (neither sharedModel nor metadata.set).');
    return;
  }
  // @ts-ignore toJSON exists at runtime
  const beforeAll = (md!.toJSON ? md!.toJSON() : {}) as Record<string, any>;
  const prev = (md!.get('mercury') as any) ?? {};
  const next = { ...prev, ...patch };
  md!.set('mercury', next);
  // @ts-ignore
  const afterAll = (md!.toJSON ? md!.toJSON() : {}) as Record<string, any>;
  console.log('[Mercury][meta][patch] (observable) BEFORE =', beforeAll, 'AFTER =', afterAll);
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
      // Make it look identical to a notebook toolbar
      this.toolbar.addClass('jp-NotebookPanel-toolbar');
      console.log('[Mercury][toolbar] creating Notebook-style toolbar');

      // Debounced auto-save used by inputs
      const scheduleSave = debounce(() => {
        console.log('[Mercury][save] debounced save → context.save()');
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
        console.log('[Mercury][context] ready → true');
        const meta = readMercuryMeta(context);
        const initial = meta.title ?? '';
        console.log('[Mercury][title] initial =', initial);
        titleInput.value = String(initial);
      });

      titleInput.addEventListener('input', () => {
        console.log('[Mercury][title] input →', titleInput.value);
        if (!context.model) return;
        patchMercuryMeta(context, { title: titleInput.value });
        console.log('[Mercury][meta] after title patch =', snapshotAllMetadata(context));
        scheduleSave();
      });

      titleInput.addEventListener('change', () => {
        console.log('[Mercury][save] blur save → context.save()');
        void context.save();
      });

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
        const initial = meta.description ?? '';
        console.log('[Mercury][description] initial =', initial);
        descInput.value = String(initial);
      });

      descInput.addEventListener('input', () => {
        console.log('[Mercury][description] input →', descInput.value);
        if (!context.model) return;
        patchMercuryMeta(context, { description: descInput.value });
        console.log('[Mercury][meta] after description patch =', snapshotAllMetadata(context));
        scheduleSave();
      });

      descInput.addEventListener('change', () => {
        console.log('[Mercury][save] blur save (description) → context.save()');
        void context.save();
      });

      this.toolbar.addItem('app-desc', new Widget({ node: descInput }));

      /* ────────────────────────────────────────────────────────────────────
       * Show code checkbox → metadata.mercury.showCode (boolean)
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

      showCodeWrap.appendChild(showCodeInput);
      showCodeWrap.appendChild(showCodeText);

      void context.ready.then(() => {
        const meta = readMercuryMeta(context);
        const initial = !!meta.showCode;
        console.log('[Mercury][showCode] initial =', initial);
        showCodeInput.checked = initial;
      });

      showCodeInput.addEventListener('change', () => {
        const value = !!showCodeInput.checked;
        console.log('[Mercury][showCode] change →', value);
        if (!context.model) return;
        patchMercuryMeta(context, { showCode: value });
        console.log('[Mercury][meta] after showCode patch =', snapshotAllMetadata(context));
        // optional: immediate save on toggle for snappy UX
        void context.save();
      });

      this.toolbar.addItem('show-code', new Widget({ node: showCodeWrap }));

      /* ────────────────────────────────────────────────────────────────────
       * Save button (explicit save)
       * ──────────────────────────────────────────────────────────────────── */
      const saveBtn = new ToolbarButton({
        icon: saveIcon,
        tooltip: 'Save Notebook',
        onClick: () => {
          console.log('[Mercury][toolbar] Save clicked → context.save()');
          void context.save();
        }
      });
      this.toolbar.addItem('save', saveBtn);
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tracker token (unchanged)
 * ──────────────────────────────────────────────────────────────────────────── */
export interface IMercuryTracker extends IWidgetTracker<MercuryWidget> {}

export const IMercuryTracker = new Token<IMercuryTracker>(
  '@mljar/mercury-extension:IMercuryTracker'
);
