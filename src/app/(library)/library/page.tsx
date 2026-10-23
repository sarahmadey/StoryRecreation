import { pageCtx } from "@/lib/server/auth";
import { listBooks } from "@/lib/server/db";
import { storyCards } from "@/lib/server/voices";
import { LibraryView } from "./LibraryView";

export const metadata = { title: "The Library" };

export default async function LibraryPage(props: PageProps<"/library">) {
  const ctx = await pageCtx();
  // From Read to Me: "See them" opens the read-alouds.
  const readAlouds = (await props.searchParams).show === "read-alouds";
  return (
    <main className="page">
      <LibraryView books={listBooks(ctx.household.id)} stories={await storyCards(ctx.household.id)} showReadAlouds={readAlouds} />
    </main>
  );
}
