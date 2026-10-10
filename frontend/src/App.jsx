import React, { useState, useEffect } from 'react';
import LoginView from './components/LoginView';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import AssessmentWizard from './components/AssessmentWizard';
import CopilotChat from './components/CopilotChat';
import ScenarioSimulator from './components/ScenarioSimulator';
import AuditTrailView from './components/AuditTrailView';
import SecurityView from './components/SecurityView';
import ApplicationDetail from './components/ApplicationDetail';
import {
  ApplicationsView,
  AnalyticsView,
  ForecastsView,
  ReportsView,
  ResponsibleAIView,
  SettingsView
} from './components/TabViews';
import { Bell, Search, ShieldCheck, Sparkles, User, LogOut } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState({
    name: 'Alex Reynolds',
    email: 'officer@bank.creditlens.ai',
    roleId: 'bank',
    roleTitle: 'Banks',
    institution: 'HDFC Enterprise Credit'
  });

  const [activeTab, setActiveTab]               = useState('dashboard');
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [applicantCount, setApplicantCount]     = useState(0);
  const [assessmentCount, setAssessmentCount]   = useState(0);

  const fetchApplicantCount = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/applications');
      if (res.ok) {
        const data = await res.json();
        setApplicantCount(data.total ?? data.applications?.length ?? 0);
      }
    } catch {
    }
  };

  useEffect(() => {
    fetchApplicantCount();
  }, [assessmentCount]);

  const handleLogin = (userData) => {
    setCurrentUser(userData);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  const tabTitles = {
    dashboard:           'Executive Dashboard',
    applications:        'Loan Applications Queue',
    'application-detail':'Application Detail & Underwriter Review',
    'new-assessment':    'Loan Selection & Intake Wizard',
    'risk-analytics':    'Portfolio Risk Analytics',
    simulator:           'Scenario Simulator',
    forecasts:           'Macroeconomic Loss Forecasts',
    copilot:             'AI Financial Copilot Assistant',
    reports:             'Compliance & Audit Reports',
    'audit-trail':       'Live Audit Trail & Status Monitor',
    security:            'Integrated Security Center',
    'responsible-ai':    'Responsible AI & Explainability',
    settings:            'Risk Policy Threshold Settings'
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            currentUser={currentUser}
            refetchTrigger={assessmentCount}
            onNavigateToAssessment={() => setActiveTab('new-assessment')}
            onSelectApplication={(app) => {
              setSelectedApplication(app);
              setActiveTab('new-assessment');
            }}
          />
        );
      case 'applications':
        return (
          <ApplicationsView
            refetchTrigger={assessmentCount}
            onSelectApp={(app) => {
              setSelectedApplication(app);
              setActiveTab('application-detail');
            }}
            onNavigateToAssessment={() => setActiveTab('new-assessment')}
            onApplicantAdded={() => {
              setAssessmentCount(c => c + 1);
              fetchApplicantCount();
            }}
          />
        );
      case 'application-detail':
        return (
          <ApplicationDetail
            app={selectedApplication}
            currentUser={currentUser}
            onBack={() => setActiveTab('applications')}
          />
        );
      case 'new-assessment':
        return (
          <AssessmentWizard
            initialApplication={selectedApplication}
            userRole={currentUser?.roleTitle}
            onNavigateTab={(tab) => {
              if (tab === 'applications') {
                setAssessmentCount(c => c + 1);
                fetchApplicantCount();
              }
              setActiveTab(tab);
            }}
          />
        );
      case 'risk-analytics':
        return <AnalyticsView />;
      case 'simulator':
        return <ScenarioSimulator />;
      case 'forecasts':
        return <ForecastsView />;
      case 'copilot':
        return <CopilotChat onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'reports':
        return <ReportsView />;
      case 'audit-trail':
        return <AuditTrailView />;
      case 'security':
        return <SecurityView currentUser={currentUser} />;
      case 'responsible-ai':
        return <ResponsibleAIView />;
      case 'settings':
        return <SettingsView />;
      default:
        return (
          <DashboardView
            currentUser={currentUser}
            refetchTrigger={assessmentCount}
            onNavigateToAssessment={() => setActiveTab('new-assessment')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] font-sans text-slate-100 flex antialiased selection:bg-cyan-500 selection:text-white">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        applicantCount={applicantCount}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen bg-[#070b14]">
        <header className="h-16 bg-[#0b1220]/90 backdrop-blur-md border-b border-cyan-900/30 px-6 flex items-center justify-between sticky top-0 z-30 shadow-lg shadow-black/20">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-bold text-white tracking-tight">
              {tabTitles[activeTab] || 'Executive Dashboard'}
            </h2>
            <span className="hidden md:inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 shadow-xs shadow-cyan-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
              <span>{currentUser.roleTitle} Portal</span>
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-bold text-slate-200 leading-tight">{currentUser.institution}</div>
              <div className="text-[10px] text-teal-400 font-mono font-medium flex items-center justify-end space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                <span>Session Active</span>
              </div>
            </div>

            <button className="relative p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors border border-slate-800/80">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-cyan-400 rounded-full ring-2 ring-[#0b1220]"></span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 text-xs font-semibold text-slate-300 hover:text-rose-300 bg-slate-900/80 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/50 px-3 py-1.5 rounded-xl transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch Role</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}
