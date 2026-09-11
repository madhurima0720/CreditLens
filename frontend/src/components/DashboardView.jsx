import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertOctagon,
  Search,
  ArrowUpRight,
  Plus,
  Calendar,
  ChevronDown,
  Eye,
  Download,
  Filter
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const API = 'http://localhost:8000';

export default function DashboardView({ onNavigateToAssessment, onSelectApplication, currentUser, refetchTrigger }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [timeframe, setTimeframe] = useState('This Month');
  const [liveApps, setLiveApps] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/v1/applications`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setLiveApps(data.applications || []);
        setLoadingApps(false);
      })
      .catch(() => {
        setLiveApps([]);
        setLoadingApps(false);
      });
  }, [refetchTrigger]);

  const totalAppsCount = liveApps.length;
  const lowRiskCount   = liveApps.filter(a => (a.risk_tier || '').toLowerCase().includes('low')).length;
  const medRiskCount   = liveApps.filter(a => (a.risk_tier || '').toLowerCase().includes('med')).length;
  const highRiskCount  = liveApps.filter(a => (a.risk_tier || '').toLowerCase().includes('high')).length;
  const anomalyCount   = liveApps.filter(a => (a.risk_tier || '').toLowerCase().includes('anom') || (a.risk_tier || '').toLowerCase().includes('fraud')).length;

  const kpiData = [
    {
      title: 'Total Applications',
      value: String(totalAppsCount),
      change: totalAppsCount > 0 ? `${totalAppsCount} Active in DB` : 'Fresh Database',
      positive: true,
      icon: Users,
      color: 'bg-cyan-950/60 text-cyan-400 border-cyan-500/30',
      indicator: 'Total Intake Pipeline'
    },
    {
      title: 'Low Risk',
      value: String(lowRiskCount),
      change: totalAppsCount > 0 ? `${Math.round((lowRiskCount / (totalAppsCount || 1)) * 100)}% of Pipeline` : '0 Active',
      positive: true,
      icon: CheckCircle2,
      color: 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30',
      indicator: 'Auto-Approved Path'
    },
    {
      title: 'Medium Risk',
      value: String(medRiskCount),
      change: 'Underwriter Review',
      positive: false,
      icon: AlertTriangle,
      color: 'bg-amber-950/60 text-amber-400 border-amber-500/30',
      indicator: 'Underwriter Review'
    },
    {
      title: 'High Risk',
      value: String(highRiskCount),
      change: 'High Exposure',
      positive: false,
      icon: XCircle,
      color: 'bg-rose-950/60 text-rose-400 border-rose-500/30',
      indicator: 'High Risk'
    },
    {
      title: 'Anomalies',
      value: String(anomalyCount),
      change: 'Fraud Flags',
      positive: false,
      icon: AlertOctagon,
      color: 'bg-purple-950/60 text-purple-400 border-purple-500/30',
      indicator: 'AI Fraud Alert'
    }
  ];

  const trendData = [
    { date: 'Sep 04', total: 120, low: 80, med: 30, high: 10 },
    { date: 'Sep 05', total: 210, low: 140, med: 50, high: 20 },
    { date: 'Sep 06', total: 290, low: 190, med: 75, high: 25 },
    { date: 'Sep 07', total: 340, low: 220, med: 90, high: 30 },
    { date: 'Sep 08', total: 410, low: 260, med: 110, high: 40 },
    { date: 'Sep 09', total: 490, low: 310, med: 135, high: 45 },
    { date: 'Sep 10', total: 580, low: 370, med: 160, high: 50 }
  ];

  const pieData = [
    { name: 'Low Risk', value: lowRiskCount || 1, color: '#10b981' },
    { name: 'Medium Risk', value: medRiskCount || 1, color: '#f59e0b' },
    { name: 'High Risk', value: highRiskCount || 1, color: '#f43f5e' },
    { name: 'Anomalies', value: anomalyCount || 1, color: '#a855f7' }
  ];

  const recentApplications = liveApps.map((a) => ({
    id: a.id,
    applicant: a.applicant_name,
    documentId: `DOC-${(a.id || '').replace('APP-', '')}`,
    loanType: a.loan_type,
    salary: `₹${(a.salary || 0).toLocaleString('en-IN')} / mo`,
    loanAmount: a.amount_display || `₹${(a.amount || 0).toLocaleString('en-IN')}`,
    dti: `${a.dti}%`,
    score: a.health_score || 0,
    riskLevel: a.risk_tier || 'Low Risk',
    status: a.status_display || (a.human_decision === 'APPROVED' ? 'Approved' : a.human_decision === 'REJECTED' ? 'Rejected' : 'In Underwriting'),
    date: a.created_at ? new Date(a.created_at).toLocaleDateString('en-IN') : 'Just now',
    rawApp: a
  }));

  const filteredApps = recentApplications.filter((app) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      app.applicant.toLowerCase().includes(q) ||
      app.id.toLowerCase().includes(q) ||
      app.documentId.toLowerCase().includes(q) ||
      app.loanType.toLowerCase().includes(q) ||
      app.riskLevel.toLowerCase().includes(q);

    const matchesRisk = riskFilter === 'All' || app.riskLevel === riskFilter;
    return matchesSearch && matchesRisk;
  });

  const getBadgeStyle = (level) => {
    const l = (level || '').toLowerCase();
    if (l.includes('low')) return 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40';
    if (l.includes('med')) return 'bg-amber-950/70 text-amber-300 border-amber-500/40';
    if (l.includes('high')) return 'bg-rose-950/70 text-rose-300 border-rose-500/40';
    if (l.includes('anom') || l.includes('fraud')) return 'bg-purple-950/70 text-purple-300 border-purple-500/40';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d1527] p-6 rounded-2xl border border-cyan-900/30 shadow-lg shadow-black/20">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Executive Portfolio Dashboard</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-cyan-950/60 text-cyan-300 rounded-full border border-cyan-500/30">
              {currentUser?.institution || 'HDFC Bank Enterprise'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time portfolio metrics, AI health scoring breakdown, and institutional application intake.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-[#090e1a] border border-cyan-900/40 rounded-xl px-3 py-1.5 text-xs text-slate-350 font-medium">
            <Calendar className="w-3.5 h-3.5 mr-2 text-cyan-400" />
            <span>{timeframe}</span>
            <ChevronDown className="w-3.5 h-3.5 ml-2 text-slate-500" />
          </div>

          <button
            onClick={onNavigateToAssessment}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-md shadow-cyan-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Assessment</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiData.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <div
              key={index}
              className="bg-[#0d1527] border border-cyan-900/25 rounded-2xl p-4 shadow-md hover:border-cyan-500/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {item.title}
                  </span>
                  <div className={`p-2 rounded-xl border ${item.color}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-white tracking-tight">{item.value}</div>
                  <div className="text-[11px] font-medium text-slate-400 mt-0.5">{item.indicator}</div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">{item.change}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0d1527] p-5 rounded-2xl border border-cyan-900/30 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Application Velocity & Risk Split</h3>
              <p className="text-xs text-slate-400">Daily intake breakdown across risk classifications</p>
            </div>
            <div className="flex items-center space-x-4 text-xs font-medium text-slate-300">
              <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-1.5"></span>Low</span>
              <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 mr-1.5"></span>Medium</span>
              <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-rose-400 mr-1.5"></span>High</span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#f8fafc' }}
                />
                <Area type="monotone" dataKey="low" stroke="#10b981" fillOpacity={1} fill="url(#colorLow)" />
                <Area type="monotone" dataKey="med" stroke="#f59e0b" fillOpacity={1} fill="url(#colorMed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0d1527] p-5 rounded-2xl border border-cyan-900/30 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Portfolio Risk Distribution</h3>
            <p className="text-xs text-slate-400">{totalAppsCount} Total Active Assessment{totalAppsCount === 1 ? '' : 's'}</p>
          </div>
          <div className="h-48 w-full flex items-center justify-center my-2 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={78}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#f8fafc' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-extrabold text-white">62.7%</span>
              <span className="text-[10px] text-teal-400 font-semibold uppercase">Low Risk</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
            {pieData.map((item, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                <span className="text-slate-300 font-medium">{item.name}</span>
                <span className="text-white font-bold ml-auto">{((item.value / 10240) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#0d1527] rounded-2xl border border-cyan-900/30 shadow-md overflow-hidden">
        <div className="p-4 border-b border-cyan-900/20 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#090e1a]/60">
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Deep Search: Name, Loan Type, Document ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#070b14] border border-cyan-900/40 text-xs text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
              />
            </div>
            <div className="flex items-center space-x-1 bg-[#070b14] border border-cyan-900/40 rounded-xl p-1 w-full sm:w-auto">
              {['All', 'Low Risk', 'Medium Risk', 'High Risk', 'Anomalies'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setRiskFilter(lvl)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    riskFilter === lvl
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Download className="w-4 h-4 text-slate-400 cursor-pointer hover:text-cyan-300" />
            <span>Showing {filteredApps.length} entries</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#090e1a] text-slate-400 font-semibold border-b border-cyan-900/20">
                <th className="py-3 px-4">Application & Doc ID</th>
                <th className="py-3 px-4">Applicant</th>
                <th className="py-3 px-4">Loan Category</th>
                <th className="py-3 px-4">Requested Loan</th>
                <th className="py-3 px-4">DTI Ratio</th>
                <th className="py-3 px-4">Health Score</th>
                <th className="py-3 px-4">Risk Classification</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <p className="text-xs font-bold text-slate-300">No applicants found — Add New Applicant</p>
                      <button
                        onClick={onNavigateToAssessment}
                        className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-xs transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add New Applicant</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-white">{app.id}</div>
                    <div className="text-[10px] font-mono text-cyan-400">{app.documentId}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-100">{app.applicant}</div>
                    <div className="text-[10px] text-slate-400">{app.date}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-medium">{app.loanType}</td>
                  <td className="py-3 px-4 text-white font-bold">{app.loanAmount}</td>
                  <td className="py-3 px-4 font-semibold text-slate-300">{app.dti}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-white">{app.score}</span>
                      <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full ${
                            app.score >= 75
                              ? 'bg-emerald-400'
                              : app.score >= 50
                              ? 'bg-amber-400'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${app.score}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-full border ${getBadgeStyle(
                        app.riskLevel
                      )}`}
                    >
                      {app.riskLevel}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onSelectApplication && onSelectApplication(app)}
                      className="inline-flex items-center space-x-1 text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Evaluate</span>
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
