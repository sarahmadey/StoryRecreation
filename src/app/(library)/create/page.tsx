import { pageCtx } from "@/lib/server/auth";
import { listBooks, listProfiles, lastSettingsForBook, madeStories } from "@/lib/server/db";
import { voiceLabels } from "@/lib/server/voices";
import { appStatus } from "@/lib/server/config";
import { writeCosts } from "@/lib/server/spending";
import { CreateWizard } from "./CreateWizard";
import { SetupNotice } from "@/components/SetupNotice";

export const metadata = { title: "Create a New Story" };

export default async function CreatePage(props: PageProps<"/create">) {
  const ctx = await pageCtx();
  const sp = await props.searchParams;
  const books = listBooks(ctx.household.id).filter((b) => ["shadow_book", "picture_book", "wild", "idea"].includes(b.kind));
  const chosenBook = typeof sp.book === "string" ? books.find((b) => b.id === sp.book) : undefined;
  // "Make one like…": the stories the family has made, each with who read it (and the one asked for, however old).
  const like = typeof sp.like === "string" ? sp.like : null;
  const labels = await voiceLabels(ctx.household.id);
  const past = madeStories(ctx.household.id, 200, like ?? undefined).map((s) => ({
    ...s,
    narrator: s.settings.narratorVoiceId ? (labels.get(s.settings.narratorVoiceId) ?? null) : null,
  }));
  // From "Make another like this" on a story's page: that story's book is chosen too, when it's a book the family owns.
  const liked = past.find((s) => s.id === like);
  const preselect =
    chosenBook ?? (liked && (liked.bookKind === "shadow_book" || liked.bookKind === "picture_book") ? books.find((b) => b.id === liked.bookId) : undefined);
  return (
    <main className="page page-narrow">
      <SetupNotice status={appStatus()} />
      <CreateWizard
        books={books}
        profiles={listProfiles(ctx.household.id)}
        currentProfile={ctx.profile}
        preselect={preselect ?? null}
        preselectSettings={chosenBook ? lastSettingsForBook(chosenBook.id, "create") : null}
        preselectNarrator={typeof sp.narrator === "string" ? sp.narrator.slice(0, 64) : null}
        past={past}
        like={past.some((s) => s.id === like) ? like : null}
        status={appStatus()}
        writeCosts={writeCosts(ctx.household.id)}
      />
    </main>
  );
}
