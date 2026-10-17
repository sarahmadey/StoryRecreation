import { notFound } from "next/navigation";
import { pageCtx } from "@/lib/server/auth";
import { getBook, lastSettingsForBook, listPages, listProfiles, listShelves, listStoryCards } from "@/lib/server/db";
import { canRecordStories, canWriteStories } from "@/lib/server/config";
import { BookView } from "./BookView";

export default async function BookPage(props: PageProps<"/books/[id]">) {
  const { id } = await props.params;
  const ctx = await pageCtx();
  const book = getBook(ctx.household.id, id);
  if (!book) notFound();
  return (
    <main className="page">
      <BookView
        book={book}
        pages={listPages(id)}
        stories={listStoryCards(ctx.household.id, { bookId: id })}
        profiles={listProfiles(ctx.household.id)}
        shelves={listShelves(ctx.household.id)}
        lastCreate={lastSettingsForBook(id, "create")}
        currentProfile={ctx.profile}
        canMake={canWriteStories() && canRecordStories()}
      />
    </main>
  );
}

export async function generateMetadata(props: PageProps<"/books/[id]">) {
  const { id } = await props.params;
  const ctx = await pageCtx();
  return { title: getBook(ctx.household.id, id)?.title ?? "Book" };
}
