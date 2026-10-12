import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  MessageSquare, 
  GitCompare, 
  BarChart3, 
  Settings, 
  ShieldCheck, 
  Database,
  LogOut,
  Sparkles
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, stats, onOpenAuth, user, onLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'documents', label: 'Knowledge Base', icon: FileText, badge: stats?.documents?.count },
    { id: 'chat', label: 'AI Assistant', icon: MessageSquare },
    { id: 'comparison', label: 'RAG vs Basic LLM', icon: GitCompare },
    { id: 'evaluation', label: 'Evaluation Studio', icon: BarChart3 },
    { id: 'settings', label: 'Configuration', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-dark-sidebar border-r border-dark-border flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-dark-border/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-white flex items-center gap-1.5">
              Enterprise RAG
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
                PRO
              </span>
            </h1>
            <p className="text-[11px] text-gray-400">Knowledge & Evaluation</p>
          </div>
        </div>

        {/* Quick System Badge */}
        <div className="px-4 py-3 mx-3 my-3 rounded-lg bg-gray-900/60 border border-gray-800/80 text-xs">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="flex items-center gap-1 text-[11px]">
              <Database className="w-3 h-3 text-emerald-400" /> Vector Index
            </span>
            <span className="text-emerald-400 font-mono text-[11px]">FAISS</span>
          </div>
          <div className="flex items-center justify-between text-gray-300 font-medium">
            <span>Indexed Chunks:</span>
            <span className="font-semibold text-white">{stats?.documents?.chunks_count || 0}</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="px-3 py-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-300 font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User profile / Auth footer */}
      <div className="p-4 border-t border-dark-border/80">
        <div className="flex items-center justify-between p-2 rounded-lg bg-gray-900/80 border border-gray-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
              {user?.username ? user.username[0] : 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-200 truncate">{user?.username || 'Guest Demo'}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email || 'demo@enterprise.ai'}</p>
            </div>
          </div>
          {user ? (
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="text-[11px] px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
