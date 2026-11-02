#!/usr/bin/env node
/** Fail closed when a QA/debug APK is mistakenly submitted as an Orvix release.
 * Read-only: this never modifies APKs, their signatures or business records.
 * Usage: node scripts/verify-android-release.mjs path/to/Orvix-release.apk
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export function inspectAndroidManifest(b) {
  const u16 = (at) => b.readUInt16LE(at);
  const u32 = (at) => b.readUInt32LE(at);
  if (b.length < 36 || u16(0) !== 0x0003 || u16(8) !== 0x0001) {
    throw new Error('Missing or invalid binary AndroidManifest.xml');
  }
  const stringPool = 8;
  const stringCount = u32(stringPool + 8);
  const flags = u32(stringPool + 16);
  const stringsStart = u32(stringPool + 20);
  const utf8 = Boolean(flags & 0x100);
  function lengthAt(at, unit) {
    if (unit === 1) {
      const first = b[at];
      return first & 0x80 ? { length: ((first & 0x7f) << 8) | b[at + 1], next: at + 2 }
        : { length: first, next: at + 1 };
    }
    const first = u16(at);
    return first & 0x8000 ? { length: ((first & 0x7fff) << 16) | u16(at + 2), next: at + 4 }
      : { length: first, next: at + 2 };
  }
  const strings = Array.from({ length: stringCount }, (_, index) => {
    let at = stringPool + stringsStart + u32(stringPool + 28 + 4 * index);
    if (utf8) {
      at = lengthAt(at, 1).next;
      const { length, next } = lengthAt(at, 1);
      return b.toString('utf8', next, next + length);
    }
    const { length, next } = lengthAt(at, 2);
    return b.toString('utf16le', next, next + length * 2);
  });
  const valueAt = (index) => index === 0xffffffff ? null : (strings[index] ?? null);
  const result = { permissions: [], manifest: {}, application: {}, sdk: {} };
  for (let at = stringPool + u32(stringPool + 4); at + 8 <= b.length;) {
    const type = u16(at);
    const size = u32(at + 4);
    if (size < 8 || at + size > b.length) throw new Error('Corrupted AndroidManifest.xml chunk');
    if (type === 0x0102) {
      const name = valueAt(u32(at + 20));
      const attributesStart = u16(at + 24);
      const attributesSize = u16(at + 26);
      const count = u16(at + 28);
      const attributes = {};
      for (let i = 0; i < count; i++) {
        const a = at + 16 + attributesStart + i * attributesSize;
        const key = valueAt(u32(a + 4));
        const raw = valueAt(u32(a + 8));
        const kind = b[a + 15];
        const data = u32(a + 16);
        attributes[key] = raw ?? (kind === 3 ? valueAt(data) : kind === 0x12 ? Boolean(data) : data);
      }
      if (name === 'manifest') result.manifest = attributes;
      if (name === 'uses-sdk') result.sdk = attributes;
      if (name === 'application') result.application = attributes;
      if (name === 'uses-permission') result.permissions.push(attributes.name);
    }
    at += size;
  }
  return result;
}

export function checkRelease(manifest) {
  const findings = [];
  const app = manifest.application;
  if (app.debuggable !== false && app.debuggable !== undefined) {
    findings.push('android:debuggable must be false for a customer release');
  }
  if (app.allowBackup !== false) {
    findings.push('android:allowBackup must be false; also configure Android 12+ data extraction rules');
  }
  if (!manifest.permissions.includes('android.permission.POST_NOTIFICATIONS')) {
    findings.push('POST_NOTIFICATIONS permission is missing (Android 13+)');
  }
  if (Number(manifest.manifest.versionCode) <= 1 || !manifest.manifest.versionCode) {
    findings.push('versionCode must be incremented beyond the previous QA APK (1)');
  }
  return findings;
}

const apkPath = process.argv[1] && process.argv[1].endsWith('verify-android-release.mjs') ? process.argv[2] : null;
if (apkPath !== null || process.argv[1]?.endsWith('verify-android-release.mjs')) {
  if (!apkPath || !existsSync(apkPath)) {
    console.error('Usage: node scripts/verify-android-release.mjs path/to/Orvix-release.apk');
    process.exitCode = 2;
  } else {
    try {
      const xml = execFileSync('unzip', ['-p', apkPath, 'AndroidManifest.xml'], { maxBuffer: 8 * 1024 * 1024 });
      const manifest = inspectAndroidManifest(xml);
      const findings = checkRelease(manifest);
      console.log(`Orvix Android ${manifest.manifest.package} version ${manifest.manifest.versionName} (${manifest.manifest.versionCode})`);
      if (findings.length) {
        findings.forEach(f => console.error(`FAIL: ${f}`));
        process.exitCode = 1;
      } else console.log('PASS: Android manifest release safety checks');
    } catch (error) {
      console.error(`Could not verify APK: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
