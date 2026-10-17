// Phone photos are huge. Shrink them in the browser before uploading: it
// makes uploads quick and keeps the storyteller's picture-reading affordable.
// (1568px on the long edge is the most detail the storyteller can use.)

export async function shrinkImage(file: File, maxEdge = 1568, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // e.g. a format this browser can't decode: let the server decide
  }
}

export interface PickedPhoto {
  id: string;
  file: File;
  url: string;
}

export async function pickPhotos(files: FileList | File[]): Promise<PickedPhoto[]> {
  const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
  // Photos taken in order usually arrive in order; sort by name as a tiebreak
  // for gallery picks (IMG_0012 before IMG_0013).
  list.sort((a, b) => a.lastModified - b.lastModified || a.name.localeCompare(b.name, undefined, { numeric: true }));
  const out: PickedPhoto[] = [];
  for (const f of list) {
    const file = await shrinkImage(f);
    out.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) });
  }
  return out;
}
