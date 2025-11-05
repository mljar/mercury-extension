/* eslint-disable no-inner-declarations */
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISessionContextDialogs } from '@jupyterlab/apputils';
import type { Cell } from '@jupyterlab/cells';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { PageConfig, signalToPromise } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { ITranslator } from '@jupyterlab/translation';
import { PromiseDelegate } from '@lumino/coreutils';
import { type AppWidget, type MercuryWidget } from '@mljar/mercury-extension';
import { IMercuryCellExecutor } from '@mljar/mercury-tokens';

type NotebookItem = {
  name: string;
  description?: string;
  href: string;
  thumbnail_bg?: string;
  thumbnail_text?: string;
  thumbnail_text_color?: string;
};

/**
 * Open the notebook with Mercury.
 */
export const plugin: JupyterFrontEndPlugin<void> = {
  id: 'mercury-application:opener',
  autoStart: true,
  requires: [IDocumentManager, IMercuryCellExecutor],
  optional: [IEditorServices, ISessionContextDialogs, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    documentManager: IDocumentManager,
    executor: IMercuryCellExecutor,
    editorServices: IEditorServices | null,
    sessionContextDialogs: ISessionContextDialogs | null,
    translator: ITranslator | null
  ) => {
    const { mimeTypeService } = editorServices ?? {};
    Promise.all([app.started, app.restored]).then(async () => {
      const notebookPath = PageConfig.getOption('notebookPath');
      const mercuryPanel = documentManager.open(
        notebookPath,
        'Mercury'
      ) as MercuryWidget;

      // Hide default toolbar and mount panel early
      mercuryPanel.toolbar.hide();
      app.shell.add(mercuryPanel, 'mercury');

      // ---------- Inject minimal styles (aligned with your HTML snippet) ----------
      const style = document.createElement('style');
      style.id = 'mrc-header-style';
      style.textContent = `
        :root { color-scheme: light dark; }
        .mrc-hidden { display: none; }

        /* Header */
        .mrc-hdr {
          position: fixed; top: 0; left: 0; right: 0; z-index: 10000;
          background: #0b0b0c;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .mrc-hdr-inner {
          margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
          padding: .6rem .75rem;
        }
        .mrc-brand {
          font-weight: 750; letter-spacing: -.01em;
          color: #f3f4f6; font-size: clamp(14px, 2vw, 20px);
          text-decoration: none;
          font-family:  ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        }
        .mrc-brand:hover { text-decoration: underline; }

        /* Button */
        .mrc-btn {
          display: inline-flex; align-items: center; gap: .5rem;
          border: 1px solid #e5e7eb;
          background: #fff; color: #374151;
          padding: .45rem .75rem; font-size: 13px; border-radius: .5rem;
          transition: box-shadow .15s ease, transform .15s ease;
          cursor: pointer;
        }
        .mrc-btn[disabled] { opacity: .7; cursor: progress; }
        .mrc-btn:hover { text-decoration: none; box-shadow: 0 1px 8px rgba(0,0,0,.06); }
        .mrc-caret { transition: transform .15s ease; }

        /* Menu (dropdown) */
        .mrc-menu{
          position:absolute; right:0; margin-top:.5rem; width:22rem; max-height:28rem; overflow:auto;
          border:1px solid rgba(0,0,0,.08); border-radius:1rem;
          background:rgba(255,255,255,.95); backdrop-filter:blur(8px);
          box-shadow:0 10px 30px rgba(0,0,0,.08);
        }
        .mrc-menu-list{ padding:.4rem; }
        .mrc-menu-item{
          display:flex; align-items:center; gap:.7rem;
          padding:.6rem .65rem; border-radius:.75rem;
          color:#111827; font-size:14px;
          text-decoration:none;
          transition: background-color .12s ease, transform .12s ease;
        }
        .mrc-menu-item:hover{ background:#f8fafc; text-decoration:none; }
        .mrc-menu-item:active{ transform: translateY(0.5px); }
        .mrc-menu-thumb{
          width:36px; height:28px; border-radius:.6rem;
          display:grid; place-items:center; font-weight:700; line-height:1;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,.03);
        }
      `;
      document.head.appendChild(style);

      // ---------- Build header ----------
      const header = document.createElement('header');
      header.className = 'mrc-hdr';
      header.setAttribute('role', 'banner');

      const inner = document.createElement('div');
      inner.className = 'mrc-hdr-inner';

      // Brand (styled "Mercury" text)
      const brand = document.createElement('a');
      brand.className = 'mrc-brand';
      brand.href = PageConfig.getBaseUrl() || '/';
      brand.textContent = 'Mercury';

      // Right-side: Notebooks menu button (initially disabled until we load)
      const rightWrap = document.createElement('div');
      rightWrap.style.position = 'relative';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mrc-btn';
      btn.id = 'mrcNbBtn';
      btn.setAttribute('aria-haspopup', 'menu');
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = 'Notebooks';

      const caret = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      caret.setAttribute('class', 'mrc-caret');
      caret.setAttribute('width', '16');
      caret.setAttribute('height', '16');
      caret.setAttribute('viewBox', '0 0 20 20');
      caret.setAttribute('fill', 'currentColor');
      caret.setAttribute('aria-hidden', 'true');
      caret.innerHTML = `<path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 0 1 1.08 1.04l-4.25 4.25a.75.75 0 0 1-1.06 0L5.21 8.27a.75.75 0 0 1 .02-1.06z" clip-rule="evenodd"/>`;
      btn.appendChild(caret);

      const menu = document.createElement('div');
      menu.id = 'mrcNbMenu';
      menu.className = 'mrc-menu mrc-hidden';
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', 'Notebook list');

      const menuList = document.createElement('div');
      menuList.id = 'mrcNbMenuList';
      menuList.className = 'mrc-menu-list';
      menuList.setAttribute('role', 'none');

      menu.appendChild(menuList);
      rightWrap.appendChild(btn);
      rightWrap.appendChild(menu);

      inner.appendChild(brand);
      inner.appendChild(rightWrap);
      header.appendChild(inner);

      // Insert header at top of document
      document.body.insertBefore(header, document.body.firstChild);

      // Add padding to main content below fixed header
      const headerHeight = header.getBoundingClientRect().height || 52;
      const mercuryMainPanel = mercuryPanel.node.querySelector('.mercury-main-panel');
      if (mercuryMainPanel) {
        (mercuryMainPanel as HTMLElement).style.paddingTop = `${headerHeight}px`;
      } else {
        const notebookPanel = mercuryPanel.node.querySelector('.jp-Notebook');
        if (notebookPanel) {
          (notebookPanel as HTMLElement).style.paddingTop = `${headerHeight}px`;
        }
      }

      // --------- Fetch notebooks from API and populate menu ----------
      const baseUrl = PageConfig.getBaseUrl() || '/';
      const apiUrl = `${baseUrl}mercury/api/notebooks`;

      function sizeThumbMenu(el: HTMLElement) {
        const txt = (el.textContent || '').trim();
        let fs = '1.0rem';
        if (txt.length > 6) fs = '0.4rem';
        else if (txt.length > 4) fs = '0.6rem';
        else if (txt.length > 2) fs = '0.8rem';
        el.style.fontSize = fs;
      }

      let notebooks: NotebookItem[] = [];
      let menuOpen = false;

      function setMenu(open: boolean) {
        menu.classList.toggle('mrc-hidden', !open);
        btn.setAttribute('aria-expanded', String(open));
        caret.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
        menuOpen = open;
      }

      function renderMenu(items: NotebookItem[]) {
        const frag = document.createDocumentFragment();
        for (const nb of items) {
          const a = document.createElement('a');
          a.className = 'mrc-menu-item';
          a.href = nb.href || '#';
          a.setAttribute('role', 'menuitem');

          const t = document.createElement('div');
          t.className = 'mrc-menu-thumb';
          t.style.background = nb.thumbnail_bg || '#f1f5f9';
          t.style.color = nb.thumbnail_text_color || '#0f172a';
          t.textContent = nb.thumbnail_text || '📒';
          sizeThumbMenu(t);

          const span = document.createElement('span');
          span.textContent = nb.name || 'Notebook';

          a.appendChild(t);
          a.appendChild(span);
          frag.appendChild(a);
        }
        menuList.innerHTML = '';
        menuList.appendChild(frag);
      }

      async function loadNotebooks() {
        try {
          btn.disabled = true;
          const resp = await fetch(apiUrl, {
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json' }
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = (await resp.json()) as NotebookItem[] | undefined;
          notebooks = Array.isArray(data) ? data : [];
          if (notebooks.length === 0) {
            // No notebooks => hide the button and menu
            btn.style.display = 'none';
            menu.remove();
            return;
          }
          renderMenu(notebooks);
        } catch (err) {
          console.warn('[Mercury] Failed to load notebooks menu:', err);
          // On error, hide button to avoid broken UI
          btn.style.display = 'none';
          menu.remove();
        } finally {
          btn.disabled = false;
        }
      }

      // Events
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!notebooks.length) return; // nothing to show
        setMenu(!menuOpen);
      });

      document.addEventListener('click', (e) => {
        if (!menuOpen) return;
        if (!menu.contains(e.target as Node) && !btn.contains(e.target as Node)) {
          setMenu(false);
        }
      });

      document.addEventListener('keydown', (e) => {
        const key = String(e.key).toLowerCase();
        if (key === 'escape') setMenu(false);
      });

      // Kick off loading the notebooks list
      loadNotebooks();

      // ---------- Execute notebook cells once kernel is ready ----------
      mercuryPanel.context.ready.then(async () => {
        let session = mercuryPanel.context.sessionContext.session;
        if (!session) {
          const [, changes] = await signalToPromise(
            mercuryPanel.context.sessionContext.sessionChanged
          );
          session = changes.newValue!;
        }

        let kernelConnection = session?.kernel;
        if (!kernelConnection) {
          const [, changes] = await signalToPromise(session.kernelChanged);
          kernelConnection = changes.newValue!;
        }

        const executeAll = async () => {
          if (
            kernelConnection?.connectionStatus === 'connected' &&
            kernelConnection?.status === 'idle'
          ) {
            kernelConnection.connectionStatusChanged.disconnect(executeAll);
            kernelConnection.statusChanged.disconnect(executeAll);

            const scheduledForExecution = new Set<string>();
            const notebook = mercuryPanel.context.model;
            const info = notebook.getMetadata('language_info');
            const mimetype = info
              ? mimeTypeService?.getMimeTypeByLanguage(info)
              : undefined;

            const onCellExecutionScheduled = (args: { cell: Cell }) => {
              scheduledForExecution.add(args.cell.model.id);
            };

            const onCellExecuted = (args: { cell: Cell }) => {
              scheduledForExecution.delete(args.cell.model.id);
            };

            for (const cellItem of (
              mercuryPanel.content.widgets[0] as AppWidget
            ).cellWidgets) {
              if (mimetype) {
                cellItem.child.model.mimeType = mimetype;
              }
              await executor.runCell({
                cell: cellItem.child,
                notebook,
                notebookConfig: mercuryPanel.content.notebookConfig,
                onCellExecuted: onCellExecuted,
                onCellExecutionScheduled: onCellExecutionScheduled,
                sessionContext: mercuryPanel.context.sessionContext,
                sessionDialogs: sessionContextDialogs ?? undefined,
                translator: translator ?? undefined
              });
            }

            const waitForExecution = new PromiseDelegate<void>();
            const pollExecution = setInterval(() => {
              if (scheduledForExecution.size === 0) {
                clearInterval(pollExecution);
                waitForExecution.resolve();
              }
            }, 500);

            await waitForExecution.promise;
          }
        };

        kernelConnection?.connectionStatusChanged.connect(executeAll);
        kernelConnection?.statusChanged.connect(executeAll);
        executeAll();
      });
    });
  }
};
