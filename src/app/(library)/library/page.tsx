import { pageCtx } from "@/lib/server/auth";
import { listBooks, listProfiles, listStoryCards } from "@/lib/server/db";
import { LibraryView } from "./LibraryView";

export const metadata = { title: "The Library" };

export default async function LibraryPage() {
  const ctx = await pageCtx();
  return (
    <main className="page">
      <LibraryView
        books={listBooks(ctx.household.id)}
        stories={listStoryCards(ctx.household.id)}
        profiles={listProfiles(ctx.household.id)}
        currentProfileId={ctx.profile?.id ?? null}
      />
    </main>
  );
}
