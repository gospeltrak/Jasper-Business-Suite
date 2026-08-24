import { getSecureDataBridgeClient, isPlaceholderSecureDataBridgeClient } from '../secureDataBridge';

let activeLucyAudio: HTMLAudioElement | null = null;
let activeLucyAudioUrl: string | null = null;

export const stopLucySpeech = () => {
  activeLucyAudio?.pause();
  activeLucyAudio = null;
  if (activeLucyAudioUrl) URL.revokeObjectURL(activeLucyAudioUrl);
  activeLucyAudioUrl = null;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
};

export const speakWithGeminiLucy = async (
  text: string,
  tenantId: string,
  language: 'sw' | 'en',
  events?: { onStart?: () => void; onEnd?: () => void },
): Promise<void> => {
  const clean = text.trim().slice(0, 1_800);
  if (!clean) return;

  const client: any = await getSecureDataBridgeClient();
  if (isPlaceholderSecureDataBridgeClient(client) || !client.auth) throw new Error('Lucy voice requires an online session.');
  const { data: { session } = { session: null } } = await client.auth.getSession();
  if (!session?.access_token) throw new Error('Lucy voice requires sign in.');

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch('/api/lucy/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ tenantId, text: clean, language }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Gemini voice is temporarily unavailable.');
    const audioBlob = await response.blob();
    if (!audioBlob.size) throw new Error('Gemini voice returned no audio.');

    stopLucySpeech();
    activeLucyAudioUrl = URL.createObjectURL(audioBlob);
    activeLucyAudio = new Audio(activeLucyAudioUrl);
    activeLucyAudio.onplay = () => events?.onStart?.();
    activeLucyAudio.onended = () => { stopLucySpeech(); events?.onEnd?.(); };
    activeLucyAudio.onerror = () => { stopLucySpeech(); events?.onEnd?.(); };
    await activeLucyAudio.play();
  } finally {
    window.clearTimeout(timeout);
  }
};
