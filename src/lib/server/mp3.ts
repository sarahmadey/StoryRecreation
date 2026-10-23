// The family's recordings are MP3s made in the browser: frames one after another, each a few hundredths of a
// second long. Part of one (the minute where Grandma is talking on her own, say) is cut out between frames,
// without decoding it, so a storytelling voice can learn from just that part while the recording stays whole.

/** Kilobits a second for each bitrate index: MPEG-1 Layer III, then MPEG-2 and 2.5 Layer III. */
const KBPS_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const KBPS_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const RATES_V1 = [44100, 48000, 32000];
const RATES_V2 = [22050, 24000, 16000];
const RATES_V25 = [11025, 12000, 8000];

export interface Mp3Frame {
  offset: number;
  length: number;
  seconds: number;
}

/** Each frame's place in the file and how long it plays (after an ID3 tag, if there is one). Not an MP3: none. */
export function mp3Frames(buf: Uint8Array): Mp3Frame[] {
  let i = 0;
  if (buf.length >= 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    // "ID3": a 10-byte header with the tag's size in 7 bits a byte, and a 10-byte footer when flagged.
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    i = 10 + size + (buf[5] & 0x10 ? 10 : 0);
  }
  const frames: Mp3Frame[] = [];
  while (i + 4 <= buf.length) {
    const b1 = buf[i + 1];
    const b2 = buf[i + 2];
    // A frame starts with 11 set bits, then its MPEG version (3: MPEG-1, 2: MPEG-2, 0: MPEG-2.5) and layer (1: III).
    const version = (b1 >> 3) & 3;
    const layer = (b1 >> 1) & 3;
    const kbpsIndex = b2 >> 4;
    const rateIndex = (b2 >> 2) & 3;
    if (buf[i] !== 0xff || (b1 & 0xe0) !== 0xe0 || version === 1 || layer !== 1 || kbpsIndex === 0 || kbpsIndex === 15 || rateIndex === 3) {
      i++;
      continue;
    }
    const v1 = version === 3;
    const kbps = (v1 ? KBPS_V1 : KBPS_V2)[kbpsIndex];
    const rate = (v1 ? RATES_V1 : version === 2 ? RATES_V2 : RATES_V25)[rateIndex];
    const samples = v1 ? 1152 : 576;
    const length = Math.floor((samples / 8) * ((kbps * 1000) / rate)) + ((b2 >> 1) & 1);
    if (i + length > buf.length) break;
    frames.push({ offset: i, length, seconds: samples / rate });
    i += length;
  }
  return frames;
}

/** A frame that only describes the file (a Xing or Info tag): it says nothing true about a part cut from it. */
const describesFile = (buf: Uint8Array, f: Mp3Frame) => /Xing|Info/.test(Buffer.from(buf.subarray(f.offset, f.offset + Math.min(f.length, 64))).toString("latin1"));

/** The frames from `fromMs` to `toMs` of an MP3. Something that isn't an MP3 comes back whole. */
export function sliceMp3(buf: Buffer, fromMs: number, toMs: number): Buffer {
  const frames = mp3Frames(buf);
  if (!frames.length) return buf;
  let at = 0;
  let first: Mp3Frame | null = null;
  let last: Mp3Frame | null = null;
  for (const [n, f] of frames.entries()) {
    if (n === 0 && describesFile(buf, f)) continue;
    const ms = at * 1000;
    at += f.seconds;
    if (ms < fromMs) continue;
    if (ms >= toMs) break;
    first ??= f;
    last = f;
  }
  return first && last ? buf.subarray(first.offset, last.offset + last.length) : Buffer.alloc(0);
}
