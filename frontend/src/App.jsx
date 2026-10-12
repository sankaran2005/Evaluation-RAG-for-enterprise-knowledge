import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import AuthModal from './components/AuthModal';
import DashboardView from './views/DashboardView';
import DocumentsView from './views/DocumentsView';
import ChatView from './views/ChatView';
import ComparisonView from './views/ComparisonView';
import EvaluationView from './views/EvaluationView';
import SettingsView from './views/SettingsView';
import { api } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [statsData, docsData, settingsData] = await Promise.all([
        api.getStats().catch(() => null),
        api.getDocuments().catch(() => ({ documents: [] })),
        api.getSettings().catch(() => null),
      ]);

      if (statsData) setStats(statsData);
      if (docsData?.documents) setDocuments(docsData.documents);
      if (settingsData) setSettings(settingsData);

      // Check current user if token exists
      const token = localStorage.getItem('rag_token');
      if (token) {
        try {
          const userData = await api.getMe();
          setUser(userData);
        } catch (e) {
          localStorage.removeItem('rag_token');
        }
      }
    } catch (err) {
      console.error('Error loading initial enterprise data:', err);
    }
  };

  const handleRefreshStats = async () => {
    try {
      const statsData = await api.getStats();
      setStats(statsData);
    } catch (e) {}
  };

  const handleRefreshDocuments = async () => {
    try {
      const docsData = await api.getDocuments();
      if (docsData?.documents) setDocuments(docsData.documents);
      handleRefreshStats();
    } catch (e) {}
  };

  const handleRefreshSettings = async () => {
    try {
      const settingsData = await api.getSettings();
      setSettings(settingsData);
    } catch (e) {}
  };

  const handleTriggerEvaluation = async () => {
    setActiveTab('evaluation');
  };

  const handleLogout = () => {
    localStorage.removeItem('rag_token');
    setUser(null);
  };

  return (
    <div className="flex h-screen bg-dark-bg text-gray-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          activeTab={activeTab}
          settings={settings}
          stats={stats}
        />

        <main className="flex-1 overflow-y-auto px-8 py-6">
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              setActiveTab={setActiveTab}
              onTriggerEvaluation={handleTriggerEvaluation}
              evalLoading={evalLoading}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentsView
              documents={documents}
              onRefresh={handleRefreshDocuments}
              stats={stats}
            />
          )}

          {activeTab === 'chat' && (
            <ChatView
              documents={documents}
              stats={stats}
              onRefreshStats={handleRefreshStats}
            />
          )}

          {activeTab === 'comparison' && (
            <ComparisonView
              onRefreshStats={handleRefreshStats}
            />
          )}

          {activeTab === 'evaluation' && (
            <EvaluationView
              onRefreshStats={handleRefreshStats}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              onRefreshSettings={handleRefreshSettings}
              currentSettings={settings}
            />
          )}
        </main>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(u) => setUser(u)}
      />
    </div>
  );
}
