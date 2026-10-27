# Tenant image upload budgets

**Status:** Code change on draft PR #21. Does not retroactively recompress saved Storage assets or legacy rows.

## Upload policy

| New upload | Target | Hard upper limit | Transport |
|---|---:|---:|---|
| Business light/dark, legacy store location, product brand logos | 10 KB | **10 KB** | Browser WebP where supported (otherwise JPEG); unchanged SVG only if already <= 10 KB |
| Real branch light/dark logo | 10 KB | **10 KB** | Browser JPEG + authenticated server endpoint that independently rejects bodies > 10 KB |
| Product photo (file or processed base64) | 10 KB | **25 KB** | Browser JPEG to the existing `product-images` path |

Limits use decimal **KB**: 10 KB = 10,000 bytes and 25 KB = 25,000 bytes. The browser tries progressively smaller dimensions and compression quality; the returned blob is inspected with `Blob.size` before upload. If no encoding meets the *hard* limit, upload fails and the existing saved image remains in place. Do not write raw data URLs or a larger fallback.

Product photos aim for <=10 KB. Only if that proves impossible at available conversion settings do we allow a clearer rendition <=25 KB. SVG logos are not rasterized; large SVG files are rejected rather than silently uploaded above the budget.

## Exclusions requiring a separate retention/privacy policy

- Customer receipts, proof of payment, IDs, attachment scans, invoices and signatures: **do not enforce 10 KB**. They may contain legally important text or evidence and shrinking them so far risks making them unreadable.
- Staff profile photos: existing legacy staff form stores a base64 settings value. Moving them to a public logo bucket would be a privacy mistake. Keep out of this release; plan an authenticated private bucket / URL migration and staff settings normalization.
- `/api/images/migrate-product`: legacy image-recovery endpoint accepts old inline images up to its original recovery limit; it is not the normal new-product upload path. Enforcing 25 KB there without a controlled migration would prevent recovering historical images. A future separate migration can recompress them safely.

## Acceptance criteria

- A 1–2 MB product photograph is recompressed to <=25 KB before new Storage upload, preferably <=10 KB.
- A business/brand/branch logo does not reach Storage with >10 KB. A failed upload leaves its original URL/settings unchanged.
- Staff document uploads and receipts are not destructively recompressed.
- Actual image visibility and quality on POS mobile cards, PDF invoices, light/dark branding and Android/iPhone should be tested on staging. CI covers byte-limit selection and server/client integration contract, not manual visual quality.
- Existing tenant data, tables, backups, attachments and historical Storage objects remain untouched.
