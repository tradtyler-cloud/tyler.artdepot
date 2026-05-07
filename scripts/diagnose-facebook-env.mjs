/**
 * Safe checks for Facebook Page photo sync (prints no secrets).
 * Run: npm run diagnose:facebook
 */

import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

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

async function main() {
  loadDotEnvFromRoot();
  const token =
    process.env.FACEBOOK_ACCESS_TOKEN?.trim() ||
    process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim();

  if (!token) {
    console.log(
      'No Graph token in .env (set FACEBOOK_ACCESS_TOKEN or INSTAGRAM_ACCESS_TOKEN).'
    );
    process.exitCode = 1;
    return;
  }
  if (
    !process.env.FACEBOOK_ACCESS_TOKEN?.trim() &&
    process.env.INSTAGRAM_ACCESS_TOKEN?.trim()
  ) {
    console.log(
      '(Using INSTAGRAM_ACCESS_TOKEN as token — add FACEBOOK_ACCESS_TOKEN if you prefer that name.)\n'
    );
  }
  if (!pageId) {
    console.log('No FACEBOOK_PAGE_ID in .env.');
    process.exitCode = 1;
    return;
  }

  console.log(
    `FACEBOOK_ACCESS_TOKEN set (length ${token.length}). FACEBOOK_PAGE_ID=${pageId}.\n`
  );

  const probeUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}?fields=id,name&access_token=${encodeURIComponent(token)}`;
  const r = await fetch(probeUrl);
  const j = await r.json().catch(() => ({}));

  if (!r.ok) {
    console.log(`GET /${pageId}?fields=id,name → ${r.status}`);
    console.log(j.error?.message ?? JSON.stringify(j));
    return;
  }

  console.log(`Page OK: ${j.name ?? '(no name)'} (id ${j.id})`);

  const photosUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos?type=uploaded&fields=id&limit=1&access_token=${encodeURIComponent(token)}`;
  const pr = await fetch(photosUrl);
  const pj = await pr.json().catch(() => ({}));

  if (!pr.ok) {
    console.log(`\nGET /${pageId}/photos → ${pr.status}: ${pj.error?.message ?? ''}`);
    console.log(
      'Try a Page access token (Graph API Explorer → Get Page Access Token) with permissions that include reading the Page.'
    );
    return;
  }

  const n = Array.isArray(pj.data) ? pj.data.length : 0;
  console.log(
    n > 0
      ? '\nPhotos edge responds — run: npm run sync:facebook'
      : '\nPhotos edge returned 0 items (album may be empty or try a different token).'
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
