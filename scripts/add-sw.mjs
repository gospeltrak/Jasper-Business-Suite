/**
 * add-sw.mjs
 * ---------------------------------------------------------------------------
 * Inaongeza tafsiri 31 za Kiswahili zilizokosekana ndani ya
 * src/LanguageContext.tsx, mara baada ya `sw: {`.
 *
 * Salama:
 *   - Inatengeneza backup kabla ya kubadilisha chochote.
 *   - Inaruka funguo zilizokwishakuwepo (hairudufu).
 *   - Ikishindwa, faili ya asili haiguswi.
 *
 * Matumizi:
 *   node scripts/add-sw.mjs
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';

const FILE = 'src/LanguageContext.tsx';

const TRANSLATIONS = {
  'account identifier': 'Namba ya simu au barua pepe',
  'active stock': 'Bidhaa zilizopo',
  'aggregate outflow': 'Jumla ya matumizi',
  'audit ledger': 'Kumbukumbu za ripoti',
  'branch yield': 'Mapato ya tawi',
  'business industry niche': 'Aina ya biashara',
  'business intelligence': 'Ripoti za biashara',
  'commit ledger': 'Hifadhi matumizi',
  'compile report': 'Tengeneza ripoti',
  'consolidated margin curve': 'Chati ya mauzo na faida',
  'cost of goods sold': 'Gharama ya bidhaa',
  'deferred credit': 'Malipo ya baadaye',
  'discard': 'Ghairi',
  'dual channel': 'Rejareja na jumla',
  'fast movers': 'Bidhaa zinazouzwa haraka',
  'gross income': 'Jumla ya mapato',
  'gross revenue': 'Jumla ya mauzo',
  'intelligence & auditing': 'Ripoti za biashara',
  'last 30 days': 'Siku 30 zilizopita',
  'last 7 days': 'Siku 7 zilizopita',
  'net gross profit': 'Faida',
  'operating expenses burden': 'Matumizi ya biashara',
  'past 30 days': 'Siku 30 zilizopita',
  'procurement': 'Manunuzi',
  'product profitability': 'Faida ya bidhaa',
  'reporting terminal': 'Ripoti',
  'sales velocity': 'Kasi ya mauzo',
  'slow movers': 'Bidhaa zinazouzwa polepole',
  'statement line items': 'Maelezo ya ripoti',
  'tracked skus': 'Bidhaa zilizofuatiliwa',
  'units moved': 'Bidhaa zilizouzwa',
};

/* --- 1. Hakikisha faili ipo ------------------------------------------- */

if (!existsSync(FILE)) {
  console.error(`Faili haipatikani: ${FILE}`);
  console.error('Endesha script hii kutoka mzizi wa mradi.');
  process.exit(1);
}

const original = readFileSync(FILE, 'utf8');

/* --- 2. Tafuta sehemu ya `sw: {` --------------------------------------- */

const marker = /\n(\s*)sw\s*:\s*\{/;
const match = marker.exec(original);

if (!match) {
  console.error('Sehemu ya `sw: {` haikupatikana. Hakuna kilichobadilishwa.');
  process.exit(1);
}

const indentBase = match[1];          // nafasi kabla ya `sw:`
const indent = indentBase + '  ';     // nafasi za funguo ndani
const insertAt = match.index + match[0].length;

/* --- 3. Tenganisha zilizopo na mpya ------------------------------------ */

// Toa block ya sw ili tuone funguo zilizopo
function swBlock(src, start) {
  let depth = 0;
  const open = src.lastIndexOf('{', start);
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i);
    }
  }
  return '';
}

const block = swBlock(original, insertAt);
const existing = new Set(
  [...block.matchAll(/"([^"]+)"\s*:\s*"/g)].map((m) => m[1]),
);

const toAdd = Object.entries(TRANSLATIONS).filter(([k]) => !existing.has(k));
const skipped = Object.keys(TRANSLATIONS).filter((k) => existing.has(k));

if (toAdd.length === 0) {
  console.log('Tafsiri zote 31 tayari zipo. Hakuna kilichobadilishwa.');
  process.exit(0);
}

/* --- 4. Backup --------------------------------------------------------- */

const backup = `${FILE}.bak`;
copyFileSync(FILE, backup);

/* --- 5. Jenga maandishi ya kuingiza ------------------------------------ */

const escape = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const lines = toAdd
  .map(([k, v]) => `${indent}"${escape(k)}": "${escape(v)}",`)
  .join('\n');

const updated =
  original.slice(0, insertAt) + '\n' + lines + original.slice(insertAt);

writeFileSync(FILE, updated, 'utf8');

/* --- 6. Ripoti --------------------------------------------------------- */

console.log(`Backup imehifadhiwa: ${backup}\n`);
console.log(`Zimeongezwa: ${toAdd.length}`);
toAdd.forEach(([k, v]) => console.log(`   + ${k}  ->  ${v}`));

if (skipped.length) {
  console.log(`\nZimerukwa (zilikuwepo): ${skipped.length}`);
  skipped.forEach((k) => console.log(`   · ${k}`));
}

console.log('\nSasa endesha:  node scripts/i18n-gap.mjs --lang sw');
