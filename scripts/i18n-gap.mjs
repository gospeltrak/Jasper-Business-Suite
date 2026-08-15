/**
 * i18n-gap.mjs
 * ---------------------------------------------------------------------------
 * Inasoma src/LanguageContext.tsx, inalinganisha funguo za lugha zote,
 * na kuorodhesha zinazokosekana kwa kila lugha.
 *
 * Matumizi:
 *   node scripts/i18n-gap.mjs
 *   node scripts/i18n-gap.mjs --full     (onyesha funguo zote, si 15 za kwanza)
 *   node scripts/i18n-gap.mjs --lang sw  (lugha moja pekee)
 *   node scripts/i18n-gap.mjs --json     (toa JSON kwa zana nyingine)
 */

import { readFileSync, existsSync } from 'node:fs';

const SOURCE = 'src/LanguageContext.tsx';
const LANGS = ['sw', 'ar', 'fr'];

const args = process.argv.slice(2);
const showFull = args.includes('--full');
const asJson = args.includes('--json');
const onlyLang = args.includes('--lang')
  ? args[args.indexOf('--lang') + 1]
  : null;

if (!existsSync(SOURCE)) {
  console.error(`Faili haipatikani: ${SOURCE}`);
  console.error('Hakikisha unaendesha script hii kutoka mzizi wa mradi.');
  process.exit(1);
}

const src = readFileSync(SOURCE, 'utf8');

/**
 * Hutoa funguo za lugha moja kwa kufuata mabano hadi yanapofungwa.
 * Njia hii ni salama zaidi kuliko regex peke yake kwa sababu inaheshimu
 * vitu vilivyowekwa ndani ya vingine.
 */
function keysFor(lang) {
  const marker = new RegExp(`\\n\\s*${lang}\\s*:\\s*\\{`);
  const match = marker.exec(src);
  if (!match) return null;

  const open = src.indexOf('{', match.index);
  let depth = 0;
  let end = open;

  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const block = src.slice(open, end);
  const keys = new Set();
  for (const m of block.matchAll(/"([^"]+)"\s*:\s*"/g)) {
    keys.add(m[1]);
  }
  return keys;
}

const sets = {};
const missingLangs = [];

for (const lang of LANGS) {
  const keys = keysFor(lang);
  if (keys === null) {
    missingLangs.push(lang);
    sets[lang] = new Set();
  } else {
    sets[lang] = keys;
  }
}

if (missingLangs.length) {
  console.warn(`Onyo: sehemu hizi hazikupatikana kwenye faili: ${missingLangs.join(', ')}\n`);
}

// Muungano wa funguo zote zilizowahi kuonekana kwenye lugha yoyote
const all = new Set(LANGS.flatMap((l) => [...sets[l]]));

const report = {};
let failed = false;

for (const lang of LANGS) {
  if (onlyLang && lang !== onlyLang) continue;

  const missing = [...all].filter((k) => !sets[lang].has(k)).sort();
  report[lang] = {
    present: sets[lang].size,
    missing: missing.length,
    keys: missing,
  };
  if (missing.length) failed = true;
}

if (asJson) {
  console.log(JSON.stringify({ total: all.size, languages: report }, null, 2));
  process.exit(failed ? 1 : 0);
}

console.log(`Jumla ya funguo tofauti kwenye lugha zote: ${all.size}\n`);
console.log('─'.repeat(64));

for (const [lang, data] of Object.entries(report)) {
  const pct = all.size ? Math.round((data.present / all.size) * 100) : 0;
  const bar = '█'.repeat(Math.round(pct / 4)).padEnd(25, '·');

  console.log(`\n${lang.toUpperCase()}  ${bar}  ${pct}%`);
  console.log(`     zipo: ${data.present}    zinakosekana: ${data.missing}`);

  if (data.missing) {
    const show = showFull ? data.keys : data.keys.slice(0, 15);
    console.log('');
    show.forEach((k) => console.log(`     · ${k}`));
    if (!showFull && data.keys.length > 15) {
      console.log(`     … na nyingine ${data.keys.length - 15}  (tumia --full kuona zote)`);
    }
  }
}

console.log('\n' + '─'.repeat(64));

if (failed) {
  console.log('\nKuna funguo zinazokosekana. Tumia --full kuona orodha kamili.');
} else {
  console.log('\nLugha zote zimekamilika.');
}

process.exit(failed ? 1 : 0);
