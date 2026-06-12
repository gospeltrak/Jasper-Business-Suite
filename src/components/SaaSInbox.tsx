import React, { useState } from 'react';
import { Inbox, CheckCircle, Clock, Trash, AlertTriangle, Reply } from 'lucide-react';

interface InboxMessage {
  id: string;
  sender: string;
  subject: string;
  body: string;
  receivedAt: string;
  isRead: boolean;
  priority: 'high' | 'normal' | 'low';
}

export default function SaaSInbox() {
  const [messages, setMessages] = useState<InboxMessage[]>([
    {
      id: 'msg-1',
      sender: 'sarah_jasper',
      subject: 'Issue with Dashboard Settings',
      body: 'Hi Admin, I cannot seem to update my profile picture. It keeps throwing a 500 error.',
      receivedAt: '10 mins ago',
      isRead: false,
      priority: 'high'
    },
    {
      id: 'msg-2',
      sender: 'john_doe',
      subject: 'Hardware Inquiry',
      body: 'Can I purchase the thermal printer standalone without the tablet?',
      receivedAt: '2 hours ago',
      isRead: true,
      priority: 'normal'
    },
    {
      id: 'msg-3',
      sender: 'mikumi_resort',
      subject: 'Feature Request: POS Split Bills',
      body: 'It would be great if the POS system could allow splitting bills among customers directly from the cart.',
      receivedAt: '1 day ago',
      isRead: true,
      priority: 'normal'
    }
  ]);
  
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [replyText, setReplyText] = useState('');

  const unreadCount = messages.filter(m => !m.isRead).length;

  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMessages(messages.map(m => m.id === id ? { ...m, isRead: true } : m));
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMessages(messages.filter(m => m.id !== id));
    if (selectedMessage?.id === id) setSelectedMessage(null);
  };

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    alert('Reply sent to user.');
    setReplyText('');
    setSelectedMessage(null);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in h-auto">
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Inbox List */}
        <div className="w-full md:w-1/3 bg-slate-900 border border-slate-850 rounded-xl overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
            <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <Inbox className="w-4 h-4 text-indigo-400" />
              Inbox
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white rounded-full px-2 py-0.5 text-[9px] font-bold">
                  {unreadCount} New
                </span>
              )}
            </h3>
          </div>
          
          <div className="overflow-y-auto flex-1 divide-y divide-slate-800/60">
            {messages.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 font-mono italic">
                No messages in your inbox.
              </div>
            ) : (
              messages.map(msg => (
                <div 
                  key={msg.id}
                  onClick={() => {
                    setSelectedMessage(msg);
                    if (!msg.isRead) handleMarkAsRead(msg.id);
                  }}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedMessage?.id === msg.id 
                      ? 'bg-slate-800' 
                      : msg.isRead ? 'bg-slate-900 hover:bg-slate-850' : 'bg-slate-900 shadow-inner'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-[11px] font-bold font-mono ${msg.isRead ? 'text-slate-400' : 'text-white'}`}>
                      @{msg.sender}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">{msg.receivedAt}</span>
                  </div>
                  <h4 className={`text-xs mb-1 truncate ${msg.isRead ? 'text-slate-500' : 'text-slate-300 font-bold'}`}>
                    {msg.subject}
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate">{msg.body}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Viewer & Reply */}
        <div className="w-full md:w-2/3 bg-slate-900 border border-slate-850 rounded-xl flex flex-col h-[500px]">
          {selectedMessage ? (
            <>
              <div className="p-5 border-b border-slate-800 flex justify-between items-start">
                <div>
                  <h2 className="text-sm font-bold text-white mb-1">{selectedMessage.subject}</h2>
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span>From: @{selectedMessage.sender}</span>
                    <span>•</span>
                    <span>{selectedMessage.receivedAt}</span>
                    {selectedMessage.priority === 'high' && (
                      <span className="flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded text-[10px]">
                        <AlertTriangle className="w-3 h-3" /> Priority
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleMarkAsRead(selectedMessage.id)}
                    className="p-1.5 text-slate-500 hover:text-emerald-400 bg-slate-950 hover:bg-emerald-500/10 rounded transition-colors"
                    title="Mark as Read"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(selectedMessage.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 bg-slate-950 hover:bg-rose-500/10 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-sm text-slate-300 leading-relaxed font-sans">
                  {selectedMessage.body}
                </div>
              </div>
              
              <div className="p-5 border-t border-slate-800 bg-slate-900/50">
                <form onSubmit={handleReply} className="flex gap-2">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply to the user..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white outline-none focus:border-indigo-500 resize-none"
                    required
                  />
                  <button type="submit" className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center gap-2 uppercase tracking-wide transition-colors">
                    <Reply className="w-4 h-4" /> Reply
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 opacity-50">
              <Inbox className="w-12 h-12 mb-3" />
              <p className="text-xs font-mono uppercase tracking-widest">Select a message to read</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
