import { notFound } from "next/navigation";
import { pageCtx } from "@/lib/server/auth";
import { getBook, getStory, listPages } from "@/lib/server/db";
import { appStatus } from "@/lib/server/config";
import { Studio } from "./Studio";

export default async function StoryPage(props: PageProps<"/stories/[id]">) {
  const { id } = await props.params;
  const ctx = await pageCtx();
  const story = getStory(ctx.household.id, id);
  if (!story) notFound();
  const book = getBook(ctx.household.id, story.bookId)!;
  return (
    <main className="page page-narrow">
      <Studio initial={story} book={book} photos={listPages(book.id)} status={appStatus()} />
    </main>
  );
}

export async function generateMetadata(props: PageProps<"/stories/[id]">) {
  const { id } = await props.params;
  const ctx = await pageCtx();
  return { title: getStory(ctx.household.id, id)?.title ?? "Story" };
}
