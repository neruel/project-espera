import React from 'react';
import {
  MessageSquare,
  Brain,
  Sliders,
  Sparkles,
  Terminal,
  ShieldCheck,
  FolderKanban,
} from 'lucide-react';
import type { SessionState } from '../stores/session.js';

interface NavbarProps {
  currentTab: 'chat' | 'memory' | 'persona' | 'projects' | 'settings';
  onSelectTab: (tab: 'chat' | 'memory' | 'persona' | 'projects' | 'settings') => void;
  pendingCount: number;
  session: SessionState;
  onToggleInspector: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  pendingCount,
  session,
  onToggleInspector,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Brand & Project Title */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab('chat')}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white font-bold text-lg">
            E
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold tracking-tight text-white text-base sm:text-lg">Project Espera</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/50">
                Phase 1 MVP
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">지속형 개인 AI 시스템</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={() => onSelectTab('projects')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
              currentTab === 'projects' ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span className="hidden sm:inline">Projects</span>
          </button>

          <button
            onClick={() => onSelectTab('chat')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
              currentTab === 'chat'
                ? 'bg-slate-800 text-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Chat</span>
          </button>

          <button
            onClick={() => onSelectTab('memory')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium relative transition ${
              currentTab === 'memory'
                ? 'bg-slate-800 text-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Memory</span>
            {pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500 text-slate-950 animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('persona')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
              currentTab === 'persona'
                ? 'bg-slate-800 text-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Persona</span>
          </button>

          <button
            onClick={() => onSelectTab('settings')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
              currentTab === 'settings'
                ? 'bg-slate-800 text-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </nav>

        {/* Right Tools: Active Model Badge & Context Inspector */}
        <div className="flex items-center space-x-2">
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-400 uppercase font-mono">{session.providerId}:</span>
            <span className="font-medium text-slate-200">{session.modelId}</span>
          </div>

          <button
            onClick={onToggleInspector}
            title="개발자 컨텍스트 인스펙터 열기"
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
          >
            <Terminal className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline text-[11px]">Inspector</span>
          </button>
        </div>
      </div>
    </header>
  );
};
