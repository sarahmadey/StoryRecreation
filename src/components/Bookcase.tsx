import { BookOnShelf } from "./Books";
import type { Book } from "@/lib/shared/types";

/** A brass plaque for a shelf: engraved, the same width as every other, centred over its books. */
function Plaque({ label }: { label: string }) {
  return (
    <h2 className="shelf-plaque" title={label}>
      <span className="plaque">
        <span className="plaque-name">
          <span className="plaque-text">{label}</span>
        </span>
      </span>
    </h2>
  );
}

/**
 * The family's books standing face-out on a bookcase. Each kind of book has a brass plaque above its
 * books; kinds with only a few books share a shelf when there's room (on a computer), and a kind with
 * many takes as many shelves as it needs. Every shelf is the same height, so the planks are drawn
 * behind the books in CSS.
 */
export function Bookcase({ groups, label }: { groups: { label: string | null; books: Book[] }[]; label: string }) {
  return (
    <div className="bookcase tiered" role="group" aria-label={label}>
      {groups.map((g, i) => (
        <section key={g.label ?? i} className="tier-group" aria-label={g.label ?? undefined}>
          {g.label && <Plaque label={g.label} />}
          <div className="tiers">
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
