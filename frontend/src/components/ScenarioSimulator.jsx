import React, { useState } from 'react';
import {
  Sliders,
  TrendingUp,
  Percent,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Download,
  Info
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export default function ScenarioSimulator() {
  const [salary, setSalary] = useState(180000);
  const [existingEmi, setExistingEmi] = useState(35000);
  const [loanAmount, setLoanAmount] = useState(3000000);
  const [interestRate, setInterestRate] = useState(10.5);
  const [tenureMonths, setTenureMonths] = useState(48);

  const monthlyRate = interestRate / 12 / 100;
  const emiCalc =
    monthlyRate > 0
      ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
        (Math.pow(1 + monthlyRate, tenureMonths) - 1)
      : loanAmount / tenureMonths;

  const newEmi = Math.round(emiCalc);
  const totalEmi = existingEmi + newEmi;
  const dtiRatio = parseFloat(((totalEmi / salary) * 100).toFixed(1));
  const disposableIncome = Math.max(0, salary - totalEmi);

  const healthScore = Math.max(20, Math.min(98, Math.round(100 - dtiRatio * 0.9 + (salary > 150000 ? 10 : 0))));

  const sensitivityData = [
    {
      scenario: 'Base Rate (10.5%)',
      emi: newEmi,
      dti: dtiRatio,
      status: dtiRatio < 40 ? 'Safe' : dtiRatio < 50 ? 'Moderate' : 'Critical'
    },
    {
      scenario: '+100 bps Shock (11.5%)',
      emi: Math.round(
        (loanAmount * (0.115 / 12) * Math.pow(1 + 0.115 / 12, tenureMonths)) /
          (Math.pow(1 + 0.115 / 12, tenureMonths) - 1)
      ),
      dti: parseFloat((((existingEmi + (loanAmount * (0.115 / 12) * Math.pow(1 + 0.115 / 12, tenureMonths)) / (Math.pow(1 + 0.115 / 12, tenureMonths) - 1)) / salary) * 100).toFixed(1)),
      status: 'Stress Test +1%'
    },
    {
      scenario: '+200 bps Shock (12.5%)',
      emi: Math.round(
        (loanAmount * (0.125 / 12) * Math.pow(1 + 0.125 / 12, tenureMonths)) /
          (Math.pow(1 + 0.125 / 12, tenureMonths) - 1)
      ),
      dti: parseFloat((((existingEmi + (loanAmount * (0.125 / 12) * Math.pow(1 + 0.125 / 12, tenureMonths)) / (Math.pow(1 + 0.125 / 12, tenureMonths) - 1)) / salary) * 100).toFixed(1)),
      status: 'Macro Shock +2%'
    }
  ];

  const chartData = [
    {
      name: 'Current Cash Flow',
      ExistingEMI: existingEmi,
      NewEMI: 0,
      Disposable: salary - existingEmi
    },
    {
      name: 'Proposed Loan Impact',
      ExistingEMI: existingEmi,
      NewEMI: newEmi,
      Disposable: disposableIncome
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-[#0d1527] p-6 rounded-xl border border-cyan-900/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Interactive Scenario Simulator</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-cyan-950/50 text-cyan-300 rounded-full border border-cyan-800/50">
              Live Stress Testing
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dynamically adjust loan terms and assess real-time debt-to-income impact & portfolio default risk.
          </p>
        </div>

        <button
          onClick={() => {
            setSalary(180000);
            setExistingEmi(35000);
            setLoanAmount(3000000);
            setInterestRate(10.5);
            setTenureMonths(48);
          }}
          className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 bg-[#070b14] hover:bg-cyan-950/40 hover:text-cyan-300 border border-cyan-900/40 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Parameters</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#0d1527] p-6 rounded-xl border border-cyan-900/40 shadow-sm space-y-6">
          <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2 border-b border-cyan-900/30 pb-3">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Interactive Financial Sliders</span>
          </h2>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-300">Requested Loan Amount</span>
              <span className="text-cyan-300 font-extrabold text-sm">₹{loanAmount.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min="500000"
              max="10000000"
              step="100000"
              value={loanAmount}
              onChange={(e) => setLoanAmount(Number(e.target.value))}
              className="w-full h-2 bg-[#070b14] border border-cyan-900/40 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
              <span>₹5 Lakhs</span>
              <span>₹50 Lakhs</span>
              <span>₹1 Crore</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-300">Interest Rate (p.a.)</span>
              <span className="text-cyan-300 font-extrabold text-sm">{interestRate}%</span>
            </div>
            <input
              type="range"
              min="7.0"
              max="18.0"
              step="0.25"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              className="w-full h-2 bg-[#070b14] border border-cyan-900/40 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
              <span>7.0%</span>
              <span>12.5%</span>
              <span>18.0%</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-300">Loan Tenure (Months)</span>
              <span className="text-cyan-300 font-extrabold text-sm">{tenureMonths} Months ({(tenureMonths/12).toFixed(1)} Yrs)</span>
            </div>
            <input
              type="range"
              min="12"
              max="84"
              step="6"
              value={tenureMonths}
              onChange={(e) => setTenureMonths(Number(e.target.value))}
              className="w-full h-2 bg-[#070b14] border border-cyan-900/40 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
              <span>12 Mo</span>
              <span>48 Mo</span>
              <span>84 Mo</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-300">Applicant Monthly Salary</span>
              <span className="text-slate-100 font-bold text-sm">₹{salary.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min="50000"
              max="600000"
              step="10000"
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value))}
              className="w-full h-2 bg-[#070b14] border border-cyan-900/40 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-300">Existing Monthly EMIs</span>
              <span className="text-slate-100 font-bold text-sm">₹{existingEmi.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min="0"
              max="150000"
              step="5000"
              value={existingEmi}
              onChange={(e) => setExistingEmi(Number(e.target.value))}
              className="w-full h-2 bg-[#070b14] border border-cyan-900/40 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#0a0f1d] text-white p-6 rounded-xl border border-cyan-900/40 shadow-md space-y-5">
            <div className="flex items-center justify-between border-b border-cyan-900/30 pb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Simulation Output</span>
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] text-slate-400 font-medium">New Monthly EMI</div>
                <div className="text-2xl font-black text-cyan-300 mt-1">₹{newEmi.toLocaleString('en-IN')}</div>
                <div className="text-[10px] text-slate-400">@ {interestRate}% p.a.</div>
              </div>

              <div>
                <div className="text-[11px] text-slate-400 font-medium">Resulting DTI Ratio</div>
                <div className="text-2xl font-black mt-1 text-slate-100">{dtiRatio}%</div>
                <div
                  className={`text-[10px] font-bold ${
                    dtiRatio < 40 ? 'text-emerald-400' : dtiRatio < 50 ? 'text-amber-400' : 'text-rose-400'
                  }`}
                >
                  {dtiRatio < 40 ? '● Low Debt Burden' : dtiRatio < 50 ? '● Moderate Exposure' : '● Critical Over-Leverage'}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-400">Simulated Health Score</span>
                <span className="font-bold text-slate-100">{healthScore} / 100</span>
              </div>
              <div className="w-full bg-[#070b14] border border-cyan-900/40 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    healthScore >= 75
                      ? 'bg-emerald-500'
                      : healthScore >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${healthScore}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-[#0d1527] p-5 rounded-xl border border-cyan-900/40 shadow-sm">
            <h3 className="text-xs font-bold text-slate-100 mb-3">Monthly Cash Flow Breakdown</h3>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                    formatter={(val) => `₹${val.toLocaleString('en-IN')}`}
                  />
                  <Bar dataKey="ExistingEMI" stackId="a" fill="#475569" />
                  <Bar dataKey="NewEMI" stackId="a" fill="#2563eb" />
                  <Bar dataKey="Disposable" stackId="a" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0d1527] p-6 rounded-xl border border-cyan-900/40 shadow-sm">
        <h3 className="text-sm font-bold text-slate-100 mb-4">Macro Interest Rate Stress Matrix</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sensitivityData.map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-cyan-900/30 bg-[#0a0f1d] space-y-2">
              <div className="text-xs font-bold text-slate-100">{item.scenario}</div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Monthly EMI:</span>
                <span className="font-bold text-slate-100">₹{item.emi.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">DTI Impact:</span>
                <span className="font-bold text-cyan-300">{item.dti}%</span>
              </div>
              <div className="pt-2 border-t border-cyan-900/30 text-[11px] font-semibold text-slate-400">
                {item.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
