// The story opens in a moment: say so straight away.

export default function Loading() {
  return (
    <main className="player">
      <div className="page-loading" role="status">
        <span className="spinner" aria-hidden="true" />
        Opening the story…
      </div>
    </main>
  );
}
