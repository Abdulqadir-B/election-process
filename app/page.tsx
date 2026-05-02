"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Vote, Landmark, MapPin, Calendar, FileText, Send, Flag, ChevronRight, Info, Loader2, CheckCircle2, Circle, Printer, Globe, MessageSquare } from 'lucide-react';

type Message = { role: 'user' | 'system'; content: string };
type DashboardData = { pollingLocation: string; deadlines: string; idRequirements: string };
type TimelineItem = { date: string; event: string };
type Lang = 'English' | 'Hindi' | 'Tamil' | 'Telugu';

const AWAITING = 'Awaiting your state or city.';

const LANG_LABELS: Record<Lang, string> = {
  English: 'English', Hindi: 'हिन्दी', Tamil: 'தமிழ்', Telugu: 'తెలుగు',
};

const WELCOME: Record<Lang, string> = {
  English: 'Welcome to the Election Assistant. I can help you find your polling booth, voter registration deadlines, and ID requirements. Which state or city are you from?',
  Hindi: 'चुनाव सहायक में आपका स्वागत है। मैं आपको मतदान केंद्र, पंजीकरण की अंतिम तिथि और आवश्यक दस्तावेज़ जानने में मदद कर सकता हूँ। आप किस राज्य या शहर से हैं?',
  Tamil: 'தேர்தல் உதவியாளரில் வரவேற்கிறோம். உங்கள் மாநிலம் அல்லது நகரத்தை கூறுங்கள்.',
  Telugu: 'ఎన్నికల సహాయకుడికి స్వాగతం. మీ రాష్ట్రం లేదా నగరాన్ని చెప్పండి.',
};

const CHECKLIST: Record<Lang, string[]> = {
  English: ['I have my EPIC / Voter ID card', 'I know my polling booth location', "I've verified my name in the voter list", 'I know the election date', "I've arranged transport to the polling booth"],
  Hindi: ['मेरे पास EPIC / मतदाता पहचान पत्र है', 'मुझे मतदान केंद्र का पता है', 'मैंने मतदाता सूची में नाम सत्यापित किया है', 'मुझे चुनाव की तारीख पता है', 'मैंने परिवहन की व्यवस्था की है'],
  Tamil: ['என்னிடம் EPIC / வாக்காளர் அட்டை உள்ளது', 'வாக்குசாவடி இடம் தெரியும்', 'வாக்காளர் பட்டியலில் பெயர் சரிபார்த்தேன்', 'தேர்தல் தேதி தெரியும்', 'பயண ஏற்பாடு செய்தேன்'],
  Telugu: ['నా దగ్గర EPIC / ఓటరు కార్డు ఉంది', 'పోలింగ్ బూత్ స్థానం తెలుసు', 'ఓటరు జాబితాలో పేరు ధృవీకరించాను', 'ఎన్నికల తేదీ తెలుసు', 'రవాణా ఏర్పాటు చేసాను'],
};

const LOADING_MESSAGES = [
  "Analyzing your location...",
  "Fetching local election details...",
  "Finding your polling booth...",
  "Checking voter ID requirements...",
  "Loading timeline events...",
  "Almost ready..."
];

