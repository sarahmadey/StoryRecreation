import assert from "node:assert/strict";
import { test } from "node:test";
import { Mp3Encoder } from "@breezystack/lamejs";
import { mp3Frames, sliceMp3 } from "../src/lib/server/mp3";

// Recordings are made into MP3s in the browser (lamejs); a voice can learn from just part of one.

const RATE = 44100;

function tone(seconds: number, kbps: number): Buffer {
  const pcm = new Int16Array(Math.round(seconds * RATE));
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / RATE));
  const encoder = new Mp3Encoder(1, RATE, kbps);
  const out: Buffer[] = [];
  for (let i = 0; i < pcm.length; i += 1152 * 16) out.push(Buffer.from(encoder.encodeBuffer(pcm.subarray(i, i + 1152 * 16))));
  out.push(Buffer.from(encoder.flush()));
  return Buffer.concat(out);
}

const seconds = (buf: Uint8Array) => mp3Frames(buf).reduce((n, f) => n + f.seconds, 0);

test("an MP3's frames add up to how long it plays", () => {
  for (const kbps of [96, 192]) {
    const mp3 = tone(10, kbps);
    assert.ok(Math.abs(seconds(mp3) - 10) < 0.1, `${kbps} kbps: ${seconds(mp3)}s`);
    const frames = mp3Frames(mp3);
    assert.equal(frames.at(-1)!.offset + frames.at(-1)!.length, mp3.length, "every byte is in a frame");
  }
});

test("just part of a recording: the frames from one moment to another", () => {
  const mp3 = tone(12, 192);
  const part = sliceMp3(mp3, 2000, 7500);
  assert.ok(Math.abs(seconds(part) - 5.5) < 0.06, `${seconds(part)}s`);
  assert.equal(mp3Frames(part)[0].offset, 0, "it starts on a frame");
  assert.equal(sliceMp3(mp3, 0, 60_000).length, mp3.length, "all of it is all of it");
  assert.equal(sliceMp3(mp3, 20_000, 30_000).length, 0, "past the end, nothing");
});

test("an ID3 tag at the front is stepped over, and something that isn't an MP3 comes back whole", () => {
  const mp3 = tone(3, 192);
  const tag = Buffer.concat([Buffer.from("ID3"), Buffer.from([4, 0, 0, 0, 0, 0, 20]), Buffer.alloc(20)]);
  const tagged = Buffer.concat([tag, mp3]);
  assert.equal(mp3Frames(tagged)[0].offset, tag.length);
  assert.ok(Math.abs(seconds(tagged) - seconds(mp3)) < 1e-9);
  assert.ok(Math.abs(seconds(sliceMp3(tagged, 1000, 2000)) - 1) < 0.06);
  const words = Buffer.from("just some words, not a recording at all");
  assert.equal(sliceMp3(words, 0, 1000), words);
});
