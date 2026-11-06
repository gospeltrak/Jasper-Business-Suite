// Read-only TypeScript inventory. A diagnostic is a removal candidate, not
// proof that the code can safely be deleted (dynamic registration may exist).
// Usage: npm run audit:dead-code; npm run audit:dead-code -- --fail
import ts from 'typescript';
import { resolve } from 'node:path';

const configFile = ts.readConfigFile(resolve('tsconfig.json'), ts.sys.readFile);
if (configFile.error) {
  console.error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
  process.exit(2);
}
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());
if (config.errors.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(config.errors, {
    getCanonicalFileName: x => x, getCurrentDirectory: process.cwd,
    getNewLine: () => '\n',
  }));
  process.exit(2);
}

const program = ts.createProgram(config.fileNames, {
  ...config.options, noUnusedLocals: true, noUnusedParameters: false,
});
const codes = new Set([6133, 6192, 6196, 6199]);
const diagnostics = ts.getPreEmitDiagnostics(program).filter(d => codes.has(d.code));
const results = diagnostics.map(d => {
  const file = d.file?.fileName.replace(process.cwd() + '/', '') || '<unknown>';
  const line = d.file && d.start !== undefined
    ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 0;
  return { file, line, code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, ' ') };
});
const byFile = new Map();
for (const entry of results) byFile.set(entry.file, (byFile.get(entry.file) || 0) + 1);
console.log('Potential unused TypeScript symbols: ' + results.length);
console.log('Files with candidates: ' + byFile.size);
console.log('Highest-count files:');
for (const [file,count] of [...byFile].sort((a,b)=>b[1]-a[1]).slice(0,30))
  console.log('  ' + count + ' ' + file);
console.log('First 80 candidates (review before deletion):');
for (const d of results.slice(0,80))
  console.log(d.file + ':' + d.line + ' TS' + d.code + ' ' + d.message);
if (process.argv.includes('--fail') && results.length) process.exitCode = 1;
