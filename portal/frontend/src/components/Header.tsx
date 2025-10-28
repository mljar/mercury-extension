'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import API from '@/lib/api';

type Notebook = {
  id?: string | number;
  slug?: string;
  title?: string;
  name?: string;
  filename?: string;
  description?: string;

  // thumbnail fields (match NotebookCard)
  thumbnail_bg?: string;
  thumbnail_text_color?: string;
  thumbnail_text?: string;
};

export default function Header() {
  // data
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ui
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // helpers
  const titleOf = (nb: Notebook) =>
    nb.title?.toString() ||
    nb.name?.toString() ||
    nb.filename?.toString() ||
    nb.slug?.toString() ||
    (nb.id != null ? String(nb.id) : 'Untitled');

  const hrefOf = (nb: Notebook) => {
    const idPart =
      nb.slug ?? nb.id ?? nb.title ?? nb.name ?? nb.filename ?? 'unknown';
    return `/notebooks/${encodeURIComponent(String(idPart))}`;
  };

  useEffect(() => {
    let alive = true;
    const fetchNotebooks = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await API.get<any>('notebooks/');
        if (!alive) return;
        const data = res?.data;
        const list: Notebook[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [];
        setNotebooks(list);
      } catch (e: any) {
        if (!alive) return;
        setError(
          e?.response?.data?.detail || e?.message || 'Failed to load notebooks.'
        );
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchNotebooks();

    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (
        !menuRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => {
          const input =
            menuRef.current?.querySelector<HTMLInputElement>(
              'input[data-search]'
            );
          input?.focus();
          input?.select();
        }, 0);
      }
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return notebooks;
    return notebooks.filter(n => titleOf(n).toLowerCase().includes(s));
  }, [q, notebooks]);

  return (
    <div
      className="
        sticky top-0 z-50
        bg-black 
        border-b 
        px-3 sm:px-4 py-1.5
      "
    >
      <div className="mx-auto max-w-4xl flex items-center justify-between">
        {/* Brand (keep understated like Stripe) */}
        <Link href="/" className="inline-flex items-center gap-2">
          <span
            className="
              text-[14px] sm:text-xl font-semibold tracking-tight text-gray-100
            "
          >
            Mercury
          </span>
        </Link>

        {/* Actions */}
        <div className="relative" ref={menuRef}>
          <button
            ref={buttonRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen(v => !v)}
            className="
              inline-flex items-center gap-2 rounded-lg
              border border-gray-200 bg-white px-3 py-1.5 text-[13px]
              text-gray-700 hover:bg-white focus:outline-none
              focus-visible:ring-2 focus-visible:ring-blue-500/50
              transition
            "
          >
            Notebooks
            <svg
              className={`h-4 w-4 transform transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Dropdown */}
          {open && (
            <div
              role="menu"
              aria-label="Notebook list"
              className="
                absolute right-0 mt-2 w-[22rem] max-h-[28rem] overflow-auto
                rounded-2xl border border-black/[0.08]
                bg-white/90 backdrop-blur
                shadow-[0_8px_30px_rgba(0,0,0,0.06)]
                ring-1 ring-black/[0.02]
              "
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white/90 backdrop-blur rounded-t-2xl">
                <div className="px-3 pt-2 pb-2 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-medium text-gray-500">
                      Your notebooks
                    </div>
                    <div className="hidden sm:block text-[11px] text-gray-400">
                      <kbd className="rounded border px-1.5 py-0.5 text-[10px]">
                        ⌘K
                      </kbd>
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="sr-only" htmlFor="nb-search">
                      Search notebooks
                    </label>
                    <div className="relative">
                      <input
                        id="nb-search"
                        data-search
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="Search notebooks…"
                        className="
                          w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5
                          text-[13px] text-gray-800 placeholder:text-gray-400
                          focus:outline-none focus:ring-2 focus:ring-blue-500/30
                        "
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M21 21l-4.3-4.3"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                          <circle
                            cx="11"
                            cy="11"
                            r="6.5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="py-1">
                {/* Loading skeleton */}
                {loading && (
                  <ul className="p-2 space-y-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <li key={i} className="animate-pulse">
                        <div className="mx-2 h-8 rounded-md bg-gray-100" />
                      </li>
                    ))}
                  </ul>
                )}

                {/* Error */}
                {!loading && error && (
                  <div className="px-3 py-3 text-[13px] text-red-600">
                    {error}
                  </div>
                )}

                {/* Empty */}
                {!loading && !error && filtered.length === 0 && (
                  <div className="px-3 py-3 text-[13px] text-gray-500">
                    No notebooks found.
                  </div>
                )}

                {/* List */}
                {!loading && !error && filtered.length > 0 && (
                  <ul className="py-1">
                    {filtered.map((nb, idx) => {
                      const t = titleOf(nb);
                      const href = hrefOf(nb);
                      const key =
                        (nb.id != null ? String(nb.id) : nb.slug) ??
                        `${t}-${idx}`;

                      const bg = nb.thumbnail_bg || '#f1f5f9'; // slate-100
                      const color = nb.thumbnail_text_color || '#0f172a'; // slate-900
                      const text = nb.thumbnail_text || '📒';

                      return (
                        <li key={key}>
                          <Link
                            href={href}
                            onClick={() => setOpen(false)}
                            role="menuitem"
                            className="
                              group mx-1 my-0.5 flex items-center gap-2.5 rounded-lg
                              px-2.5 py-2 text-[13px]
                              text-gray-700 hover:bg-gray-50 hover:text-gray-900
                              focus:outline-none
                            "
                          >
                            {/* Thumbnail (matches NotebookCard style, scaled for menu) */}
                            <div
                              aria-hidden
                              className={`inline-flex h-7 w-9 items-center justify-center rounded-lg shadow-sm flex-shrink-0 text-[${text.length > 2 ? 6 : 13}px] font-medium`}
                              style={{ backgroundColor: bg, color }}
                            >
                              {text}
                            </div>

                            <span className="truncate">{t}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
