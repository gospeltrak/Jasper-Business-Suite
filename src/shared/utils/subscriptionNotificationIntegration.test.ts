import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync(resolve('src/components/Dashboard.tsx'), 'utf8');
const api = readFileSync(resolve('server.ts'), 'utf8');
const context = readFileSync(resolve('src/shared/contexts/JasperNotificationContext.tsx'), 'utf8');
const inbox = readFileSync(resolve('src/shared/components/NotificationCenterModal.tsx'), 'utf8');

describe('three-day subscription expiry notifications', () => {
  it('writes to existing tenant-isolated server inbox, not just phone-only client state', () => {
    expect(api).toContain("app.post('/api/notifications/subscription-reminder'");
    expect(api).toContain('requireNotificationInboxUser(req)');
    expect(api).toContain("idempotency_key: idempotencyKey");
    expect(api).toContain("recipient_user_id: access.user.id");
    expect(api).toContain("subscription_status,subscription_end_date");
    expect(api).toContain("days < 1 || days > 3");
    expect(api).toContain("if (inserted.error && inserted.error.code !== '23505')");
    expect(context).toContain("fetch('/api/notifications/subscription-reminder'");
    expect(context).toContain("fetch('/api/notifications/inbox'");
    expect(dashboard).not.toContain('window.innerWidth >= 768) return');
  });

  it('shows the same persisted event in Kiswahili or English using trusted metadata', () => {
    expect(api).toContain('subscriptionPlanName:');
    expect(api).toContain('subscriptionDaysRemaining:');
    expect(inbox).toContain('getSubscriptionReminder(');
    expect(inbox).toContain('localizedSubscription(n)?.message || n.message');
  });

  it('keeps notification access in the tablet quick menu and full feature menu', () => {
    expect(dashboard).toContain('setShowMobileQuickMenu(false)');
    expect(dashboard).toContain("aria-label={lang === 'sw' ? 'Fungua arifa' : 'Open notifications'}");
    expect(dashboard).toContain('setMoreMenuOpen(false);');
    expect(dashboard).toContain('void refreshInbox();');
    expect(dashboard).toContain('canAccessNotificationInbox && <NotificationCenterModal');
  });
});
