// Android QA-only integration. Keep native printer/scanner/permissions intact.
// Apply targeted workspace refresh tuning to native Dashboard instead of
// replacing the native file with the web version.
import { readFileSync, writeFileSync } from 'node:fs';
const path = 'src/components/Dashboard.tsx';
let source = readFileSync(path,'utf8');
function replaceOnce(before, after, name) {
  if (source.split(before).length !== 2) throw new Error('Cannot safely patch native ' + name);
  source = source.replace(before,after);
}
replaceOnce(
  '    let refreshInFlight = false;\n    cloudWorkspaceLoadedRef.current = false;',
  '    let refreshInFlight = false;\n    // Realtime handles normal updates. Focus/keyboard must not re-fetch the whole store.\n    let lastFullRefreshAt = Date.now();\n    const MIN_RECOVERY_REFRESH_MS = 3 * 60 * 1000;\n    cloudWorkspaceLoadedRef.current = false;',
  'workspace refresh timer',
);
replaceOnce(
  '      if (!active || !navigator.onLine || refreshInFlight) return;\n      if (Date.now() - localWorkspaceChangedAtRef.current < LOCAL_WORKSPACE_PROTECTION_MS) return;',
  '      if (!active || !navigator.onLine || refreshInFlight) return;\n      if (!force && Date.now() - lastFullRefreshAt < MIN_RECOVERY_REFRESH_MS) return;\n      if (Date.now() - localWorkspaceChangedAtRef.current < LOCAL_WORKSPACE_PROTECTION_MS) return;',
  'workspace throttle',
);
replaceOnce(
  '          cloudWorkspaceLoadedRef.current = true;\n          applyWorkspace(workspace);\n        }\n      } finally {\n        refreshInFlight = false;',
  '          cloudWorkspaceLoadedRef.current = true;\n          lastFullRefreshAt = Date.now();\n          applyWorkspace(workspace);\n        }\n      } finally {\n        refreshInFlight = false;',
  'refresh timestamp',
);
replaceOnce(
  '    const handleFocus = () => {\n      refreshWorkspaceFromDatabase(true);\n    };',
  '    const handleFocus = () => {\n      void refreshWorkspaceFromDatabase();\n    };',
  'keyboard focus',
);
replaceOnce('    }, 90_000);', '    }, 5 * 60 * 1000);','recovery polling');
writeFileSync(path,source);
console.log('Android native workspace refresh tuned; payment and printer handlers preserved');
