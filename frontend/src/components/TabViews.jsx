import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  BarChart3,
  TrendingUp,
  FileSpreadsheet,
  ShieldCheck,
  BrainCircuit,
  Settings,
  Search,
  Filter,
  Download,
  CheckCircle,
  AlertTriangle,
  Lock,
  Sparkles,
  RefreshCw,
  Users,
  Eye,
  Loader2,
  WifiOff,
  BadgeCheck,
  ShieldX,
  Clock,
  Plus,
  X
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const API = 'http://localhost:8000';

function riskBadge(tier) {
  const t = (tier || '').toLowerCase();
  if (t.includes('low'))    return 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40';
  if (t.includes('medium')) return 'bg-amber-950/70 text-amber-300 border-amber-500/40';
  if (t.includes('high'))   return 'bg-rose-950/70 text-rose-300 border-rose-500/40';
  if (t.includes('anom'))   return 'bg-purple-950/70 text-purple-300 border-purple-500/40';
  return 'bg-slate-800 text-slate-300 border-slate-700';
}

function statusBadge(app) {
  if (app.human_decision === 'APPROVED') return { label: 'Approved',              cls: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40' };
  if (app.human_decision === 'REJECTED') return { label: 'Rejected',              cls: 'bg-rose-950/70 text-rose-300 border-rose-500/40' };
  return                                          { label: 'Pending Human Review', cls: 'bg-amber-950/70 text-amber-300 border-amber-500/40' };
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(8)].map((_, i) => (
        <td key={i} className="py-3 px-4">
          <div className="h-3 bg-slate-800 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export function ApplicationsView({ onSelectApp, refetchTrigger, onNavigateToAssessment, onApplicantAdded }) {
  const [apps, setApps]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [offline, setOffline]   = useState(false);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [newApplicant, setNewApplicant] = useState({
    applicant_name: '',
    loan_type: 'Home Loan',
    amount: '',
    salary: '',
    existingEmis: '',
    savings: ''
  });
  const debounceRef             = useRef(null);

  const fetchApps = async (q = '', statusFilter = 'All') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q)                           params.set('search', q);
      if (statusFilter !== 'All') {
        const mapped = statusFilter === 'Approved' ? 'APPROVED'
          : statusFilter === 'Rejected' ? 'REJECTED'
          : statusFilter === 'Pending' ? 'PENDING' : '';
        if (mapped) params.set('status', mapped);
      }
      const res = await fetch(`${API}/api/v1/applications?${params}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setApps(data.applications || []);
      setOffline(false);
    } catch {
      setOffline(true);
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApps(search, filter); }, [refetchTrigger]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchApps(val, filter), 300);
  };

  const handleFilter = (val) => {
    setFilter(val);
    fetchApps(search, val);
  };

  const handleAddApplicant = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setAddError('');
    try {
      const salary = parseFloat(newApplicant.salary) || 1;
      const amount = parseFloat(newApplicant.amount) || 0;
      const existing = parseFloat(newApplicant.existingEmis) || 0;
      const savings = parseFloat(newApplicant.savings) || 0;

      const approxEmi = Math.round((amount * (0.085 / 12)) / (1 - Math.pow(1 + 0.085 / 12, -48)));
      const dti = parseFloat((((existing + approxEmi) / salary) * 100).toFixed(1));
      const healthScore = Math.max(20, Math.min(98, Math.round(100 - dti * 0.85 + (savings > 500000 ? 10 : 0))));
      const riskTier = dti < 35 ? 'Low Risk' : dti < 50 ? 'Medium Risk' : 'High Risk';

      const payload = {
        applicant_name: newApplicant.applicant_name.trim(),
        loan_type: newApplicant.loan_type,
        amount: amount,
        salary: salary,
        dti: dti,
        health_score: healthScore,
        risk_tier: riskTier,
        positive_signals: savings > 500000 ? ['Strong liquid savings buffer', 'Active income stream'] : ['Income stream verified'],
        risk_factors: dti > 45 ? [{ category: 'DTI Exposure', severity: 'WARNING', message: `Post-loan DTI reaches ${dti}%` }] : [],
        documents: []
      };

      const res = await fetch(`${API}/api/v1/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to create applicant in MongoDB');
      }

      setNewApplicant({
        applicant_name: '',
        loan_type: 'Home Loan',
        amount: '',
        salary: '',
        existingEmis: '',
        savings: ''
      });
      setShowAddModal(false);

      await fetchApps(search, filter);
      if (onApplicantAdded) onApplicantAdded();
    } catch (err) {
      setAddError(err.message || 'Error submitting applicant');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-[#0d1527] p-6 rounded-xl border border-cyan-900/30 shadow-lg shadow-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Active Applications Queue</h1>
          <p className="text-xs text-slate-400 mt-1">
            {offline
              ? '⚠ Backend disconnected — showing live MongoDB status.'
              : `${apps.length} applicant(s) loaded from MongoDB`
            }
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {offline && <WifiOff className="w-4 h-4 text-amber-400" />}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 px-3.5 py-2 rounded-lg transition-all shadow-md shadow-cyan-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Applicant</span>
          </button>
          <button
            onClick={() => fetchApps(search, filter)}
            className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 bg-[#070b14] hover:bg-slate-800 border border-cyan-900/40 px-3 py-2 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 bg-[#070b14] hover:bg-slate-800 border border-cyan-900/40 px-3 py-2 rounded-lg">
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="bg-[#0d1527] rounded-xl border border-cyan-900/30 shadow-md overflow-hidden">
        <div className="p-4 border-b border-cyan-900/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#090e1a]/60">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID, or loan type..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-full bg-[#070b14] border border-cyan-900/40 text-xs rounded-lg pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
            />
          </div>
          <div className="flex items-center space-x-1 bg-[#070b14] border border-cyan-900/40 rounded-lg p-1">
            {['All', 'Low Risk', 'Medium Risk', 'High Risk', 'Anomalies', 'Pending', 'Approved', 'Rejected'].map(lvl => (
              <button
                key={lvl}
                onClick={() => handleFilter(lvl)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  filter === lvl ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#090e1a] text-slate-400 font-semibold border-b border-cyan-900/20">
              <tr>
                <th className="py-3 px-4">Application ID</th>
                <th className="py-3 px-4">Applicant</th>
                <th className="py-3 px-4">Loan Type</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">DTI</th>
                <th className="py-3 px-4">FHS</th>
                <th className="py-3 px-4">Risk Tier</th>
                <th className="py-3 px-4">Decision Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading
                ? [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
                : apps.length === 0
                ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                          <Users className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold text-white">
                            No applicants found
                          </h3>
                          <p className="text-xs text-slate-400 max-w-sm">
                            There are currently 0 active applications in the database. Add your first applicant to get started.
                          </p>
                        </div>
                        <button
                          onClick={() => setShowAddModal(true)}
                          className="mt-2 inline-flex items-center space-x-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add New Applicant</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
                : apps.map(item => {
                  const sb = statusBadge(item);
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{item.id}</td>
                      <td className="py-3 px-4 font-semibold text-slate-100">{item.applicant_name}</td>
                      <td className="py-3 px-4 text-slate-300">{item.loan_type}</td>
                      <td className="py-3 px-4 font-bold text-white">{item.amount_display || `₹${(item.amount||0).toLocaleString('en-IN')}`}</td>
                      <td className="py-3 px-4 text-slate-300">{item.dti}%</td>
                      <td className="py-3 px-4">
                        <span className={`font-bold ${item.health_score >= 75 ? 'text-emerald-400' : item.health_score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {item.health_score}/100
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${riskBadge(item.risk_tier)}`}>
                          {item.risk_tier}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`flex items-center space-x-1 w-fit px-2 py-0.5 text-[10px] font-bold rounded-full border ${sb.cls}`}>
                          {item.human_decision === 'APPROVED' && <BadgeCheck className="w-3 h-3" />}
                          {item.human_decision === 'REJECTED' && <ShieldX className="w-3 h-3" />}
                          {!item.human_decision && <Clock className="w-3 h-3" />}
                          <span>{sb.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onSelectApp && onSelectApp(item)}
                          className="flex items-center space-x-1 ml-auto text-cyan-400 font-semibold hover:text-cyan-300 hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#0d1527] rounded-2xl border border-cyan-900/40 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add New Applicant</h3>
                  <p className="text-[11px] text-slate-400">Creates a fresh MongoDB document with guaranteed unique ID</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddApplicant} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Applicant Full Name *</label>
                <input
                  type="text"
                  required
                  value={newApplicant.applicant_name}
                  onChange={e => setNewApplicant({...newApplicant, applicant_name: e.target.value})}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full bg-[#070b14] border border-cyan-900/40 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Loan Category *</label>
                  <select
                    value={newApplicant.loan_type}
                    onChange={e => setNewApplicant({...newApplicant, loan_type: e.target.value})}
                    className="w-full bg-[#070b14] border border-cyan-900/40 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 font-medium"
                  >
                    <option value="Home Loan" className="bg-[#070b14]">Home Loan</option>
                    <option value="Personal Loan" className="bg-[#070b14]">Personal Loan</option>
                    <option value="Vehicle Loan" className="bg-[#070b14]">Vehicle Loan</option>
                    <option value="Business Loan" className="bg-[#070b14]">Business Loan</option>
                    <option value="Education Loan" className="bg-[#070b14]">Education Loan</option>
                    <option value="Agricultural Loan" className="bg-[#070b14]">Agricultural Loan</option>
                    <option value="Gold Loan" className="bg-[#070b14]">Gold Loan</option>
                    <option value="Loan Against Property" className="bg-[#070b14]">Loan Against Property</option>
                    <option value="Consumer Loan" className="bg-[#070b14]">Consumer Loan</option>
                    <option value="Equipment & Machinery Loan" className="bg-[#070b14]">Equipment & Machinery</option>
                    <option value="Loan Against Securities" className="bg-[#070b14]">Loan Against Securities</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Loan Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="10000"
                    value={newApplicant.amount}
                    onChange={e => setNewApplicant({...newApplicant, amount: e.target.value})}
                    placeholder="e.g. 2500000"
                    className="w-full bg-[#070b14] border border-cyan-900/40 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Monthly Salary (₹) *</label>
                  <input
                    type="number"
                    required
                    min="5000"
                    value={newApplicant.salary}
                    onChange={e => setNewApplicant({...newApplicant, salary: e.target.value})}
                    placeholder="e.g. 120000"
                    className="w-full bg-[#070b14] border border-cyan-900/40 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Existing Monthly EMIs (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={newApplicant.existingEmis}
                    onChange={e => setNewApplicant({...newApplicant, existingEmis: e.target.value})}
                    placeholder="e.g. 15000"
                    className="w-full bg-[#070b14] border border-cyan-900/40 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Liquid Savings (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={newApplicant.savings}
                  onChange={e => setNewApplicant({...newApplicant, savings: e.target.value})}
                  placeholder="e.g. 400000"
                  className="w-full bg-[#070b14] border border-cyan-900/40 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 font-medium"
                />
              </div>

              {addError && (
                <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800 p-2.5 rounded-lg font-semibold">
                  {addError}
                </p>
              )}

              <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center space-x-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-md shadow-cyan-600/20"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>{submitting ? 'Creating in MongoDB...' : 'Save Applicant'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function AnalyticsView() {
  const analyticsData = [
    { tier: 'Tier 1 (750+ Score)', count: 4800, defaultRate: '0.4%' },
    { tier: 'Tier 2 (650-749)', count: 3100, defaultRate: '1.8%' },
    { tier: 'Tier 3 (550-649)', count: 1600, defaultRate: '5.2%' },
    { tier: 'Tier 4 (<550)', count: 740, defaultRate: '14.1%' }
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-[#0d1527] p-6 rounded-xl border border-cyan-900/30 shadow-lg shadow-black/20">
        <h1 className="text-2xl font-bold text-white tracking-tight">Portfolio Risk Analytics</h1>
        <p className="text-xs text-slate-400 mt-1">Deep-dive risk tier segmentation, expected credit loss (ECL), and default metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0d1527] p-5 rounded-xl border border-cyan-900/30 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-white">Default Probability by Credit Tier</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="tier" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#f8fafc' }} />
                <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0d1527] p-5 rounded-xl border border-cyan-900/30 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-white">Expected Loss & Capital Provisioning</h3>
          <div className="space-y-3 text-xs">
            {analyticsData.map((d, i) => (
              <div key={i} className="p-3 bg-[#070b14] rounded-lg border border-cyan-900/30 flex items-center justify-between">
                <span className="font-semibold text-slate-200">{d.tier}</span>
                <span className="text-slate-400">{d.count} Loans</span>
                <span className="font-bold text-rose-400">Default Rate: {d.defaultRate}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ForecastsView() {
  const forecastTrend = [
    { month: 'Oct', baseline: 1.2, stressHigh: 2.1 },
    { month: 'Nov', baseline: 1.3, stressHigh: 2.4 },
    { month: 'Dec', baseline: 1.1, stressHigh: 2.8 },
    { month: 'Jan', baseline: 1.4, stressHigh: 3.1 },
    { month: 'Feb', baseline: 1.2, stressHigh: 2.9 }
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-[#0d1527] p-6 rounded-xl border border-cyan-900/30 shadow-lg shadow-black/20">
        <h1 className="text-2xl font-bold text-white tracking-tight">Macroeconomic Forecasts</h1>
        <p className="text-xs text-slate-400 mt-1">Simulated portfolio performance under inflation and rate hike projections.</p>
      </div>

      <div className="bg-[#0d1527] p-5 rounded-xl border border-cyan-900/30 shadow-md space-y-4">
        <h3 className="text-sm font-bold text-white">6-Month Projected Default Rate (%)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecastTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#f8fafc' }} />
              <Line type="monotone" dataKey="baseline" stroke="#10b981" strokeWidth={2} name="Baseline Scenario" />
              <Line type="monotone" dataKey="stressHigh" stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 4" name="+200bps Rate Hike" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function ReportsView() {
  return (
    <div className="space-y-6 pb-12">
      <div className="bg-[#0d1527] p-6 rounded-xl border border-cyan-900/30 shadow-lg shadow-black/20">
        <h1 className="text-2xl font-bold text-white tracking-tight">Compliance & Executive Reports</h1>
        <p className="text-xs text-slate-400 mt-1">Generate quarterly credit risk assessments, fair lending audits, and regulatory certifications.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Q3 2026 Fair Lending Audit Pack', desc: 'Demographic bias evaluation & model disparate impact ratio report.' },
          { title: 'Portfolio Capital Adequacy Report', desc: 'Expected Loss & Basel III capital buffer breakdown.' },
          { title: 'Fraud & Anomaly Digest', desc: 'Summary of bank statement tampering & OCR mismatch incidents.' }
        ].map((r, i) => (
          <div key={i} className="bg-[#0d1527] p-5 rounded-xl border border-cyan-900/30 shadow-md space-y-3">
            <FileSpreadsheet className="w-6 h-6 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">{r.title}</h3>
            <p className="text-xs text-slate-400">{r.desc}</p>
            <button className="text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline flex items-center space-x-1 pt-2">
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SecurityView() {
  return (
    <div className="space-y-6 pb-12">
      <div className="bg-[#0d1527] p-6 rounded-xl border border-cyan-900/30 shadow-lg shadow-black/20">
        <h1 className="text-2xl font-bold text-white tracking-tight">Security Posture & RBAC</h1>
        <p className="text-xs text-slate-400 mt-1">Encryption parameters, access controls, and SOC2 compliance monitoring.</p>
      </div>

      <div className="bg-[#0d1527] p-6 rounded-xl border border-cyan-900/30 shadow-md space-y-4">
        <div className="flex items-center space-x-3 text-teal-400 font-bold text-sm">
          <ShieldCheck className="w-5 h-5" />
          <span>All Security Safeguards Operational</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-[#070b14] rounded-lg border border-cyan-900/30">
            <span className="font-bold text-white block">Data at Rest</span>
            <span className="text-slate-400">AES-256 Bit Encryption</span>
          </div>
          <div className="p-4 bg-[#070b14] rounded-lg border border-cyan-900/30">
            <span className="font-bold text-white block">Data in Transit</span>
            <span className="text-slate-400">TLS 1.3 Strict Enforced</span>
          </div>
          <div className="p-4 bg-[#070b14] rounded-lg border border-cyan-900/30">
            <span className="font-bold text-white block">Active Sessions</span>
            <span className="text-slate-400">12 Underwriters Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResponsibleAIView() {
  return (
    <div className="space-y-6 pb-12">
      <div className="bg-[#0d1527] p-6 rounded-xl border border-cyan-900/30 shadow-lg shadow-black/20">
        <h1 className="text-2xl font-bold text-white tracking-tight">Responsible AI & Governance</h1>
        <p className="text-xs text-slate-400 mt-1">SHAP explainability rankings, model fairness metrics, and algorithmic transparency.</p>
      </div>

      <div className="bg-[#0d1527] p-6 rounded-xl border border-cyan-900/30 shadow-md space-y-4">
        <h3 className="text-sm font-bold text-white">Model Feature Importance Weights (SHAP)</h3>
        <div className="space-y-2 text-xs">
          {[
            { feature: 'Debt-to-Income (DTI) Ratio', weight: '34.5%' },
            { feature: 'Verified Monthly Net Income', weight: '26.8%' },
            { feature: 'Liquid Savings / Reserves', weight: '18.2%' },
            { feature: 'Cheque Bounce / Anomaly Score', weight: '12.1%' },
            { feature: 'Employment Stability Index', weight: '8.4%' }
          ].map((f, idx) => (
            <div key={idx} className="flex items-center justify-between p-2.5 bg-[#070b14] rounded-lg border border-cyan-900/30">
              <span className="font-semibold text-slate-200">{f.feature}</span>
              <span className="font-bold text-cyan-400">{f.weight}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SettingsView() {
  const [maxDti, setMaxDti] = useState(45);
  const [minScore, setMinScore] = useState(70);

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-[#0d1527] p-6 rounded-xl border border-cyan-900/30 shadow-lg shadow-black/20">
        <h1 className="text-2xl font-bold text-white tracking-tight">Credit Lens Policy & Threshold Settings</h1>
        <p className="text-xs text-slate-400 mt-1">Configure automated underwriting score cutoffs and risk alert rules.</p>
      </div>

      <div className="bg-[#0d1527] p-6 rounded-xl border border-cyan-900/30 shadow-md space-y-6 max-w-2xl">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">Auto-Approval Maximum DTI Ceiling (%)</label>
          <input
            type="number"
            value={maxDti}
            onChange={(e) => setMaxDti(e.target.value)}
            className="w-full bg-[#070b14] border border-cyan-900/40 text-white rounded-lg p-2.5 text-xs font-bold focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">Auto-Approval Minimum Credit Health Score</label>
          <input
            type="number"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            className="w-full bg-[#070b14] border border-cyan-900/40 text-white rounded-lg p-2.5 text-xs font-bold focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
          />
        </div>

        <button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-md shadow-cyan-600/20">
          Save Risk Policy
        </button>
      </div>
    </div>
  );
}
