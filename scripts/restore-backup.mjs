#!/usr/bin/env node
// Brings an automatic backup back from the family's cloud storage into a data folder.
//
//   node scripts/restore-backup.mjs [--from production] [--date 2026-10-21] [--force] <data folder>
//
// It reads the same BACKUP_ENDPOINT, BACKUP_BUCKET, BACKUP_KEY_ID and BACKUP_SECRET_KEY
// settings as the app. --from picks which copy's backups to use (default: this one's, so
// "--from production" fills a test copy with the live library). --date picks a daily copy
// of the database instead of the latest. The app must be stopped while this runs, and it
// won't write over an existing library unless --force is given.

import fs from "node:fs";
import path from "node:path";
import { AwsClient } from "aws4fetch";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const [, value] = args.splice(i, 2);
  return value;
};
const force = args.includes("--force") ? (args.splice(args.indexOf("--force"), 1), true) : false;
const from = flag("--from") || process.env.STORYHOLLOW_ENV || process.env.RAILWAY_ENVIRONMENT_NAME || "storyhollow";
const date = flag("--date");
const target = args[0] || process.env.DATA_DIR;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const endpointSetting = process.env.BACKUP_ENDPOINT?.trim();
const bucketName = process.env.BACKUP_BUCKET?.trim();
const keyId = process.env.BACKUP_KEY_ID?.trim();
const secret = process.env.BACKUP_SECRET_KEY?.trim();
if (!endpointSetting || !bucketName || !keyId || !secret) fail("Set BACKUP_ENDPOINT, BACKUP_BUCKET, BACKUP_KEY_ID and BACKUP_SECRET_KEY first.");
if (!target) fail("Which data folder should the backup go into?");
if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("--date looks like 2026-10-21.");
if (fs.existsSync(path.join(target, "storyhollow.db")) && !force)
  fail(`${target} already has a library. Add --force to replace its database (its other files are kept, and the backup's are added).`);

const endpoint = (/^https?:\/\//.test(endpointSetting) ? endpointSetting : `https://${endpointSetting}`).replace(/\/+$/, "");
const region = process.env.BACKUP_REGION?.trim() || endpoint.match(/s3[.-]([a-z0-9-]+)\.(?:backblazeb2|amazonaws)\.com/)?.[1] || "auto";
const aws = new AwsClient({ accessKeyId: keyId, secretAccessKey: secret, region, service: "s3" });
const base = `${endpoint}/${encodeURIComponent(bucketName)}`;
const unescapeXml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

async function send(url) {
  const res = await aws.fetch(url);
  if (!res.ok) fail(`The backup storage said ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

async function list(prefix) {
  const keys = [];
  let token;
  do {
    const params = new URLSearchParams({ "list-type": "2", prefix, "max-keys": "1000" });
    if (token) params.set("continuation-token", token);
    const xml = await (await send(`${base}?${params}`)).text();
    for (const [, item] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = item.match(/<Key>([\s\S]*?)<\/Key>/)?.[1];
      if (key) keys.push(unescapeXml(key));
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] : undefined;
    if (token) token = unescapeXml(token);
  } while (token);
  return keys;
}

async function download(key, to) {
  const data = Buffer.from(await (await send(`${base}/${key.split("/").map(encodeURIComponent).join("/")}`)).arrayBuffer());
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, data);
  return data.length;
}

const filesPrefix = `${from}/files/`;
const files = await list(filesPrefix);
const dbKey = `${from}/database/${date ? `storyhollow-${date}.db` : "latest.db"}`;
if (!(await list(dbKey)).includes(dbKey)) fail(`There's no ${dbKey} in the backup storage.`);

console.log(`Restoring ${files.length} files and the database from ${bucketName}/${from} into ${target}…`);
let bytes = 0;
for (const key of files) {
  const rel = key.slice(filesPrefix.length);
  if (!rel || rel.split("/").includes("..")) continue;
  bytes += await download(key, path.join(target, rel));
}
for (const extra of ["-wal", "-shm"]) fs.rmSync(path.join(target, `storyhollow.db${extra}`), { force: true });
bytes += await download(dbKey, path.join(target, "storyhollow.db"));
console.log(`Done: ${files.length + 1} files, ${(bytes / (1024 * 1024)).toFixed(1)} MB. Start the app again.`);
