// A Google Drive link, however Drive wrote it: what file it is (and, for some older links, the key that goes
// with it), or that it's a folder rather than a file.

export type DriveLink = { id: string; resourceKey: string | null } | { folder: true };

const ID = /^[\w-]{10,}$/;

/** The Drive file a pasted link points to, or null when it isn't a Drive link at all. */
export function driveLink(text: string): DriveLink | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)(drive|docs)\.google\.com$/.test(url.hostname)) return null;
  if (/\/folders\//.test(url.pathname)) return { folder: true };
  // …/file/d/<id>/view, …/file/u/0/d/<id>/preview, or …/open?id=<id>, …/uc?id=<id>&export=download
  const id = url.pathname.match(/\/d\/([\w-]{10,})/)?.[1] ?? url.searchParams.get("id") ?? "";
  if (!ID.test(id)) return null;
  return { id, resourceKey: url.searchParams.get("resourcekey") };
}
