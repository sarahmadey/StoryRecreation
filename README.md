# 🌳 Storyhollow

*A hollow old tree where stories live, with a little glowing door.*

**A new story for every night.** Photograph the pages of a book your children love, or something wonderful
you found on a walk, and a cast of storytellers turns it into an immersive audio story, with a soft chime
whenever it's time to turn the page.

Built first for a shadow book whose old read-along had been heard a hundred times. Now every night can bring
a brand-new tale for the very same pictures.

---

## What it does

### ✨ Create a New Story
- **From a book you own.** Snap each page (shadow books, picture books, board books). The storyteller studies
  the pictures and writes a *completely new* story that matches each page, so the child sees exactly what they
  hear. Old printed text in the photos is ignored, never reused.
- **From something you saw.** A puddle, a snail, a sofa-cushion castle: photos from your day become a story.
- **From just an idea.** "A dragon who's afraid of the dark."
- **Shape it:** length (3, 6 or 10 minutes), mood (cozy bedtime, silly, brave adventure, gentle mystery,
  heartwarming, spooky-ish), listener age, your child as the hero, a gentle lesson, special wishes, and a
  🎲 *Surprise us* twist.
- **Never the same twice.** Each book remembers its earlier stories, and the storyteller is told to make
  tonight's clearly different. Characters keep their voices from night to night.
- **Familiar friends, new adventures.** The characters keep the names printed in the book (say, Anton and
  Babette) unless you ask for new ones.
- **Pages in any order.** Photographed the book back to front? The storyteller reads the printed page numbers
  and puts the pages in order for this and every future story. There's also a ⇅ Reverse button.
- **✨ A new story tonight:** one tap on any book writes and records a fresh story with last time's settings.

### 🎭 Voices that feel human
- **A full cast.** The narrator and every character get their own expressive voice from ElevenLabs'
  newest model (Eleven v4), performed as one scene, so turn-taking sounds like real actors and not a robot
  reading lines.
- **Directed delivery.** The script includes cues like `[whispers]`, `[giggles]` and `[sleepily]`, which the
  voices act out.
- **Storybook personas.** Kids pick *Professor Hoot*, *Granny Willow*, *Captain Bramble*… not "voice #12".
- **🪄 Conjure a voice.** Describe one ("a tiny, squeaky mouse who talks very fast"), hear three versions, and
  keep your favorite in the family's voice wardrobe for future stories.

### 🔔 Made for real books
- **A gentle page-turn chime** (bell, wand sparkle, or wind chime) with an adjustable pause after it.
- **The classic read-along welcome:** *"You'll know it's time to turn the page when you hear this sound…"*
- **✋ Wait for me:** after each chime the story pauses until someone taps, for slow little page-turners.
- **🌙 Lights out:** a near-black screen with ember-dim controls, so the phone doesn't wash out a shadow book
  on the bedroom wall.
- **🔤 Read-along words:** each word lights up as it's spoken, which helps early readers.
- **An optional soundscape** (crickets, rain, waves) looped very quietly underneath.
- **One MP3** with narration, chimes and pauses baked in, so it plays on a lock screen, a Bluetooth speaker or
  in the car, and can be **downloaded for a make-your-own Yoto card**.

### 🎧 Read to Me
- **Pick a reader**, then a book. Add *character voices* so the dialogue is acted out.
- **The Classic Treasury:** Peter Rabbit, Winnie-the-Pooh, The Velveteen Rabbit, The Wind in the Willows,
  Aesop, Grimm and more, plus a search of 70,000+ public-domain books (Project Gutenberg).
- **A book we own:** photograph the pages and the storyteller transcribes the real words exactly, then reads
  them aloud with a chime per page.
- **Our own words:** paste a poem, a letter from Granny, or a story your child dictated.

### 📚 The Library
- A candlelit bookcase. Books stand face-out on shelves (Shadow Books, Picture Books, Tales from the Wild,
  Dreamed-Up Tales, The Classic Treasury, or any shelf you name), and each book holds all its stories.
- Filter by child, ⭐ favorites or read-alouds, and search everything.
- **Family accounts with reader cards:** one grown-up login per family, then a "Who's listening tonight?"
  card for each child (no passwords), so everyone finds their own favorites.
- **Grown-up PIN** (optional): children can play anything on the shelves, but creating new stories, which
  spends credits, needs a grown-up.

---

## Quick start

You need **Node.js 22.13+**.

```bash
npm install
cp .env.example .env.local     # add your two API keys
npm run dev                    # open http://localhost:3000
```

