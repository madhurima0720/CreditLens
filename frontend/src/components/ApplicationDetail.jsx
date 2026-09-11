import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, ShieldCheck, ShieldAlert, ShieldX,
  FileText, CheckCircle2, XCircle, AlertTriangle,
  User, TrendingUp, Wallet, Clock, BadgeCheck,
  Loader2, Send, ChevronDown, ChevronUp, Info,
  BarChart3, Sparkles, Lock
} from 'lucide-react';
import AIExtractedDetailsView from './AIExtractedDetailsView';

const API = 'http://localhost:8000';

function riskColor(tier) {
  if (!tier) return 'bg-slate-800 text-slate-300 border-slate-700';
  const t = tier.toLowerCase();
  if (t.includes('low'))    return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60';
  if (t.includes('medium')) return 'bg-amber-950/60 text-amber-300 border-amber-800/60';
  if (t.includes('high'))   return 'bg-rose-950/60 text-rose-300 border-rose-800/60';
  if (t.includes('anom'))   return 'bg-purple-950/60 text-purple-300 border-purple-800/60';
  return 'bg-slate-800 text-slate-300 border-slate-700';
}

function severityIcon(sev) {
  if (sev === 'CRITICAL') return <ShieldX className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
  if (sev === 'HIGH')     return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  return                         <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
}

function severityBadge(sev) {
  if (sev === 'CRITICAL') return 'bg-rose-950/60 text-rose-300 border-rose-800/60';
  if (sev === 'HIGH')     return 'bg-amber-950/60 text-amber-300 border-amber-800/60';
  return 'bg-blue-950/60 text-cyan-300 border-cyan-800/60';
}

function ScoreGauge({ score }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f43f5e';
  const strokeDash = `${(pct / 100) * 220} 220`;
  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg viewBox="0 0 80 80" className="w-28 h-28 -rotate-90">
        <circle cx="40" cy="40" r="35" fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="40" cy="40" r="35" fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={strokeDash} style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black text-slate-100">{pct}</span>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">/ 100</span>
      </div>
    </div>
  );
}

