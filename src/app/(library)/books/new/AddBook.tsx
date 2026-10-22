"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/components/Grownup";
import { PhotoPicker } from "@/components/Pickers";
import type { PickedPhoto } from "@/lib/client/images";

/**
 * Adding a book the family owns, the one place it's done: its name, what kind it is, and its pages.
 * Then on to its page (to read its words or make a story), or back to where they came from.
 */
export function AddBook({ then }: { then: "read" | "create" | null }) {
  const api = useApi();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"shadow_book" | "picture_book">("picture_book");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("kind", kind);
      photos.forEach((p) => form.append("pages", p.file, p.file.name));
      const { id } = await api.form<{ id: string }>("/api/books", form);
      router.push(then === "read" ? `/read?book=${id}` : then === "create" ? `/create?book=${id}` : `/books/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The book couldn't be put on the shelf.");
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ ["--gap" as string]: "22px" }}>
      <Link href={then === "read" ? "/read" : then === "create" ? "/create" : "/library"} className="back-link">
        ‹ Back
      </Link>
      <div className="center">
        <div className="eyebrow">The Library</div>
        <h1>Add a book</h1>
        <p className="muted" style={{ margin: 0 }}>
          Photograph a book you own, once. Then your storyteller can read its own words aloud, or dream up new stories for its
          pictures, whenever you like.
        </p>
      </div>
      <div className="parchment stack">
        <label className="field">
          <span>What&apos;s the book called?</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Goodnight, Forest" />
        </label>
        <div>
          <span className="label">What kind of book is it?</span>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={kind === "picture_book"} onClick={() => setKind("picture_book")}>
              📕 Picture book
            </button>
            <button type="button" className="chip" aria-pressed={kind === "shadow_book"} onClick={() => setKind("shadow_book")}>
              🔦 Shadow book
            </button>
          </div>
        </div>
        <div>
          <span className="label">The pages, in order</span>
          <p className="hint" style={{ marginTop: 0 }}>
            One photo per page: snap them here, or choose them all at once from your photos (the first is the cover). For a shadow
            book, photograph each picture disc or slide, or its projection on the wall.
          </p>
          <PhotoPicker photos={photos} onChange={setPhotos} />
        </div>
        {error && <p className="notice notice-error">{error}</p>}
        <div className="center">
          <button className="btn btn-lg" type="button" onClick={save} disabled={busy || !title.trim() || photos.length === 0}>
            {busy ? "Putting it on the shelf…" : "Put it on the shelf"}
          </button>
        </div>
      </div>
    </div>
  );
}
