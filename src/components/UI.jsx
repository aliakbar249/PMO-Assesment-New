import { useState } from 'react';
import { ChevronDown, ChevronUp, Info, X } from 'lucide-react';

// ─── Card ──────────────────────────────────────────────────────
export function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 ${className}`}>{children}</div>;
}

export function CardHeader({ title, subtitle, icon: Icon, action }) {
  return (
    <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon && <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0"><Icon size={18} className="text-indigo-600" /></div>}
        <div><h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}</div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ─── Button ────────────────────────────────────────────────────
export function Button({ children, variant = 'primary', size = 'md', className = '', disabled, onClick, type = 'button', ...rest }) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed';
  const V = {
    primary:   'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-400 disabled:bg-indigo-300',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-300 disabled:opacity-50',
    danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-400 disabled:opacity-50',
    success:   'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-400 disabled:opacity-50',
    ghost:     'text-indigo-600 hover:bg-indigo-50 focus:ring-indigo-300 disabled:opacity-50',
    warning:   'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-300 disabled:opacity-50',
    outline:   'border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 focus:ring-indigo-300 disabled:opacity-50',
  };
  const S = { xs: 'text-xs px-3 py-1.5', sm: 'text-sm px-3.5 py-2', md: 'text-sm px-4 py-2.5', lg: 'text-base px-6 py-3' };
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      className={`${base} ${V[variant] || V.primary} ${S[size] || S.md} ${className}`} {...rest}>
      {children}
    </button>
  );
}

// ─── Form controls ─────────────────────────────────────────────
export function Input({ label, error, hint, required, className = '', wrapClass = '', ...props }) {
  return (
    <div className={wrapClass}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>}
      <input className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 bg-white placeholder-gray-400
        ${error ? 'border-red-400 focus:ring-red-200 bg-red-50' : 'border-gray-300 focus:border-indigo-400 focus:ring-indigo-100'} ${className}`} {...props} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function Select({ label, error, required, wrapClass = '', children, ...props }) {
  return (
    <div className={wrapClass}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>}
      <select className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 bg-white
        ${error ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:border-indigo-400 focus:ring-indigo-100'}`} {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, required, wrapClass = '', ...props }) {
  return (
    <div className={wrapClass}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>}
      <textarea className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 bg-white placeholder-gray-400 resize-none
        ${error ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:border-indigo-400 focus:ring-indigo-100'}`} rows={3} {...props} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Badge ─────────────────────────────────────────────────────
export function Badge({ children, variant = 'default', size = 'sm', className = '' }) {
  const V = {
    default:  'bg-gray-100 text-gray-700',
    primary:  'bg-indigo-100 text-indigo-700',
    success:  'bg-emerald-100 text-emerald-700',
    warning:  'bg-amber-100 text-amber-700',
    danger:   'bg-red-100 text-red-700',
    info:     'bg-blue-100 text-blue-700',
    purple:   'bg-purple-100 text-purple-700',
  };
  const S = { xs: 'text-xs px-1.5 py-0.5', sm: 'text-xs px-2 py-0.5', md: 'text-sm px-2.5 py-1' };
  return <span className={`inline-flex items-center rounded-full font-medium ${V[variant]} ${S[size]} ${className}`}>{children}</span>;
}

// ─── ProgressBar ───────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = 'indigo', label, showPercent = true, className = '' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const C = { indigo: 'bg-indigo-500', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-blue-500' };
  return (
    <div className={className}>
      {(label || showPercent) && <div className="flex justify-between text-xs text-gray-500 mb-1">{label && <span>{label}</span>}{showPercent && <span>{pct}%</span>}</div>}
      <div className="w-full bg-gray-100 rounded-full h-2"><div className={`${C[color] || C.indigo} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

// ─── Alert ─────────────────────────────────────────────────────
export function Alert({ type = 'info', children, className = '' }) {
  const S = { info: 'bg-blue-50 border-blue-200 text-blue-800', success: 'bg-emerald-50 border-emerald-200 text-emerald-800', warning: 'bg-amber-50 border-amber-200 text-amber-800', error: 'bg-red-50 border-red-200 text-red-800' };
  return <div className={`px-4 py-3 rounded-xl border text-sm ${S[type]} ${className}`}>{children}</div>;
}

// ─── Modal ─────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  const S = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${S[size]} max-h-[92vh] flex flex-col`}>
        {title && (
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <h2 className="text-base font-semibold text-gray-800">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X size={16} /></button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Step Indicator ────────────────────────────────────────────
export function StepIndicator({ steps, current }) {
  return (
    <div className="flex items-center justify-center mb-8 overflow-x-auto pb-1 gap-0">
      {steps.map((step, i) => {
        const done = i < current, active = i === current;
        return (
          <div key={i} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-gray-200 text-gray-500'}`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-xs mt-1 text-center max-w-20 leading-tight hidden sm:block ${active ? 'text-indigo-600 font-medium' : 'text-gray-500'}`}>{step}</span>
            </div>
            {i < steps.length - 1 && <div className={`h-0.5 w-8 sm:w-12 mx-1 mb-4 sm:mb-5 ${done ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── TipBox ────────────────────────────────────────────────────
export function TipBox({ content, label = 'Show rating guidance' }) {
  const [show, setShow] = useState(false);
  if (!content) return null;
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setShow(!show)}
        className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
        <Info size={13} />{show ? 'Hide guidance' : label}
      </button>
      {show && <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed">{content}</div>}
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon: Icon, color = 'indigo' }) {
  const C = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green:  'bg-emerald-50 text-emerald-600',
    amber:  'bg-amber-50 text-amber-600',
    red:    'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    blue:   'bg-blue-50 text-blue-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start gap-4">
      {Icon && <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${C[color]}`}><Icon size={20} /></div>}
      <div>
        <div className="text-2xl font-bold text-gray-800">{value}</div>
        <div className="text-sm font-medium text-gray-600">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-12 px-6">
      {Icon && <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Icon size={24} className="text-gray-400" /></div>}
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-xs text-gray-500 mb-4">{description}</p>}
      {action && action}
    </div>
  );
}

// ─── Accordion ─────────────────────────────────────────────────
export function Accordion({ title, children, defaultOpen = false, badge, subtitle }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <span className="font-semibold text-gray-800 text-sm">{title}</span>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {badge && badge}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0 ml-2" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0 ml-2" />}
      </button>
      {open && <div className="p-5 border-t border-gray-100 bg-white">{children}</div>}
    </div>
  );
}

// ─── Divider ───────────────────────────────────────────────────
export function Divider({ label }) {
  if (!label) return <hr className="border-gray-200 my-4" />;
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 border-t border-gray-200" />
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <div className="flex-1 border-t border-gray-200" />
    </div>
  );
}
