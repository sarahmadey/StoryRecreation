import { notFound, redirect } from "next/navigation";
import { pageCtx } from "@/lib/server/auth";
import { getBook, getStory, listPages } from "@/lib/server/db";
import { voiceLabels } from "@/lib/server/voices";
import { Player } from "./Player";

export default async function PlayPage(props: PageProps<"/play/[id]">) {
  const { id } = await props.params;
  const ctx = await pageCtx();
  const story = getStory(ctx.household.id, id);
  if (!story) notFound();
  if (story.status !== "ready" || !story.audioUrl || !story.timeline) redirect(`/stories/${id}`);
  const book = getBook(ctx.household.id, story.bookId)!;
  const narratorVoice = story.script?.cast.find((c) => c.id === "narrator")?.voiceId;
  const narrator = narratorVoice ? ((await voiceLabels(ctx.household.id)).get(narratorVoice) ?? null) : null;
  return <Player story={story} book={book} photos={listPages(book.id)} narrator={narrator} />;
}

export async function generateMetadata(props: PageProps<"/play/[id]">) {
  const { id } = await props.params;
  const ctx = await pageCtx();
  return { title: getStory(ctx.household.id, id)?.title ?? "Listen" };
}
