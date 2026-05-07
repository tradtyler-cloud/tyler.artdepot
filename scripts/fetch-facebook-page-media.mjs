/**
 * Builds data/gallery.json from Facebook Graph API — Page published photos.
 *
 * Env (see .env.example):
 *   FACEBOOK_ACCESS_TOKEN — User or Page access token that can read the Page
 *     (If unset, INSTAGRAM_ACCESS_TOKEN is used as a fallback.)
 *   FACEBOOK_PAGE_ID      — Numeric Page id (not @handle)
 *
 * Run: npm run sync:facebook
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const PHOTO_FIELDS = 'id,images,link,created_time';
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

const GRAPH_VERSION =
  process.env.FACEBOOK_GRAPH_API_VERSION ?? 'v21.0';

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.error(`Missing env: ${name}. See .env.example and copy to .env.`);
    process.exit(1);
  }
  return String(v).trim();
}

function facebookAccessTokenFromEnv() {
  const direct = process.env.FACEBOOK_ACCESS_TOKEN?.trim();
  if (direct) return direct;
  const legacy = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (legacy) {
    console.warn(
      'Using INSTAGRAM_ACCESS_TOKEN as the Graph token (add FACEBOOK_ACCESS_TOKEN=… to .env if you want that name explicitly).'
    );
    return legacy;
  }
  return null;
}

function pickLargestImageSource(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  const sorted = [...images].sort(
    (a, b) => (b.width ?? 0) - (a.width ?? 0)
  );
  const top = sorted[0];
  return top?.source ?? null;
}

function mapPhoto(p) {
  const displayUrl = pickLargestImageSource(p.images);
  return {
    id: p.id,
    permalink: p.link ?? null,
    mediaType: 'IMAGE',
    caption: '',
    timestamp: p.created_time ?? null,
    displayUrl,
    mediaUrl: displayUrl,
    thumbnailUrl: null,
  };
}

async function fetchPagePhotos(accessToken, pageId) {
  const maxRaw = Number.parseInt(process.env.FACEBOOK_MAX_MEDIA ?? '48', 10);
  const limit = Number.isFinite(maxRaw) ? Math.min(Math.max(maxRaw, 1), 200) : 48;
  const batch = Math.min(25, limit);

  const base = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`;
  const qs = new URLSearchParams({
    type: 'uploaded',
    fields: PHOTO_FIELDS,
    limit: String(batch),
    access_token: accessToken,
  });
  let url = `${base}?${qs.toString()}`;

  const items = [];

  while (url && items.length < limit) {
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = json.error?.message ?? res.statusText;
      const hint =
        String(errMsg).includes('permission') || res.status === 403
          ? ' — Ensure the token can access this Page (try a Page access token from Graph API Explorer) and that the Page id is correct.'
          : '';
      throw new Error(
        `Facebook Graph error ${res.status}: ${errMsg}${hint}`
      );
    }

    const batchItems = json.data ?? [];
    for (const p of batchItems) {
      if (items.length >= limit) break;
      const mapped = mapPhoto(p);
      if (!mapped.displayUrl) {
        console.warn(`Skipping photo ${p.id}: no image URL in \`images\`.`);
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
  const token = facebookAccessTokenFromEnv();
  if (!token) {
    console.error(
      'Missing token: set FACEBOOK_ACCESS_TOKEN (or reuse INSTAGRAM_ACCESS_TOKEN=…) in .env.'
    );
    process.exit(1);
  }
  const pageId = requireEnv('FACEBOOK_PAGE_ID');

  const items = await fetchPagePhotos(token, pageId);
  const outDir = path.join(ROOT, 'data');
  await fs.mkdir(outDir, { recursive: true });

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'facebook_graph_page_photos',
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
