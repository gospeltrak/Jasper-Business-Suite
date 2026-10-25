/**
 * Stable, versioned JSON digest for immutable offline operations.
 * The authoritative backend MUST independently reproduce this algorithm,
 * reject a repeated idempotency key with a different digest and return the
 * original receipt on retries.
 *
 * This is a payload-integrity checksum, NOT an authentication signature.
 */
export function canonicalOfflinePayload(value: unknown): string {
  const visited = new WeakSet<object>();
  const stringify = (input: unknown, arrayItem = false): string | undefined => {
    if (input === null) return 'null';
    if (typeof input === 'string' || typeof input === 'boolean') return JSON.stringify(input);
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) throw new Error('Financial payload has a non-finite number.');
      return JSON.stringify(input);
    }
    if (input === undefined) return arrayItem ? 'null' : undefined;
    if (typeof input !== 'object') throw new Error('Financial payload contains unsupported values.');
    if (visited.has(input)) throw new Error('Circular reference in financial payload.');
    visited.add(input);
    try {
      if (input instanceof Date) {
        if (!Number.isFinite(input.getTime())) throw new Error('Invalid date in financial payload.');
        return JSON.stringify(input.toISOString());
      }
      if (Array.isArray(input)) {
        const members = input.map(item => stringify(item, true) ?? 'null');
        return `[${members.join(',')}]`;
      }
      const proto = Object.getPrototypeOf(input);
      if (proto !== Object.prototype && proto !== null) {
        throw new Error('Financial payload must be plain JSON.');
      }
      const entries: string[] = [];
      for (const key of Object.keys(input).sort()) {
        const serialized = stringify((input as Record<string, unknown>)[key]);
        if (serialized !== undefined) entries.push(`${JSON.stringify(key)}:${serialized}`);
      }
      return `{${entries.join(',')}}`;
    } finally {
      visited.delete(input);
    }
  };
  const result = stringify(value);
  if (result === undefined) throw new Error('Financial payload is empty.');
  return result;
}

export async function offlinePayloadDigest(payload: unknown): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure SHA-256 is unavailable: offline write blocked.');
  const bytes = new TextEncoder().encode(canonicalOfflinePayload(payload));
  const raw = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(raw), byte => byte.toString(16).padStart(2,'0')).join('');
  return `sha256:${hex}`;
}
