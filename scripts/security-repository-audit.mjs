import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const forbiddenFilePatterns = [
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)(?:id_rsa|id_ed25519|credentials\.json|service-account\.json)$/i,
  /\.(?:pem|p12|pfx|key)$/i,
];

const allowedTrackedFiles = new Set(['.env.example']);
const forbiddenFiles = trackedFiles.filter(
  (file) => !allowedTrackedFiles.has(file) && forbiddenFilePatterns.some((pattern) => pattern.test(file)),
);

const secretPatterns = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Google API key', pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'OpenAI or payment secret', pattern: /(?:sk-(?:proj-|live-|test-)?|sk_(?:live|test)_)[0-9A-Za-z_-]{20,}/ },
];

const ignoredContentFiles = new Set([
  'package-lock.json',
  'scripts/security-repository-audit.mjs',
]);
const findings = [];

for (const file of trackedFiles) {
  if (ignoredContentFiles.has(file) || !fs.existsSync(file)) continue;
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 2_000_000) continue;

  const content = fs.readFileSync(file);
  if (content.includes(0)) continue;
  const text = content.toString('utf8');

  for (const { name, pattern } of secretPatterns) {
    if (pattern.test(text)) findings.push(`${file}: possible ${name}`);
  }

  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(?:#|\/\/)/.test(line)) continue;
    const assignment = line.match(/^\s*(?:SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY|OPENAI_API_KEY)\s*[=:]\s*(.*?)\s*$/i);
    const value = assignment?.[1]?.replace(/^["']|["']$/g, '').trim() || '';
    if (value.length >= 16 && !/^(?:env\(|process\.env|MY_|YOUR_|CHANGE_|REPLACE_|\.\.\.)/i.test(value)) {
      findings.push(`${file}: possible server secret assignment`);
    }
  }
}

if (forbiddenFiles.length || findings.length) {
  console.error('Repository security audit failed. Secret values are intentionally redacted.');
  for (const file of forbiddenFiles) console.error(`- ${file}: sensitive file must not be tracked`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Repository security audit passed (${trackedFiles.length} tracked files checked).`);
