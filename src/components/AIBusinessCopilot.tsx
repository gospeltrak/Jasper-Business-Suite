import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { Tenant } from '../types';
import { createLucyResponse, detectLucyLanguage, getLucyGreeting } from '../utils/lucyBrain';
import { normalizeSubscriptionPlanId } from '../utils/subscription';
import { getSecureDataBridgeClient, isPlaceholderSecureDataBridgeClient } from '../secureDataBridge';
import { 
  Sparkles, 
  Send, 
  X, 
  AlertTriangle,
  CheckCircle,
  Radio,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Lock,
  BarChart3,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { speakWithGeminiLucy, stopLucySpeech, unlockLucySpeech } from '../utils/lucySpeech';

interface AIBusinessCopilotProps {
  activeTenant: Tenant;
  activeTab: string;
  onNavigate: (tabId: string) => void;
  products?: any[];
  sales?: any[];
  expenses?: any[];
  subscriptionStatus?: any;
}

interface Message {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  actionTriggered?: string;
  unsupportedFeature?: string | null;
  sources?: Array<{ title: string; url: string }>;
}

const inferLucyIntent = (text: string): 'chat' | 'report' | 'forecast' => {
  const lower = text.toLowerCase();
  if (lower.includes('forecast') || lower.includes('utabiri') || lower.includes('makadirio') || lower.includes('predict')) return 'forecast';
  if (lower.includes('report') || lower.includes('ripoti') || lower.includes('analysis') || lower.includes('summarize') || lower.includes('muhtasari')) return 'report';
  return 'chat';
};

const LUCY_VOICE_KEY = 'jasper_lucy_voice_name';
const LUCY_FEMALE_VOICE_HINTS = [
  'google uk english female',
  'google us english',
  'samantha',
  'serena',
  'karen',
  'susan',
  'victoria',
  'zira',
  'aria',
  'jenny',
  'female',
  'woman',
  'google'
];

const pickLucyVoice = (voices: SpeechSynthesisVoice[]) => {
  if (!voices.length) return null;
  const saved = onlineStorage.getItem(LUCY_VOICE_KEY);
  if (saved) {
    const savedVoice = voices.find((voice) => voice.name === saved);
    if (savedVoice) return savedVoice;
  }

  const scored = voices
    .map((voice) => {
      const haystack = `${voice.name} ${voice.lang}`.toLowerCase();
      const hintScore = LUCY_FEMALE_VOICE_HINTS.reduce((score, hint, index) => (
        haystack.includes(hint) ? score + (LUCY_FEMALE_VOICE_HINTS.length - index) : score
      ), 0);
      const langScore = voice.lang.toLowerCase().startsWith('en') ? 4 : voice.lang.toLowerCase().startsWith('sw') ? 3 : 0;
      const localScore = voice.localService ? 1 : 0;
      return { voice, score: hintScore + langScore + localScore };
    })
    .sort((a, b) => b.score - a.score);

  const selected = scored[0]?.voice || voices[0];
  if (selected) onlineStorage.setItem(LUCY_VOICE_KEY, selected.name);
  return selected;
};

export default function AIBusinessCopilot({ 
  activeTenant, 
  activeTab, 
  onNavigate,
  products = [],
  sales = [],
  expenses = [],
  subscriptionStatus
}: AIBusinessCopilotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const rawPlanId = normalizeSubscriptionPlanId(
    subscriptionStatus?.state?.planId
      || subscriptionStatus?.plan?.packageId
      || subscriptionStatus?.plan?.id
      || activeTenant.activePackageId
      || activeTenant.selectedPackageId
  );
  const planId = rawPlanId === 'trial' && !subscriptionStatus?.isExpired ? 'diamond' : rawPlanId;
  const isLucyEnabled = planId === 'diamond' || planId === 'tanzanite';
  const dailyLimits = planId === 'tanzanite'
    ? { chat: 500, report: 6, forecast: 3 }
    : planId === 'diamond'
      ? { chat: 200, report: 3, forecast: 0 }
      : { chat: 0, report: 0, forecast: 0 };
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: isLucyEnabled
        ? getLucyGreeting('en', activeTenant.name)
        : 'Lucy AI is available from Diamond. Upgrade to unlock online guidance, reports, and business growth support.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<'online' | 'safe-mode' | 'locked'>(
    isLucyEnabled ? 'online' : 'locked'
  );
  const [usage, setUsage] = useState<{ intent?: string; used?: number; limit?: number; remaining?: number; model?: string } | null>(null);

  useEffect(() => {
    setOnlineStatus(isLucyEnabled ? 'online' : 'locked');
    setMessages(prev => {
      if (prev.length !== 1 || prev[0]?.sender !== 'ai') return prev;
      return [{
        ...prev[0],
        text: isLucyEnabled
          ? getLucyGreeting('en', activeTenant.name)
          : 'Lucy AI is available from Diamond. Upgrade to unlock online guidance, reports, and business growth support.'
      }];
    });
  }, [isLucyEnabled, activeTenant.name]);

  // Voice Controls States
  const [isListening, setIsListening] = useState(false);
  const [isSpokenOutputEnabled, setIsSpokenOutputEnabled] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const cleanSpokenText = (rawText: string): string => {
    let cleaned = rawText.replace(/\[.*?\]/g, '').replace(/<.*?>/g, '');
    const lines = cleaned.split('\n');
    const filteredLines = lines.map(line => line.trim())
      .filter(line => !line.includes('|-') && !line.includes('-|'))
      .map(line => line.replace(/\|/g, ' ').replace(/^[-*•\d+.]\s+/, '').replace(/\b(sku|barcode|serial|id|uuid|code)(\s*:\s*|\s+)[a-z5-9-]+/gi, '').replace(/\b[a-z]{2,5}-\d{2,10}\b/gi, '').replace(/\b\d{7,18}\b/gi, ''));
    cleaned = filteredLines.filter(line => line.trim().length > 0).join('. ').replace(/[\s\t]+/g, ' ').replace(/\.+/g, '.').replace(/,\s*,/g, ',');
    return cleaned.trim();
  };

  const speakAIResponse = async (text: string, force = false) => {
    if (!force && !isSpokenOutputEnabled) return;
    setSpeechError(null);
    const language = detectLucyLanguage(text) === 'sw' ? 'sw' : 'en';
    try {
      await speakWithGeminiLucy(cleanSpokenText(text), activeTenant.id, language);
      return;
    } catch {
      // Gemini TTS is preview and can be temporarily unavailable. Keep the
      // browser voice as a resilient offline/timeout fallback.
    }
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const speakText = cleanSpokenText(text);
      if (!speakText) return;
      const utterance = new SpeechSynthesisUtterance(speakText);
      const selectedVoice = pickLucyVoice(speechVoices.length ? speechVoices : window.speechSynthesis.getVoices());
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang = language === 'sw' ? 'sw-TZ' : 'en-US';
      }
      utterance.pitch = 1.08;
      utterance.rate = 0.92;
      utterance.onerror = () => setSpeechError(language === 'sw'
        ? 'Sauti imezuiwa na browser. Bonyeza speaker tena kisha ongeza volume ya kifaa.'
        : 'The browser blocked audio. Tap the speaker again and check the device volume.');
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis fail', e);
      setSpeechError(language === 'sw' ? 'Sauti haikuweza kuanza. Tafadhali bonyeza speaker tena.' : 'Voice could not start. Please tap the speaker again.');
    }
  };

  const openSubscriptionPackages = () => {
    setIsOpen(false);
    onNavigate('subscription-modal');
    window.dispatchEvent(new CustomEvent('jasper_open_subscription_packages', { detail: { source: 'lucy' } }));
  };

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setSpeechVoices(voices);
      pickLucyVoice(voices);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if (window.speechSynthesis.onvoiceschanged === loadVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.onstart = () => { setIsListening(true); setSpeechError(null); };
      rec.onerror = (event: any) => {
        setSpeechError('Microphone permission blocked or speech not heard clearly.');
        setIsListening(false);
      };
      rec.onend = () => setIsListening(false);
      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && transcript.trim()) handleSend(transcript);
      };
      recognitionRef.current = rec;
    }
    return () => stopLucySpeech();
  }, []);

  const toggleListening = () => {
    if (!(window as any).SpeechRecognition && !(window as any).webkitSpeechRecognition) {
      alert('Your browser does not support Speech Recognition.');
      return;
    }
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
    } else {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      try {
        recognitionRef.current.start();
      } catch (err) {}
    }
  };

  const handleSend = async (customMessage?: string) => {
    const textToSend = customMessage || input;
    if (!textToSend.trim()) return;
    if (!isLucyEnabled) {
      setIsOpen(true);
      openSubscriptionPackages();
      return;
    }
    if (!customMessage) setInput('');

    setMessages(prev => [...prev, { sender: 'user', text: textToSend, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setIsLoading(true);

    const intent = inferLucyIntent(textToSend);
    const latestLanguageBearingUserMessage = [...messages]
      .reverse()
      .find(message => message.sender === 'user' && /[a-zA-Z]{2,}/.test(message.text));
    const isShortChoiceReply = /^\s*(?:(?:option|number|namba|chaguo)\s*)?(?:\d+|[a-e])\s*$/i.test(textToSend);
    const conversationLanguage = isShortChoiceReply
      ? detectLucyLanguage(latestLanguageBearingUserMessage?.text || textToSend)
      : detectLucyLanguage(textToSend);
    const conversation = [
      ...messages.slice(-8).map(message => ({
        role: message.sender === 'ai' ? 'assistant' : 'user',
        content: message.text,
      })),
      { role: 'user', content: textToSend },
    ];
    const localLucy = createLucyResponse(textToSend, {
      activeTenant,
      activeTab,
      products,
      sales,
      expenses,
      surface: 'dashboard'
    });
    try {
      const client: any = await getSecureDataBridgeClient();
      const { data: { session } = { session: null } } = !isPlaceholderSecureDataBridgeClient(client) && client.auth
        ? await client.auth.getSession()
        : { data: { session: null } };
      const response = await fetch('/api/copilot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          message: textToSend,
          activeTab,
          deviceClass: window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1280 ? 'tablet' : 'desktop',
          businessType: activeTenant.businessType || 'retail',
          lang: conversationLanguage,
          conversation,
          tenantId: activeTenant.id,
          planId,
          intent,
          activeTenant: {
            id: activeTenant.id,
            name: activeTenant.name,
            businessType: activeTenant.businessType,
            selectedPackageId: activeTenant.selectedPackageId,
            activePackageId: activeTenant.activePackageId,
            city: activeTenant.city,
            country: activeTenant.country,
          },
          products: products.slice(0, 50).map(product => ({
            name: product.name,
            category: product.category,
            stockQty: product.stockQty ?? product.shopStockQty ?? 0,
            alertQty: product.alertQty,
            sellingPrice: product.sellingPrice,
          })),
          sales: [...sales]
            .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
            .slice(0, 80)
            .map(sale => ({
              id: sale.id,
              total: sale.total,
              productTotal: (sale as any).productTotal,
              timestamp: sale.timestamp,
              paymentMethod: sale.paymentMethod,
            })),
          expenses: [...expenses]
            .sort((a, b) => String(b.timestamp || b.date || '').localeCompare(String(a.timestamp || a.date || '')))
            .slice(0, 50)
            .map(expense => ({
              category: expense.category,
              amount: expense.amount,
              date: expense.timestamp || expense.date,
            })),
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && data?.responseText) {
        throw Object.assign(new Error(data.responseText), { lucyPayload: data });
      }

      const onlineText = typeof data.responseText === 'string' ? data.responseText.trim() : '';
      const answerText = onlineText || localLucy.text;
      const aiMsgObj: Message = {
        sender: 'ai',
        text: answerText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionTriggered: (data.action === 'NAVIGATE' ? data.targetTab : undefined) || (localLucy.action === 'NAVIGATE' ? localLucy.targetTab : undefined),
        unsupportedFeature: data.unsupportedFeature || localLucy.safetyTopic,
        sources: Array.isArray(data.sources) ? data.sources : [],
      };

      setOnlineStatus(onlineText ? 'online' : 'safe-mode');
      setUsage(data.usage || null);
      setMessages(prev => [...prev, aiMsgObj]);
      void speakAIResponse(aiMsgObj.text);
      setIsLoading(false);

      if (data.action === 'NAVIGATE' && data.targetTab) {
        window.setTimeout(() => onNavigate(data.targetTab), 500);
      } else if (data.action === 'UPGRADE_REQUIRED') {
        window.setTimeout(() => onNavigate('subscription-modal'), 500);
      } else if (!onlineText && localLucy.action === 'NAVIGATE' && localLucy.targetTab) {
        window.setTimeout(() => onNavigate(localLucy.targetTab!), 500);
      }
    } catch (error: any) {
      const blockedPayload = error?.lucyPayload;
      if (blockedPayload?.responseText) {
        setMessages(prev => [...prev, {
          sender: 'ai',
          text: blockedPayload.responseText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unsupportedFeature: blockedPayload.unsupportedFeature
        }]);
        setUsage(blockedPayload.usage || null);
        setIsLoading(false);
        return;
      }

      const lucy = createLucyResponse(textToSend, {
        activeTenant,
        activeTab,
        products,
        sales,
        expenses,
        surface: 'dashboard'
      });

      const aiMsgObj: Message = {
        sender: 'ai',
        text: lucy.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionTriggered: lucy.action === 'NAVIGATE' ? lucy.targetTab : undefined,
        unsupportedFeature: lucy.safetyTopic
      };

      setOnlineStatus('safe-mode');
      setMessages(prev => [...prev, aiMsgObj]);
      speakAIResponse(lucy.text);
      setIsLoading(false);

      if (lucy.action === 'NAVIGATE' && lucy.targetTab) {
        window.setTimeout(() => onNavigate(lucy.targetTab!), 500);
      }
    }
  };

  return (
    <>
      <button
        id="jasper-ai-floating-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className={`lucy-copilot-fab fixed bottom-[calc(var(--dashboard-bottom-nav-height)+1rem)] right-4 xl:bottom-6 xl:right-6 w-[58px] h-[58px] rounded-2xl flex items-center justify-center text-white shadow-2xl transition-transform active:scale-95 cursor-pointer z-[65] border group ${
          isLucyEnabled
            ? 'bg-slate-950 hover:bg-slate-900 border-emerald-400/30'
            : 'bg-slate-700 hover:bg-slate-800 border-slate-500/40'
        }`}
      >
        {isLucyEnabled ? <Sparkles className="w-6 h-6 text-white group-hover:scale-110 transition-transform" /> : <Lock className="w-6 h-6 text-white" />}
        <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${isLucyEnabled ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            id="jasper-ai-chat-drawer"
            className="lucy-copilot-panel fixed bottom-[calc(var(--dashboard-bottom-nav-height)+1rem)] right-4 xl:bottom-24 xl:right-6 w-[calc(100vw-2rem)] max-w-[420px] h-[min(680px,calc(var(--app-height,100dvh)-var(--dashboard-bottom-nav-height)-2rem))] xl:h-[min(680px,calc(100dvh-7rem))] bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col z-[65] overflow-hidden font-sans antialiased"
          >
            {/* Header */}
            <div 
              className="px-5 py-4 bg-slate-950 text-white border-b border-slate-800 flex items-center justify-between select-none"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-emerald-400 text-slate-950 rounded-2xl flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="font-black text-sm tracking-tight">Lucy AI</h5>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-[9px] font-black uppercase tracking-wider">
                      {planId}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium">
                    {onlineStatus === 'online' ? 'Online business coach' : onlineStatus === 'safe-mode' ? 'Safe-mode guidance' : 'Diamond feature'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => {
                    const state = !isSpokenOutputEnabled;
                    setIsSpokenOutputEnabled(state);
                    if (!state) {
                      stopLucySpeech();
                      return;
                    }
                    unlockLucySpeech();
                    const lastLucyMessage = [...messages].reverse().find(message => message.sender === 'ai');
                    if (lastLucyMessage) void speakAIResponse(lastLucyMessage.text, true);
                  }}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    isSpokenOutputEnabled ? 'bg-emerald-400/15 text-emerald-300' : 'text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {isSpokenOutputEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-400 hover:bg-white/10 rounded-full transition-colors font-sans cursor-pointer items-center justify-center inline-flex">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
              <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                onlineStatus === 'online'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : onlineStatus === 'safe-mode'
                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                <ShieldCheck className="w-3 h-3" />
                {onlineStatus === 'online' ? 'Protected online' : onlineStatus === 'safe-mode' ? 'Local fallback' : 'Locked'}
              </span>
              <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-slate-600">
                <Zap className="w-3 h-3 text-amber-500" />
                {dailyLimits.chat} chats/day
              </span>
              <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-slate-600">
                <BarChart3 className="w-3 h-3 text-indigo-500" />
                {dailyLimits.report} reports/day
              </span>
              {usage?.limit !== undefined && (
                <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900 text-white">
                  {usage.intent}: {usage.remaining ?? 0} left
                </span>
              )}
            </div>

            {/* Chat Area */}
            <div className="p-4 flex-grow overflow-y-auto space-y-4 bg-[#fbfcfd] relative scrollbar-hide">
              {!isLucyEnabled && (
                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-950 space-y-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    <h4 className="text-xs font-black uppercase tracking-wider">Diamond unlock required</h4>
                  </div>
                  <p className="text-xs leading-relaxed">
                    Lucy starts from Diamond. Upgrade to unlock online guidance, business reports, and multilingual help.
                  </p>
                  <button
                    type="button"
                    onClick={openSubscriptionPackages}
                    className="px-3 py-2 rounded-xl bg-slate-950 text-white text-[11px] font-black"
                  >
                    View Packages
                  </button>
                </div>
              )}
              {isListening && (
                <div className="absolute inset-x-0 top-0 bottom-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center animate-pulse border border-blue-100 mb-4 shadow-sm">
                    <Radio className="w-8 h-8" />
                  </div>
                  <h4 className="text-[13px] font-semibold text-slate-800">Listening to you...</h4>
                  <p className="text-[12px] text-slate-500 mt-1 mb-6">Speak clearly into the microphone</p>
                  <button
                    onClick={toggleListening}
                    className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {speechError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-[11px] text-red-700 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="flex-1">{speechError}</span>
                  <button onClick={() => setSpeechError(null)} className="text-red-400 hover:text-red-700">&times;</button>
                </div>
              )}

              {messages.map((m, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  key={idx} 
                  className={`flex flex-col w-full ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div 
                    className={`px-4 py-2.5 rounded-[20px] max-w-[85%] text-[13px] leading-relaxed shadow-sm ${
                      m.sender === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-sm' 
                        : 'bg-[#F4F4F5] text-slate-800 rounded-bl-sm border border-slate-100/50'
                    }`}
                  >
                    {parseMessageText(m.text, m.sender)}

                    {m.sender === 'ai' && m.sources && m.sources.length > 0 && (
                      <div className="mt-3 border-t border-slate-200/70 pt-2">
                        <p className="mb-1 text-[9px] font-black uppercase tracking-wider text-slate-500">Current market sources</p>
                        <div className="flex flex-wrap gap-1.5">
                          {m.sources.map((source, sourceIndex) => (
                            <a
                              key={`${source.url}-${sourceIndex}`}
                              href={source.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="max-w-full truncate rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-blue-700 hover:border-blue-300"
                            >
                              {source.title || `Source ${sourceIndex + 1}`}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {m.actionTriggered && (
                      <div className="mt-2.5 p-2 bg-white/80 border border-slate-200/50 text-emerald-700 font-semibold text-[10px] rounded-xl flex items-center space-x-1.5 backdrop-blur-sm shadow-sm">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Redirected to {m.actionTriggered.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 mt-1 px-1">
                    {m.timestamp}
                  </span>
                </motion.div>
              ))}

              {isLoading && (
                <div className="flex items-start max-w-[85%]">
                  <div className="px-4 py-3 bg-[#F4F4F5] rounded-[20px] rounded-bl-sm flex items-center space-x-2 shadow-sm border border-slate-100/50">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="p-3 bg-white border-t border-slate-100 flex items-center space-x-2"
            >
              <button
                type="button"
                onClick={toggleListening}
                disabled={!isLucyEnabled}
                className={`p-2.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                  isListening ? 'bg-red-50 text-red-500' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!isLucyEnabled}
                placeholder={isLucyEnabled ? 'Ask Lucy about Orvix or your business...' : 'Upgrade to Diamond to use Lucy'}
                className="flex-grow bg-[#F4F4F5] border-transparent rounded-full px-4 py-2 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-shadow"
              />
              <button
                type="submit"
                disabled={!isLucyEnabled || isLoading || !input.trim()}
                className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center shadow-md transition-colors shrink-0"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function parseMessageText(text: string, sender: 'user' | 'ai'): ReactNode {
  const lines = text.split('\n');
  let inList = false;
  let inTable = false;
  const elements: ReactNode[] = [];
  let currentListItems: ReactNode[] = [];
  let tableRows: string[][] = [];

  const parseInlineStyles = (txt: string): ReactNode[] => {
    return txt.replace(/<b[^>]*>|<\/b>/gi, '**').split('**').map((part, i) => (
      i % 2 === 1 ? <strong key={i} className="font-bold">{part}</strong> : part
    ));
  };

  const flushList = (key: number) => {
    if (currentListItems.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="list-disc pl-5 my-1.5 space-y-0.5">
          {currentListItems}
        </ul>
      );
      currentListItems = [];
    }
    inList = false;
  };

  const flushTable = (key: number) => {
    if (tableRows.length > 0) {
      const filteredRows = tableRows.filter(row => !row.every(cell => cell.trim().startsWith('-')));
      if (filteredRows.length > 0) {
        const hasHeader = filteredRows.length > 1;
        elements.push(
          <div key={`table-${key}`} className="my-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-[12px] border-collapse">
              {hasHeader && (
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {filteredRows[0].map((cell, cidx) => (
                      <th key={cidx} className="px-3 py-2 text-left font-semibold text-slate-700">{cell.trim()}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {(hasHeader ? filteredRows.slice(1) : filteredRows).map((row, ridx) => (
                  <tr key={ridx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    {row.map((cell, cidx) => (
                      <td key={cidx} className="px-3 py-2 text-slate-600">{parseInlineStyles(cell.trim())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      tableRows = [];
    }
    inTable = false;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    const columns = trimmed.startsWith('|') && trimmed.endsWith('|') 
      ? trimmed.slice(1, -1).split('|') 
      : trimmed.includes('|') && trimmed.split('|').length > 1 
        ? trimmed.split('|') 
        : null;

    if (columns) {
      if (inList) flushList(idx);
      inTable = true;
      tableRows.push(columns);
      return;
    } else {
      if (inTable) flushTable(idx);
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      inList = true;
      currentListItems.push(
        <li key={`li-${idx}`} className="list-disc">{parseInlineStyles(trimmed.substring(2))}</li>
      );
    } else if (trimmed.match(/^\d+\.\s/)) {
      inList = true;
      currentListItems.push(
        <li key={`li-${idx}`} className="list-decimal">{parseInlineStyles(trimmed.replace(/^\d+\.\s/, ''))}</li>
      );
    } else if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
      flushList(idx);
      elements.push(
        <h4 key={idx} className={`font-semibold text-[14px] mt-3 mb-1 ${sender === 'user' ? 'text-white' : 'text-slate-800'}`}>
          {parseInlineStyles(trimmed.replace(/^#+\s/, ''))}
        </h4>
      );
    } else if (trimmed === '') {
      flushList(idx);
      elements.push(<div key={idx} className="h-1.5" />);
    } else {
      flushList(idx);
      elements.push(
        <p key={idx} className="my-1.5">{parseInlineStyles(trimmed)}</p>
      );
    }
  });

  flushList(999);
  flushTable(999);

  return <div className={`space-y-0.5 ${sender === 'user' ? 'text-white' : 'text-slate-800'}`}>{elements}</div>;
}
