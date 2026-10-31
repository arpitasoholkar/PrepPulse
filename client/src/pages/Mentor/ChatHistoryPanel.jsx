import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  Plus,
  Search,
  Trash2,
  MoreHorizontal,
  PanelLeftClose,
  X,
} from 'lucide-react';

import Loader from '../../components/Loader.jsx';

// ChatGPT-style conversation list

const startOfDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function groupLabel(value, now = new Date()) {
  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return 'Older';

  const days = Math.round(
    (startOfDay(now) - startOfDay(d)) / 86400000
  );

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 7) return 'Previous 7 Days';
  if (days <= 30) return 'Previous 30 Days';

  return d.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export function groupSessions(sessions, now = new Date()) {
  const groups = [];
  const index = new Map();

  for (const s of sessions) {
    const label = groupLabel(s.updatedAt, now);

    if (!index.has(label)) {
      const group = { label, items: [] };
      index.set(label, group);
      groups.push(group);
    }

    index.get(label).items.push(s);
  }

  return groups;
}

export default function ChatHistoryPanel({
  open,
  sessions,
  loading,
  activeId,
  busy,
  onClose,
  onNewChat,
  onOpen,
  onDelete,
}) {
  const [query, setQuery] = useState('');
  const [menuId, setMenuId] = useState(null);

  const rootRef = useRef(null);

  // Close menu on outside click or Escape
  useEffect(() => {
    if (!menuId) return undefined;

    const onDown = (e) => {
      if (!e.target.closest?.('[data-menu-open]')) {
        setMenuId(null);
      }
    };

    const onKey = (e) => {
      if (e.key === 'Escape') setMenuId(null);
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuId]);

  // Search chats
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return sessions;

    return sessions.filter((s) =>
      [s.title, s.preview, s.topic].some((t) =>
        String(t || '').toLowerCase().includes(q)
      )
    );
  }, [sessions, query]);

  // Group chats by date
  const groups = useMemo(
    () => groupSessions(filtered),
    [filtered]
  );

  if (!open) return null;

  return (
    <>
      {/* Mobile overlay */}
      <button
        type="button"
        aria-label="Close chat history"
        onClick={onClose}
        className="lg:hidden absolute inset-0 z-20 bg-black/30 cursor-default"
      />

      <aside
        ref={rootRef}
        aria-label="Chat history"
        className="
          absolute inset-y-0 left-0 z-30
          w-[85%] max-w-xs
          lg:static lg:z-auto lg:w-72 lg:max-w-none
          lg:shrink-0 min-h-0
          flex flex-col
          bg-white lg:bg-white/40
          border-r border-[#ececf2]
          shadow-2xl lg:shadow-none
          overflow-hidden
        "
      >

        {/* Sidebar Header */}
        <div className="flex items-center gap-2 px-3 pt-3">

          <button
            type="button"
            onClick={onNewChat}
            disabled={busy}
            className="
              flex-1 inline-flex items-center gap-2
              h-11 px-4 rounded-full
              text-sm font-semibold
              border border-[#ececf2]
              bg-white text-ink shadow-sm
              hover:bg-[#f1ecfb]
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-violet-400
              disabled:opacity-50
              transition
            "
          >
            <Plus className="w-4 h-4 text-[#7652C8]" />
            New chat
          </button>

          {/* KEEP THIS SIDEBAR TOGGLE */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="
              p-2 rounded-full
              text-ink-soft
              hover:bg-[#f6f5fa]
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-violet-400
            "
          >
            <PanelLeftClose className="w-4 h-4 hidden lg:block" />
            <X className="w-4 h-4 lg:hidden" />
          </button>

        </div>

        {/* Search */}
        <div className="px-3 pt-3">

          <label htmlFor="chat-search" className="sr-only">
            Search chats
          </label>

          <div className="relative">

            <Search
              className="
                w-4 h-4 absolute left-3.5
                top-1/2 -translate-y-1/2
                text-ink-soft pointer-events-none
              "
            />

            <input
              id="chat-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              className="
                w-full h-10 rounded-full
                border border-[#ececf2]
                bg-[#f6f5fa]
                pl-10 pr-4
                text-sm text-ink
                placeholder:text-ink-soft
                focus:outline-none
                focus:border-[#7652C8]
                focus:ring-2
                focus:ring-[#7652C8]/30
              "
            />

          </div>
        </div>

        {/* Chat History */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-2 pt-2 pb-4">

          {/* Loading */}
          {loading && sessions.length === 0 && (
            <div className="py-10">
              <Loader label="Loading chats…" />
            </div>
          )}

          {/* Empty state */}
          {!loading && sessions.length === 0 && (
            <p className="px-3 py-8 text-sm text-center text-ink-soft">
              No chats yet. Ask the mentor something and it will appear here.
            </p>
          )}

          {/* No search results */}
          {sessions.length > 0 && filtered.length === 0 && (
            <p className="px-3 py-8 text-sm text-center text-ink-soft">
              No chats match "{query}".
            </p>
          )}

          {/* Grouped chats */}
          {groups.map((group) => (

            <section
              key={group.label}
              className="mt-3 first:mt-1"
            >

              <h3
                className="
                  px-3 pb-1
                  text-[11px] font-bold
                  uppercase tracking-wide
                  text-ink-soft
                "
              >
                {group.label}
              </h3>

              <ul className="space-y-0.5">

                {group.items.map((s) => {

                  const active = s.sessionId === activeId;

                  return (

                    <li
                      key={s.sessionId}
                      className="relative"
                      data-menu-open={
                        menuId === s.sessionId ? '' : undefined
                      }
                    >

                      <div
                        className={`
                          group flex items-center
                          rounded-xl transition
                          ${
                            active
                              ? 'bg-[#ece5fa]'
                              : 'hover:bg-[#f6f5fa]'
                          }
                        `}
                      >

                        {/* Chat title */}
                        <button
                          type="button"
                          onClick={() => onOpen(s.sessionId)}
                          disabled={busy}
                          title={s.title}
                          aria-current={
                            active ? 'true' : undefined
                          }
                          className="
                            flex-1 min-w-0 text-left
                            px-3 py-2 text-sm
                            text-ink truncate rounded-xl
                            focus:outline-none
                            focus-visible:ring-2
                            focus-visible:ring-violet-400
                            disabled:opacity-60
                          "
                        >
                          <span
                            className={`
                              block truncate
                              ${active ? 'font-semibold' : ''}
                            `}
                          >
                            {s.title}
                          </span>
                        </button>

                        {/* Three-dot menu */}
                        <button
                          type="button"
                          onClick={() =>
                            setMenuId(
                              menuId === s.sessionId
                                ? null
                                : s.sessionId
                            )
                          }
                          aria-label={`Options for ${s.title}`}
                          aria-haspopup="menu"
                          aria-expanded={
                            menuId === s.sessionId
                          }
                          className={`
                            mr-1 p-1.5 rounded-full
                            text-ink-soft
                            hover:bg-white hover:text-ink
                            focus:outline-none
                            focus-visible:ring-2
                            focus-visible:ring-violet-400
                            ${
                              menuId === s.sessionId || active
                                ? 'opacity-100'
                                : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                            }
                            max-lg:opacity-100
                          `}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                      </div>

                      {/* Delete menu */}
                      {menuId === s.sessionId && (

                        <div
                          role="menu"
                          className="
                            absolute right-1 top-full z-10
                            mt-1 w-40
                            rounded-xl
                            border border-[#ececf2]
                            bg-white p-1 shadow-xl
                          "
                        >

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuId(null);
                              onDelete(s);
                            }}
                            className="
                              w-full flex items-center gap-2
                              rounded-lg px-3 py-2
                              text-sm font-semibold
                              text-rose-600
                              hover:bg-rose-50
                              focus:outline-none
                              focus-visible:ring-2
                              focus-visible:ring-rose-300
                            "
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete chat
                          </button>

                        </div>

                      )}

                    </li>

                  );
                })}

              </ul>

            </section>

          ))}

        </nav>

      </aside>
    </>
  );
}