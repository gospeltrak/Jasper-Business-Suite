// QA-only adapter: preserve native printer/scanner POS work while copying the
// proven React memoization of product cards from the web performance fix.
// Do NOT replace the whole native DashboardPOS.tsx with the web version.
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/modules/pos/DashboardPOS.tsx';
let source = readFileSync(path, 'utf8');
if (source.includes('const productCards = useMemo')) {
  throw new Error('Product card grid was already memoized; adapter must not run twice');
}
const start = '            filteredProducts.map(prod => {';
const end = '\n            })\n          )}';
const from = source.indexOf(start);
const until = source.indexOf(end, from);
if (from === -1 || until === -1 || source.indexOf(start, from + 1) !== -1) {
  throw new Error('Could not uniquely identify the native POS product-card renderer');
}
const original = source.slice(from, until + '\n            })'.length);
if (/\bcart\b|orderDiscount|setCart/.test(original)) {
  throw new Error('Product cards unexpectedly use cart state; memoization unsafe');
}
const marker = '  // Pre-compute ALL cart item display values once — avoids calling getPharmacyDoseConfig etc per render';
if (!source.includes(marker)) throw new Error('Cart display memo anchor not found');

const declaration = `  // Avoid re-drawing every catalog card and image whenever the cart gains an
  // item. Stable product-card React nodes let only cart rows and totals update.
  const productCards = useMemo(() => ${original.trim()}, [
    filteredProducts, productPriceMap, productRemainingMap, addToCart,
    showProductImages, currency,
  ]);

`;
source = source.replace(marker, declaration + marker);
const oldRender = original + '\n          )}';
if (!source.includes(oldRender)) throw new Error('Could not identify card-list JSX expression');
source = source.replace(oldRender, '            productCards\n          )}');
if (source.includes('            filteredProducts.map(prod => {')) {
  // The map is now inside the memo declaration, not in the returned JSX.
  if (source.indexOf('            filteredProducts.map(prod => {') > source.indexOf('  return (\n    <div id="pos-view-container"')) {
    throw new Error('Catalog is still being created inside the cart render path');
  }
}
writeFileSync(path, source);
console.log('Native POS catalog cards memoized; printer/scanner components preserved');
