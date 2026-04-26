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
    { role: 'system', content: 'Welcome. I can help you find your election information. What state do you currently reside in?' }
  ]);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    pollingLocation: 'Awaiting state input.',
    deadlines: 'Awaiting state input.',
    idRequirements: 'Awaiting state input.'
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
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

      const data = await response.json();
      
      if (data.error) {
        setMessages(prev => [...prev, { role: 'system', content: `Error: ${data.error}` }]);
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
      
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'system', content: 'An unexpected error occurred while communicating with the assistant.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Official Government Banner */}
      <div className="bg-slate-900 text-slate-100 text-xs py-2 px-6 flex items-center gap-2">
        <Flag className="w-4 h-4 text-slate-300" />
        <span>An official election assistant website</span>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-white p-2 rounded-md">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl text-primary leading-tight">Civic Assistant</h1>
            <p className="text-sm text-slate-500">Official Election Guide</p>
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      <div className="px-6 md:px-8 py-4 text-sm text-slate-500 flex items-center gap-2">
        <span className="hover:underline cursor-pointer text-primary">Home</span>
        <ChevronRight className="w-4 h-4" />
        <span className="hover:underline cursor-pointer text-primary">Voter Information</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-700 font-medium">Your State Profile</span>
      </div>

      {/* Two Column Layout */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-8">
        
        {/* LEFT MAIN AREA: Dashboard (70%) */}
        <section className="flex-[7] space-y-8">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-3xl font-bold text-slate-800">Your Election Dashboard</h2>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Follow the instructions in the assistant to retrieve your specific polling locations, deadlines, and voter ID requirements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white border-t-4 border-t-primary border-x border-b border-slate-200 shadow-sm p-6 rounded-b-md relative flex flex-col">
              <div className="flex items-start gap-4 mb-2">
                <MapPin className="w-6 h-6 text-primary flex-shrink-0" />
                <h3 className="font-semibold text-slate-800">Polling Location</h3>
              </div>
              <p className="text-sm text-slate-600 mt-1 flex-1">{dashboardData.pollingLocation}</p>
            </div>

            <div className="bg-white border-t-4 border-t-primary border-x border-b border-slate-200 shadow-sm p-6 rounded-b-md relative flex flex-col">
              <div className="flex items-start gap-4 mb-2">
                <Calendar className="w-6 h-6 text-primary flex-shrink-0" />
                <h3 className="font-semibold text-slate-800">Key Deadlines</h3>
              </div>
              <p className="text-sm text-slate-600 mt-1 flex-1">{dashboardData.deadlines}</p>
            </div>

            <div className="bg-white border-t-4 border-t-primary border-x border-b border-slate-200 shadow-sm p-6 rounded-b-md relative flex flex-col">
              <div className="flex items-start gap-4 mb-2">
                <FileText className="w-6 h-6 text-primary flex-shrink-0" />
                <h3 className="font-semibold text-slate-800">ID Requirements</h3>
              </div>
              <p className="text-sm text-slate-600 mt-1 flex-1">{dashboardData.idRequirements}</p>
            </div>
          </div>

          {/* Structured Information Table Area */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-md overflow-hidden mt-8">
            <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
               <Info className="w-5 h-5 text-slate-600" />
               <h3 className="font-semibold text-slate-800">Status Overview</h3>
            </div>
            <div className="p-6 text-sm text-slate-600 flex flex-col items-center justify-center py-12">
               {dashboardData.pollingLocation === 'Awaiting state input.' ? (
                 <p>Please use the assistant on the right to load your voting information.</p>
               ) : (
                 <p className="text-center text-primary font-medium">Your state profile has been loaded. Check the cards above for your customized information.</p>
               )}
            </div>
          </div>

        </section>

        {/* RIGHT SIDEBAR: Chat Interface (30%) */}
        <aside className="flex-[3] w-full min-w-[320px] max-w-[400px] bg-white border border-slate-200 rounded-md shadow-sm flex flex-col overflow-hidden h-[600px] sticky top-8">
          <header className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
               <Bot className="w-5 h-5 text-primary" />
               Support Assistant
            </h2>
          </header>

          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
            {messages.map((msg, idx) => (
              <div key={idx} className={msg.role === 'system' ? "bg-slate-50 p-4 rounded-md border border-slate-200 text-sm" : "bg-primary text-white p-4 rounded-md text-sm ml-8"}>
                {msg.role === 'system' && <p className="font-semibold text-slate-800 mb-1">System</p>}
                <p className={msg.role === 'system' ? "text-slate-600" : "text-white"}>{msg.content}</p>
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
                placeholder="Enter your state..." 
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
