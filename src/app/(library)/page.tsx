import Link from "next/link";
import { pageCtx } from "@/lib/server/auth";
import { listProfiles } from "@/lib/server/db";
import { storyCards } from "@/lib/server/voices";
import { appStatus } from "@/lib/server/config";
import { ProfilePicker } from "@/components/Readers";
import { Greeting } from "@/components/Greeting";
import { QuillArt, ReadArt, ShelfArt } from "@/components/Art";
import { StoryCardView } from "@/components/Books";
import { SetupNotice } from "@/components/SetupNotice";

export default async function HallPage() {
  const ctx = await pageCtx();
  const profiles = listProfiles(ctx.household.id);
  if (!ctx.profile) {
    return (
      <main className="page">
        <ProfilePicker profiles={profiles} />
      </main>
    );
  }

  const stories = await storyCards(ctx.household.id);
  const mine = stories.filter((s) => s.profileId === ctx.profile!.id);
  const ready = stories.filter((s) => s.status === "ready");
  const recent = ready
    .filter((s) => s.lastPlayedAt)
    .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
    .slice(0, 4);
  const favorites = ready.filter((s) => s.favorite).slice(0, 8);
  const inProgress = stories.filter((s) => s.status !== "ready").slice(0, 4);
  // Newest skips stories already listed above, so the Hall doesn't repeat itself.
  const shown = new Set([...recent, ...favorites].map((s) => s.id));
  const newest = ready.filter((s) => !shown.has(s.id)).slice(0, 6);
  const emojiOf = new Map(profiles.map((p) => [p.id, p.avatar]));

  return (
    <main className="page">
      <SetupNotice status={appStatus()} />
      <div className="hero hero-hall">
        <h1>
          <Greeting name={ctx.profile.name} />
        </h1>
        <p className="muted hero-sub">Where shall we go tonight?</p>
      </div>

      <div className="doorways">
        <Link href="/create" className="doorway">
          <QuillArt />
          <div className="doorway-text">
            <h2>Create a New Story</h2>
            <p>From a book&apos;s pictures, something you saw, or just an idea.</p>
          </div>
        </Link>
        <Link href="/read" className="doorway">
          <ReadArt />
          <div className="doorway-text">
            <h2>Read to Me</h2>
            <p>A storyteller reads a favorite book aloud.</p>
          </div>
        </Link>
        <Link href="/library" className="doorway">
          <ShelfArt />
          <div className="doorway-text">
            <h2>The Library</h2>
            <p>Every book and story you&apos;ve made, on the shelves.</p>
          </div>
        </Link>
      </div>

      {inProgress.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Still brewing</h2>
          </div>
          <div className="story-list">
            {inProgress.map((s) => (
              <StoryCardView key={s.id} story={s} profileEmoji={s.profileId ? emojiOf.get(s.profileId) : undefined} />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Listen again</h2>
          </div>
          <div className="story-list">
            {recent.map((s) => (
              <StoryCardView key={s.id} story={s} profileEmoji={s.profileId ? emojiOf.get(s.profileId) : undefined} />
            ))}
          </div>
        </section>
      )}

      {favorites.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>⭐ Favorites</h2>
          </div>
          <div className="story-list">
            {favorites.map((s) => (
              <StoryCardView key={s.id} story={s} profileEmoji={s.profileId ? emojiOf.get(s.profileId) : undefined} />
            ))}
          </div>
        </section>
      )}

      {newest.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Newest on the shelves</h2>
            <Link href="/library" className="small">
              See the whole library →
            </Link>
          </div>
          <div className="story-list">
            {newest.map((s) => (
              <StoryCardView key={s.id} story={s} profileEmoji={s.profileId ? emojiOf.get(s.profileId) : undefined} />
            ))}
          </div>
        </section>
      )}

      {stories.length === 0 && (
        <section className="section empty">
          <span className="big">🕯️</span>
          The shelves are waiting for their very first story.
          <br />
          {mine.length === 0 && (
            <Link href="/create" className="btn" style={{ marginTop: 18 }}>
              Make the first one ✨
            </Link>
          )}
        </section>
      )}
    </main>
  );
}
