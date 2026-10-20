import fs from "node:fs";
import { Readable } from "node:stream";

// A small ZIP writer for family backups. Everything inside is already
// compressed (MP3s, JPEGs), so entries are stored as they are. Each file's
// checksum is worked out just before it's written, so the download starts at
// once and nothing large ever sits in memory.

export interface ZipEntry {
  /** Path inside the archive, with forward slashes. */
  name: string;
  /** A file on disk, or the bytes themselves. */
  file?: string;
  data?: Buffer;
  mtime?: Date;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crcStep(state: number, buf: Uint8Array): number {
  let c = state;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c;
}

export function crc32(buf: Uint8Array): number {
  return (crcStep(0xffffffff, buf) ^ 0xffffffff) >>> 0;
}

async function fileCrc(path: string): Promise<number> {
  let state = 0xffffffff;
  for await (const chunk of fs.createReadStream(path, { highWaterMark: 1 << 20 })) state = crcStep(state, chunk as Buffer);
  return (state ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const UTF8 = 0x0800; // names are UTF-8

/** The archive's exact size, so the browser can show download progress. */
export function zipSize(entries: { name: string; size: number }[]): number {
  return entries.reduce((n, e) => n + 30 + 46 + 2 * Buffer.byteLength(e.name) + e.size, 22);
}

export function sizeOf(entry: ZipEntry): number {
  return entry.data ? entry.data.length : fs.statSync(entry.file!).size;
}

/** Streams a ZIP of the entries. Throws before starting if it would be too big for a plain ZIP. */
export function zipStream(entries: ZipEntry[]): { stream: ReadableStream<Uint8Array>; size: number } {
  const sized = entries.map((e) => ({ ...e, size: sizeOf(e) }));
  const size = zipSize(sized);
  if (sized.length > 0xffff || size > 0xffffffff) throw new Error("This library is too big for one download.");

  async function* generate() {
    const central: Buffer[] = [];
    let offset = 0;
    for (const e of sized) {
      const name = Buffer.from(e.name, "utf8");
      const crc = e.data ? crc32(e.data) : await fileCrc(e.file!);
      const { time, date } = dosDateTime(e.mtime ?? new Date());

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4); // version needed
      local.writeUInt16LE(UTF8, 6);
      local.writeUInt16LE(0, 8); // stored
      local.writeUInt16LE(time, 10);
      local.writeUInt16LE(date, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(e.size, 18);
      local.writeUInt32LE(e.size, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(0, 28);
      yield local;
      yield name;
      if (e.data) yield e.data;
      else for await (const chunk of fs.createReadStream(e.file!, { highWaterMark: 1 << 20 })) yield chunk as Buffer;

      const cd = Buffer.alloc(46);
      cd.writeUInt32LE(0x02014b50, 0);
      cd.writeUInt16LE((3 << 8) | 20, 4); // made on unix, spec 2.0
      cd.writeUInt16LE(20, 6);
      cd.writeUInt16LE(UTF8, 8);
      cd.writeUInt16LE(0, 10);
      cd.writeUInt16LE(time, 12);
      cd.writeUInt16LE(date, 14);
      cd.writeUInt32LE(crc, 16);
      cd.writeUInt32LE(e.size, 20);
      cd.writeUInt32LE(e.size, 24);
      cd.writeUInt16LE(name.length, 28);
      cd.writeUInt32LE((0o100644 << 16) >>> 0, 38); // a regular, readable file
      cd.writeUInt32LE(offset, 42);
      central.push(cd, name);
      offset += 30 + name.length + e.size;
    }
    const cdSize = central.reduce((n, b) => n + b.length, 0);
    yield* central;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(sized.length, 8);
    end.writeUInt16LE(sized.length, 10);
    end.writeUInt32LE(cdSize, 12);
    end.writeUInt32LE(offset, 16);
    yield end;
  }

  return { stream: Readable.toWeb(Readable.from(generate())) as ReadableStream<Uint8Array>, size };
}
