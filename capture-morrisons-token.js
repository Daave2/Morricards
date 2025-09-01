
#!/usr/bin/env node

/**
 * Capture Morrisons API bearer tokens from a real browser session you control.
 * - Listens to network requests for api.morrisons.com
 * - Extracts "Authorization: Bearer <token>"
 * - (Optional) Verifies the token by POSTing to /product/v1/items/@search
 *
 * Usage:
 *   npm i playwright axios
 *   node capture-morrisons-token.js https://storemobile.apps.mymorri.com/ --verify "milk" --apikey YOUR_API_KEY
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');
const axios = require('axios');

const OUT_PATH = path.resolve(__dirname, 'morrisons-token.json');
const TARGET_HOST = 'api.morrisons.com';

const args = process.argv.slice(2);
const startUrl = (args[0] && !args[0].startsWith('--')) ? args[0] : 'https://storemobile.apps.mymorri.com/';
const apikeyArg = getFlagValue('--apikey');           // optional: API key if you want to verify
const verifyQuery = getFlagValue('--verify');         // optional: e.g. "milk"
const timeoutMs = parseInt(getFlagValue('--timeout') || '0', 10) || 0; // optional: auto-stop after N ms

function getFlagValue(flag) {
  const i = args.indexOf(flag);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  return null;
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    // Mobile-like UA helps if the site serves different bundles to mobile
    userAgent:
      'Mozilla/5.0 (Linux; Android 10; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 780 },
  });
  const page = await context.newPage();

  // Collect tokens & cookies
  const tokens = new Set();
  const seenSamples = []; // store a few request samples for debugging

  page.on('request', req => {
    try {
      const url = new URL(req.url());
      if (url.host !== TARGET_HOST) return;
      const headers = req.headers(); // keys are lowercase
      const auth = headers['authorization'];
      if (auth && /^bearer\s+/i.test(auth)) {
        const tok = auth.replace(/^bearer\s+/i, '').trim();
        if (tok) {
          tokens.add(tok);
          if (seenSamples.length < 3) {
            seenSamples.push({ url: req.url(), method: req.method(), ts: new Date().toISOString() });
          }
          // Echo once for visibility
          if (tokens.size === 1) {
            console.log('🔐 Captured bearer token from request to', url.pathname);
          }
        }
      }
    } catch (_) {}
  });

  console.log('Opening:', startUrl);
  await page.goto(startUrl, { waitUntil: 'domcontentloaded' });

  if (timeoutMs > 0) {
    console.log(`⏱️ Capture will auto-stop after ${timeoutMs} ms...`);
  }
  console.log('➡️  Log in and use the app until an authenticated API call occurs.');
  console.log('   When ready, press Enter here to finish capturing.\n');

  // Either wait for Enter or timeout
  const stop = new Promise(resolve => {
    if (timeoutMs > 0) setTimeout(resolve, timeoutMs);
    prompt('Press Enter to finish... ').then(resolve);
  });
  await stop;

  const cookies = await context.cookies();

  const result = {
    capturedAt: new Date().toISOString(),
    startUrl: startUrl,
    tokenCount: tokens.size,
    tokens: Array.from(tokens),
    requestSamples: seenSamples,
    cookies,
  };

  // Optional: verify token by calling the @search endpoint using Axios
  if (verifyQuery && result.tokens.length > 0) {
    const token = result.tokens[result.tokens.length - 1]; // last seen
    if (!apikeyArg) {
      console.warn('⚠️  --verify was provided but no --apikey given; skipping verification.');
    } else {
      try {
        const verifyUrl = `https://${TARGET_HOST}/product/v1/items/@search?apikey=${encodeURIComponent(apikeyArg)}`;
        // A simple Elasticsearch-style body tends to work; adjust if your app uses a different shape.
        const body = {
          size: 5,
          query: {
            query_string: { query: verifyQuery }
          }
        };
        console.log(`🔎 Verifying token with @search for query "${verifyQuery}" ...`);
        const resp = await axios.post(verifyUrl, body, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          // If the service requires a Referer or other headers, add them here:
          // headers: { Referer: 'https://storemobile.apps.mymorri.com/', ... }
          validateStatus: () => true,
        });
        result.verify = {
          url: verifyUrl,
          status: resp.status,
          ok: resp.status >= 200 && resp.status < 300,
          sampleIds: Array.isArray(resp.data?.hits?.hits)
            ? resp.data.hits.hits.map(h => h._id).slice(0, 5)
            : undefined,
        };
        console.log(`✅ Verify status: ${resp.status}`);
      } catch (err) {
        result.verify = { error: String(err) };
        console.error('❌ Verify failed:', err?.response?.status || err.message);
      }
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
  console.log(`\n✅ Saved capture to ${OUT_PATH}`);
  console.log(`   Tokens found: ${result.tokenCount}`);

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
