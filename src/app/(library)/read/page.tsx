import { pageCtx } from "@/lib/server/auth";
import { listBooks, listFavoriteClassics, listProfiles, listStoryCards } from "@/lib/server/db";
import { appStatus } from "@/lib/server/config";
import { CLASSICS, TOPICS, warmCatalogue } from "@/lib/server/classics";
import { ReadToMe } from "./ReadToMe";

export const metadata = { title: "Read to Me" };

export default async function ReadPage(props: PageProps<"/read">) {
  const ctx = await pageCtx();
  const sp = await props.searchParams;
  const books = listBooks(ctx.household.id);
  warmCatalogue(); // the library's topics, fetched in the background so browsing is quick
  return (
    <main className="page">
      <ReadToMe
        classics={CLASSICS}
        topics={TOPICS}
        ownBooks={books.filter((b) => (b.kind === "shadow_book" || b.kind === "picture_book") && b.pageCount > 0)}
        readAlouds={listStoryCards(ctx.household.id).filter((s) => s.mode === "read")}
        profiles={listProfiles(ctx.household.id)}
        status={appStatus()}
        preselectBook={typeof sp.book === "string" ? sp.book : null}
        preselectClassic={typeof sp.classic === "string" ? Number(sp.classic) : null}
        favoriteClassics={listFavoriteClassics(ctx.household.id)}
      />
    </main>
  );
}
