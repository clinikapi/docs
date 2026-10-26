#!/usr/bin/env node
/**
 * Captures light and dark screenshots of each documented dashboard page into docs/images/dashboard/.
 *
 * NOT run in CI and NOT run automatically. Run it by hand against a dashboard you control, once its screens are stable:
 *
 *   DASHBOARD_BASE_URL=http://localhost:3100 \
 *   DASHBOARD_STORAGE_STATE=.auth/dashboard.json \
 *   node docs/scripts/capture-dashboard-screenshots.mjs [--only access,logs] [--width 1440]
 *
 * Rules:
 *   - Use the synthetic "ZZ-E2E Studio Org" only (slug zz-e2e-studio-org; see
 *     Project-docs/architecture/DASHBOARD_STUDIO_E2E_FIXTURE.md). Never a real customer's organization: the script
 *     refuses to run if ORG_SLUG is anything else.
 *   - STORAGE_STATE is a Playwright storageState file for a signed-in session of that organization's account. It is
 *     never committed (keep it under a git-ignored folder) and this script never signs in or reads a password.
 *   - The Data browser, Exports and key-entry fields ask for a test key. The script never types one, so those pages
 *     are captured in their empty state. Do not paste a key while capturing by hand either.
 *   - Pages that show a secret once (a new key, a new webhook secret) are NOT captured here.
 *
 * Output: docs/images/dashboard/<page>-light.png and <page>-dark.png.
 * A page in docs references an image only after it exists in that folder; the validator does not need them.
 */

import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'images', 'dashboard');

const BASE = (process.env.DASHBOARD_BASE_URL || '').replace(/\/+$/, '');
const STATE = process.env.DASHBOARD_STORAGE_STATE || '';
const ORG_SLUG = process.env.DASHBOARD_ORG_SLUG || 'zz-e2e-studio-org';
const PROJECT = process.env.DASHBOARD_PROJECT_REF || 'default';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const only = flag('only', '') ? flag('only', '').split(',') : null;
const WIDTH = Number(flag('width', '1440'));
const HEIGHT = Number(flag('height', '900'));

if (!BASE || !STATE) {
  console.error('Set DASHBOARD_BASE_URL and DASHBOARD_STORAGE_STATE. See the header of this script.');
  process.exit(2);
}
if (ORG_SLUG !== 'zz-e2e-studio-org') {
  console.error(`Refusing to capture organization "${ORG_SLUG}": only the synthetic ZZ-E2E Studio Org may be used.`);
  process.exit(2);
}
if (!existsSync(STATE)) {
  console.error(`Storage state file not found: ${STATE}`);
  process.exit(2);
}

const p = (page) => `/org/${ORG_SLUG}/project/${PROJECT}/${page}`;
const o = (section) => `/org/${ORG_SLUG}/settings/${section}`;

/** name (the docs page it illustrates) -> route */
const PAGES = [
  ['projects-home', `/org/${ORG_SLUG}`],
  ['project-overview', p('overview')],
  ['access-keys', p('access')],
  ['webhooks', p('webhooks')],
  ['project-settings', p('settings')],
  ['compute-and-disk', p('settings/compute')],
  ['data-browser', p('data')],
  ['exports', p('exports')],
  ['realtime', p('realtime')],
  ['logs', p('logs')],
  ['usage', p('usage')],
  ['api-reference', p('reference')],
  ['fhir-server', p('fhir')],
  ['organization-settings', o('general')],
  ['members', o('members')],
  ['sub-organizations', o('sub-organizations')],
  ['profile', '/account/profile'],
  ['security', '/account/security'],
];

let chromium;
try {
  ({ chromium } = await import('@playwright/test'));
} catch {
  console.error('Playwright is not installed. Run `npm install` at the repo root (it ships with apps/dashboard dev dependencies).');
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let failures = 0;

for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({
    storageState: STATE,
    viewport: { width: WIDTH, height: HEIGHT },
    colorScheme: scheme,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  for (const [name, route] of PAGES) {
    if (only && !only.includes(name)) continue;
    try {
      const res = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60_000 });
      if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : 'no response'}`);
      if (/\/(login|sign-in)/.test(new URL(page.url()).pathname)) throw new Error('redirected to sign-in: the session has expired');
      await page.screenshot({ path: join(OUT, `${name}-${scheme}.png`), fullPage: false });
      console.log(`ok    ${name}-${scheme}`);
    } catch (e) {
      failures += 1;
      console.error(`FAIL  ${name}-${scheme}: ${e.message}`);
    }
  }
  await context.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
