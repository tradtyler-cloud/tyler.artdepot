/**
 * Safe checks for .env + Meta tokens (prints no secrets).
 * Run: npm run diagnose:instagram
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

async function getJson(url) {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function main() {
  loadDotEnvFromRoot();
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const configuredId = process.env.INSTAGRAM_USER_ID?.trim();

  if (!token) {
    console.log('No INSTAGRAM_ACCESS_TOKEN in .env (repo root).');
    process.exitCode = 1;
    return;
  }

  console.log(
    `INSTAGRAM_ACCESS_TOKEN looks set (length ${token.length}). INSTAGRAM_USER_ID in .env: ${configuredId || '(empty)'}.\n`
  );

  // Fire sequentially for readable output
  void (async () => {
    const igMe = await getJson(
      `https://graph.instagram.com/v21.0/me?fields=id,username,account_type&access_token=${encodeURIComponent(token)}`
    );

    if (igMe.ok && igMe.json?.id) {
      console.log('Instagram Graph (graph.instagram.com) /me: OK');
      console.log(
        `  → Use INSTAGRAM_USER_ID=${igMe.json.id} (and keep default graph host graph.instagram.com).`
      );
      if (configuredId && configuredId !== String(igMe.json.id)) {
        console.log(
          `  ⚠ .env has INSTAGRAM_USER_ID=${configuredId} but Instagram says id ${igMe.json.id}. Prefer the id above.`
        );
      }
      return;
    }

    const msg = igMe.json?.error?.message ?? igMe.json?.error ?? 'unknown';
    console.log(`Instagram Graph (graph.instagram.com) /me: FAILED (${igMe.status}) — ${msg}`);

    const fbMe = await getJson(
      `https://graph.facebook.com/v21.0/me?fields=id&access_token=${encodeURIComponent(token)}`
    );
    if (fbMe.ok && fbMe.json?.id) {
      console.log(`\nFacebook Graph (graph.facebook.com) /me: OK → Facebook user id ${fbMe.json.id}`);
    } else {
      const m = fbMe.json?.error?.message ?? fbMe.json?.error ?? 'unknown';
      console.log(`\nFacebook Graph /me: FAILED (${fbMe.status}) — ${m}`);
    }

    const pages = await getJson(
      `https://graph.facebook.com/v21.0/me/accounts?fields=name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`
    );
    const rows = pages.json?.data ?? [];
    const withIg = rows.filter((r) => r.instagram_business_account?.id);
    if (withIg.length > 0) {
      console.log('\nLinked Instagram business account(s) via Facebook Page(s):');
      for (const r of withIg) {
        const ig = r.instagram_business_account;
        console.log(
          `  Page "${r.name}" → INSTAGRAM_USER_ID=${ig.id} (${ig.username ?? 'no username'})`
        );
      }
      console.log(
        '\nSet INSTAGRAM_GRAPH_HOST=graph.facebook.com and use the INSTAGRAM_USER_ID shown above, or switch to an Instagram Login User token for graph.instagram.com.'
      );
    } else if (rows.length === 0) {
      console.log(
        '\nNo Facebook Pages returned for this token (often normal for Instagram-only Login).'
      );
    }

    if (configuredId) {
      const probe = await getJson(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(configuredId)}/media?fields=id&limit=1&access_token=${encodeURIComponent(token)}`
      );
      if (!probe.ok) {
        const em = probe.json?.error?.message ?? '';
        if (String(em).includes('nonexisting field (media)')) {
          console.log(
            `\nConfigured INSTAGRAM_USER_ID (${configuredId}) does not expose /media on Facebook Graph.` +
              `\nThat usually means it is a Facebook user id, not an Instagram Business/Creator scoped id.` +
              `\nFix: regenerate an Instagram-capable User token or use instagram_business_account id from diagnose output.`
          );
        }
      }
    }

    console.log(
      '\nNext step: regenerate token in Meta (Graph API Explorer + correct product/scopes). Run Instagram Login flow if instagram.com rejects the token.'
    );
  })();
}

main();
