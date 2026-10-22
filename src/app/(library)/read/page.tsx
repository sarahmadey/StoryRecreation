import { pageCtx } from "@/lib/server/auth";
import { catalogueSize, listBooks, listFavoriteClassics, listProfiles } from "@/lib/server/db";
import { storyCards } from "@/lib/server/voices";
import { appStatus } from "@/lib/server/config";
import { CLASSICS, TOPICS, warmCatalogue } from "@/lib/server/classics";
import { ReadToMe } from "./ReadToMe";

export const metadata = { title: "Read to Me" };

export default async function ReadPage(props: PageProps<"/read">) {
  const ctx = await pageCtx();
  const sp = await props.searchParams;
  const books = listBooks(ctx.household.id);
  warmCatalogue(); // the library's topics, fetched in the background so browsing is quick
  const readAlouds = (await storyCards(ctx.household.id)).filter((s) => s.mode === "read");
  // Who last read each book (newest first), so the next chapter can have the same storyteller.
  const keyOf = new Map(books.map((b) => [b.id, b.kind === "classic" ? `classic:${b.sourceRef}` : `book:${b.id}`]));
  const lastReaders: Record<string, string> = {};
  for (const s of readAlouds) {
    const key = keyOf.get(s.bookId);
    if (key && s.narratorVoiceId && !(key in lastReaders)) lastReaders[key] = s.narratorVoiceId;
  }
  return (
    <main className="page">
      <ReadToMe
        classics={CLASSICS}
        topics={TOPICS}
        ownBooks={books.filter((b) => (b.kind === "shadow_book" || b.kind === "picture_book") && b.pageCount > 0)}
        readAlouds={readAlouds}
        lastReaders={lastReaders}
        profiles={listProfiles(ctx.household.id)}
        status={appStatus()}
        preselectBook={typeof sp.book === "string" ? sp.book : null}
        preselectClassic={typeof sp.classic === "string" ? Number(sp.classic) : null}
        favoriteClassics={listFavoriteClassics(ctx.household.id)}
        librarySize={catalogueSize()}
      />
    </main>
  );
}
