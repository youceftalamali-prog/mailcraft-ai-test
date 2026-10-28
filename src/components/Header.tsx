import React from 'react';
import { Film, Mail, Mic, MessageSquare, Sparkles, Wand2 } from 'lucide-react';

interface HeaderProps {
  activeTab: 'campaign' | 'algerian_outros' | 'chat' | 'video';
  setActiveTab: (tab: 'campaign' | 'algerian_outros' | 'chat' | 'video') => void;
  onOpenSample: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onOpenSample }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20 shrink-0">
            <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                CampaignForge
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                AI Pro
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden md:block">
              Email Campaigns • 1K/2K/4K Visuals • استوديو الأصوات الجزائرية
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center p-0.5 sm:p-1 bg-slate-900/90 border border-slate-800 rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('campaign')}
            aria-label="Campaign Generator tab"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'campaign'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Campaigns</span>
          </button>

          <button
            onClick={() => setActiveTab('algerian_outros')}
            aria-label="Algerian Outros and Voice Studio tab"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 relative ${
              activeTab === 'algerian_outros'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span>أصوات جزائرية</span>
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('video')}
            aria-label="Video Studio tab"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'video'
                ? 'bg-pink-600 text-white shadow-sm shadow-pink-600/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>الفيديو</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            aria-label="Gemini AI Chatbot tab"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 ${
              activeTab === 'chat'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Copilot</span>
          </button>
        </nav>

        {/* Quick Demo Preset Button */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={onOpenSample}
            aria-label="Load Instant Demo Preset"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/90 text-slate-300 border border-slate-700/80 hover:bg-slate-700/80 hover:text-white transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Load Demo Campaign</span>
          </button>
        </div>
      </div>
    </header>
  );
};
