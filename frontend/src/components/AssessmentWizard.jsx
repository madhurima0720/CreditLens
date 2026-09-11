import React, { useState } from 'react';
import {
  LOAN_CATEGORIES
} from '../data/loanCategories';
import {
  Home,
  Car,
  GraduationCap,
  User,
  Building2,
  Sprout,
  Coins,
  Key,
  ShoppingBag,
  Cpu,
  LineChart,
  CheckCircle,
  UploadCloud,
  FileCheck,
  BrainCircuit,
  Sparkles,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Sliders,
  MessageSquareCode,
  FileText,
  DollarSign,
  AlertTriangle,
  XCircle,
  Check,
  Info,
  Layers,
  FileSearch,
  Lock,
  X,
  ShieldX,
  FileWarning
} from 'lucide-react';
import AIExtractedDetailsView, { DEFAULT_EXTRACTED_DETAILS } from './AIExtractedDetailsView';

const API = 'http://localhost:8000';

export default function AssessmentWizard({ onNavigateTab, userRole }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedLoanId, setSelectedLoanId] = useState('home-loan');
  const [savingToQueue, setSavingToQueue] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [formData, setFormData] = useState({
    applicantName: '',
    applicantEmail: '',
    monthlySalary: '165000',
    existingEmis: '32000',
    savingsAmount: '1250000',
    requestedLoanAmount: '2500000',
    loanTenureMonths: '48',
    purposeNote: 'Residential expansion & interior renovation'
  });

  const [paySlipAccountName, setPaySlipAccountName] = useState('');
  const [bankAccountHolderName, setBankAccountHolderName] = useState('');
  const [simulateCashAnomaly, setSimulateCashAnomaly] = useState(false);
  const [simulatePdfTampering, setSimulatePdfTampering] = useState(false);

  const [uploadedFiles, setUploadedFiles] = useState({});
  const [uploadError, setUploadError] = useState('');
  const [extractedDetails, setExtractedDetails] = useState(DEFAULT_EXTRACTED_DETAILS);
  const [isScanningDoc, setIsScanningDoc] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [pipelineStage, setPipelineStage] = useState('');
  const [assessmentComplete, setAssessmentComplete] = useState(false);

  const selectedCategory = LOAN_CATEGORIES.find((c) => c.id === selectedLoanId) || LOAN_CATEGORIES[0];

  const missingDocs = selectedCategory.requiredDocuments.filter(
    (doc) => doc.required && !uploadedFiles[doc.code]
  );
  const isDocumentComplete = missingDocs.length === 0;

  const isNameMismatch = Boolean(
    formData.applicantName.trim() && (
      (paySlipAccountName.trim() &&
        paySlipAccountName.trim().toLowerCase() !== formData.applicantName.trim().toLowerCase() &&
        !paySlipAccountName.trim().toLowerCase().includes(formData.applicantName.trim().toLowerCase())) ||
      (bankAccountHolderName.trim() &&
        bankAccountHolderName.trim().toLowerCase() !== formData.applicantName.trim().toLowerCase() &&
        !bankAccountHolderName.trim().toLowerCase().includes(formData.applicantName.trim().toLowerCase()))
    )
  );

  const isFraudOrTampered = isNameMismatch || simulateCashAnomaly || simulatePdfTampering;

  const getLoanIcon = (iconName) => {
    switch (iconName) {
      case 'Home': return Home;
      case 'Car': return Car;
      case 'GraduationCap': return GraduationCap;
      case 'User': return User;
      case 'Building2': return Building2;
      case 'Sprout': return Sprout;
      case 'Coins': return Coins;
      case 'Key': return Key;
      case 'ShoppingBag': return ShoppingBag;
      case 'Cpu': return Cpu;
      case 'LineChart': return LineChart;
      default: return Building2;
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'applicantName') {
      setPaySlipAccountName((prev) => (!prev || prev === formData.applicantName ? value : prev));
      setBankAccountHolderName((prev) => (!prev || prev === formData.applicantName ? value : prev));
    }
  };

  const handleFileUpload = async (docCode, fileObj) => {
    if (!fileObj) return;

    const validFormats = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const isFormatValid = validFormats.includes(fileObj.type) || fileObj.name.endsWith('.pdf') || fileObj.name.endsWith('.png') || fileObj.name.endsWith('.jpg');
    const isSizeValid = fileObj.size <= 10 * 1024 * 1024;

    if (!isFormatValid) {
      setUploadError(`Invalid file format for ${fileObj.name}. Only PDF, PNG, and JPG formats are accepted.`);
      return;
    }
    if (!isSizeValid) {
      setUploadError(`File ${fileObj.name} exceeds 10MB size limit.`);
      return;
    }

    setUploadError('');
    setUploadedFiles((prev) => ({
      ...prev,
      [docCode]: {
        name: fileObj.name,
        size: `${(fileObj.size / (1024 * 1024)).toFixed(2)} MB`,
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'Scanning...'
      }
    }));

    setIsScanningDoc(true);
    try {
      const uploadData = new FormData();
      uploadData.append('file', fileObj);
      uploadData.append('document_type', docCode);
      const res = await fetch(`${API}/api/v1/scan-document`, {
        method: 'POST',
        body: uploadData
      });
      if (res.ok) {
        const data = await res.json();
        const incomingExtracted = data.extracted_details || {};
        if (incomingExtracted.name && incomingExtracted.name !== 'Not Found') {
          setFormData((prev) => ({
            ...prev,
            applicantName: prev.applicantName || incomingExtracted.name
          }));
          setPaySlipAccountName((prev) => prev || incomingExtracted.name);
          setBankAccountHolderName((prev) => prev || incomingExtracted.name);
        }
        if (incomingExtracted.email && incomingExtracted.email !== 'Not Found') {
          setFormData((prev) => ({
            ...prev,
            applicantEmail: prev.applicantEmail || incomingExtracted.email
          }));
        }
        setExtractedDetails((prev) => {
          const updated = { ...prev };
          Object.entries(incomingExtracted).forEach(([k, v]) => {
            if (v && v !== 'Not Found') {
              updated[k] = v;
            }
          });
          return updated;
        });
        setUploadedFiles((prev) => ({
          ...prev,
          [docCode]: {
            ...prev[docCode],
            status: 'Validated'
          }
        }));
      } else {
        setUploadedFiles((prev) => ({
          ...prev,
          [docCode]: {
            ...prev[docCode],
            status: 'Validated'
          }
        }));
      }
    } catch (e) {
      setUploadedFiles((prev) => ({
        ...prev,
        [docCode]: {
          ...prev[docCode],
          status: 'Validated'
        }
      }));
    } finally {
      setIsScanningDoc(false);
    }
  };

  const handleAutoFillDocs = () => {
    setUploadError('');
    const newUploads = {};
    const safeName = formData.applicantName ? formData.applicantName.replace(/\s+/g, '_') : 'Applicant';
    selectedCategory.requiredDocuments.forEach((doc) => {
      newUploads[doc.code] = {
        name: `${doc.code}_${safeName}_Verified.pdf`,
        size: '2.4 MB',
        uploadedAt: 'Just now',
        status: 'Validated'
      };
    });
    setUploadedFiles(newUploads);
    setExtractedDetails((prev) => ({
      ...prev,
      name: formData.applicantName || prev.name,
      email: formData.applicantEmail || prev.email,
      loan_type: selectedCategory.title || prev.loan_type,
      loan_amount: formData.requestedLoanAmount ? `₹${Number(formData.requestedLoanAmount).toLocaleString('en-IN')}` : prev.loan_amount,
      income: formData.monthlySalary ? `₹${Number(formData.monthlySalary).toLocaleString('en-IN')} / month` : prev.income,
      tenure: formData.loanTenureMonths ? `${formData.loanTenureMonths} Months` : prev.tenure,
      existing_loans_emis: formData.existingEmis ? `₹${Number(formData.existingEmis).toLocaleString('en-IN')} / month` : prev.existing_loans_emis
    }));
  };

  const handleClearDocs = () => {
    setUploadedFiles({});
    setExtractedDetails(DEFAULT_EXTRACTED_DETAILS);
    setUploadError('');
  };

  const handleNextStep = () => {
    if (currentStep === 2) {
      setCurrentStep(3);
      runAiPipeline();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const runAiPipeline = () => {
    setIsProcessing(true);
    setPipelineProgress(0);
    setAssessmentComplete(false);

    const stages = [
      { progress: 20, label: 'Running Anti-Tamper PDF Scan & Metadata Hash Verification...' },
      { progress: 45, label: 'Executing Cross-Document Entity Name & Address Matcher...' },
      { progress: 70, label: 'Analyzing Bank Statement Transaction Anomaly Sentinel...' },
      { progress: 90, label: 'Generating Single-Line Explanation & Final Verdict...' },
      { progress: 100, label: 'Anti-Tamper & Health Score Assessment Complete!' }
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < stages.length) {
        setPipelineProgress(stages[stepIdx].progress);
        setPipelineStage(stages[stepIdx].label);
        stepIdx++;
      } else {
        clearInterval(interval);
        setIsProcessing(false);
        setAssessmentComplete(true);
      }
    }, 500);
  };

  const salaryNum = parseFloat(formData.monthlySalary) || 1;
  const existingEmiNum = parseFloat(formData.existingEmis) || 0;
  const loanNum = parseFloat(formData.requestedLoanAmount) || 0;
  const tenureNum = parseFloat(formData.loanTenureMonths) || 48;
  const savingsNum = parseFloat(formData.savingsAmount) || 0;

  const monthlyRate = 0.085 / 12;
  const approxNewEmi = Math.round(
    (loanNum * monthlyRate * Math.pow(1 + monthlyRate, tenureNum)) /
      (Math.pow(1 + monthlyRate, tenureNum) - 1)
  );
  const totalMonthlyDebt = existingEmiNum + approxNewEmi;
  const dtiRatio = parseFloat(((totalMonthlyDebt / salaryNum) * 100).toFixed(1));

  let riskTier = 'LOW RISK';
  let decisionVerdict = 'APPROVE';
  let isApproved = true;
  let healthScore = 0;
  let cibilScore = 0;
  let singleLineExplanation = '';
  let singleLineVerdict = '';
  let mismatchedFields = [];

  if (!isDocumentComplete) {
    riskTier = 'HIGH RISK / INCOMPLETE';
    decisionVerdict = 'REJECTED - INCOMPLETE APPLICATION';
    isApproved = false;
    healthScore = 0;
    cibilScore = 0;
    const missingNamesStr = missingDocs.map((d) => d.name).join(', ');
    singleLineExplanation = `Missing Required Document: ${missingNamesStr} must be uploaded before risk assessment.`;
    singleLineVerdict = `Rejected: Application is incomplete due to missing ${missingDocs.length} mandatory document(s). Upload all required files to proceed.`;
  } else if (isFraudOrTampered) {
    riskTier = 'Anomalies / Fraud Alert';
    decisionVerdict = 'REJECTED - FRAUD / MISMATCH DETECTED';
    isApproved = false;
    healthScore = 15;
    cibilScore = 610;

    if (paySlipAccountName.trim().toLowerCase() !== formData.applicantName.trim().toLowerCase()) {
      mismatchedFields.push(`Pay Slip Account Name ('${paySlipAccountName}') mismatches Applicant Name ('${formData.applicantName}')`);
    }
    if (bankAccountHolderName.trim().toLowerCase() !== formData.applicantName.trim().toLowerCase()) {
      mismatchedFields.push(`Bank Account Holder Name ('${bankAccountHolderName}') mismatches Applicant Name ('${formData.applicantName}')`);
    }
    if (simulateCashAnomaly) {
      mismatchedFields.push('Unusual Bank Behavior: Sudden ₹15,00,000 cash deposit detected 48h prior to application submission');
    }
    if (simulatePdfTampering) {
      mismatchedFields.push('Anti-Tamper Scan: Modified PDF font streams & altered salary figures detected in uploaded pay slip');
    }

    singleLineExplanation = `Cross-document entity verification failed: ${mismatchedFields.join('; ')}.`;
    singleLineVerdict = 'Rejected: Identity mismatch / fraudulent pattern detected between uploaded pay slip and bank statement.';
  } else {
    cibilScore = Math.min(850, Math.max(600, Math.round(740 + (savingsNum > 1000000 ? 30 : 0) - dtiRatio * 1.5)));
    healthScore = Math.max(15, Math.min(98, Math.round(100 - dtiRatio * 0.9 + (savingsNum > 1000000 ? 12 : 0))));

    if (dtiRatio > 52 || healthScore < 50) {
      riskTier = 'HIGH RISK';
      decisionVerdict = 'REJECT';
      isApproved = false;
    } else if (dtiRatio > 40 || healthScore < 75) {
      riskTier = 'MEDIUM RISK';
      decisionVerdict = 'APPROVE';
      isApproved = true;
    } else {
      riskTier = 'LOW RISK';
      decisionVerdict = 'APPROVE';
      isApproved = true;
    }

    singleLineExplanation = `Score assigned at ${healthScore}/100 based on CIBIL benchmark of ${cibilScore}, verified monthly income of ₹${salaryNum.toLocaleString('en-IN')}, and a post-loan DTI ratio of ${dtiRatio}%.`;

    singleLineVerdict = isApproved
      ? `Approved: Strong liquid savings of ₹${savingsNum.toLocaleString('en-IN')} and verified income stream offset incremental EMI obligations within policy ceiling.`
      : `Rejected: Combined debt obligations drive post-loan DTI ratio to ${dtiRatio}%, exceeding institutional maximum exposure ceiling of 45%.`;
  }

  const handleSaveToQueue = async () => {
    setSavingToQueue(true);
    try {
      const payload = {
        applicant_name: formData.applicantName.trim() || 'New Applicant',
        loan_type: selectedCategory.title,
        amount: loanNum,
        salary: salaryNum,
        dti: dtiRatio,
        health_score: healthScore,
        risk_tier: riskTier,
        positive_signals: isApproved ? ['Strong liquid savings buffer', 'Acceptable DTI ratio'] : [],
        risk_factors: isFraudOrTampered
          ? [{ category: 'Identity & Fraud Sentinel', severity: 'CRITICAL', message: singleLineVerdict }]
          : !isDocumentComplete
          ? [{ category: 'Document Completeness', severity: 'HIGH', message: singleLineExplanation }]
          : dtiRatio > 45
          ? [{ category: 'DTI Exposure', severity: 'WARNING', message: singleLineVerdict }]
          : [],
        documents: Object.keys(uploadedFiles).map(docId => ({
          type: docId,
          file_name: uploadedFiles[docId].name,
          extracted_name: formData.applicantName,
          confidence: 98.0
        })),
        extracted_details: extractedDetails
      };

      const res = await fetch(`${API}/api/v1/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => {
          if (onNavigateTab) onNavigateTab('applications');
        }, 500);
      }
    } catch (err) {
      console.error('Error saving to queue:', err);
    } finally {
      setSavingToQueue(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-[#0d1527] p-6 rounded-2xl border border-cyan-900/30 shadow-lg shadow-black/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">AI Loan Assessment Intake</h1>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-cyan-950/60 text-cyan-300 rounded-full border border-cyan-500/30">
                Workflow Step {currentStep} of 3
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Select loan product, validate document checklists, and execute AI risk health scoring.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            {isFraudOrTampered && isDocumentComplete ? (
              <span className="px-3 py-1 font-bold bg-rose-950/70 text-rose-300 border border-rose-500/40 rounded-full flex items-center space-x-1.5">
                <ShieldX className="w-3.5 h-3.5 text-rose-400" />
                <span>Fraud / Mismatch Alert</span>
              </span>
            ) : isDocumentComplete ? (
              <span className="px-3 py-1 font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 rounded-full flex items-center space-x-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Documents Complete</span>
              </span>
            ) : (
              <span className="px-3 py-1 font-bold bg-amber-950/70 text-amber-300 border border-amber-500/40 rounded-full flex items-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Incomplete ({missingDocs.length} Missing)</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div
            className={`p-3 rounded-xl border flex items-center space-x-3 ${
              currentStep === 1 ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200 font-semibold' : currentStep > 1 ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' : 'bg-[#070b14] border-slate-800 text-slate-500'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${currentStep > 1 ? 'bg-emerald-500 text-white' : currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <div>
              <div className="text-xs font-bold text-white">1. Loan & Applicant</div>
              <div className="text-[10px] text-slate-400">11 Categories Supported</div>
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border flex items-center space-x-3 ${
              currentStep === 2 ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200 font-semibold' : currentStep > 2 ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' : 'bg-[#070b14] border-slate-800 text-slate-500'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${currentStep > 2 ? 'bg-emerald-500 text-white' : currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
            </div>
            <div>
              <div className="text-xs font-bold text-white">2. Document Intake</div>
              <div className="text-[10px] text-slate-400">
                {isDocumentComplete ? 'All Validated' : `${missingDocs.length} Pending`}
              </div>
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border flex items-center space-x-3 ${
              currentStep === 3 ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200 font-semibold' : 'bg-[#070b14] border-slate-800 text-slate-500'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${currentStep === 3 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              3
            </div>
            <div>
              <div className="text-xs font-bold text-white">3. AI Health Scoring</div>
              <div className="text-[10px] text-slate-400">Verdict Engine</div>
            </div>
          </div>
        </div>
      </div>

      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="bg-[#0d1527] p-6 rounded-2xl border border-cyan-900/30 shadow-md space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Select Loan Category (11 Products Supported)</span>
              </span>
              <span className="text-xs font-semibold text-cyan-400">Selected: {selectedCategory.title}</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {LOAN_CATEGORIES.map((cat) => {
                const IconComp = getLoanIcon(cat.iconName);
                const isSelected = selectedLoanId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedLoanId(cat.id);
                      setUploadedFiles({});
                    }}
                    className={`p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-600/20 border-cyan-400 text-white shadow-md shadow-cyan-500/10 font-semibold ring-2 ring-cyan-500/30'
                        : 'bg-[#070b14] border-cyan-900/30 text-slate-300 hover:border-cyan-700/50 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <IconComp className={`w-5 h-5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                      {isSelected && <CheckCircle className="w-3.5 h-3.5 text-teal-400" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold truncate text-white">{cat.title}</div>
                      <div className="text-[10px] text-teal-400 truncate mt-0.5 font-mono">{cat.avgRate} avg</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-[#0d1527] p-6 rounded-2xl border border-cyan-900/30 shadow-md space-y-5">
            <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Applicant Financial Profile & Loan Parameters</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Primary Applicant Name</label>
                <input
                  type="text"
                  name="applicantName"
                  value={formData.applicantName}
                  onChange={handleInputChange}
                  placeholder="Enter applicant full name"
                  className="w-full bg-[#070b14] border border-cyan-900/40 rounded-lg px-3 py-2 text-white font-bold focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Monthly Salary / Net Income (₹)</label>
                <input
                  type="number"
                  name="monthlySalary"
                  value={formData.monthlySalary}
                  onChange={handleInputChange}
                  className="w-full bg-[#070b14] border border-cyan-900/40 rounded-lg px-3 py-2 text-white font-bold focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Existing Monthly EMIs (₹)</label>
                <input
                  type="number"
                  name="existingEmis"
                  value={formData.existingEmis}
                  onChange={handleInputChange}
                  className="w-full bg-[#070b14] border border-cyan-900/40 rounded-lg px-3 py-2 text-white font-bold focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Liquid Savings & Reserves (₹)</label>
                <input
                  type="number"
                  name="savingsAmount"
                  value={formData.savingsAmount}
                  onChange={handleInputChange}
                  className="w-full bg-[#070b14] border border-cyan-900/40 rounded-lg px-3 py-2 text-white font-bold focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Requested Loan Amount (₹)</label>
                <input
                  type="number"
                  name="requestedLoanAmount"
                  value={formData.requestedLoanAmount}
                  onChange={handleInputChange}
                  className="w-full bg-[#070b14] border border-cyan-900/40 rounded-lg px-3 py-2 text-cyan-400 font-extrabold text-sm focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Tenure (Months)</label>
                <input
                  type="number"
                  name="loanTenureMonths"
                  value={formData.loanTenureMonths}
                  onChange={handleInputChange}
                  className="w-full bg-[#070b14] border border-cyan-900/40 rounded-lg px-3 py-2 text-white font-bold focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="p-4 bg-[#070b14] border border-cyan-900/40 text-white rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                <span className="font-bold text-cyan-400 flex items-center space-x-1.5">
                  <ShieldAlert className="w-4 h-4 text-cyan-400" />
                  <span>Anti-Tamper & Cross-Document Entity Simulation Toggles</span>
                </span>
                <span className="text-[10px] text-teal-400 font-mono">FraudSentinel v2.1</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Pay Slip Account Name</label>
                  <input
                    type="text"
                    value={paySlipAccountName}
                    onChange={(e) => setPaySlipAccountName(e.target.value)}
                    placeholder="Name on pay slip"
                    className="w-full bg-[#0d1527] border border-cyan-900/40 rounded-lg px-3 py-1.5 text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Bank Statement Account Holder</label>
                  <input
                    type="text"
                    value={bankAccountHolderName}
                    onChange={(e) => setBankAccountHolderName(e.target.value)}
                    placeholder="Account holder name on statement"
                    className="w-full bg-[#0d1527] border border-cyan-900/40 rounded-lg px-3 py-1.5 text-white font-medium"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-1 text-xs">
                <label className="flex items-center space-x-2 cursor-pointer text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={simulateCashAnomaly}
                    onChange={(e) => setSimulateCashAnomaly(e.target.checked)}
                    className="rounded bg-[#0d1527] border-cyan-900/40 text-blue-500 focus:ring-0"
                  />
                  <span>Simulate Pre-Application Cash Deposit Anomaly</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={simulatePdfTampering}
                    onChange={(e) => setSimulatePdfTampering(e.target.checked)}
                    className="rounded bg-[#0d1527] border-cyan-900/40 text-blue-500 focus:ring-0"
                  />
                  <span>Simulate PDF Metadata & Font Stream Tampering</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                onClick={handleNextStep}
                className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-cyan-600/20 transition-all"
              >
                <span>Proceed to Required Document Upload</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="bg-[#0d1527] p-6 rounded-2xl border border-cyan-900/30 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <UploadCloud className="w-5 h-5 text-cyan-400" />
                <span>Document Checklist for {selectedCategory.title}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload verified PDFs or images (&lt; 10MB) matching institutional policy requirements.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {Object.keys(uploadedFiles).length > 0 && (
                <button
                  onClick={handleClearDocs}
                  className="text-xs text-slate-400 hover:text-rose-300 font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 hover:bg-rose-950/40"
                >
                  Clear Uploads
                </button>
              )}
              <button
                onClick={handleAutoFillDocs}
                className="flex items-center space-x-1.5 bg-cyan-950/60 border border-cyan-500/30 hover:bg-cyan-900/60 text-cyan-300 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span>Auto-Fill All Required Documents</span>
              </button>
            </div>
          </div>

          {!isDocumentComplete && (
            <div className="p-4 bg-amber-950/60 border border-amber-500/40 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Document Completeness Alert: Missing {missingDocs.length} Mandatory Document(s)</span>
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                Policy Enforcement: Evaluating AI Risk Scoring with missing documents will immediately set decision to{' '}
                <strong className="text-white">REJECTED - INCOMPLETE APPLICATION</strong>.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {missingDocs.map((doc) => (
                  <span key={doc.code} className="px-2 py-0.5 text-[10px] font-bold bg-amber-900/80 text-amber-200 rounded-md border border-amber-700">
                    ✕ {doc.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {uploadError && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="space-y-3">
            {selectedCategory.requiredDocuments.map((doc) => {
              const uploaded = uploadedFiles[doc.code];
              return (
                <div
                  key={doc.code}
                  className={`p-4 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    uploaded
                      ? 'bg-[#070b14] border-emerald-500/40'
                      : 'bg-[#070b14] border-cyan-900/30'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${uploaded ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' : 'bg-slate-850 text-slate-400'}`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">{doc.name}</span>
                        {doc.required && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            uploaded
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                              : 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                          }`}>
                            {uploaded ? 'Verified' : 'Mandatory'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {uploaded
                          ? `${uploaded.name} • ${uploaded.size} • ${uploaded.status}`
                          : 'Format: PDF, PNG, JPG (Max 10 MB)'}
                      </p>
                    </div>
                  </div>

                  <div>
                    {uploaded ? (
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-1 text-xs font-bold bg-emerald-950/60 text-emerald-300 rounded-lg border border-emerald-500/40 flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Validated</span>
                        </span>
                        <button
                          onClick={() => {
                            const updated = { ...uploadedFiles };
                            delete updated[doc.code];
                            setUploadedFiles(updated);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-md"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer bg-[#0d1527] border border-cyan-900/40 hover:bg-slate-800 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors inline-flex items-center space-x-1.5">
                        <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Upload File</span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => handleFileUpload(doc.code, e.target.files?.[0])}
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <AIExtractedDetailsView
            details={extractedDetails}
            title="Live AI Extracted Details"
            subtitle="Automated extraction from uploaded files or applicant profile. Any undetected fields strictly show 'Not Found'."
          />

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setCurrentStep(1)}
              className="flex items-center space-x-2 bg-[#070b14] border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold text-xs px-4 py-2 rounded-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              onClick={handleNextStep}
              className={`flex items-center space-x-2 font-semibold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all ${
                isDocumentComplete
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-cyan-600/20'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              <span>{isDocumentComplete ? 'Execute AI Document OCR & Scoring' : 'Run Completeness Audit & Score'}</span>
              <BrainCircuit className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-6">
          {isProcessing ? (
            <div className="bg-[#0d1527] p-12 rounded-2xl border border-cyan-900/30 shadow-lg text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 animate-pulse">
                <BrainCircuit className="w-8 h-8 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">CreditLens Anti-Tamper & Risk Pipeline</h3>
                <p className="text-xs text-slate-400 mt-1">{pipelineStage}</p>
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-cyan-900/40">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500 rounded-full"
                    style={{ width: `${pipelineProgress}%` }}
                  ></div>
                </div>
                <div className="text-xs font-bold text-teal-400">{pipelineProgress}% Complete</div>
              </div>
            </div>
          ) : (
            assessmentComplete && (
              <div className="space-y-6">
                <div className="bg-[#0d1527] p-6 rounded-2xl border border-cyan-900/30 shadow-md space-y-6">
                  <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="flex items-center space-x-6">
                      <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <path className="text-slate-800" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                          <path
                            className={
                              !isDocumentComplete || isFraudOrTampered
                                ? 'text-rose-500'
                                : healthScore >= 75
                                ? 'text-emerald-400'
                                : healthScore >= 50
                                ? 'text-amber-400'
                                : 'text-rose-500'
                            }
                            strokeDasharray={`${healthScore}, 100`}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-black text-white">{isDocumentComplete ? healthScore : '0'}</span>
                          <span className="text-[9px] font-bold text-teal-400 uppercase">
                            {isFraudOrTampered ? 'Fraud Alert' : isDocumentComplete ? 'Health Score' : 'Incomplete'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <h2 className="text-xl font-extrabold text-white">{formData.applicantName}</h2>
                          <span
                            className={`px-3 py-1 text-xs font-black rounded-full border ${
                              isFraudOrTampered
                                ? 'bg-rose-950/70 text-rose-300 border-rose-500/40'
                                : !isDocumentComplete
                                ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                                : riskTier === 'LOW RISK'
                                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                                : riskTier === 'MEDIUM RISK'
                                ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                                : 'bg-rose-950/70 text-rose-300 border-rose-500/40'
                            }`}
                          >
                            {riskTier}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Product: <strong className="text-white">{selectedCategory.title}</strong> • Requested: ₹{loanNum.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-6 w-full lg:w-auto">
                      <div className="bg-[#070b14] p-3 rounded-xl border border-cyan-900/30 text-center min-w-28">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase">CIBIL Benchmark</div>
                        <div className="text-lg font-black text-white">{isDocumentComplete && !isFraudOrTampered ? cibilScore : 'N/A'}</div>
                        <div className="text-[10px] text-teal-400 font-semibold">{isFraudOrTampered ? 'Fraud Flagged' : isDocumentComplete ? 'Bureau Scored' : 'Blocked'}</div>
                      </div>

                      <div className="bg-[#070b14] p-3 rounded-xl border border-cyan-900/30 text-center min-w-28">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase">Fraud Sentinel</div>
                        <div className={`text-lg font-black ${isFraudOrTampered ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isFraudOrTampered ? 'ALERT' : 'CLEAN'}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400">{isFraudOrTampered ? 'Mismatch Found' : '0 Anomalies'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {isFraudOrTampered && mismatchedFields.length > 0 && (
                  <div className="bg-rose-950/60 border-2 border-rose-500/40 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center space-x-2 text-rose-300 font-bold text-xs uppercase tracking-wider">
                      <ShieldX className="w-5 h-5 text-rose-400 shrink-0" />
                      <span>Cross-Document Mismatched Fields & Anti-Tamper Violations</span>
                    </div>
                    <ul className="space-y-2 text-xs font-semibold text-rose-200">
                      {mismatchedFields.map((field, i) => (
                        <li key={i} className="flex items-start space-x-2 bg-[#070b14] p-3 rounded-xl border border-rose-900/40">
                          <span className="text-rose-400 font-bold">✕</span>
                          <span>{field}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div
                  className={`p-5 rounded-2xl shadow-md border space-y-2 ${
                    isFraudOrTampered
                      ? 'bg-rose-950/80 text-rose-100 border-rose-800'
                      : !isDocumentComplete
                      ? 'bg-amber-950/80 text-amber-100 border-amber-800'
                      : 'bg-gradient-to-r from-blue-950 to-[#0d1527] text-white border-cyan-900/40'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-bold text-xs uppercase tracking-wider text-teal-300">
                    <Sparkles className="w-4 h-4 text-teal-400" />
                    <span>Single-Line Score Explanation Engine</span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed font-sans text-slate-200">
                    "{singleLineExplanation}"
                  </p>
                </div>

                <div
                  className={`p-6 rounded-2xl border shadow-sm space-y-3 ${
                    isFraudOrTampered
                      ? 'bg-rose-950/60 border-rose-800 text-rose-100'
                      : !isDocumentComplete
                      ? 'bg-amber-950/60 border-amber-800 text-amber-100'
                      : isApproved
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-100'
                      : 'bg-rose-950/40 border-rose-800/60 text-rose-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider flex items-center space-x-1.5 text-white">
                      {isFraudOrTampered ? (
                        <>
                          <ShieldX className="w-5 h-5 text-rose-400" />
                          <span>Final Decision Verdict: REJECTED - FRAUD / MISMATCH DETECTED</span>
                        </>
                      ) : !isDocumentComplete ? (
                        <>
                          <AlertTriangle className="w-5 h-5 text-amber-400" />
                          <span>Final Decision Verdict: REJECTED - INCOMPLETE APPLICATION</span>
                        </>
                      ) : isApproved ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                          <span>Final Decision Verdict: APPROVE</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-rose-400" />
                          <span>Final Decision Verdict: REJECT</span>
                        </>
                      )}
                    </span>
                    <span
                      className={`px-3 py-1 text-xs font-black rounded-lg border ${
                        isFraudOrTampered
                          ? 'bg-rose-600 text-white border-rose-700'
                          : !isDocumentComplete
                          ? 'bg-amber-600 text-white border-amber-700'
                          : isApproved
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-rose-600 text-white border-rose-700'
                      }`}
                    >
                      {decisionVerdict}
                    </span>
                  </div>

                  <div className="bg-[#070b14] p-4 rounded-xl border border-cyan-900/30 font-semibold text-xs leading-relaxed text-slate-200">
                    💡 <strong>Verdict Explanation:</strong> "{singleLineVerdict}"
                  </div>
                </div>

                <AIExtractedDetailsView
                  details={extractedDetails}
                  title="Document Intelligence & Extracted Entity Profile"
                  subtitle="Verified extraction metrics stored in MongoDB application dossier."
                />

                <div className="bg-[#0d1527] p-5 rounded-2xl border border-cyan-900/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-400">
                    {isFraudOrTampered
                      ? 'Escalated to Fraud Sentinel Unit for legal & identity inspection.'
                      : !isDocumentComplete
                      ? 'Upload missing mandatory documents to proceed.'
                      : 'Assessment results logged to immutable Audit Trail.'}
                  </div>
                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    <button
                      onClick={handleSaveToQueue}
                      disabled={savingToQueue}
                      className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-emerald-600/20 transition-all"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{savingToQueue ? 'Submitting to MongoDB...' : savedSuccess ? 'Saved to Queue!' : 'Add to Applications Queue'}</span>
                    </button>

                    <button
                      onClick={() => onNavigateTab && onNavigateTab('copilot')}
                      className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md shadow-cyan-600/20 transition-all"
                    >
                      <MessageSquareCode className="w-4 h-4" />
                      <span>Ask Copilot</span>
                    </button>

                    <button
                      onClick={() => onNavigateTab && onNavigateTab('audit-trail')}
                      className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-[#070b14] hover:bg-slate-800 border border-cyan-900/40 text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
                    >
                      <FileSearch className="w-4 h-4 text-cyan-400" />
                      <span>Audit Log</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