const LoadingIndicator = () => {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-start">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[90%] text-sm flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
        <span className="text-slate-600 animate-pulse">{LOADING_MESSAGES[msgIdx]}</span>
      </div>
    </div>
  );
};
export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lang, setLang] = useState<Lang>('English');
  const [messages, setMessages] = useState<Message[]>([{ role: 'system', content: WELCOME['English'] }]);
  const [dashboardData, setDashboardData] = useState<DashboardData>({ pollingLocation: AWAITING, deadlines: AWAITING, idRequirements: AWAITING });
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [stateName, setStateName] = useState('');
  const [checklist, setChecklist] = useState<boolean[]>([false, false, false, false, false]);
  const [mobileTab, setMobileTab] = useState<'dashboard' | 'chat'>('chat');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Load checklist from localStorage on mount
  useEffect(() => {
    try { const s = localStorage.getItem('voterChecklist'); if (s) setChecklist(JSON.parse(s)); } catch {}
  }, []);

  // Persist checklist to localStorage on change
  useEffect(() => {
    localStorage.setItem('voterChecklist', JSON.stringify(checklist));
  }, [checklist]);

  // Skip scroll on initial mount — only scroll when new messages arrive
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Sync <html lang="..."> with the selected language for screen readers & SEO
  const LANG_CODES: Record<Lang, string> = { English: 'en', Hindi: 'hi', Tamil: 'ta', Telugu: 'te' };
  useEffect(() => {
    document.documentElement.lang = LANG_CODES[lang];
  }, [lang]);

  // Language switch — resets chat and dashboard
  const handleLangChange = (l: Lang) => {
    if (l === lang) return;
    setLang(l);
    setMessages([{ role: 'system', content: WELCOME[l] }]);
    setDashboardData({ pollingLocation: AWAITING, deadlines: AWAITING, idRequirements: AWAITING });
    setTimeline([]);
    setStateName('');
  };

  const handleHomeClick = () => {
    setMessages([{ role: 'system', content: WELCOME[lang] }]);
    setDashboardData({ pollingLocation: AWAITING, deadlines: AWAITING, idRequirements: AWAITING });
    setTimeline([]);
    setStateName('');
    setInputValue('');
  };

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
        body: JSON.stringify({ messages: currentMessages, language: lang })
      });

      // Safely parse JSON — if server returns an HTML error page this won't crash
      let data: any;
      try {
        data = await response.json();
      } catch (parseErr) {
        console.error("Failed to parse server response:", parseErr);
        setMessages(prev => [...prev, { role: 'system', content: "I'm having trouble connecting right now. Please try again in a moment." }]);
        setIsLoading(false);
        return;
      }

      // Server returned a structured error (e.g. Gemini quota, model error, missing key)
      if (data.error) {
        console.error("API error response:", data.error);
        setMessages(prev => [...prev, { role: 'system', content: data.error }]);
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
              idRequirements: parsed.idRequirements || 'No data found.',
            });
            if (Array.isArray(parsed.timeline)) setTimeline(parsed.timeline);
            if (parsed.stateName) {
              setStateName(parsed.stateName);
              setMobileTab('dashboard'); // Auto-switch to details tab on mobile
            }
          }
        } catch (e) {
          console.error("Failed to parse JSON from AI response", e);
        }
        // Remove the JSON block from the text shown to the user
        aiText = aiText.replace(jsonRegex, '').trim();
      }

      setMessages(prev => [...prev, { role: 'system', content: aiText }]);
      
    } catch (error: any) {
      // Network-level failure — log details, show friendly message
      console.error("Chat fetch error:", error?.message || error);
      setMessages(prev => [...prev, { role: 'system', content: "I'm having trouble connecting right now. Please try again in a moment." }]);
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
      // Strip javascript: protocol to prevent XSS if AI hallucinates a malicious URL
      const safeHref = /^javascript:/i.test(href) ? '#' : href;
      const displayText = match[0].replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
      result.push(
        <a key={match.index} href={safeHref} target="_blank" rel="noopener noreferrer" className={linkClass}>
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


  const isDataLoaded = dashboardData.pollingLocation !== AWAITING;
  const checkedCount = checklist.filter(Boolean).length;
  const fmtDate = (d: string) => {
    if (!d) return "To be announced";
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const isPast = (d: string) => {
    if (!d) return false;
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return false;
    return parsed < new Date();
  };

  return (
    <main id="app-root" className="flex flex-col h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Print-only header */}
      <div id="print-only" className="p-6 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800">Civic Election Assistant — Voter Summary</h2>
        <p className="text-sm text-slate-500 mt-1">Printed on {new Date().toLocaleDateString('en-IN')}{stateName ? ` · Location: ${stateName}` : ''}</p>
      </div>

      {/* Top Banner with Language Switcher */}
      <div id="top-banner" className="bg-slate-900 text-slate-100 text-xs py-2 px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <Flag className="w-4 h-4 text-slate-300 hidden sm:block" />
          <span className="opacity-80 sm:opacity-100">An election information guide for voters</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-center">
          <Globe className="w-3.5 h-3.5 text-slate-400 mr-1 hidden sm:block" />
          {(['English', 'Hindi', 'Tamil', 'Telugu'] as Lang[]).map(l => (
            <button key={l} onClick={() => handleLangChange(l)}
              aria-label={`Switch language to ${l}`}
              aria-pressed={lang === l}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${lang === l ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}>
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Header */}
      <header id="main-header" className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-white p-2 rounded-md shrink-0"><Vote className="w-6 h-6" /></div>
          <div>
            <h1 className="font-bold text-lg md:text-xl text-primary leading-tight">Civic Election Assistant</h1>
            <p className="text-xs md:text-sm text-slate-500">Your Election Information Guide</p>
          </div>
        </div>
        <button onClick={() => window.print()} disabled={!isDataLoaded}
          className="flex items-center justify-center w-full sm:w-auto gap-2 px-4 py-2 rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Printer className="w-4 h-4" />Print Summary
        </button>
      </header>

      {/* Breadcrumbs */}
      <div id="breadcrumbs" className="px-6 md:px-8 py-4 text-sm flex items-center gap-2">
        <button 
          onClick={handleHomeClick} 
          disabled={!stateName}
          className={`transition-colors focus:outline-none ${!stateName ? 'text-slate-800 font-semibold cursor-default' : 'text-slate-500 hover:text-primary cursor-pointer hover:underline'}`}
        >
          Home
        </button>
        {stateName && (
          <>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <div className="flex items-center gap-1.5 text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-md">
              <MapPin className="w-3.5 h-3.5" />
              {stateName} Profile
            </div>
          </>
        )}
      </div>

      {/* Mobile Tab Toggle */}
      <div className="md:hidden flex border-b border-slate-200 bg-white no-print">
         <button 
           onClick={() => setMobileTab('chat')} 
           className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${mobileTab === 'chat' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-slate-500 hover:text-slate-700'}`}>
           <MessageSquare className="w-4 h-4" /> Assistant
         </button>
         <button 
           onClick={() => setMobileTab('dashboard')} 
           className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${mobileTab === 'dashboard' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-slate-500 hover:text-slate-700'}`}>
           <Info className="w-4 h-4" /> Details
         </button>
      </div>

      {/* Two Column Layout */}
      <div id="two-col" className="flex-1 max-w-[1400px] w-full mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-4 md:gap-8 overflow-hidden">

        {/* LEFT MAIN AREA: Dashboard (70%) */}
        <section id="dashboard-section" className={`w-full md:flex-[7] h-full space-y-6 overflow-y-auto pr-1 md:pr-2 ${mobileTab === 'dashboard' ? 'block' : 'hidden md:block'}`}>
          <div className="border-b border-slate-200 pb-4 no-print">
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


          {/* Election Timeline */}
          <div id="timeline-section" className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-600" />
              <h3 className="font-semibold text-slate-800">Election Timeline</h3>
            </div>
            {timeline.length === 0 ? (
              <div className="p-6 text-sm text-slate-400 italic text-center py-10">Awaiting your location to load election dates...</div>
            ) : (
              <div className="p-6">
                <ol className="relative border-l-2 border-slate-200 space-y-6 ml-3">
                  {timeline.map((item, i) => {
                    const past = isPast(item.date);
                    return (
                      <li key={i} className="ml-6">
                        <span className={`absolute -left-[11px] flex items-center justify-center w-5 h-5 rounded-full ring-4 ring-white ${past ? 'bg-emerald-500' : 'bg-primary'}`}>
                          <span className="w-2 h-2 rounded-full bg-white" />
                        </span>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${past ? 'text-emerald-600' : 'text-primary'}`}>{fmtDate(item.date)}</p>
                        <p className="text-sm font-medium text-slate-800">{item.event}</p>
                        {past && <span className="text-xs text-emerald-600 font-medium">✓ Completed</span>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>

          {/* Google Maps Placeholder */}
          <div id="map-section" className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-slate-600" />
              <h3 className="font-semibold text-slate-800">Polling Area Map</h3>
            </div>
            {stateName ? (
              <iframe
                title="Polling Area Map"
                width="100%"
                height="280"
                className="border-0"
                src={`/api/maps-embed?q=${encodeURIComponent(stateName)}`}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center gap-3">
                <div className="bg-slate-100 rounded-full p-4"><MapPin className="w-8 h-8 text-slate-400" /></div>
                <p className="text-sm text-slate-400">Enter your location in the chat to activate the map</p>
              </div>
            )}
          </div>

          {/* Voter Readiness Checklist */}
          <div id="checklist-section" className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2"><Info className="w-5 h-5 text-slate-600" /><h3 className="font-semibold text-slate-800">Am I Ready to Vote?</h3></div>
              <span className="text-xs font-semibold text-slate-500">{checkedCount} / {CHECKLIST[lang].length} completed</span>
            </div>
            <div className="h-1.5 bg-slate-100"><div className="h-full bg-primary transition-all duration-500 rounded-r-full" style={{ width: `${(checkedCount / CHECKLIST[lang].length) * 100}%` }} /></div>
            <div className="p-6 space-y-2">
              {checkedCount === CHECKLIST[lang].length && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 text-sm font-medium text-center mb-3">
                  🎉 You&apos;re ready to vote!
                </div>
              )}
              {CHECKLIST[lang].map((item, i) => (
                <button key={i} onClick={() => setChecklist(prev => { const n = [...prev]; n[i] = !n[i]; return n; })}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left group">
                  {checklist[i]
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    : <Circle className="w-5 h-5 text-slate-300 flex-shrink-0 group-hover:text-slate-400" />}
                  <span className={`text-sm transition-colors ${checklist[i] ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item}</span>
                </button>
              ))}
            </div>
          </div>


        </section>

        {/* RIGHT SIDEBAR: Chat Interface (30%) */}
        <aside id="chat-aside" className={`w-full md:flex-[3] md:min-w-[320px] md:max-w-[400px] bg-white border border-slate-200 rounded-md shadow-sm flex-col overflow-hidden h-full ${mobileTab === 'chat' ? 'flex' : 'hidden md:flex'}`}>
          <header className="p-4 border-b border-slate-200 bg-slate-50 hidden md:flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
               <Landmark className="w-5 h-5 text-primary" />
               Civic Assistant
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
            {isLoading && <LoadingIndicator />}
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
                placeholder="Type your state or city..." 
                disabled={isLoading}
                className="w-full pl-3 pr-10 py-2 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-slate-800 bg-white disabled:opacity-50"
              />
              <button 
                type="submit" 
                aria-label="Send message"
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
