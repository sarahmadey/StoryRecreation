import { BookOnShelf, Cover } from "./Books";
import { Plaque } from "./Plaque";
import type { Book } from "@/lib/shared/types";

/** Books the family keeps together, standing on the shelf as one. */
export interface ShelfFolder {
  name: string;
  books: Book[];
}

/**
 * The family's books standing face-out on a bookcase. Each kind of book has a brass plaque above its
 * books; kinds with only a few books share a shelf when there's room (on a computer), and a kind with
 * many takes as many shelves as it needs. Every shelf is the same height, so the planks are drawn
 * behind the books in CSS. Folders stand first on their shelf, and open when they're tapped.
 */
export function Bookcase({
  groups,
  label,
  onOpenFolder,
  fresh,
}: {
  groups: { label: string | null; folders?: ShelfFolder[]; books: Book[] }[];
  label: string;
  onOpenFolder?: (name: string) => void;
  /** A folder just made or changed, which glows for a moment to show where it went. */
  fresh?: string | null;
}) {
  return (
    <div className="bookcase tiered" role="group" aria-label={label}>
      {groups.map((g, i) => (
        <section key={g.label ?? i} className="tier-group" aria-label={g.label ?? undefined}>
          {g.label && <Plaque label={g.label} />}
          <div className="tiers">
            {g.folders?.map((f) => (
              <div key={`folder:${f.name}`} className="tier-item">
                <FolderOnShelf folder={f} fresh={f.name === fresh} onOpen={() => onOpenFolder?.(f.name)} />
              </div>
            ))}
            {g.books.map((b) => (
              <div key={b.id} className="tier-item">
                <BookOnShelf book={b} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** A folder on the shelf: a wooden box with its name on a paper label, and the tops of its first books peeking out. */
function FolderOnShelf({ folder, fresh, onOpen }: { folder: ShelfFolder; fresh: boolean; onOpen: () => void }) {
  const n = folder.books.length;
  const count = `${n} ${n === 1 ? "book" : "books"}`;
  return (
    <button type="button" className={`book folder${fresh ? " fresh" : ""}`} onClick={onOpen} aria-label={`The folder ${folder.name}, ${count}`}>
      <div className="book-cover folder-box">
        {folder.books.slice(0, 3).map((b, i) => (
          <div key={b.id} className="folder-peek" data-at={i}>
            <Cover id={b.id} title={b.title} kind={b.kind} coverUrl={b.coverUrl} notes={b.notes} showTitle={false} />
          </div>
        ))}
        <div className="folder-front">
          <span className="folder-name">
            <span>{folder.name}</span>
          </span>
          <span className="folder-count">📁 {count}</span>
        </div>
      </div>
    </button>
  );
}

/** An empty bookcase: its plaque, and a word about what goes here. */
export function EmptyBookcase({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bookcase tiered">
      <section className="tier-group">
        <Plaque label={label} />
        <div className="tiers tiers-empty">
          <p className="shelf-empty">{children}</p>
        </div>
      </section>
    </div>
  );
}
