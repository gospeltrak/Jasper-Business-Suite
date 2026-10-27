# Subscription reminders: dashboard and in-app inbox

**Date:** 2026-10-27. Draft PR #21 only. No live subscription, stock, sale or billing rows changed.

## Tenant-facing copy

| Remaining | English | Kiswahili |
|---|---|---|
| 3 days | Your Tanzanite package expires in 3 days. | Kifurushi chako cha Tanzanite kitaisha ndani ya siku 3. |
| 2 days | Your Tanzanite package expires in 2 days. | Kifurushi chako cha Tanzanite kitaisha ndani ya siku 2. |
| 1 day | Your Tanzanite package expires tomorrow. | Kifurushi chako cha Tanzanite kitaisha kesho. |

The plan name is dynamic (Ruby, Diamond or Tanzanite). Dashboard and in-app notifications use the same concise copy. The message no longer includes a secondary “Pay now” sentence. Trial countdowns are short too.

## Notification workflow

The tenant-owner/admin dashboard uses the existing authenticated notification-inbox service. On loading or refreshing the inbox, a narrow server endpoint checks the current active tenant's real subscription end timestamp. On remaining days 3, 2 and 1 it idempotently writes a `subscription` event to the **existing** `branch_notification_events` table and a delivered in-app row in `branch_notification_recipients` for that authenticated administrator. No schema changes, new table, outside-tenant IDs or client-supplied deadlines.

- Deduplication key includes tenant, actual period end timestamp and remaining day count. Repeated page loads and concurrent sessions do not reset read state.
- Server returns the verified plan name and day count; the notification center renders either English or Kiswahili. Existing server-owned read/mark-all-read endpoints still apply.
- Trial subscriptions with a server-recorded end date also receive a reminder at days 3, 2 and 1.
- Subscriptions already ended, pending, suspended or more than three days from ending are not created as new expiry notices.
- The notification center remains available on desktop, the responsive quick-settings hamburger, the direct mobile bell and **the full-screen tablet/mobile feature menu** for users authorized for the inbox. Do not grant the seller role the tenant-admin inbox.

## Manual checks

1. Check 3-day, 2-day and 1-day countdown with an authenticated test tenant, including account role and time near midnight. Check for one event per day after refresh, and persistence after logout/login and cross-device.
2. Tablet: open the hamburger quick menu and the full-screen Features menu, then Notifications; confirm no clipping and overlay is visible.
3. Switch to Kiswahili and back; the title and body should translate without mixed-language text.
4. Mark read; refresh/reopen; ensure the notification stays read and new day creates a separate unread item.
5. Renew the subscription in staging; ensure no new expired-period notices are generated after renewal.
6. Verify sales, stock, payroll, roles and all existing non-subscription notifications are unaffected.

**Release:** Keep draft until authenticated runtime staging tests and review. No production tenant event writes have been executed during this code review.
