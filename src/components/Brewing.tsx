import type { StoryProgress } from "@/lib/shared/types";

export function Brewing({ title, progress, note }: { title: string; progress: StoryProgress | null; note?: string }) {
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 4;
  return (
    <div className="brewing" role="status" aria-live="polite">
      <div>
        <div className="orb" />
        <div className="orb-stand" style={{ margin: "-16px auto 0" }} />
      </div>
      <h2 style={{ margin: 0 }}>{title}</h2>
      <p className="muted" style={{ margin: 0 }}>
        {progress?.step ?? "Gathering the magic"}
        {progress && progress.total > 1 && progress.done > 0 ? ` · ${progress.done} of ${progress.total}` : ""}…
      </p>
      <div className="progress" aria-hidden="true">
        <div style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
      {note && <p className="faint small">{note}</p>}
    </div>
  );
}
