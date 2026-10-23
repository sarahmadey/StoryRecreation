"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Cover } from "@/components/Books";
import { useApi } from "@/components/Grownup";
import { Spinner } from "@/components/Waiting";
import { SHELF_ORDER } from "@/lib/shared/options";
import type { Book } from "@/lib/shared/types";

const sameName = (a: string, b: string) => a.trim().localeCompare(b.trim(), undefined, { sensitivity: "base" }) === 0;
const rank = (shelf: string) => {
  const i = SHELF_ORDER.indexOf(shelf);
  return i === -1 ? 100 : i;
};

/**
 * Making a folder of books, or changing one: what it's called, and the books in it, ticked. A folder's own books are
 * listed first, then every other book shelf by shelf, so one that's in another folder can be moved here.
 */
export function FolderMaker({
  books,
  folder,
  onDone,
  onCancel,
}: {
  /** Every book in the library. */
  books: Book[];
  /** The folder being changed, or null for a new one. */
  folder: string | null;
  /** Saved: the folder's name as it was kept (null when it was unpacked), and every book as it is now. */
  onDone: (name: string | null, books: Book[]) => void;
  onCancel: () => void;
}) {
  const api = useApi();
  const router = useRouter();
  const [name, setName] = useState(folder ?? "");
  const [picked, setPicked] = useState(() => new Set(books.filter((b) => folder && b.folder === folder).map((b) => b.id)));
  const [query, setQuery] = useState("");
  const [onShelf, setOnShelf] = useState<string | null>(null);
  const [missing, setMissing] = useState<"name" | "books" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const booksRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  // Opened where it was asked for, in full view.
  useEffect(() => panelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), []);

  // Listed once, as the panel opens, so a book doesn't jump about when it's ticked. The newest first on each shelf.
  const [groups] = useState(() => {
    const newest = [...books].sort((a, b) => b.createdAt - a.createdAt);
    const own = newest.filter((b) => folder && b.folder === folder);
    const byShelf = new Map<string, Book[]>();
    for (const b of newest) if (!own.includes(b)) byShelf.set(b.shelf, [...(byShelf.get(b.shelf) ?? []), b]);
    const shelves = [...byShelf].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
    return own.length ? [[`In “${folder}” now`, own] as [string, Book[]], ...shelves] : shelves;
  });
  const others = [...new Set(books.map((b) => b.folder).filter((f): f is string => Boolean(f) && f !== folder))];
  const joins = name.trim() ? others.find((f) => sameName(f, name)) : undefined;
  const q = query.trim().toLowerCase();
  const shown = (list: Book[]) => list.filter((b) => (!onShelf || b.shelf === onShelf) && (!q || b.title.toLowerCase().includes(q)));
  // A long list can be narrowed to one shelf: the dreamed-up tales, say.
  const shelfNames = [...new Set(groups.flatMap(([, list]) => list.map((b) => b.shelf)))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const n = picked.size;

  const toggle = (id: string) => {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMissing((m) => (m === "books" ? null : m));
  };

  const save = async (unpack = false) => {
    if (saving) return;
    const bookIds = unpack ? [] : [...picked];
    if (unpack) {
      if (!confirm(`Unpack “${folder}”? Its books go back on their shelves, just as they were.`)) return;
    } else if (!name.trim()) {
      setMissing("name");
      nameRef.current?.focus();
      nameRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    } else if (!bookIds.length) {
      if (!folder) {
        setMissing("books");
        booksRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }
      if (!confirm(`Nothing is ticked, so “${folder}” would be empty. Unpack it? Its books go back on their shelves.`)) return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<{ folder: string | null; books: Book[] }>("/api/folders", { from: folder, name: name.trim(), bookIds });
      router.refresh();
      onDone(res.folder, res.books);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save. Try again?");
      setSaving(false);
    }
  };

  return (
    <section ref={panelRef} className="folder-maker parchment stack" aria-label={folder ? `Change the folder ${folder}` : "Make a folder"}>
      <div>
        <h2 className="folder-maker-title">{folder ? `📁 Change “${folder}”` : "📁 Make a folder"}</h2>
        {!folder && (
          <p className="hint" style={{ margin: 0 }}>
            Books in a folder stand together on the shelf as one. Tap the folder to open it.
          </p>
        )}
      </div>

      <label className="field">
        <span>What&apos;s it called?</span>
        <input
          ref={nameRef}
          className="input"
          value={name}
          maxLength={40}
          placeholder="Twinkle and Adaline"
          aria-invalid={missing === "name" || undefined}
          onChange={(e) => {
            setName(e.target.value);
            setMissing((m) => (m === "name" ? null : m));
          }}
        />
        {missing === "name" && (
          <div className="field-error" role="alert">
            Give the folder a name here.
          </div>
        )}
        {joins && <div className="hint">There&apos;s a folder called “{joins}” already. These books will join it.</div>}
      </label>

      <div ref={booksRef} className="stack" style={{ ["--gap" as string]: "10px" }}>
        <span className="label" style={{ margin: 0 }}>
          {folder ? "The books in it" : "Tick the books to put in it"}
          {n > 0 && <span className="folder-ticked"> · {n} ticked</span>}
        </span>
        {missing === "books" && (
          <div className="field-error" role="alert" style={{ marginTop: 0 }}>
            Tick at least one book to put in the folder.
          </div>
        )}
        {books.length > 12 && (
          <>
            <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 Find a book" aria-label="Find a book" />
            {shelfNames.length > 1 && (
              <div className="chips folder-shelves" role="group" aria-label="Show the books on">
                <button type="button" className="chip" aria-pressed={!onShelf} onClick={() => setOnShelf(null)}>
                  Every shelf
                </button>
                {shelfNames.map((name) => (
                  <button key={name} type="button" className="chip" aria-pressed={onShelf === name} onClick={() => setOnShelf(name)}>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {groups.map(([shelf, list]) => {
          const these = shown(list);
          if (!these.length) return null;
          return (
            <div key={shelf} className="folder-pick-group" role="group" aria-label={shelf}>
              <div className="folder-pick-shelf">{shelf}</div>
              {these.map((b) => (
                <label key={b.id} className="folder-pick">
                  <input type="checkbox" checked={picked.has(b.id)} onChange={() => toggle(b.id)} />
                  <span className="folder-pick-thumb">
                    <Cover id={b.id} title={b.title} kind={b.kind} coverUrl={b.coverUrl} notes={b.notes} showTitle={false} />
                  </span>
                  <span className="folder-pick-text">
                    <span className="folder-pick-title">{b.title}</span>
                    {b.folder && b.folder !== folder && (
                      <span className="folder-pick-where">
                        in 📁 {b.folder}
                        {picked.has(b.id) ? ", and moves to this one" : ""}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          );
        })}
        {groups.every(([, list]) => shown(list).length === 0) && (
          <p className="hint" style={{ margin: 0 }}>
            No book by that name{onShelf ? ` on ${onShelf}` : ""}.
          </p>
        )}
      </div>

      {error && <p className="notice notice-error">{error}</p>}
      {saving ? (
        <div className="wait-line" role="status" aria-live="polite">
          <Spinner />
          <b>Putting the books away…</b>
        </div>
      ) : (
        <div className="row">
          <button type="button" className="btn" onClick={() => save()}>
            {folder ? "Save the folder" : n > 0 ? `Put ${n === 1 ? "the book" : `${n} books`} in the folder` : "Make the folder"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          {folder && (
            <button type="button" className="btn btn-quiet btn-sm folder-unpack" onClick={() => save(true)}>
              Unpack the folder
            </button>
          )}
        </div>
      )}
    </section>
  );
}
