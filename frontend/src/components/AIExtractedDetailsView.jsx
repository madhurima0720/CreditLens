import React from 'react';
import {
  FileText, User, Calendar, CreditCard, Phone, Mail, MapPin,
  TrendingUp, DollarSign, Percent, Clock, Receipt, Hash,
  AlertCircle, Building, CheckCircle2, Shield, Landmark,
  Layers, Scale, Lock
} from 'lucide-react';

export const DEFAULT_EXTRACTED_DETAILS = {
  name: 'Not Found',
  dob: 'Not Found',
  gender: 'Not Found',
  aadhaar: 'Not Found',
  pan: 'Not Found',
  phone: 'Not Found',
  email: 'Not Found',
  address: 'Not Found',
  loan_type: 'Not Found',
  loan_amount: 'Not Found',
  interest_rate: 'Not Found',
  tenure: 'Not Found',
  emi: 'Not Found',
  loan_account_number: 'Not Found',
  dates: 'Not Found',
  outstanding_amount: 'Not Found',
  income: 'Not Found',
  existing_loans_emis: 'Not Found',
  bank_details: 'Not Found',
  assets: 'Not Found',
  liabilities: 'Not Found',
  collateral: 'Not Found',
};

export default function AIExtractedDetailsView({ details = {}, title = "AI Extracted Details", subtitle = "Real document extraction analysis — undetected fields strictly marked as Not Found" }) {
  const merged = { ...DEFAULT_EXTRACTED_DETAILS, ...details };

  const fieldCount = Object.keys(DEFAULT_EXTRACTED_DETAILS).length;
  const detectedCount = Object.keys(DEFAULT_EXTRACTED_DETAILS).filter(
    k => merged[k] && merged[k] !== 'Not Found'
  ).length;

  const renderFieldValue = (val) => {
    const isFound = val && val !== 'Not Found';
    if (!isFound) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#070b14] text-slate-500 border border-slate-800">
          <span>Not Found</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-cyan-950/50 text-cyan-200 border border-cyan-800/60 max-w-full truncate" title={String(val)}>
        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
        <span className="truncate">{String(val)}</span>
      </span>
    );
  };

  const sections = [
    {
      title: "Identity & Personal Profile",
      icon: User,
      color: "border-blue-900/40 bg-[#0a0f1d]",
      fields: [
        { key: "name", label: "Applicant Name", icon: User },
        { key: "dob", label: "Date of Birth (DOB)", icon: Calendar },
        { key: "gender", label: "Gender", icon: User },
        { key: "aadhaar", label: "Aadhaar Number", icon: CreditCard },
        { key: "pan", label: "PAN Identifier", icon: CreditCard },
        { key: "phone", label: "Phone Number", icon: Phone },
        { key: "email", label: "Email Address", icon: Mail },
        { key: "address", label: "Residential Address", icon: MapPin },
      ]
    },
    {
      title: "Loan Specifications",
      icon: Receipt,
      color: "border-cyan-900/40 bg-[#0a0f1d]",
      fields: [
        { key: "loan_type", label: "Loan Type", icon: FileText },
        { key: "loan_amount", label: "Loan Amount", icon: DollarSign },
        { key: "interest_rate", label: "Interest Rate", icon: Percent },
        { key: "tenure", label: "Tenure / Duration", icon: Clock },
        { key: "emi", label: "Monthly EMI", icon: Receipt },
        { key: "loan_account_number", label: "Loan Account Number", icon: Hash },
        { key: "dates", label: "Sanction / Issue Dates", icon: Calendar },
      ]
    },
    {
      title: "Financial & Bank Details",
      icon: Landmark,
      color: "border-emerald-900/40 bg-[#0a0f1d]",
      fields: [
        { key: "income", label: "Income / Salary", icon: DollarSign },
        { key: "outstanding_amount", label: "Outstanding Amount", icon: TrendingUp },
        { key: "existing_loans_emis", label: "Existing Loans / EMIs", icon: Scale },
        { key: "bank_details", label: "Bank Account & IFSC", icon: Landmark },
      ]
    },
    {
      title: "Assets, Liabilities & Collateral",
      icon: Shield,
      color: "border-amber-900/40 bg-[#0a0f1d]",
      fields: [
        { key: "assets", label: "Declared Assets", icon: Layers },
        { key: "liabilities", label: "Total Liabilities", icon: Scale },
        { key: "collateral", label: "Pledged Collateral", icon: Lock },
      ]
    }
  ];

  return (
    <div className="bg-[#0d1527] rounded-2xl border border-cyan-900/40 shadow-sm p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-900/30 pb-3.5">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center text-white shadow-sm shadow-cyan-950/50">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-100 tracking-tight">{title}</h3>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-950/50 text-cyan-300 border border-cyan-800/50 rounded-full">
              {detectedCount} of {fieldCount} Detected
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>
        </div>

        <div className="flex items-center space-x-2 text-[11px]">
          <span className="flex items-center space-x-1 text-emerald-300 font-semibold bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>{detectedCount} Verified</span>
          </span>
          <span className="flex items-center space-x-1 text-slate-400 font-medium bg-[#070b14] border border-cyan-900/30 px-2 py-0.5 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            <span>{fieldCount - detectedCount} Not Found</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((sec, idx) => (
          <div key={idx} className={`rounded-xl border p-4 space-y-3 ${sec.color}`}>
            <div className="flex items-center space-x-2 border-b border-cyan-900/30 pb-2">
              <sec.icon className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold text-slate-100">{sec.title}</h4>
            </div>

            <div className="space-y-2">
              {sec.fields.map((f) => (
                <div key={f.key} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs py-1 border-b border-cyan-900/20 last:border-0 gap-1">
                  <div className="flex items-center space-x-1.5 text-slate-400 min-w-0">
                    <f.icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-medium text-[11px] truncate">{f.label}</span>
                  </div>
                  <div className="sm:text-right shrink-0">
                    {renderFieldValue(merged[f.key])}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
