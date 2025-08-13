
const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs/promises');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');

const OUTPUT_FILE = './morrisons-token.json';

async function main() {
  const args = process.argv.slice(2);
  const url = args[0];
  const verifyFlagIndex = args.indexOf('--verify');
  const verifyTerm = verifyFlagIndex !== -1 ? args[verifyFlagIndex + 1] : null;
  const apikeyFlagIndex = args.indexOf('--apikey');
  const apikey = apikeyFlagIndex !== -1 ? args[apikeyFlagIndex + 1] : null;

  if (!url) {
    console.error('Usage: node capture-morrisons-token.js <url> [--verify <term>] [--apikey <key>]');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  let bearerToken = null;

  page.on('request', async (request) => {
    const authHeader = await request.headerValue('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      bearerToken = authHeader;
      console.log(`\n✅ Bearer token captured: ${bearerToken.substring(0, 20)}...`);
    }
  });

  console.log(`\nNavigating to ${url}...`);
  await page.goto(url);
  console.log('Please log in and perform an action that triggers an API call (e.g., search for an item).');

  const rl = readline.createInterface({ input, output });
  await rl.question('\nPress Enter here once you have captured a token...');
  rl.close();

  if (!bearerToken) {
    console.error('❌ No bearer token was captured. Please try again.');
    await browser.close();
    process.exit(1);
  }

  if (verifyTerm && apikey) {
    console.log(`\nVerifying token by searching for "${verifyTerm}"...`);
    try {
      const verifyUrl = `https://api.morrisons.com/search/v4/products?catalogueType=OFFER_PRODUCTS&searchTerm=${verifyTerm}&apiKey=${apikey}`;
      await axios.get(verifyUrl, {
        headers: {
          'Authorization': bearerToken,
        },
      });
      console.log('✅ Token verification successful!');
    } catch (error) {
      console.error('❌ Token verification failed. The captured token may be invalid or expired.');
      console.error(error.response?.data || error.message);
      await browser.close();
      process.exit(1);
    }
  }

  await fs.writeFile(OUTPUT_FILE, JSON.stringify({ bearerToken }, null, 2));
  console.log(`\n✅ Token saved to ${OUTPUT_FILE}`);
  console.log('You can now copy this token into the application settings.');

  await browser.close();
}

main().catch(console.error);