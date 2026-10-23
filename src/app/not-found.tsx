import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page page-narrow center" style={{ paddingTop: 80 }}>
      <div style={{ fontSize: "4rem" }}>🦉</div>
      <h1>This page has wandered off the shelf</h1>
      <p className="muted">Even the library owl can't find it.</p>
      <Link href="/" className="btn">
        Back home
      </Link>
    </main>
  );
}
