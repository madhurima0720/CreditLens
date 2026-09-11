import React from 'react';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  BarChart3,
  Sliders,
  TrendingUp,
  MessageSquareCode,
  FileSpreadsheet,
  History,
  ShieldCheck,
  BrainCircuit,
  Settings,
  ChevronRight,
  LogOut
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, currentUser, onLogout, applicantCount = 0 }) {
  const mainNavItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'applications', label: 'Applications Queue', icon: FileText, badge: String(applicantCount ?? 0) },
    { id: 'new-assessment', label: 'New Assessment', icon: PlusCircle, highlight: true },
    { id: 'risk-analytics', label: 'Risk Analytics', icon: BarChart3 },
    { id: 'simulator', label: 'Scenario Simulator', icon: Sliders },
    { id: 'forecasts', label: 'Forecasts', icon: TrendingUp },
  ];

  const aiGovernanceNavItems = [
    { id: 'copilot', label: 'Copilot Assistant', icon: MessageSquareCode, badge: 'AI' },
    { id: 'reports', label: 'Reports & Compliance', icon: FileSpreadsheet },
    { id: 'audit-trail', label: 'Audit Trail', icon: History, badge: '143 Flags' },
    { id: 'security', label: 'Security Center', icon: ShieldCheck, highlight: true },
    { id: 'responsible-ai', label: 'Responsible AI', icon: BrainCircuit },
    { id: 'settings', label: 'Policy Settings', icon: Settings },
  ];

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
          isActive
            ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-xs shadow-cyan-500/10'
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
        } ${item.highlight && !isActive ? 'text-cyan-400 font-semibold bg-cyan-950/30 hover:bg-cyan-950/50' : ''}`}
      >
        <div className="flex items-center space-x-3">
          <Icon
            className={`w-4 h-4 transition-colors ${
              isActive
                ? 'text-cyan-400'
                : item.highlight
                ? 'text-cyan-400'
                : 'text-slate-500 group-hover:text-slate-300'
            }`}
          />
          <span>{item.label}</span>
        </div>
        <div className="flex items-center space-x-1">
          {item.badge !== undefined && item.badge !== null && item.badge !== '' && (
            <span
              className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                item.badge === 'AI'
                  ? 'bg-teal-950/80 text-teal-300 border border-teal-500/40 shadow-xs'
                  : item.badge.includes('Flags')
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-850 text-slate-300 border border-slate-750'
              }`}
            >
              {item.badge}
            </span>
          )}
          {isActive && <ChevronRight className="w-3.5 h-3.5 text-cyan-400 ml-1" />}
        </div>
      </button>
    );
  };

  return (
    <aside className="w-64 bg-[#0a0f1d] border-r border-cyan-900/20 flex flex-col justify-between h-screen sticky top-0 shadow-xl select-none z-20">
      <div>
        <div className="p-5 border-b border-cyan-900/20 flex items-center justify-between bg-[#070b14]/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1">
                <span className="font-bold text-white text-lg tracking-tight">Credit</span>
                <span className="font-extrabold text-cyan-400 text-lg tracking-tight">Lens</span>
              </div>
              <p className="text-[10px] font-bold text-teal-400 tracking-wider uppercase">
                {currentUser?.roleTitle || 'Banks'} Portal
              </p>
            </div>
          </div>
        </div>

        <div className="px-3 py-4 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
          <div>
            <p className="px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Underwriting & Intake
            </p>
            <div className="space-y-1">{mainNavItems.map(renderNavItem)}</div>
          </div>

          <div>
            <p className="px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Security & Intelligence
            </p>
            <div className="space-y-1">{aiGovernanceNavItems.map(renderNavItem)}</div>
          </div>
        </div>
      </div>

      <div className="p-3.5 border-t border-cyan-900/20 bg-[#070b14]/60">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0f172a] border border-cyan-900/30 shadow-md">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                AR
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0f172a]"></span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-100 truncate">{currentUser?.name || 'Alex Reynolds'}</p>
              <p className="text-[10px] text-teal-400 truncate">{currentUser?.roleTitle || 'Banks'}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Institutional Logout"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
