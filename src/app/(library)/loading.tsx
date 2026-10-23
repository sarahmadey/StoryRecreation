// A tap that opens a page shows at once that it's on its way, while the page is made.

export default function Loading() {
  return (
    <main className="page page-narrow">
      <div className="page-loading" role="status">
        <span className="spinner" aria-hidden="true" />
        Turning the page…
      </div>
    </main>
  );
}
