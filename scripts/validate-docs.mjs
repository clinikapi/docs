#!/usr/bin/env node
/**
 * ClinikAPI developer-docs validator.
 *
 * Mintlify will happily publish a site whose navigation points at pages that do
 * not exist (they 404 silently), which contains orphan pages nobody can reach,
 * and — the one unique to this repo — whose API-reference pages point at
 * operations the OpenAPI spec does not define. That last failure is the worst
 * of the three, because the page still renders: a reader gets a title, a blank
 * body, and no reason to believe anything is wrong. They conclude the endpoint
 * is undocumented, or worse, that it does not exist.
 *
 * Ported from ../ClinikEHR/knowledge-base/scripts/validate-docs.mjs and adapted:
 * this repo uses the OLDER `mint.json` config format (a flat array of
 * `{ group, pages }`), not `docs.json`, and its reference pages are generated
 * from `api-reference/openapi.yaml` rather than hand-written.
 *
 * ⚠️ WHAT IS DELIBERATELY *NOT* CHECKED, and why:
 *   · Internal architecture vocabulary. The Help Center bans table and service
 *     names because it is read by clinic staff. These docs are read by
 *     ENGINEERS, who need exact field names, types and status codes. The same
 *     rule here would be actively wrong.
 *   · `import` statements. Every `import` in these pages is example code inside
 *     a fenced block (`import { Clinik } from '@clinikapi/sdk'`), not an MDX
 *     component import. Resolving them would fail on every quickstart.
 *
 * Checks (errors — these block):
 *   1. mint.json parses.
 *   2. Every navigation entry resolves to an .mdx file.
 *   3. Every .mdx file is reachable from the navigation (no orphans).
 *   4. No page is listed twice inside one group.
 *   5. Every page has frontmatter with a non-empty `title`.
 *   6. No HTML comments — invalid MDX; Mintlify's cloud build 404s the page.
 *   7. Every `openapi:` frontmatter reference resolves to a real operation.
 *   8. Every internal markdown link resolves to a navigable page or an anchor.
 *   9. Assets named in mint.json (logo, favicon) exist.
 *
 * Warnings (advisory — these do not block):
 *   · A page with no `description` (drives search results and social cards).
 *   · An operation in openapi.yaml that no page documents — an endpoint
 *     customers cannot discover.
 *   · A tab whose url prefix has no pages under it.
 *
 * Usage: node docs/scripts/validate-docs.mjs [--quiet]
 * Exits non-zero on any error.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const QUIET = process.argv.includes('--quiet');

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

// ── 1. Load navigation ──────────────────────────────────────────────────────

const mintJsonPath = join(ROOT, 'mint.json');
if (!existsSync(mintJsonPath)) {
  console.error('FATAL: mint.json not found at ' + mintJsonPath);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(readFileSync(mintJsonPath, 'utf8'));
} catch (e) {
  console.error('FATAL: mint.json is not valid JSON — ' + e.message);
  process.exit(1);
}

/**
 * Collect page paths from the mint.json navigation tree.
 *
 * The legacy format is a flat array of `{ group, pages: [...] }`, but `pages`
 * may itself contain a nested group object, so this recurses rather than
 * assuming one level.
 */
function collectPages(node, out = []) {
  if (node == null) return out;
  if (Array.isArray(node)) {
    for (const item of node) collectPages(item, out);
    return out;
  }
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'pages' || key === 'groups' || key === 'navigation') {
        collectPages(value, out);
      }
    }
  }
  return out;
}

const navPages = collectPages(config.navigation);
const navSet = new Set(navPages);

// A page listed twice in ONE group is a genuine double-listing — the reader
// sees the same entry twice in the same sidebar section.
for (const group of config.navigation ?? []) {
  const seen = new Set();
  for (const p of collectPages(group)) {
    if (seen.has(p)) {
      err(`mint.json lists "${p}" twice inside the "${group.group ?? '?'}" group.`);
    }
    seen.add(p);
  }
}

// ── 2. Walk the filesystem ──────────────────────────────────────────────────

const IGNORED_DIRS = new Set(['node_modules', '.git', 'scripts', 'images', 'logo', 'snippets']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.mdx')) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const fileSlugs = new Map(
  files.map((f) => [relative(ROOT, f).replace(/\\/g, '/').replace(/\.mdx$/, ''), f]),
);

// ── 3. Navigation ↔ filesystem agreement ────────────────────────────────────

for (const page of navSet) {
  if (!fileSlugs.has(page)) {
    err(`mint.json navigates to "${page}" but ${page}.mdx does not exist.`);
  }
}

for (const [slug] of fileSlugs) {
  if (!navSet.has(slug)) {
    err(`${slug}.mdx exists but no navigation entry reaches it — readers cannot find it.`);
  }
}

// ── 4. The OpenAPI contract ─────────────────────────────────────────────────
//
// Reference pages declare `openapi: post /v1/appointments`. If that operation
// is not in the spec the page renders EMPTY — a title and nothing else — which
// reads to a customer as "this endpoint is undocumented".

/** `METHOD /path` keys present in the spec, lowercased method. */
let specOperations = null;
const specPath = join(ROOT, 'api-reference', 'openapi.yaml');

