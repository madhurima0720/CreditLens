import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  Landmark,
  Briefcase,
  Building,
  Store,
  BarChart2,
  Lock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Key
} from 'lucide-react';
import { INSTITUTIONAL_ROLES } from '../data/loanCategories';

export default function LoginView({ onLogin }) {
  const [selectedRole, setSelectedRole] = useState('bank');
  const [email, setEmail] = useState('alex.reynolds@hdfcbank.com');
  const [password, setPassword] = useState('••••••••••••');
  const [institutionName, setInstitutionName] = useState('HDFC Enterprise Credit');

  const getRoleIcon = (iconName) => {
    switch (iconName) {
      case 'Zap':
        return Zap;
      case 'Landmark':
        return Landmark;
      case 'Briefcase':
        return Briefcase;
      case 'Building':
        return Building;
      case 'Store':
        return Store;
      case 'ShieldCheck':
        return ShieldCheck;
      case 'BarChart2':
        return BarChart2;
      default:
        return Building;
    }
  };

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    const roleObj = INSTITUTIONAL_ROLES.find((r) => r.id === roleId);
    if (roleObj) {
      setEmail(`officer@${roleId}.creditlens.ai`);
      setInstitutionName(`${roleObj.title} Global`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const roleObj = INSTITUTIONAL_ROLES.find((r) => r.id === selectedRole);
    onLogin({
      name: 'Alex Reynolds',
      email: email,
      roleId: selectedRole,
      roleTitle: roleObj ? roleObj.title : 'Banks',
      institution: institutionName
    });
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden select-none">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0e1a2f_1px,transparent_1px),linear-gradient(to_bottom,#0e1a2f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl w-full relative z-10 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center space-x-3 bg-[#0d1527] border border-cyan-900/40 px-4 py-2 rounded-2xl shadow-xl">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-cyan-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex items-center space-x-1">
              <span className="font-extrabold text-white text-xl tracking-tight">Credit</span>
              <span className="font-black text-cyan-400 text-xl tracking-tight">Lens</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300 ml-2 px-2 py-0.5 bg-teal-950/60 rounded-md border border-teal-500/30">
                Institutional AI Portal
              </span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Financial Risk & Health Assessment Platform
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Select your institutional organization type to authenticate into the CreditLens high-speed underwriting engine.
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-center text-xs font-bold uppercase tracking-wider text-cyan-400">
            Step 1: Select Your Institutional Portal Role
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {INSTITUTIONAL_ROLES.map((role) => {
              const IconComp = getRoleIcon(role.icon);
              const isSelected = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleRoleSelect(role.id)}
                  className={`p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-600/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/10 ring-2 ring-cyan-500/50'
                      : 'bg-[#0d1527]/90 border-cyan-900/30 text-slate-400 hover:border-cyan-700/50 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <IconComp className={`w-5 h-5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />}
                  </div>
                  <div className="text-xs font-bold leading-tight">{role.title}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-[#0d1527] border border-cyan-900/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>
                  Authenticating as:{' '}
                  <span className="text-cyan-400">
                    {INSTITUTIONAL_ROLES.find((r) => r.id === selectedRole)?.title}
                  </span>
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {INSTITUTIONAL_ROLES.find((r) => r.id === selectedRole)?.permissions}
              </p>
            </div>
            <span className="px-2.5 py-1 text-[11px] font-bold bg-teal-950/60 text-teal-300 border border-teal-500/30 rounded-lg">
              256-Bit Encrypted
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Institution Name</label>
                <input
                  type="text"
                  required
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="w-full bg-[#070b14] border border-cyan-900/40 rounded-xl px-3.5 py-2.5 text-white font-medium focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Authorized Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#070b14] border border-cyan-900/40 rounded-xl px-3.5 py-2.5 text-white font-medium focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">Security Token / Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#070b14] border border-cyan-900/40 rounded-xl px-3.5 py-2.5 text-white font-medium focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-cyan-600/30 flex items-center justify-center space-x-2 transition-all"
            >
              <span>Launch Institutional Underwriting Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="p-3 bg-[#070b14] border border-cyan-900/30 rounded-xl flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>Demo Mode: Click any role above to pre-fill credentials instantly.</span>
            </span>
            <span className="font-mono text-[10px] text-teal-400">JWT Token Sandbox</span>
          </div>
        </div>
      </div>
    </div>
  );
}
