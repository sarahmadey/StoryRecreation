import { pageCtx } from "@/lib/server/auth";
import { listBooks, listProfiles, lastSettingsForBook } from "@/lib/server/db";
import { appStatus } from "@/lib/server/config";
import { CreateWizard } from "./CreateWizard";
import { SetupNotice } from "@/components/SetupNotice";

export const metadata = { title: "Create a New Story" };

export default async function CreatePage(props: PageProps<"/create">) {
  const ctx = await pageCtx();
  const sp = await props.searchParams;
  const books = listBooks(ctx.household.id).filter((b) => ["shadow_book", "picture_book", "wild", "idea"].includes(b.kind));
  const preselect = typeof sp.book === "string" ? books.find((b) => b.id === sp.book) : undefined;
  return (
    <main className="page page-narrow">
      <SetupNotice status={appStatus()} />
      <CreateWizard
        books={books}
        profiles={listProfiles(ctx.household.id)}
        currentProfile={ctx.profile}
        preselect={preselect ?? null}
        preselectSettings={preselect ? lastSettingsForBook(preselect.id, "create") : null}
      />
    </main>
  );
}
