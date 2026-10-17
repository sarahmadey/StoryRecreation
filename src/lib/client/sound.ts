"use client";

import { renderChime } from "@/lib/shared/chime";
import type { ChimeStyle } from "@/lib/shared/types";

let ctx: AudioContext | null = null;

/** Play the same page-turn chime that gets baked into the story audio. */
export function previewChime(style: ChimeStyle) {
  ctx ??= new AudioContext();
  void ctx.resume();
  const samples = renderChime(style, ctx.sampleRate, 0.5);
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
}

let voiceAudio: HTMLAudioElement | null = null;

/** Play a voice sample; calling again stops the previous one. */
export function previewVoice(url: string | null | undefined): boolean {
  voiceAudio?.pause();
  if (!url) return false;
  voiceAudio = new Audio(url);
  void voiceAudio.play().catch(() => undefined);
  return true;
}

export function stopPreview() {
  voiceAudio?.pause();
}
