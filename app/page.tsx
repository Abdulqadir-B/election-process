"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Bot, MapPin, Calendar, FileText, Send, Flag, ChevronRight, Info, Loader2 } from 'lucide-react';

type Message = { role: 'user' | 'system'; content: string };
type DashboardData = {
  pollingLocation: string;
  deadlines: string;
  idRequirements: string;
};

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'Welcome to the Election Assistant. I can help you find your polling booth, voter registration deadlines, and ID requirements. Which state or city are you from?' }
  ]);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    pollingLocation: 'Awaiting your state or city.',
    deadlines: 'Awaiting your state or city.',
    idRequirements: 'Awaiting your state or city.'
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Skip scroll on initial mount — only scroll when new messages are added
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const currentMessages = [...messages, { role: 'user', content: userMessage }];
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: currentMessages })
      });

      // Safely parse JSON — if server returns an HTML error page this won't crash
      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new Error(`Server returned an unreadable response (HTTP ${response.status}). Try restarting the dev server.`);
      }

      // Server returned a structured error (e.g. Gemini quota, model error, missing key)
      if (data.error) {
        setMessages(prev => [...prev, { role: 'system', content: `⚠️ ${data.error}` }]);
        setIsLoading(false);
        return;
      }

      let aiText = data.message;
      
      // Look for JSON block in the response
      const jsonRegex = /```json\n([\s\S]*?)\n```/;
      const match = aiText.match(jsonRegex);
      
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.type === 'dashboard_update') {
            setDashboardData({
              pollingLocation: parsed.pollingLocation || 'No data found.',
              deadlines: parsed.deadlines || 'No data found.',
              idRequirements: parsed.idRequirements || 'No data found.'
            });
          }
        } catch (e) {
          console.error("Failed to parse JSON from AI response", e);
        }
        // Remove the JSON block from the text shown to the user
        aiText = aiText.replace(jsonRegex, '').trim();
      }

      setMessages(prev => [...prev, { role: 'system', content: aiText }]);
      
    } catch (error: any) {
      // This fires for true network failures or the JSON parse error above
      const msg = error?.message || 'An unexpected error occurred.';
      console.error("Chat fetch error:", msg, error);
      setMessages(prev => [...prev, { role: 'system', content: `⚠️ ${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Helpers ---

  // Makes URLs in text clickable links
  const linkify = (text: string, linkClass: string): React.ReactNode[] => {
    const urlPattern = /((?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9-]+\.(?:gov\.in|nic\.in|in|com|org)(?:\/[^\s]*)?)/g;
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    urlPattern.lastIndex = 0;
    while ((match = urlPattern.exec(text)) !== null) {
      if (match.index > lastIndex) result.push(text.slice(lastIndex, match.index));
      const href = /^https?:\/\//.test(match[0]) ? match[0] : `https://${match[0]}`;
      const displayText = match[0].replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
      result.push(
        <a key={match.index} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {displayText}
        </a>
      );
      lastIndex = urlPattern.lastIndex;
    }
    if (lastIndex < text.length) result.push(text.slice(lastIndex));
    return result;
  };

  // Renders card text — splits by sentences into bullets,
  // and if there's a colon followed by comma-separated items, renders them as a tag list
  const TextBullets = ({ text }: { text: string }) => {
    if (text.startsWith('Awaiting')) return <p className="text-sm text-slate-400 italic">{text}</p>;

    // Detect "intro text: item1, item2, item3..." pattern (for ID lists etc.)
    const colonIdx = text.lastIndexOf(':');
    if (colonIdx > -1) {
      const intro = text.slice(0, colonIdx + 1).trim();
      const rest = text.slice(colonIdx + 1).trim();
      const commaItems = rest
        .split(',')
        .map(s => s.replace(/\.$/, '').trim())
        .filter(s => s.length > 1 && !/^etc\.?$/i.test(s) && !/^and$/i.test(s));
      if (commaItems.length > 2) {
        return (
          <div className="space-y-2">
            <p className="text-sm text-slate-700 leading-relaxed">{linkify(intro, 'text-primary underline hover:opacity-80')}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {commaItems.map((item, i) => (
                <span key={i} className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-md border border-slate-200">
                  {item}
                </span>
              ))}
            </div>
          </div>
        );
      }
    }

    // Fallback: split by sentence boundaries
    const bullets = text.split(/(?<=\.)\s+/).map(s => s.trim()).filter(s => s.length > 2);
    if (bullets.length <= 1) return <p className="text-sm text-slate-700 leading-relaxed">{linkify(text, 'text-primary underline hover:opacity-80')}</p>;

    return (
      <ul className="space-y-1.5 mt-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            <span className="leading-relaxed">{linkify(b, 'text-primary underline hover:opacity-80')}</span>
          </li>
        ))}
      </ul>
    );
  };

  // Renders chat message text — handles numbered lists, bullet lines, newlines, and URLs
  const ChatContent = ({ text, isUser }: { text: string; isUser: boolean }) => {
    const linkClass = isUser ? 'underline text-white/90 hover:text-white' : 'text-primary underline hover:opacity-80';
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const isListLine = (l: string) => /^(\d+\.|[-•*])\s/.test(l);
    const hasLists = lines.some(isListLine);

    if (hasLists) {
      return (
        <div className="space-y-1.5">
          {lines.map((line, i) => {
            const clean = line.replace(/^(\d+\.|[-•*])\s+/, '').trim();
            if (isListLine(line)) {
              return (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isUser ? 'bg-white/70' : 'bg-primary'}`} />
                  <span className={isUser ? 'text-white leading-relaxed' : 'text-slate-700 leading-relaxed'}>
                    {linkify(clean, linkClass)}
                  </span>
                </div>
              );
            }
            return (
              <p key={i} className={`text-sm leading-relaxed ${isUser ? 'text-white' : 'text-slate-700'}`}>
                {linkify(line, linkClass)}
              </p>
            );
          })}
        </div>
      );
    }

    // Plain text — render line by line with link detection
    return (
      <div className="space-y-1">
        {lines.map((line, i) => (
          <p key={i} className={`text-sm leading-relaxed ${isUser ? 'text-white' : 'text-slate-700'}`}>
            {linkify(line, linkClass)}
          </p>
        ))}
      </div>
    );
  };


  return (
    <main className="flex flex-col h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Top Banner */}
      <div className="bg-slate-900 text-slate-100 text-xs py-2 px-6 flex items-center gap-2">
        <Flag className="w-4 h-4 text-slate-300" />
        <span>An election information guide for voters</span>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-white p-2 rounded-md">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl text-primary leading-tight">Civic Election Assistant</h1>
            <p className="text-sm text-slate-500">Your Election Information Guide</p>
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      <div className="px-6 md:px-8 py-4 text-sm text-slate-500 flex items-center gap-2">
        <span className="hover:underline cursor-pointer text-primary">Home</span>
        <ChevronRight className="w-4 h-4" />
        <span className="hover:underline cursor-pointer text-primary">Voter Information</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-700 font-medium">Your State / City Profile</span>
      </div>

      {/* Two Column Layout */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-8 overflow-hidden">
        
        {/* LEFT MAIN AREA: Dashboard (70%) */}
        <section className="flex-[7] space-y-8 overflow-y-auto pr-2">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-3xl font-bold text-slate-800">Your Election Dashboard</h2>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Tell the assistant your Indian state or city to get your polling booth details, voter registration deadlines, and accepted ID documents.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Polling Location Card */}
            <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-md rounded-xl p-6 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Polling Location</h3>
              </div>
              <TextBullets text={dashboardData.pollingLocation} />
            </div>

            {/* Key Deadlines Card */}
            <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-md rounded-xl p-6 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500/10 p-2 rounded-lg">
                  <Calendar className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Key Deadlines</h3>
              </div>
              <TextBullets text={dashboardData.deadlines} />
            </div>

            {/* ID Requirements Card */}
            <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-md rounded-xl p-6 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 p-2 rounded-lg">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">ID Requirements</h3>
              </div>
              <TextBullets text={dashboardData.idRequirements} />
            </div>
          </div>

          {/* Structured Information Table Area */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-md overflow-hidden mt-8">
            <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
               <Info className="w-5 h-5 text-slate-600" />
               <h3 className="font-semibold text-slate-800">Status Overview</h3>
            </div>
            <div className="p-6 text-sm text-slate-600 flex flex-col items-center justify-center py-12">
               {dashboardData.pollingLocation === 'Awaiting your state or city.' ? (
                 <p>Tell the assistant your state or city (e.g. &quot;Maharashtra&quot; or &quot;Bengaluru&quot;) to load your voter information.</p>
               ) : (
                 <p className="text-center text-primary font-medium">Your state/city profile has been loaded. Check the cards above for your election details.</p>
               )}
            </div>
          </div>

        </section>

        {/* RIGHT SIDEBAR: Chat Interface (30%) */}
        <aside className="flex-[3] w-full min-w-[320px] max-w-[400px] bg-white border border-slate-200 rounded-md shadow-sm flex flex-col overflow-hidden h-full">
          <header className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
               <Bot className="w-5 h-5 text-primary" />
               Support Assistant
            </h2>
          </header>

          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
            {messages.map((msg, idx) => (
              <div key={idx} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={msg.role === 'user'
                  ? 'bg-primary text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[85%] text-sm leading-relaxed'
                  : 'bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[90%] text-sm'
                }>
                  {msg.role === 'system' && (
                    <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1.5">Assistant</p>
                  )}
                  <ChatContent text={msg.content} isUser={msg.role === 'user'} />
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="bg-slate-50 p-4 rounded-md border border-slate-200 text-sm flex items-center gap-2 text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Area */}
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <form 
              onSubmit={handleSubmit}
              className="relative flex items-center"
            >
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter your state or city (e.g. Maharashtra, Delhi)..." 
                disabled={isLoading}
                className="w-full pl-3 pr-10 py-2 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-slate-800 bg-white disabled:opacity-50"
              />
              <button 
                type="submit" 
                disabled={isLoading || !inputValue.trim()}
                className="absolute right-2 p-1.5 text-primary hover:bg-slate-200 rounded-md transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </aside>

      </div>
    </main>
  );
}
