/**
 * Builds data/gallery.json from the Instagram Graph API (Creator/Business accounts).
 *
 * Prereqs: Meta Developer app, Instagram Login or Facebook Login, long-lived User token
 * with instagram_basic (+ any scopes your review requires).
 *
 * Env (see .env.example):
 *   INSTAGRAM_ACCESS_TOKEN  — Graph API User access token
 *   INSTAGRAM_USER_ID     — IG User ID (digits) from Meta / token debugger, not @handle
 *
 * Run: npm run sync:instagram (reads repo-root .env if present; overrides not applied to vars already set in your shell.)
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const MEDIA_FIELDS =
  'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp';
const OUTPUT_REL = ['data', 'gallery.json'];

function loadDotEnvFromRoot() {
  const envPath = path.join(ROOT, '.env');
  if (!fsSync.existsSync(envPath)) return;
  const raw = fsSync.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let val = trimmed.slice(eq + 1).trim();
    const q = /^(['"])(.*)\1$/.exec(val);
    if (q) val = q[2];
    process.env[key] = val;
  }
}

loadDotEnvFromRoot();

const GRAPH_HOST =
  process.env.INSTAGRAM_GRAPH_HOST ?? 'graph.instagram.com';
const GRAPH_VERSION =
  process.env.INSTAGRAM_GRAPH_API_VERSION ?? 'v21.0';

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.error(`Missing env: ${name}. Copy .env.example to .env and fill values.`);
    process.exit(1);
  }
  return String(v).trim();
}

function displayUrlFromMedia(m) {
  if (m.media_type === 'VIDEO') {
    return m.thumbnail_url || m.media_url || null;
  }
  if (m.media_type === 'IMAGE') {
    return m.media_url || null;
  }
  if (m.media_type === 'CAROUSEL_ALBUM') {
    // TODO: optional second request GET /{media-id}/children?fields=...
    return m.media_url || m.thumbnail_url || null;
  }
  return m.media_url || m.thumbnail_url || null;
}

function mapMediaItem(m) {
  return {
    id: m.id,
    permalink: m.permalink ?? null,
    mediaType: m.media_type ?? null,
    caption: m.caption ?? '',
    timestamp: m.timestamp ?? null,
    displayUrl: displayUrlFromMedia(m),
    mediaUrl: m.media_url ?? null,
    thumbnailUrl: m.thumbnail_url ?? null,
  };
}

async function fetchAllMedia(accessToken, userId) {
  const maxRaw = Number.parseInt(process.env.INSTAGRAM_MAX_MEDIA ?? '48', 10);
  const limit = Number.isFinite(maxRaw) ? Math.min(Math.max(maxRaw, 1), 200) : 48;
  const batch = Math.min(25, limit);

  const base = `https://${GRAPH_HOST}/${GRAPH_VERSION}/${userId}/media`;
  const qs = new URLSearchParams({
    fields: MEDIA_FIELDS,
    limit: String(batch),
    access_token: accessToken,
  });
  let url = `${base}?${qs.toString()}`;

  const items = [];

  while (url && items.length < limit) {
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      let errMsg = json.error?.message ?? res.statusText;
      const hintFbUserAsIg =
        String(errMsg).includes('nonexisting field (media)') &&
        GRAPH_HOST.includes('facebook.com');
      if (hintFbUserAsIg) {
        errMsg += ` — ${userId} may be a Facebook user id (no /media). Use your Instagram Business/Creator scoped id, or run: npm run diagnose:instagram`;
      }
      const badParse =
        String(errMsg).includes('Cannot parse access token') &&
        GRAPH_HOST.includes('instagram.com');
      if (badParse) {
        errMsg +=
          ` — Token may be for Facebook Graph only or expired. Try INSTAGRAM_GRAPH_HOST=graph.facebook.com after fixing INSTAGRAM_USER_ID, or run: npm run diagnose:instagram`;
      }
      throw new Error(`Instagram Graph error ${res.status}: ${errMsg}`);
    }

    const batchItems = json.data ?? [];
    for (const m of batchItems) {
      if (items.length >= limit) break;
      const mapped = mapMediaItem(m);
      if (!mapped.displayUrl) {
        console.warn(
          `Skipping media ${m.id} (${m.media_type}): no image URL — carousels may need a children fetch.`
        );
        continue;
      }
      items.push(mapped);
    }

    const next =
      typeof json.paging?.next === 'string' && json.paging.next.length > 0
        ? json.paging.next
        : null;

    url = next;
  }

  return items;
}

async function main() {
  loadDotEnvFromRoot();
  const token = requireEnv('INSTAGRAM_ACCESS_TOKEN');
  const userId = requireEnv('INSTAGRAM_USER_ID');

  const items = await fetchAllMedia(token, userId);
  const outDir = path.join(ROOT, 'data');
  await fs.mkdir(outDir, { recursive: true });

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'instagram_graph_api',
    items,
  };

  const outPath = path.join(ROOT, ...OUTPUT_REL);
  const tmpPath = `${outPath}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.rename(tmpPath, outPath);

  console.log(`Wrote ${outPath} (${items.length} items).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
