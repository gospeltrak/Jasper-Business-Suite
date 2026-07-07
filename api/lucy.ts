import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'GEMINI_API_KEY not configured.' });
  }

  const { system, messages } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Convert messages to Gemini format
    const geminiContents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      config: { systemInstruction: system },
      contents: geminiContents,
    });

    const text = response.text ?? '';
    return res.json({ text });
  } catch (err: any) {
    console.error('[Lucy API] Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Lucy request failed.' });
  }
}
