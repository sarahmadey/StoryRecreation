// Phone photos are huge. Shrink them in the browser before uploading: it
// makes uploads quick and keeps the storyteller's picture-reading affordable.
// (1568px on the long edge is the most detail the storyteller can use.)

export async function shrinkImage(file: File, maxEdge = 1568, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const picture = await decode(file);
    const scale = Math.min(1, maxEdge / Math.max(picture.width, picture.height));
    const w = Math.round(picture.width * scale);
    const h = Math.round(picture.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(picture.source, 0, 0, w, h);
    picture.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // e.g. a format this browser can't decode: let the server decide
  }
}

/** A photo, ready to draw. A browser that can't make a bitmap of it (or of one that big) can usually still show it. */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
  }
}

export interface PickedPhoto {
  id: string;
  file: File;
  url: string;
}

export async function pickPhotos(
  files: FileList | File[],
  limit = Infinity,
  onProgress?: (done: number, total: number) => void,
): Promise<{ photos: PickedPhoto[]; extra: number }> {
  const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
  // Photos taken in order usually arrive in order; sort by name as a tiebreak
  // for gallery picks (IMG_0012 before IMG_0013).
  list.sort((a, b) => a.lastModified - b.lastModified || a.name.localeCompare(b.name, undefined, { numeric: true }));
  const take = list.slice(0, Math.max(0, limit));
  const photos: PickedPhoto[] = [];
  for (const f of take) {
    onProgress?.(photos.length, take.length);
    const file = await shrinkImage(f);
    photos.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) });
  }
  return { photos, extra: list.length - take.length };
}
