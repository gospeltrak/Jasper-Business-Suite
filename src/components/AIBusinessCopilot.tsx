import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { Tenant } from '../types';
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
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AIBusinessCopilotProps {
  activeTenant: Tenant;
  activeTab: string;
  onNavigate: (tabId: string) => void;
  products?: any[];
  sales?: any[];
  expenses?: any[];
}

interface Message {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  actionTriggered?: string;
  unsupportedFeature?: string | null;
}

export default function AIBusinessCopilot({ 
  activeTenant, 
  activeTab, 
  onNavigate,
  products = [],
  sales = [],
  expenses = []
}: AIBusinessCopilotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: 'Hi! I am Lucy, your Copilot. How can I assist you with your business today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdminUtilities, setShowAdminUtilities] = useState(false);

  // Voice Controls States
  const [isListening, setIsListening] = useState(false);
  const [isSpokenOutputEnabled, setIsSpokenOutputEnabled] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const [unsupportedLog, setUnsupportedLog] = useState<Record<string, number>>(() => {
    const cached = localStorage.getItem('jasper_unsupported_features');
    return cached ? JSON.parse(cached) : {};
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem('jasper_unsupported_features', JSON.stringify(unsupportedLog));
  }, [unsupportedLog]);

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

  const speakAIResponse = (text: string) => {
    if (!isSpokenOutputEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const speakText = cleanSpokenText(text);
      if (!speakText) return;
      const utterance = new SpeechSynthesisUtterance(speakText);
      utterance.pitch = 1.1;
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis fail', e);
    }
  };

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
    return () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); };
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

  const logUnsupportedFeature = (featureName: string, amount = 1) => {
    setUnsupportedLog(prev => ({ ...prev, [featureName]: (prev[featureName] || 0) + amount }));
  };

  const handleSend = async (customMessage?: string) => {
    const textToSend = customMessage || input;
    if (!textToSend.trim()) return;
    if (!customMessage) setInput('');

    const cleanLowerInput = textToSend.trim().toLowerCase();
    if (cleanLowerInput === '/admin' || cleanLowerInput === 'admin') {
      const nextState = !showAdminUtilities;
      setShowAdminUtilities(nextState);
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: nextState ? '🔐 Super-Admin Mode ENABLED.' : '🔐 Super-Admin Mode DISABLED.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      return;
    }

    setMessages(prev => [...prev, { sender: 'user', text: textToSend, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: textToSend, 
          activeTab, 
          businessType: activeTenant.businessType, 
          products, 
          sales, 
          expenses 
        })
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      
      const aiMsgObj: Message = {
        sender: 'ai',
        text: data.responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionTriggered: data.action === 'NAVIGATE' ? data.targetTab : undefined,
        unsupportedFeature: data.unsupportedFeature
      };

      if (data.action === 'NAVIGATE' && data.targetTab) setTimeout(() => onNavigate(data.targetTab), 1200);
      if (data.unsupportedFeature) logUnsupportedFeature(data.unsupportedFeature);

      setMessages(prev => [...prev, aiMsgObj]);
      speakAIResponse(data.responseText);
    } catch (err) {
      const lower = textToSend.toLowerCase();
      let responseText = 'Offline Mode: I am currently unable to reach the main AI server. I default to local diagnostics.';
      let actionObj: string | undefined = undefined;
      
      if (lower.includes('pos') || lower.includes('mauzo') || lower.includes('till')) {
        actionObj = 'pos';
        responseText = 'Switching view to Cashier Desk Till Register now...';
      } else if (lower.includes('ripoti') || lower.includes('report')) {
        actionObj = 'reports';
        responseText = 'Opening corporate reports module.';
      }
      
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionTriggered: actionObj
      }]);
      if (actionObj) setTimeout(() => onNavigate(actionObj!), 800);
      speakAIResponse(responseText);
    } finally {
      setIsLoading(false);
    }
  };

  const triggeredBacklogs = Object.entries(unsupportedLog).filter(([_, count]) => (count as number) >= 10);

  return (
    <>
      <button
        id="jasper-ai-floating-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-6 md:bottom-6 md:right-6 w-[56px] h-[56px] bg-[#111111] hover:bg-[#222222] rounded-full flex items-center justify-center text-white shadow-2xl transition-transform active:scale-95 cursor-pointer z-50 border border-slate-700/50 group"
      >
        <Sparkles className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            id="jasper-ai-chat-drawer"
            className="fixed bottom-24 right-6 w-[380px] h-[600px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden font-sans antialiased"
          >
            {/* Header */}
            <div 
              onDoubleClick={() => setShowAdminUtilities(prev => !prev)}
              className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-black text-white rounded-full flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-semibold text-sm text-slate-800 tracking-tight">Lucy</h5>
                  <p className="text-[11px] text-slate-500 font-medium">Always here to help</p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => {
                    const state = !isSpokenOutputEnabled;
                    setIsSpokenOutputEnabled(state);
                    if (!state && window.speechSynthesis) window.speechSynthesis.cancel();
                  }}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    isSpokenOutputEnabled ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {isSpokenOutputEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-full transition-colors font-sans cursor-pointer items-center justify-center inline-flex">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Admin Utility Banners */}
            {showAdminUtilities && triggeredBacklogs.length > 0 && (
              <div className="bg-amber-50 text-amber-900 border-b border-amber-100 p-3 text-[11px] flex items-start space-x-2 font-medium">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-bold">Missing Features Alert (10+ Requests)</p>
                  <ul className="mt-1 space-y-0.5">
                    {triggeredBacklogs.map(([feature, count]) => (
                      <li key={feature} className="flex justify-between border-t border-amber-200/50 pt-0.5">
                        <span className="opacity-80">{feature}</span>
                        <span className="font-bold bg-amber-200 px-1 rounded text-[10px]">{count} Req</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Chat Area */}
            <div className="p-4 flex-grow overflow-y-auto space-y-4 bg-white relative scrollbar-hide">
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
                placeholder="Ask Lucy anything..."
                className="flex-grow bg-[#F4F4F5] border-transparent rounded-full px-4 py-2 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-shadow"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
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
