/**
 * userPresence.ts
 * 
 * Tracks two things:
 * 1. ONLINE PRESENCE — heartbeat every 30s to Supabase Realtime presence channel
 *    Super Admin reads who is currently online (last heartbeat < 90s ago)
 * 
 * 2. DAILY VISIT LOG — once per session per day, logs a visit record to
 *    onlineStorage under 'jasper_visit_log'. Super Admin reads this for
 *    historical daily visitor reports.
 * 
 * User types: 'tenant' | 'affiliate' | 'partner'
 */

import { formatLocalDate } from './localDate';

export type PresenceUserType = 'tenant' | 'affiliate' | 'partner';

export interface VisitLogEntry {
  userId: string;
  userType: PresenceUserType;
  userName: string;
  date: string;        // YYYY-MM-DD
  firstSeenAt: string; // ISO timestamp
  lastSeenAt: string;  // ISO timestamp
}

export interface OnlinePresenceEntry {
  userId: string;
  userType: PresenceUserType;
  userName: string;
  lastHeartbeat: string; // ISO timestamp
}

const VISIT_LOG_KEY = 'jasper_visit_log';
const PRESENCE_KEY = 'jasper_online_presence';
const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
const ONLINE_THRESHOLD_MS = 90_000;   // 90 seconds — if no heartbeat in 90s, considered offline

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let currentUserId: string | null = null;
let currentUserType: PresenceUserType | null = null;
let currentUserName: string | null = null;

// ─── VISIT LOG ────────────────────────────────────────────────────────────────

function getTodayStr(): string {
  return formatLocalDate();
}

function getVisitLog(): VisitLogEntry[] {
  try {
    const raw = onlineStorage.getItem(VISIT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveVisitLog(log: VisitLogEntry[]): void {
  try {
    // Keep last 90 days of data only — prevent unbounded growth
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = formatLocalDate(cutoff);
    const trimmed = log.filter(e => e.date >= cutoffStr);
    onlineStorage.setItem(VISIT_LOG_KEY, JSON.stringify(trimmed));
  } catch {
    // onlineStorage full — skip silently
  }
}

function recordVisit(userId: string, userType: PresenceUserType, userName: string): void {
  const today = getTodayStr();
  const now = new Date().toISOString();
  const log = getVisitLog();
  
  const existingIdx = log.findIndex(e => e.userId === userId && e.date === today);
  if (existingIdx >= 0) {
    // Update lastSeenAt for existing entry
    log[existingIdx].lastSeenAt = now;
    log[existingIdx].userName = userName; // keep name fresh
  } else {
    // New entry for today
    log.push({ userId, userType, userName, date: today, firstSeenAt: now, lastSeenAt: now });
  }
  saveVisitLog(log);
}

// ─── ONLINE PRESENCE ─────────────────────────────────────────────────────────

function getPresenceMap(): Record<string, OnlinePresenceEntry> {
  try {
    const raw = onlineStorage.getItem(PRESENCE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePresenceMap(map: Record<string, OnlinePresenceEntry>): void {
  try {
    onlineStorage.setItem(PRESENCE_KEY, JSON.stringify(map));
  } catch {}
}

function writeHeartbeat(): void {
  if (!currentUserId || !currentUserType || !currentUserName) return;
  const now = new Date().toISOString();
  const map = getPresenceMap();
  map[currentUserId] = {
    userId: currentUserId,
    userType: currentUserType,
    userName: currentUserName,
    lastHeartbeat: now,
  };
  savePresenceMap(map);
  // Also update the visit log lastSeenAt
  recordVisit(currentUserId, currentUserType, currentUserName);
}

function removeHeartbeat(): void {
  if (!currentUserId) return;
  const map = getPresenceMap();
  delete map[currentUserId];
  savePresenceMap(map);
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Call this when a user logs in (tenant, affiliate, or partner).
 * Starts heartbeat and records the first visit of the day.
 */
export function startPresenceTracking(
  userId: string,
  userType: PresenceUserType,
  userName: string
): void {
  // Clear any existing tracker first
  stopPresenceTracking();

  currentUserId = userId;
  currentUserType = userType;
  currentUserName = userName;

  // Record immediately
  writeHeartbeat();
  recordVisit(userId, userType, userName);

  // Then every 30 seconds
  heartbeatTimer = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);

  // Remove on tab close / page unload
  window.addEventListener('beforeunload', stopPresenceTracking);
}

/**
 * Call this when a user logs out or the session ends.
 */
export function stopPresenceTracking(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  removeHeartbeat();
  currentUserId = null;
  currentUserType = null;
  currentUserName = null;
  window.removeEventListener('beforeunload', stopPresenceTracking);
}

/**
 * Returns all users currently online (heartbeat within last 90 seconds).
 */
export function getOnlineUsers(): OnlinePresenceEntry[] {
  const map = getPresenceMap();
  const cutoff = Date.now() - ONLINE_THRESHOLD_MS;
  return Object.values(map).filter(
    e => new Date(e.lastHeartbeat).getTime() > cutoff
  );
}

/**
 * Returns visit log entries within a date range.
 * dateFrom and dateTo are YYYY-MM-DD strings (inclusive).
 */
export function getVisitsInRange(dateFrom: string, dateTo: string): VisitLogEntry[] {
  return getVisitLog().filter(e => e.date >= dateFrom && e.date <= dateTo);
}

/**
 * Returns today's visit count grouped by user type.
 */
export function getTodayVisitCounts(): Record<PresenceUserType, number> {
  const today = getTodayStr();
  const log = getVisitLog().filter(e => e.date === today);
  return {
    tenant: log.filter(e => e.userType === 'tenant').length,
    affiliate: log.filter(e => e.userType === 'affiliate').length,
    partner: log.filter(e => e.userType === 'partner').length,
  };
}
