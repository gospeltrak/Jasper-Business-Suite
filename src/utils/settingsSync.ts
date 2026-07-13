import { SystemSettings } from '../types';

export const SETTINGS_SYNC_FIELD = 'settingsSync';

type SettingsSyncMap = Record<string, string>;

const parseTime = (value?: string | null): number => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const isPlainObject = (value: any) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const clone = <T>(value: T): T => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const getAtPath = (source: any, path: string): any => {
  if (!path) return source;
  return path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), source);
};

const setAtPath = (target: any, path: string, value: any) => {
  const parts = path.split('.');
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!isPlainObject(cursor[part])) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
};

const equalJson = (left: any, right: any): boolean => {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return left === right;
  }
};

const collectSettingPaths = (value: any, prefix = ''): string[] => {
  if (!isPlainObject(value)) return prefix ? [prefix] : [];
  const paths: string[] = [];
  for (const key of Object.keys(value)) {
    if (key === SETTINGS_SYNC_FIELD) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const child = value[key];
    if (Array.isArray(child) || !isPlainObject(child)) {
      paths.push(path);
    } else {
      const childPaths = collectSettingPaths(child, path);
      paths.push(...(childPaths.length ? childPaths : [path]));
    }
  }
  return paths;
};

const readSyncMap = (settings: any): SettingsSyncMap => {
  const sync = settings?.[SETTINGS_SYNC_FIELD];
  return sync && typeof sync === 'object' && !Array.isArray(sync) ? sync : {};
};

export function stampSettingsForSync(
  nextSettings: SystemSettings,
  currentSettings: Partial<SystemSettings> | null | undefined,
  updatedAt = new Date().toISOString(),
): SystemSettings {
  const next: any = clone(nextSettings || {});
  const current: any = currentSettings || {};
  const previousSync = readSyncMap(current);
  const nextSync = readSyncMap(next);
  const paths = new Set([
    ...collectSettingPaths(next),
    ...collectSettingPaths(current),
  ]);

  for (const path of paths) {
    if (equalJson(getAtPath(next, path), getAtPath(current, path))) {
      nextSync[path] = nextSync[path] || previousSync[path] || updatedAt;
    } else {
      nextSync[path] = updatedAt;
    }
  }

  next[SETTINGS_SYNC_FIELD] = nextSync;
  return next as SystemSettings;
}

export function mergeSettingsForSync(
  incomingSettings: Partial<SystemSettings> | null | undefined,
  currentSettings: Partial<SystemSettings> | null | undefined,
): SystemSettings {
  if (!incomingSettings && !currentSettings) return {} as SystemSettings;
  if (!incomingSettings) return clone(currentSettings) as SystemSettings;
  if (!currentSettings) return clone(incomingSettings) as SystemSettings;

  const incoming: any = incomingSettings || {};
  const current: any = currentSettings || {};
  const incomingSync = readSyncMap(incoming);
  const currentSync = readSyncMap(current);
  const merged: any = clone(current);
  const mergedSync: SettingsSyncMap = { ...currentSync };
  const paths = new Set([
    ...collectSettingPaths(incoming),
    ...collectSettingPaths(current),
  ]);

  for (const path of paths) {
    const incomingTime = parseTime(incomingSync[path]);
    const currentTime = parseTime(currentSync[path]);
    const incomingValue = getAtPath(incoming, path);
    const currentValue = getAtPath(current, path);

    if (incomingValue === undefined) continue;
    if (currentValue === undefined || incomingTime >= currentTime) {
      setAtPath(merged, path, clone(incomingValue));
      mergedSync[path] = incomingSync[path] || currentSync[path] || new Date().toISOString();
    }
  }

  merged[SETTINGS_SYNC_FIELD] = mergedSync;
  return merged as SystemSettings;
}
