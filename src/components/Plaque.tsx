/**
 * A display title as an engraved brass plaque, in the castle-library style: bevelled corners, a rivet
 * at each end, a diamond either side of the name. Every plaque of a size is the same width, centred.
 * (Actions are the round gold buttons; titles are plaques.) `wide` is for section titles.
 */
export function Plaque({ label, wide = false }: { label: string; wide?: boolean }) {
  return (
    <h2 className={`shelf-plaque ${wide ? "wide" : ""}`} title={label}>
      <span className="plaque">
        <span className="plaque-name">
          <span className="plaque-text">{label}</span>
        </span>
      </span>
    </h2>
  );
}
