// Best-effort Telegram alert sender for security and payment-approval events.
// Never throws — a Telegram outage must not break the request that triggered
// the alert. Silently no-ops if TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID are unset.

export async function sendTelegramAlert(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: any) {
    console.error('[TelegramAlert] send failed:', err?.message || err);
  }
}