| Key | What it powers | Where to get it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | The storyteller (Claude reads the photos and writes the scripts) | [console.anthropic.com](https://console.anthropic.com) |
| `ELEVENLABS_API_KEY` | The voices, voice design and soundscapes | [elevenlabs.io → API keys](https://elevenlabs.io/app/settings/api-keys) |

**No keys yet?** Run `DEMO_MODE=1 npm run dev` to click through every screen with a pretend storyteller and
humming placeholder voices.

### Your first shadow book story
1. Sign up and add a reader card for each child.
2. **Create → A book we own → A new book.** Name it and choose *Shadow book*.
3. Photograph each picture **in order**: the slide or disc itself, or its projection on the wall. One
   photo per page. The ← → buttons reorder pages.
4. Choose the length, mood and voices. Leave *Let me read it before the voices record it* on the first time.
5. Read the script, swap any voice, then press **Record the story**. After a minute or two, press **Listen**.
6. Tomorrow, open the book and tap **✨ A new story tonight**.

---

## How it works

```
 page photos ──► Claude (vision + structured output) ──► script: cast, voices, lines per page
                                                             │
                     grown-up review & edits (optional) ◄────┘
                                                             │
 ElevenLabs Text-to-Dialogue (Eleven v4, PCM + timestamps) ◄─┘   one request per page
                                                             │
 mixer: welcome · page 1 · chime · pause · page 2 · … ◄──────┘   + optional looping soundscape
                                                             │
 story.mp3 + page timeline + word timings ──► player (page cues, wait-for-me, read-along, lock screen)
```

- **Storyteller:** `claude-opus-5-5` with adaptive thinking, a JSON-schema output whose `voice_id` field is
  restricted to the family's real voices, and automatic refusal fallbacks. Prompts:
  `src/lib/server/storyteller.ts`.
- **Voices:** ElevenLabs Text-to-Dialogue performs each page as one multi-voice scene, returning raw PCM
  plus per-character timings (the source of the read-along). If dialogue isn't available on a plan, it
  falls back to line-by-line speech. See `src/lib/server/performer.ts`.
- **Chimes** are synthesized in code (`src/lib/shared/chime.ts`), so the preview in the browser is exactly
  what gets mixed into the story.
- **Mixing and MP3 encoding** are pure JavaScript (`src/lib/server/audio.ts`); no ffmpeg needed.
- **Editing a page only re-records that page.** Recordings are cached by content, and changing the chime
  re-binds the story without spending any voice credits.
- **Background jobs** keep writing and recording if a phone locks or the page is closed. If the server
  restarts mid-job, the story shows *Try again* and resumes where it stopped.

### Project layout

```
src/app/(library)/   hall, library, book, create wizard, studio, read-to-me, grown-ups
src/app/play/        the player
src/app/api/         auth, profiles, PIN, books, stories, voices, classics, files
src/lib/server/      db (SQLite), auth, storyteller, performer, audio, jobs, classics, voices
src/lib/shared/      types, options & presets, personas, chime synthesis
tests/               unit tests and API integration tests (fake Claude + ElevenLabs servers)
```

Storage is a single SQLite file plus photos and audio under `DATA_DIR` (default `./data`), using Node's
built-in `node:sqlite`, so there's no database server to run.

### Checks

```bash
npm run typecheck
npm test          # audio, text, and integration tests against fake Claude & ElevenLabs APIs
npm run build
```

---

## Your questions, answered

**Is this better as an app?**
Start as an installable web app (what this is). On iPhone or iPad tap *Share → Add to Home Screen*; on
Android, *Install app*. It opens full-screen with its own icon, the camera works for photographing pages,
audio keeps playing on the lock screen, and every update arrives instantly with no app store review. If you
later want App Store distribution, wrap the same code with Capacitor; nothing needs rewriting.

**Accounts?**
Built in as a *family account* (one grown-up email and password) with *reader cards* for each child, like a
streaming service's profile picker. Books and stories belong to the family, each story remembers who it
was made for, and the library filters by child.

**Can it find books in a library database?**
Partly. Out-of-copyright classics come straight from Project Gutenberg's free catalogue (the Classic
Treasury). Modern picture books are still under copyright and aren't available as text from any open
database or library API, so for those you photograph your own copy and the app reads its real words aloud.
That's for your family's own listening; please don't share those recordings publicly.

---

## Costs

| | Roughly |
| --- | --- |
| Writing a 12-page story (Claude Opus 5.5) | about $0.15–$0.50, depending on photo count and length |
| Recording a 6-minute story | about 5,000 characters of ElevenLabs voice credit. Compare with your plan's monthly allowance. |
| Changing chimes, replaying, downloading | free |

To trim costs, set `STORY_MODEL=claude-sonnet-5-5` for the storyteller, or pick a shorter length.

The create screen estimates character use before you start. A grown-up PIN keeps small hands from
spending credits.

---

## Hosting it for the family

The camera and "Add to Home Screen" need **HTTPS** (or `localhost`).

- **Docker** (a home server, NAS, Fly.io, Railway, Render…). Mount a volume for `/data`:
  ```bash
  docker build -t storyhollow .
  docker run -p 3000:3000 -v storyhollow-data:/data \
    -e ANTHROPIC_API_KEY=… -e ELEVENLABS_API_KEY=… storyhollow
  ```
- On a home network over plain `http://`, add `-e INSECURE_COOKIES=1` so sign-in cookies work without HTTPS.
- It needs a persistent disk (SQLite + audio files) and a long-running Node process for background jobs, so
  serverless-only hosts aren't a fit as-is.

Optional settings live in `.env.example` (`STORY_MODEL`, `VOICE_MODEL`, `ELEVENLABS_BASE_URL`, `DATA_DIR`).

---

## Roadmap: ideas for even more magic

- **Grandparent voices.** With consent, record Granny once and have her voice read bedtime stories from
  across the ocean (ElevenLabs instant voice cloning).
- **Sound effects on cue:** an owl's hoot as it appears on the page, waves as the boat sets sail.
- **Ongoing sagas:** recurring characters with memories across nights ("Ollie remembers last week's
  adventure").
- **Kid-made covers:** photograph a child's drawing as the book's cover.
- **Sleep timer and soundscape-only mode** after the story ends.
- **Offline shelf:** save favorite stories on the device for car trips and flights.
- **Share with family:** send a story link to grandparents, or let them make one for the kids.
- **Stories in other languages**, for bilingual families.
- **Native wrappers** (Capacitor) for App Store / Play Store distribution.
