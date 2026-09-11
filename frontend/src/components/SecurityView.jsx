import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Key,
  Database,
  FileCheck,
  Activity,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Terminal,
  Layers
} from 'lucide-react';

export default function SecurityView({ currentUser }) {
  const [encryptionStatus, setEncryptionStatus] = useState('Active (AES-256-GCM)');

  const securityParameters = [
    {
      id: 1,
      title: 'Role-Based Access Control (RBAC)',
      status: 'Enforced',
      detail: `Active User Role: ${currentUser?.roleTitle || 'Banks'}. Access scoped strictly to institutional data boundaries.`,
      icon: UserCheck,
      badgeColor: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
    },
    {
      id: 2,
      title: 'Data & Payload Encryption',
      status: 'AES-256 Bit',
      detail: 'TLS 1.3 in-transit and AES-256-GCM at-rest envelope encryption with AWS KMS hardware security modules.',
      icon: Lock,
      badgeColor: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
    },
    {
      id: 3,
      title: 'Secure Document Storage Engine',
      status: 'S3 Sealed',
      detail: 'Applicant tax documents & bank statements stored in isolated encrypted buckets with temporary signed URLs (15m expiry).',
      icon: Database,
      badgeColor: 'bg-blue-950/60 text-cyan-300 border-cyan-800/60'
    },
    {
      id: 4,
      title: 'API Authentication & Bearer Tokens',
      status: 'JWT OAuth2',
      detail: 'Stateless JSON Web Tokens with RSA-256 signature verification and automated session revocation.',
      icon: Key,
      badgeColor: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
    },
    {
      id: 5,
      title: 'Rate Limiting & Threat Protection',
      status: '100 req/min',
      detail: 'Token bucket rate limiting per institutional tenant IP. DDoS mitigation via Web Application Firewall (WAF).',
      icon: Activity,
      badgeColor: 'bg-purple-950/60 text-purple-300 border-purple-800/60'
    },
    {
      id: 6,
      title: 'Immutable Audit Logging',
      status: 'SHA-256 Ledger',
      detail: 'Every credit risk decision and model override is cryptographically hashed and logged to an append-only audit trail.',
      icon: Terminal,
      badgeColor: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
    },
    {
      id: 7,
      title: 'Real-Time File Validation & Anti-Malware',
      status: 'Strict Scan',
      detail: 'ClamAV antivirus stream scanning, file extension validation (.pdf, .png, .jpg), and 10MB upload payload enforcement.',
      icon: FileCheck,
      badgeColor: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
    },
    {
      id: 8,
      title: 'Institutional Access Control Policies',
      status: 'SOC2 Type II',
      detail: 'Zero Trust architecture, automated session timeouts, and continuous compliance monitoring.',
      icon: ShieldCheck,
      badgeColor: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-[#0d1527] p-6 rounded-2xl border border-cyan-900/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Integrated Security Center</h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-950/60 text-emerald-300 rounded-full border border-emerald-800/60 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>SOC2 Type II Compliant</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time verification panel displaying active system security parameters and encryption posture.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-cyan-300 bg-[#070b14] border border-cyan-900/40 px-3 py-1.5 rounded-xl">
          <Server className="w-4 h-4 text-cyan-400" />
          <span>KMS Status: Online</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {securityParameters.map((param) => {
          const IconComp = param.icon;
          return (
            <div
              key={param.id}
              className="bg-[#0d1527] p-5 rounded-2xl border border-cyan-900/30 shadow-sm hover:border-cyan-500/40 transition-colors flex items-start space-x-4"
            >
              <div className="p-3 bg-cyan-950/50 text-cyan-300 rounded-xl border border-cyan-800/50 shrink-0">
                <IconComp className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100 truncate">{param.title}</h3>
                  <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border shrink-0 ${param.badgeColor}`}>
                    {param.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{param.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-[#0a0f1d] text-white p-6 rounded-2xl border border-cyan-900/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Active Institutional Session</div>
          <div className="text-lg font-bold text-slate-100">
            {currentUser?.institution || 'HDFC Bank Enterprise'} ({currentUser?.roleTitle || 'Banks'})
          </div>
          <div className="text-xs text-slate-400">
            Authenticated via OAuth2 JWT • IP Rate Limit: 100 req/min • Key ID: 0x9f82a7
          </div>
        </div>

        <button className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-950/50 transition-all shrink-0 cursor-pointer">
          <Lock className="w-4 h-4" />
          <span>Rotate Session Keys</span>
        </button>
      </div>
    </div>
  );
}
