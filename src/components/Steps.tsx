/**
 * Where you are in a few-step flow. Steps already done can be tapped to go back and change them.
 */
export function Steps({ labels, step, onGo }: { labels: readonly string[]; step: number; onGo: (step: number) => void }) {
  return (
    <nav className="steps" aria-label="Steps">
      {labels.map((label, i) =>
        i < step ? (
          <button key={label} type="button" className="step done" onClick={() => onGo(i)} aria-label={`Back to ${label}`}>
            <i>✓</i>
            {label}
          </button>
        ) : (
          <span key={label} className="step" aria-current={i === step ? "step" : undefined}>
            <i>{i + 1}</i>
            {label}
          </span>
        ),
      )}
    </nav>
  );
}

/** Each step starts at the top, like turning to a new page, not partway down where the last one ended. */
export function toTop() {
  window.scrollTo({ top: 0 });
}
