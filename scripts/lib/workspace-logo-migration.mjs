import { createHash } from 'node:crypto';

const LOGO_FIELDS = [
  ['settings', 'business', 'businessLogo'],
  ['settings', 'business', 'businessLogoLight'],
  ['settings', 'business', 'businessLogoDark'],
  ['settings', 'company', 'logo'],
  ['settings', 'company', 'logoUrl'],
];

const MIME_EXTENSIONS = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
});

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function atPath(record, path) {
  let node = record;
  for (const key of path) {
    if (!node || typeof node !== 'object' || !Object.hasOwn(node, key)) return undefined;
    node = node[key];
  }
  return node;
}

function setPath(record, path, value) {
  const parent = atPath(record, path.slice(0, -1));
  if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, path.at(-1))) {
    throw new Error('Source logo path changed during migration');
  }
  parent[path.at(-1)] = value;
}

export function readInlineImage(value) {
  if (typeof value !== 'string' || !value.startsWith('data:')) return null;
  const match = /^data:(image\/[^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(value);
  if (!match) throw new Error('Unsupported or malformed inline image; original is preserved');
  const mime = match[1].toLowerCase();
  if (!Object.hasOwn(MIME_EXTENSIONS, mime)) {
    throw new Error('Unsupported inline image MIME; original is preserved');
  }
  const source = match[2].replace(/\s/g, '');
  const bytes = Buffer.from(source, 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== source) {
    throw new Error('Invalid or oversized inline image; original is preserved');
  }
  const validMagic = mime === 'image/png'
    ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : mime === 'image/jpeg'
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : mime === 'image/gif'
        ? ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii',0,6))
        : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (!validMagic) throw new Error('Inline image content does not match MIME; original is preserved');
  return {
    mime,
    bytes,
    hash: createHash('sha256').update(bytes).digest('hex'),
    extension: MIME_EXTENSIONS[mime],
  };
}

export function collectInlineLogoCandidates(payload) {
  const paths = [...LOGO_FIELDS];
  // Product-brand logos also live inside tenant-wide settings. They are
  // dynamically indexed array entries; preserve order, names and other keys.
  const productBrands = atPath(payload, ['settings', 'productStore', 'brands']);
  if (Array.isArray(productBrands)) {
    productBrands.forEach((brand, index) => {
      if (brand && typeof brand === 'object' && !Array.isArray(brand) &&
          Object.hasOwn(brand, 'logo')) {
        paths.push(['settings', 'productStore', 'brands', String(index), 'logo']);
      }
    });
  }

  const legacy = atPath(payload, ['settings', 'business', 'branchBranding']);
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
    for (const [storeName, branding] of Object.entries(legacy)) {
      if (!branding || typeof branding !== 'object' || Array.isArray(branding)) continue;
      for (const key of ['businessLogo', 'businessLogoLight', 'businessLogoDark']) {
        paths.push(['settings', 'business', 'branchBranding', storeName, key]);
      }
    }
  }
  return paths.flatMap((path) => {
    const value = atPath(payload, path);
    if (typeof value !== 'string' || !value.startsWith('data:')) return [];
    return [{ path, image: readInlineImage(value) }];
  });
}

export function replaceInlineLogos(payload, candidates, urlByHash) {
  // Only replace a key when it still contains exactly the expected bytes.
  // All other workspace keys and values are preserved.
  const updated = structuredClone(payload);
  for (const { path, image } of candidates) {
    const oldImage = readInlineImage(atPath(updated, path));
    const url = urlByHash.get(image.hash);
    if (!oldImage || oldImage.hash !== image.hash || !url || !url.startsWith('https://')) {
      throw new Error('Unsafe inline logo replacement refused');
    }
    setPath(updated, path, url);
  }
  return updated;
}

export function immutableLogoStoragePath(tenantId, image) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
    throw new Error('A valid tenant UUID is required');
  }
  return `migrated/${tenantId}/${image.hash}.${image.extension}`;
}
