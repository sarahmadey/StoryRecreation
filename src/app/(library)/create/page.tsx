import { pageCtx } from "@/lib/server/auth";
import { listBooks, listProfiles, lastSettingsForBook, madeStories } from "@/lib/server/db";
import { voiceLabels } from "@/lib/server/voices";
import { appStatus } from "@/lib/server/config";
import { CreateWizard } from "./CreateWizard";
import { SetupNotice } from "@/components/SetupNotice";

export const metadata = { title: "Create a New Story" };

export default async function CreatePage(props: PageProps<"/create">) {
  const ctx = await pageCtx();
  const sp = await props.searchParams;
  const books = listBooks(ctx.household.id).filter((b) => ["shadow_book", "picture_book", "wild", "idea"].includes(b.kind));
  const preselect = typeof sp.book === "string" ? books.find((b) => b.id === sp.book) : undefined;
  // "Make one like…": the stories the family has made, each with who read it (and the one asked for, however old).
  const like = typeof sp.like === "string" ? sp.like : null;
  const labels = await voiceLabels(ctx.household.id);
  const past = madeStories(ctx.household.id, 40, like ?? undefined).map((s) => ({
    ...s,
    narrator: s.settings.narratorVoiceId ? (labels.get(s.settings.narratorVoiceId) ?? null) : null,
  }));
  return (
    <main className="page page-narrow">
      <SetupNotice status={appStatus()} />
      <CreateWizard
        books={books}
        profiles={listProfiles(ctx.household.id)}
        currentProfile={ctx.profile}
        preselect={preselect ?? null}
        preselectSettings={preselect ? lastSettingsForBook(preselect.id, "create") : null}
        past={past}
        like={past.some((s) => s.id === like) ? like : null}
      />
    </main>
  );
}
