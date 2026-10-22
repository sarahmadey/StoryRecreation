import { pageCtx } from "@/lib/server/auth";
import { AddBook } from "./AddBook";

export const metadata = { title: "Add a book" };

/** Photograph a book once; then read its own words, or make new stories for its pictures. */
export default async function AddBookPage(props: PageProps<"/books/new">) {
  await pageCtx();
  const sp = await props.searchParams;
  const then = sp.then === "read" || sp.then === "create" ? sp.then : null;
  return (
    <main className="page page-narrow">
      <AddBook then={then} />
    </main>
  );
}