function DocCard({ doc }) {
  const [expanded, setExpanded] = useState(false);
  const hasFlags = doc.flags && doc.flags.length > 0;
  const statusOk = doc.status === 'VERIFIED';

  return (
    <div className={`rounded-xl border text-xs overflow-hidden ${
      statusOk ? 'border-cyan-900/30' : doc.status === 'CRITICAL' ? 'border-rose-900/50' : 'border-amber-900/50'
    }`}>
      <div className={`flex items-center justify-between p-3 ${
        statusOk ? 'bg-[#0a0f1d]' : doc.status === 'CRITICAL' ? 'bg-rose-950/30' : 'bg-amber-950/30'
      }`}>
        <div className="flex items-center space-x-2">
          <FileText className={`w-4 h-4 shrink-0 ${
            statusOk ? 'text-cyan-400' : doc.status === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'
          }`} />
          <div>
            <p className="font-bold text-slate-100">{doc.doc_type}</p>
            <p className="text-slate-400">{doc.file_name}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {doc.extracted_name !== null && (
            <span className={`flex items-center space-x-1 px-2 py-0.5 rounded-full border font-semibold ${
              doc.name_match
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
            }`}>
              {doc.name_match
                ? <CheckCircle2 className="w-3 h-3" />
                : <XCircle className="w-3 h-3" />
              }
              <span>{doc.name_match ? 'Name Match' : 'Name Mismatch'}</span>
            </span>
          )}
          <span className="text-slate-400 font-medium">OCR {doc.accuracy}%</span>
          <span className={`px-2 py-0.5 rounded-full font-bold border ${
            statusOk
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
              : doc.status === 'CRITICAL'
                ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
          }`}>
            {doc.status}
          </span>
          <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-cyan-300 ml-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-3 space-y-3 bg-[#070b14] border-t border-cyan-900/30">
          {doc.extracted_name && (
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-400 w-28 shrink-0">Extracted Name</span>
              <span className="font-bold text-slate-100">{doc.extracted_name}</span>
              {doc.match_score > 0 && (
                <span className="text-cyan-400 ml-1">({doc.match_score}% similarity)</span>
              )}
            </div>
          )}

          {doc.fields && Object.keys(doc.fields).length > 0 && (
            <div className="bg-[#0a0f1d] rounded-lg border border-cyan-900/30 p-2.5 space-y-1.5">
              <p className="font-bold text-slate-300 mb-1.5">Extracted Fields</p>
              {Object.entries(doc.fields).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[11px]">
                  <span className="text-slate-400 capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="font-semibold text-slate-200">
                    {typeof v === 'number' && k.includes('income') || k.includes('balance')
                      ? `₹${v.toLocaleString('en-IN')}`
                      : String(v)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {hasFlags && (
            <div className="space-y-1.5">
              <p className="font-bold text-slate-300">Document Flags</p>
              {doc.flags.map((f, i) => (
                <div key={i} className={`flex items-start space-x-2 p-2 rounded-lg border ${severityBadge(f.severity)}`}>
                  {severityIcon(f.severity)}
                  <div className="flex-1">
                    <span className={`text-[10px] font-bold uppercase mr-1.5 px-1.5 py-0.5 rounded border ${severityBadge(f.severity)}`}>
                      {f.severity}
                    </span>
                    <span className="text-[11px]">{f.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RejectedFilesBanner({ files }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="bg-rose-950/40 border-2 border-rose-900/60 rounded-xl p-4 space-y-2">
      <div className="flex items-center space-x-2 font-bold text-rose-300 text-sm">
        <ShieldX className="w-5 h-5" />
        <span>Invalid Document(s) Detected — Upload Rejected</span>
      </div>
      {files.map((f, i) => (
        <div key={i} className="flex items-start space-x-2 text-xs bg-[#0a0f1d] border border-rose-900/50 rounded-lg p-2.5">
          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
          <span className="text-rose-200">{f.error}</span>
        </div>
      ))}
    </div>
  );
}

function HumanDecisionPanel({ app, officerName, onDecisionSaved }) {
  const [statement, setStatement]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const alreadyDecided = !!app.human_decision;

  const handleDecision = async (decision) => {
    if (!statement.trim() || statement.trim().length < 10) {
      setError('Underwriter statement is required (minimum 10 characters).');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/v1/applications/${app.id}/human-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          statement: statement.trim(),
          officer_name: officerName || 'Alex Reynolds',
          officer_role: 'Senior Credit Underwriter',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to record decision.');
      }
      const data = await res.json();
      onDecisionSaved && onDecisionSaved(data.application);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadyDecided) {
    const isApproved = app.human_decision === 'APPROVED';
    return (
      <div className={`rounded-xl border-2 p-5 space-y-3 ${
        isApproved ? 'bg-emerald-950/40 border-emerald-800/60' : 'bg-rose-950/40 border-rose-800/60'
      }`}>
        <div className="flex items-center space-x-2">
          {isApproved
            ? <BadgeCheck className="w-6 h-6 text-emerald-400" />
            : <ShieldX className="w-6 h-6 text-rose-400" />
          }
          <h3 className={`text-base font-black ${isApproved ? 'text-emerald-300' : 'text-rose-300'}`}>
            Application {app.human_decision}
          </h3>
        </div>
        <div className="text-xs space-y-1.5">
          <div className="flex space-x-2">
            <span className="text-slate-400 w-36 shrink-0">Underwriter</span>
            <span className="font-semibold text-slate-100">{app.decided_by}</span>
          </div>
          <div className="flex space-x-2">
            <span className="text-slate-400 w-36 shrink-0">Recorded At</span>
            <span className="font-semibold text-slate-100">
              {app.decided_at ? new Date(app.decided_at).toLocaleString('en-IN') : '—'}
            </span>
          </div>
          <div className="flex space-x-2 mt-1">
            <span className="text-slate-400 w-36 shrink-0 pt-0.5">Statement</span>
            <span className={`font-semibold italic ${isApproved ? 'text-emerald-300' : 'text-rose-300'}`}>
              "{app.underwriter_remarks}"
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-400 pt-1 border-t border-cyan-900/30">
          <Lock className="w-3 h-3 text-slate-500" />
          <span>Decision locked. Contact a supervisor to escalate an override.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1527] rounded-xl border border-cyan-900/40 p-5 space-y-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-100">Human Underwriter Decision</h3>
            <p className="text-[11px] text-slate-400">AI advisory only — final decision is yours</p>
          </div>
        </div>
        <span className="flex items-center space-x-1.5 text-[11px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2.5 py-1 rounded-full">
          <Clock className="w-3 h-3" />
          <span>Awaiting Human Review</span>
        </span>
      </div>

      <div className="bg-cyan-950/30 border border-cyan-900/50 rounded-lg p-3 text-xs text-cyan-200 flex items-start space-x-2">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
        <span>
          <strong>AI Advisory (non-binding):</strong> Financial Health Score {app.health_score}/100 —
          Risk Tier: {app.risk_tier}. Review the extracted data, risk factors, and document flags above
          before making your final decision.
        </span>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-300">
          Underwriter One-Line Statement / Reason <span className="text-rose-400">*</span>
        </label>
        <textarea
          rows={3}
          value={statement}
          onChange={e => setStatement(e.target.value)}
          placeholder="e.g. Income verified. DTI within acceptable limits. Property documentation clear. Approved with standard terms."
          className="w-full bg-[#070b14] border border-cyan-900/40 rounded-lg text-xs text-slate-100 placeholder-slate-500 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
        />
        <p className="text-[11px] text-slate-400">{statement.length}/500 characters. Minimum 10 required.</p>
        {error && (
          <p className="text-[11px] text-rose-400 font-semibold flex items-center space-x-1">
            <XCircle className="w-3 h-3" /> <span>{error}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          disabled={submitting}
          onClick={() => handleDecision('APPROVED')}
          className="flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
        >
          {submitting
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <BadgeCheck className="w-4 h-4" />
          }
          <span>APPROVE APPLICATION</span>
        </button>
        <button
          disabled={submitting}
          onClick={() => handleDecision('REJECTED')}
          className="flex items-center justify-center space-x-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
        >
          {submitting
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <ShieldX className="w-4 h-4" />
          }
          <span>REJECT APPLICATION</span>
        </button>
      </div>

      <p className="text-[10px] text-slate-500 text-center">
        This action will be timestamped, attributed to your officer account, and permanently logged in MongoDB.
      </p>
    </div>
  );
}

export default function ApplicationDetail({ app: initialApp, currentUser, onBack }) {
  const [app, setApp]         = useState(initialApp);
  const [loading, setLoading] = useState(!initialApp);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!initialApp?.id) return;
    setLoading(true);
    fetch(`${API}/api/v1/applications/${initialApp.id}`)
      .then(r => r.ok ? r.json() : Promise.reject('Not found'))
      .then(data => { setApp(data); setLoading(false); })
      .catch(() => { setApp(initialApp); setLoading(false); });
  }, [initialApp?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm space-x-2">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
        <span>Loading application details...</span>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="flex items-center justify-center h-64 text-rose-400 text-sm">
        Application not found.
      </div>
    );
  }

  const dv = app.doc_verification || {};
  const anomalies = dv.anomalies || [];
  const criticalAnomalies = anomalies.filter(a => a.severity === 'CRITICAL');
  const officerName = currentUser?.name || 'Alex Reynolds';

  const statusDisplay = app.human_decision === 'APPROVED' ? 'Approved'
    : app.human_decision === 'REJECTED' ? 'Rejected'
    : 'Pending Human Review';

  const statusColor = app.human_decision === 'APPROVED'
    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
    : app.human_decision === 'REJECTED'
    ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
    : 'bg-amber-950/60 text-amber-300 border-amber-800/60';

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">

      <div className="bg-[#0d1527] rounded-xl border border-cyan-900/40 shadow-sm p-5">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-300 mb-4 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Applications Queue</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-slate-100">{app.applicant_name}</h1>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${riskColor(app.risk_tier)}`}>
                {app.risk_tier}
              </span>
            </div>
            <div className="flex items-center space-x-3 text-xs text-slate-400">
              <span className="font-bold text-cyan-400 font-mono">{app.id}</span>
              <span>·</span>
              <span>{app.loan_type}</span>
              <span>·</span>
              <span>{app.amount_display || `₹${(app.amount || 0).toLocaleString('en-IN')}`}</span>
              <span>·</span>
              <span>{app.created_at ? new Date(app.created_at).toLocaleDateString('en-IN') : '—'}</span>
            </div>
          </div>

          <span className={`self-start sm:self-center text-xs font-bold px-3 py-1.5 rounded-full border ${statusColor}`}>
            {statusDisplay}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-1 space-y-4">

          <div className="bg-[#0d1527] rounded-xl border border-cyan-900/40 shadow-sm p-5 space-y-4">
            <div className="flex items-center space-x-2 border-b border-cyan-900/30 pb-3">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-slate-100">AI Risk Summary</h2>
              <span className="text-[10px] font-bold bg-cyan-950/50 text-cyan-300 border border-cyan-800/50 px-1.5 py-0.5 rounded">Advisory Only</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1">Financial Health Score</p>
                <ScoreGauge score={app.health_score || 0} />
              </div>
              <div className="space-y-3 text-right">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">DTI Ratio</p>
                  <p className="text-lg font-black text-slate-100">{app.dti}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Monthly Salary</p>
                  <p className="text-sm font-bold text-slate-100">₹{(app.salary || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-1.5 bg-amber-950/50 border border-amber-800/50 rounded-lg py-2 text-xs font-bold text-amber-300">
              <Clock className="w-3.5 h-3.5" />
              <span>PENDING HUMAN REVIEW</span>
            </div>
          </div>

          {(app.positive_signals || []).length > 0 && (
            <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-emerald-300 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4" /> <span>Positive AI Signals</span>
              </p>
              {app.positive_signals.map((s, i) => (
                <div key={i} className="flex items-start space-x-2 text-xs text-emerald-300/90">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}

          {(app.risk_factors || []).length > 0 && (
            <div className="bg-[#0d1527] border border-cyan-900/40 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" /> <span>AI Detected Risk Factors</span>
              </p>
              {app.risk_factors.map((rf, i) => (
                <div key={i} className={`text-xs p-2.5 rounded-lg border ${severityBadge(rf.severity)}`}>
                  <div className="flex items-center space-x-1.5 mb-0.5">
                    {severityIcon(rf.severity)}
                    <span className="font-bold">{rf.category}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${severityBadge(rf.severity)}`}>
                      {rf.severity}
                    </span>
                  </div>
                  <p className="text-slate-300">{rf.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-5">

          <div className="bg-[#0d1527] rounded-xl border border-cyan-900/40 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-900/30 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-slate-100">Document Extraction & Cross-Verification</h2>
              </div>
              {dv.overall_status && (
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  dv.overall_status === 'VERIFIED' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                  : dv.overall_status === 'INVALID_FILES_DETECTED' ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                }`}>
                  {dv.overall_status?.replace(/_/g, ' ')}
                </span>
              )}
            </div>

            {dv.summary && (
              <p className="text-xs text-slate-300 bg-[#070b14] border border-cyan-900/30 rounded-lg px-3 py-2">
                {dv.summary}
              </p>
            )}

            <RejectedFilesBanner files={dv.rejected_files} />

            {criticalAnomalies.length > 0 && (
              <div className="bg-rose-950/30 border border-rose-900/50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-rose-300 flex items-center space-x-1.5">
                  <ShieldX className="w-4 h-4 text-rose-400" />
                  <span>{criticalAnomalies.length} Critical Identity / Fraud Flag(s)</span>
                </p>
                {criticalAnomalies.map((a, i) => (
                  <div key={i} className="flex items-start space-x-2 text-xs bg-[#0a0f1d] border border-rose-900/40 rounded-lg p-2.5">
                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span className="text-rose-200">{a.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {(dv.cross_match_results || []).map((doc, i) => (
                <DocCard key={i} doc={doc} />
              ))}
              {(!dv.cross_match_results || dv.cross_match_results.length === 0) && (
                <p className="text-xs text-slate-400 text-center py-4">No documents available for verification.</p>
              )}
            </div>
          </div>

          <AIExtractedDetailsView
            details={app.extracted_details || {}}
            title="AI Extracted Details (MongoDB Dossier)"
            subtitle="Real financial & loan document extraction across all 21 key fields. Unverified or missing fields strictly displayed as Not Found."
          />

          <HumanDecisionPanel
            app={app}
            officerName={officerName}
            onDecisionSaved={(updatedApp) => setApp(updatedApp)}
          />
        </div>
      </div>
    </div>
  );
}
