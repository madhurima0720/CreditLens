import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquareCode,
  Send,
  Sparkles,
  Bot,
  User,
  Paperclip,
  Sliders,
  Zap,
  FileText,
  TrendingUp,
  ShieldAlert,
  Info
} from 'lucide-react';

const CATEGORY_META = {
  GREETING:         { label: 'Greeting',          color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' },
  FAREWELL:         { label: 'Farewell',           color: 'bg-slate-800 text-slate-300 border-slate-700' },
  FRAUD_EXPLANATION:{ label: 'Fraud Alert',        color: 'bg-rose-950/60 text-rose-300 border-rose-800/60' },
  DOCUMENTS:        { label: 'Documents',          color: 'bg-blue-950/60 text-cyan-300 border-cyan-800/60' },
  DTI_CALCULATION:  { label: 'DTI Formula',        color: 'bg-purple-950/60 text-purple-300 border-purple-800/60' },
  CIBIL:            { label: 'CIBIL / Credit',     color: 'bg-amber-950/60 text-amber-300 border-amber-800/60' },
  INTEREST_RATES:   { label: 'Interest Rates',     color: 'bg-teal-950/60 text-teal-300 border-teal-800/60' },
  ELIGIBILITY:      { label: 'Eligibility',        color: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60' },
  GENERAL:          { label: 'General',            color: 'bg-slate-800 text-slate-300 border-slate-700' },
};

function RichText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, li) => {
        const parts = line.split(/\*\*(.+?)\*\*/g);
        return (
          <p key={li} className={line === '' ? 'h-1' : ''}>
            {parts.map((part, pi) =>
              pi % 2 === 1 ? <strong key={pi} className="font-semibold text-cyan-300">{part}</strong> : part
            )}
          </p>
        );
      })}
    </div>
  );
}

const SESSION_CONTEXT = {
  applicant_name: '',
  loan_type: 'Home Loan',
  health_score: 78,
  dti_ratio: 38.5,
  risk_classification: 'Low Risk',
  missing_documents: [],
  mismatched_fields: [],
};

const DEFAULT_CHIPS = [
  'Why was this applicant flagged?',
  'What documents are required for Home Loan?',
  'How is DTI calculated?',
  'What interest rates apply for Personal Loans?',
];