if (!existsSync(specPath)) {
  warn('api-reference/openapi.yaml not found — skipping OpenAPI reference checks.');
} else {
  let YAML = null;
  try {
    YAML = (await import('yaml')).default;
  } catch {
    warn('The `yaml` package could not be resolved — skipping OpenAPI reference checks. Run this from the repo root, where it is installed.');
  }
  if (YAML) {
    try {
      const spec = YAML.parse(readFileSync(specPath, 'utf8'));
      specOperations = new Set();
      const METHODS = new Set(['get', 'put', 'post', 'delete', 'patch', 'head', 'options', 'trace']);
      for (const [path, item] of Object.entries(spec?.paths ?? {})) {
        for (const method of Object.keys(item ?? {})) {
          if (METHODS.has(method.toLowerCase())) {
            specOperations.add(`${method.toLowerCase()} ${path}`);
          }
        }
      }
      if (specOperations.size === 0) warn('openapi.yaml parsed but declares no operations.');
    } catch (e) {
      err(`api-reference/openapi.yaml could not be parsed — ${e.message}`);
    }
  }
}

// ── 5. Per-file checks ──────────────────────────────────────────────────────

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const documentedOperations = new Set();

for (const [slug, file] of fileSlugs) {
  const raw = readFileSync(file, 'utf8');

  // HTML comments are INVALID MDX. Mintlify's cloud build fails the whole page
  // on one, and `mint dev` does NOT reproduce it — so this is the only place it
  // gets caught before a reader meets a 404.
  if (/<!--/.test(raw)) {
    err(`${slug}.mdx contains an HTML comment (<!-- -->). MDX has no HTML comment syntax and the cloud build 404s the page. Use {/* … */}.`);
  }

  const fm = FRONTMATTER.exec(raw);
  if (!fm) {
    err(`${slug}.mdx has no frontmatter block.`);
    continue;
  }
  const front = fm[1];

  const title = /^title:\s*(.+)$/m.exec(front)?.[1]?.trim();
  if (!title) err(`${slug}.mdx has no \`title\` in its frontmatter.`);

  // `openapi: post /v1/appointments`
  const openapiRef = /^openapi:\s*(.+)$/m.exec(front)?.[1]?.trim().replace(/^["']|["']$/g, '');

  // ⚠️ ONLY hand-written pages need a description. An OpenAPI-backed reference
  // page inherits its description from the operation's `summary` in the spec,
  // so warning on those would fire on ~315 pages that are all correct — and a
  // check that cries wolf 315 times is one nobody reads.
  const description = /^description:\s*(.+)$/m.exec(front)?.[1]?.trim();
  if (!description && !openapiRef) {
    warn(`${slug}.mdx has no \`description\` — it drives search results and social cards.`);
  }
  if (openapiRef) {
    const m = /^([a-zA-Z]+)\s+(\S+)$/.exec(openapiRef);
    if (!m) {
      err(`${slug}.mdx has \`openapi: ${openapiRef}\`, which is not a "METHOD /path" reference.`);
    } else {
      const key = `${m[1].toLowerCase()} ${m[2]}`;
      documentedOperations.add(key);
      if (specOperations && !specOperations.has(key)) {
        err(`${slug}.mdx references \`${openapiRef}\`, which openapi.yaml does not define. The page will render EMPTY.`);
      }
    }
  }

  // Internal links must resolve to a navigable page (or an in-page anchor).
  const body = raw.slice(fm[0].length);
  for (const m of body.matchAll(/\]\((\/[a-zA-Z0-9/_-]+)(#[^)]*)?\)/g)) {
    const target = m[1].replace(/^\//, '').replace(/\/$/, '');
    if (!navSet.has(target) && !fileSlugs.has(target)) {
      err(`${slug}.mdx links to /${target}, which is not a page in this site.`);
    }
  }
}

// An endpoint in the spec that no page documents is an endpoint a customer
// cannot discover. A warning, not an error: a spec may legitimately carry an
// internal or not-yet-launched operation.
if (specOperations) {
  const undocumented = [...specOperations].filter((op) => !documentedOperations.has(op));
  if (undocumented.length) {
    warn(`${undocumented.length} operation(s) in openapi.yaml have no reference page: ${undocumented.slice(0, 8).join(', ')}${undocumented.length > 8 ? ', …' : ''}`);
  }
}

// ── 6. Tabs and assets referenced by mint.json ──────────────────────────────

for (const tab of config.tabs ?? []) {
  if (!tab.url) continue;
  const prefix = tab.url.replace(/^\//, '');
  if (![...navSet].some((p) => p === prefix || p.startsWith(prefix + '/'))) {
    warn(`mint.json declares the "${tab.name ?? tab.url}" tab at "${tab.url}", but no navigation page sits under it — the tab opens nothing.`);
  }
}

for (const asset of [config.favicon, config.logo?.light, config.logo?.dark, typeof config.logo === 'string' ? config.logo : null]) {
  if (!asset || /^https?:/.test(asset)) continue;
  const rel = asset.replace(/^\//, '');
  if (!existsSync(join(ROOT, rel))) {
    err(`mint.json references "${asset}" but docs/${rel} does not exist.`);
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

if (!QUIET) {
  console.log(`Checked ${fileSlugs.size} pages against ${navSet.size} navigation entries.`);
  if (specOperations) {
    console.log(`Checked ${documentedOperations.size} reference pages against ${specOperations.size} OpenAPI operations.`);
  }
}

for (const w of warnings) console.warn(`  warning  ${w}`);
for (const e of errors) console.error(`  error    ${e}`);

if (errors.length) {
  console.error(`\n${errors.length} error(s).`);
  process.exit(1);
}
if (!QUIET) console.log('\nOK.');
