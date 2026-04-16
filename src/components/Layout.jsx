import { useState } from 'react';
import { useApp } from '../store/AppContext';
import {
  Star, LayoutDashboard, User, ClipboardList, Briefcase, Users,
  Settings, LogOut, Menu, X, ChevronRight, Shield, Eye, UserCog
} from 'lucide-react';

const NAV = {
  employee: [
    { id: 'emp-dashboard',   label: 'Dashboard',           icon: LayoutDashboard },
    { id: 'emp-profile',     label: 'My Profile',          icon: User },
    { id: 'emp-assessment',  label: 'Self Assessment',      icon: Star },
    { id: 'emp-assignments', label: 'My Assignments',       icon: Briefcase },
    { id: 'emp-nominations', label: 'Nominate Reviewers',   icon: Users },
  ],
  reviewer: [
    { id: 'rev-dashboard',   label: 'Dashboard',           icon: LayoutDashboard },
    { id: 'rev-assessment',  label: 'Rate Employee',        icon: ClipboardList },
  ],
  admin: [
    { id: 'adm-dashboard',   label: 'Dashboard',           icon: LayoutDashboard },
    { id: 'adm-employees',   label: 'Employees',            icon: UserCog },
    { id: 'adm-profiles',    label: 'Reviewer Profiles',    icon: Users },
    { id: 'adm-progress',    label: 'Track Progress',       icon: Eye },
    { id: 'adm-templates',   label: 'Assessment Templates', icon: Settings },
    { id: 'adm-export',      label: 'Export Data',          icon: ClipboardList },
  ],
};

const ROLE_BADGE = {
  admin:    { label: 'Administrator', cls: 'bg-purple-100 text-purple-700' },
  employee: { label: 'Employee',      cls: 'bg-emerald-100 text-emerald-700' },
  reviewer: { label: 'Reviewer',      cls: 'bg-blue-100 text-blue-700' },
};

export default function Layout({ page, onNavigate, children }) {
  const { currentUser, logout } = useApp();
  const [mOpen, setMOpen] = useState(false);
  const items = NAV[currentUser?.role] || [];
  const badge = ROLE_BADGE[currentUser?.role] || ROLE_BADGE.employee;

  const SideContent = () => (
    <>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <Star size={17} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-800 leading-tight">360° Assessment</div>
            <div className="text-xs text-gray-500">Power Skills Tool</div>
          </div>
        </div>
      </div>

      {/* User card */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">{currentUser?.name?.[0]?.toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-800 truncate">{currentUser?.name}</div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {items.map(item => {
          const active = page === item.id;
          return (
            <button key={item.id} onClick={() => { onNavigate(item.id); setMOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium mb-0.5 transition-all
                ${active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
              <item.icon size={17} className={active ? 'text-indigo-600' : 'text-gray-400'} />
              <span className="flex-1 text-left">{item.label}</span>
              {active && <ChevronRight size={13} className="text-indigo-400" />}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all">
          <LogOut size={17} className="text-gray-400" />Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col flex-shrink-0 shadow-sm">
        <SideContent />
      </aside>

      {/* Mobile sidebar */}
      {mOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMOpen(false)} />
          <aside className="relative w-72 h-full bg-white shadow-2xl flex flex-col">
            <button onClick={() => setMOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><X size={18} /></button>
            <SideContent />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100" onClick={() => setMOpen(true)}><Menu size={20} /></button>
            <div className="hidden sm:flex items-center gap-2">
              {currentUser?.role === 'admin' && <Shield size={14} className="text-purple-500" />}
              <span className="text-sm font-medium text-gray-600">{items.find(n => n.id === page)?.label || 'Dashboard'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center">
              <span className="text-white text-xs font-bold">{currentUser?.name?.[0]?.toUpperCase()}</span>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-5xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