export default function CopilotChat({ onNavigateTab, sessionContext }) {
  const ctx = sessionContext || SESSION_CONTEXT;

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: `Hello! 👋 I'm the CreditLens AI Copilot — your intelligent financial policy engine. Ask me about applicant risk, document requirements, fraud flags, DTI calculations, CIBIL scores, or interest rate benchmarks.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      category: 'GREETING',
      suggestedPrompts: DEFAULT_CHIPS,
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chips, setChips] = useState(DEFAULT_CHIPS);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (textToSend) => {
    const query = (textToSend || inputQuery).trim();
    if (!query) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputQuery('');
    setIsTyping(true);

    const payload = {
      query,
      applicant_name: ctx.applicant_name,
      loan_type: ctx.loan_type,
      health_score: ctx.health_score,
      dti_ratio: ctx.dti_ratio,
      risk_classification: ctx.risk_classification,
      missing_documents: ctx.missing_documents || [],
      mismatched_fields: ctx.mismatched_fields || [],
    };

    let botText = '';
    let botCategory = 'GENERAL';
    let botSuggestedPrompts = DEFAULT_CHIPS;

    try {
      const res = await fetch('http://localhost:8000/api/v1/copilot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      botText = data.response;
      botCategory = data.category || 'GENERAL';
      if (data.suggested_prompts?.length) {
        botSuggestedPrompts = data.suggested_prompts;
      }
    } catch {
      const q = query.toLowerCase();
      if (/\b(bye|goodbye|farewell|take care)\b/.test(q)) {
        botText = 'Goodbye! 👋 Thank you for using CreditLens AI Copilot. Come back anytime!';
        botCategory = 'FAREWELL';
      } else if (/\b(hi|hello|hey)\b/.test(q)) {
        botText = "Hello! 👋 I'm the CreditLens AI Copilot. How can I help you today?";
        botCategory = 'GREETING';
      } else if (/flag|fraud|mismatch|why reject/.test(q)) {
        const appInfo = ctx.applicant_name ? `'${ctx.applicant_name}' ` : '';
        botText = `Applicant ${appInfo}(${ctx.loan_type}) — Financial Health Score: ${ctx.health_score}/100, DTI: ${ctx.dti_ratio}%, Classification: ${ctx.risk_classification}.`;
        botCategory = 'ELIGIBILITY';
      } else if (/document|require|upload|kyc/.test(q)) {
        botText = 'Home Loans require: Government ID, Address Proof, Salary Slips, 6M Bank Statement, Form 16 / ITR, Property Title Documents.\nBusiness Loans require: GST Certificate, Promoter KYC, Audited Financial Statements, 2Y Business ITR, 12M Bank Statement.';
        botCategory = 'DOCUMENTS';
      } else if (/dti|debt.to.income|ratio/.test(q)) {
        botText = '**DTI Formula:** (Total Monthly Debt Obligations ÷ Net Monthly Salary) × 100\n\n• DTI ≤ 40% → Low Risk ✅\n• DTI 40–50% → Medium Risk ⚠️\n• DTI > 50% → High Risk ❌';
        botCategory = 'DTI_CALCULATION';
      } else if (/interest|rate/.test(q)) {
        botText = '**Benchmark Rates:**\n• Home Loan: 8.50%\n• Vehicle Loan: 9.25%\n• Education Loan: 9.75%\n• Personal Loan: 11.50%\n• Business Loan: 12.00%\n• Agricultural Loan: 7.00%';
        botCategory = 'INTEREST_RATES';
      } else if (/cibil|credit score/.test(q)) {
        botText = '**CIBIL Score Range:** 300–900\n• 750+ → Excellent\n• 700–749 → Good\n• 650–699 → Fair\n• Below 650 → Poor / Rejection risk';
        botCategory = 'CIBIL';
      } else {
        botText = `CreditLens AI is offline. Your query: "${query}"\n\nPlease start the backend server at http://localhost:8000 to receive live AI responses.`;
        botCategory = 'GENERAL';
      }
    }

    setChips(botSuggestedPrompts);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: botText,
          category: botCategory,
          suggestedPrompts: botSuggestedPrompts,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setIsTyping(false);
    }, 400);
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-[#0d1527] rounded-2xl border border-cyan-900/40 shadow-sm overflow-hidden">

      <div className="p-4 border-b border-cyan-900/30 bg-[#0a0f1d] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center text-white shadow-sm shadow-cyan-950/50">
            <MessageSquareCode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-slate-100">CreditLens AI Copilot</h2>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            </div>
            <p className="text-[11px] text-slate-400">Autonomous Financial Reasoning &amp; Policy Query Engine</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="hidden sm:flex items-center space-x-2 bg-cyan-950/40 border border-cyan-900/50 rounded-lg px-3 py-1.5 text-[11px]">
            {ctx.applicant_name && (
              <>
                <span className="font-semibold text-cyan-300">{ctx.applicant_name}</span>
                <span className="text-cyan-700">|</span>
              </>
            )}
            <span className="text-slate-300">{ctx.loan_type}</span>
            <span className="text-cyan-700">|</span>
            <span className="font-bold text-cyan-300">FHS {ctx.health_score}/100</span>
          </div>
          <button
            onClick={() => onNavigateTab && onNavigateTab('simulator')}
            className="flex items-center space-x-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/40 border border-cyan-800/50 px-3 py-1.5 rounded-lg hover:bg-cyan-900/40 transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Simulator</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-5 overflow-y-auto space-y-5 bg-[#070b14]">
        {messages.map((msg) => {
          const catMeta = CATEGORY_META[msg.category] || CATEGORY_META.GENERAL;
          return (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-sm shadow-cyan-950/50'
                }`}
              >
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`max-w-2xl space-y-2 ${msg.sender === 'user' ? 'items-end flex flex-col' : ''}`}>

                {msg.sender === 'bot' && msg.category && (
                  <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border ${catMeta.color}`}>
                    {catMeta.label}
                  </span>
                )}

                <div
                  className={`inline-block text-xs p-4 rounded-2xl leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-tr-none shadow-sm shadow-cyan-950/50'
                      : 'bg-[#0d1527] border border-cyan-900/40 text-slate-100 rounded-tl-none shadow-sm'
                  }`}
                >
                  {msg.sender === 'bot'
                    ? <RichText text={msg.text} />
                    : <div className="whitespace-pre-line">{msg.text}</div>
                  }
                  <div className={`text-[10px] mt-2 font-medium ${msg.sender === 'user' ? 'text-cyan-200' : 'text-slate-400'}`}>
                    {msg.timestamp}
                  </div>
                </div>

                {msg.sender === 'bot' && msg.suggestedPrompts?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {msg.suggestedPrompts.map((sp, si) => (
                      <button
                        key={si}
                        onClick={() => handleSend(sp)}
                        className="text-[11px] font-medium bg-cyan-950/50 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-800/50 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                      >
                        {sp}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center space-x-2 text-cyan-400 text-xs">
            <Bot className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>CreditLens AI Copilot is synthesizing financial intelligence...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="px-4 py-2 bg-[#0a0f1d] border-t border-cyan-900/30 flex items-center space-x-2 overflow-x-auto">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Quick Prompts:</span>
        {chips.map((chip, i) => (
          <button
            key={i}
            onClick={() => handleSend(chip)}
            className="shrink-0 text-[11px] font-medium bg-[#070b14] hover:bg-cyan-950/50 hover:text-cyan-300 text-slate-300 px-3 py-1 rounded-full transition-colors border border-cyan-900/30 whitespace-nowrap cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="p-3 bg-[#0a0f1d] border-t border-cyan-900/30">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center space-x-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Ask about DTI rules, fraud flags, document requirements, CIBIL scores..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              className="w-full bg-[#070b14] border border-cyan-900/40 text-xs text-slate-100 placeholder-slate-500 rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
            <button type="button" className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer">
              <Paperclip className="w-4 h-4" />
            </button>
          </div>
          <button
            type="submit"
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white p-2.5 rounded-xl shadow-sm shadow-cyan-950/50 transition-all shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
