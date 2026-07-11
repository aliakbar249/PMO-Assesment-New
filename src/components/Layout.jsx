import { useState } from 'react';
import { useApp } from '../store/AppContext';
import {
  Star, LayoutDashboard, User, ClipboardList, Briefcase, Users,
  Settings, LogOut, Menu, X, ChevronRight, Shield, Eye, UserCog, Building2,
  Target, BookOpen, Library, LayoutTemplate, GitBranch, Network, Sliders, Zap, Map, MapPin, UserCheck,
} from 'lucide-react';

// NAV structure: each entry is either a nav item { id, label, icon }
// or a section divider { section: 'Label' } for grouped headings.
const NAV = {
  employee: [
    { id: 'emp-dashboard',   label: 'Dashboard',         icon: LayoutDashboard },
    { id: 'emp-profile',     label: 'My Profile',        icon: User },
    { id: 'emp-assessment',  label: 'Self Assessment',   icon: Star },
    { id: 'emp-assignments', label: 'My Assignments',    icon: Briefcase },
    { id: 'emp-nominations', label: 'Nominate Reviewers',icon: Users },
    { id: 'emp-training',    label: 'My Training',       icon: BookOpen },
  ],
  reviewer: [
    { id: 'rev-dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
    { id: 'rev-assessment', label: 'Rate Employee', icon: ClipboardList },
  ],
  admin: [
    { id: 'adm-dashboard',     label: 'Dashboard',             icon: LayoutDashboard },

    { section: 'Organisation' },
    { id: 'adm-companies',     label: 'Companies',             icon: Building2 },
    { id: 'adm-employees',     label: 'Employees',             icon: UserCog },
    { id: 'adm-profiles',      label: 'Reviewer Profiles',     icon: Users },
    { id: 'adm-org-chart',     label: 'Org Chart',             icon: Network },

    { section: 'Configuration' },
    { id: 'adm-hier-levels',   label: 'Hierarchy Levels',      icon: GitBranch },
    { id: 'adm-org-units',     label: 'Org Units',             icon: Map },
    { id: 'adm-positions',     label: 'Positions',             icon: MapPin },
    { id: 'adm-occupancy',     label: 'Position Occupancy',    icon: UserCheck },
    { id: 'adm-custom-fields', label: 'Custom Fields',         icon: Sliders },
    { id: 'adm-auto-rules',    label: 'Auto-Assignment Rules', icon: Zap },

    { section: 'Assessments' },
    { id: 'adm-templates',     label: 'Assessment Templates',  icon: Settings },
    { id: 'adm-progress',      label: 'Track Progress',        icon: Eye },

    { section: 'KPI Management' },
    { id: 'adm-kpi-lib',       label: 'KPI Library',           icon: Library },
    { id: 'adm-kpi-builder',   label: 'Template Builder',      icon: LayoutTemplate },
    { id: 'adm-kpis',          label: 'KPI Dashboard',         icon: Target },

    { section: 'Training' },
    { id: 'adm-training',      label: 'Training Targets',      icon: BookOpen },

    { section: 'Reports' },
    { id: 'adm-export',        label: 'Export Data',           icon: ClipboardList },
  ],
  company_admin: [
    { id: 'co-dashboard', label: 'Assessment Dashboard', icon: LayoutDashboard },
    { section: 'KPI Management' },
    { id: 'co-kpis',      label: 'KPI Dashboard',     icon: Target },
    { section: 'Training' },
    { id: 'co-training',  label: 'Training Targets',  icon: BookOpen },
  ],
};

const ROLE_BADGE = {
  admin:         { label: 'Administrator', cls: 'bg-purple-100 text-purple-700' },
  company_admin: { label: 'Company Admin', cls: 'bg-amber-100 text-amber-700'  },
  employee:      { label: 'Employee',      cls: 'bg-emerald-100 text-emerald-700' },
  reviewer:      { label: 'Reviewer',      cls: 'bg-blue-100 text-blue-700' },
};

export default function Layout({ page, onNavigate, children }) {
  const { currentUser, logout } = useApp();
  const [mOpen, setMOpen] = useState(false);
  const items = NAV[currentUser?.role] || [];
  const badge = ROLE_BADGE[currentUser?.role] || ROLE_BADGE.employee;

  const SideContent = () => (
    <>
      {/* Brand — teal bar matching login header */}
      <div className="flex items-center justify-center gap-2.5 px-4 flex-shrink-0" style={{background:'#01A2B1', padding:'22px 16px'}}>
        <img
          src="/optem-logo.png"
          alt="Optem Consulting"
          className="w-auto object-contain flex-shrink-0"
          style={{height: 32}}
          onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex'; }}
        />
        {/* Hex monogram fallback */}
        <svg style={{display:'none'}} width="31" height="31" viewBox="0 0 28 28" fill="none" className="flex-shrink-0">
          <polygon points="14,2 25,8 25,20 14,26 3,20 3,8" fill="rgba(255,255,255,0.15)"/>
          <polygon points="14,5 23,10 23,18 14,23 5,18 5,10" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.7"/>
          <text x="14" y="17" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff" fontFamily="sans-serif">OA</text>
        </svg>
        <div>
          <div className="font-bold text-white leading-tight" style={{fontSize: 13, letterSpacing:'0.05em'}}>OPTEM ACUITY</div>
          <div className="text-white leading-tight" style={{fontSize: 10, opacity: 0.65, letterSpacing:'0.05em'}}>by Optem Consulting</div>
        </div>
      </div>

      {/* User card */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{background:'#110941'}}>
            <span className="text-white text-sm font-bold">{currentUser?.name?.[0]?.toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-800 truncate">{currentUser?.name}</div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {items.map((item, idx) => {
          // Section divider
          if (item.section) {
            return (
              <div key={`sec-${idx}`} className="px-3 pt-4 pb-1">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{item.section}</span>
              </div>
            );
          }

          const active = page === item.id;

          // Sub-menu item — indented under parent, with connector dot
          if (item.sub) {
            return (
              <div key={item.id} className="flex items-stretch ml-3.5">
                {/* Vertical connector line */}
                <div className="flex flex-col items-center w-5 flex-shrink-0">
                  <div className="w-px flex-1 bg-gray-200" />
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mb-1 ${active ? '' : 'bg-gray-300'}`}
                    style={active ? {background:'#01A2B1'} : {}} />
                </div>
                <button
                  onClick={() => { onNavigate(item.id); setMOpen(false); }}
                  className={`relative flex-1 flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-r-xl text-xs font-medium mb-0.5 transition-all
                    ${active ? 'text-[#01A2B1]' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
                  style={active ? {background:'rgba(1,162,177,0.07)'} : {}}
                >
                  {active && <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r" style={{background:'#01A2B1'}} />}
                  <item.icon size={13} className={active ? 'text-[#01A2B1]' : 'text-gray-300'} />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              </div>
            );
          }

          // Standard nav button
          return (
            <button key={item.id} onClick={() => { onNavigate(item.id); setMOpen(false); }}
              className={`relative w-full flex items-center gap-3 px-3.5 py-2 rounded-r-xl text-sm font-medium mb-0.5 transition-all
                ${active ? 'text-[#01A2B1] font-medium' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
              style={active ? {background:'rgba(1,162,177,0.07)'} : {}}
            >
              {active && (
                <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r" style={{background:'#01A2B1'}} />
              )}
              <item.icon size={16} className={active ? 'text-[#01A2B1]' : 'text-gray-400'} />
              <span className="flex-1 text-left">{item.label}</span>
              {active && <ChevronRight size={13} className="text-[#01A2B1] opacity-60" />}
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
              {currentUser?.role === 'admin'         && <Shield   size={14} className="text-purple-500" />}
            {currentUser?.role === 'company_admin'  && <Building2 size={14} className="text-amber-500" />}
              <span className="text-sm font-medium text-gray-600">{items.find(n => n.id && n.id === page)?.label || 'Dashboard'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{background:'#01A2B1'}}>
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
