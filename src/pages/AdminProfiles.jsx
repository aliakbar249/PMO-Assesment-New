import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import {
  getAllReviewers, approveReviewer, rejectReviewer, updateReviewer,
  setReviewerStatus, getAllEmployees,
  adminCreateReviewer, adminResetPassword, adminSetPassword,
  getUserByNominationId, getReviewerSubmittedResults
} from '../lib/supabase';
import { getOrgEmployees, getHierarchyLevels, getEmployeeFieldMap } from '../lib/orgDb';
import { Button, Card, Badge, Input, Select, Alert, Modal, PageHeader, EmptyState } from '../components/UI';
import {
  CheckCircle, X, Edit3, ChevronDown, ChevronUp, Shield,
  Plus, KeyRound, Copy, Power, PowerOff, RefreshCw, Lock,
  Users, AlertCircle, UserCheck, BarChart2, Star, ChevronRight,
  Filter, Search, Tag
} from 'lucide-react';

const STATUS_COLORS = { pending: 'warning', approved: 'success', rejected: 'danger' };
const CATEGORY_LABELS = {
  sponsor: 'Sponsor', supervisor: 'Supervisor', peer: 'Peer',
  client: 'Client', teamMember: 'Team Member'
};
const CATEGORIES = ['sponsor', 'supervisor', 'peer', 'client', 'teamMember'];

// ─── Category pill selector (inline, compact) ─────────────────
function CategoryPills({ value, onChange, size = 'sm' }) {
  return (
    <div className="flex flex-wrap gap-1">
      {CATEGORIES.map(cat => (
        <button key={cat} type="button" onClick={() => onChange(cat)}
          className={`px-2 py-0.5 rounded-lg font-medium border transition-all
            ${size === 'xs' ? 'text-[10px]' : 'text-xs'}
            ${value === cat
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-500 border-gray-300 hover:border-indigo-300 hover:text-indigo-600'}`}>
          {CATEGORY_LABELS[cat]}
        </button>
      ))}
    </div>
  );
}

// ─── Create Reviewer Modal ─────────────────────────────────────
// Two-mode form:
//   Mode A (default) — reviewer is an existing employee (auto-fills details)
//   Mode B           — reviewer is external (manual entry)
function CreateReviewerModal({ onSave, onClose }) {
  const [allPeople,     setAllPeople]     = useState([]);   // everyone: supabase + org
  const [loadingEmps,   setLoadingEmps]   = useState(true);

  // ── Reviewer identity ──────────────────────────────────────────
  // mode: 'existing' | 'external'
  const [mode,          setMode]          = useState('existing');
  // existing mode: picked reviewer from org list
  const [reviewerPick,  setReviewerPick]  = useState(null);   // full person object
  const [reviewerSearch,setReviewerSearch]= useState('');
  // external mode: manual form
  const [extForm, setExtForm] = useState({ name: '', email: '', designation: '', department: '', phone: '' });

  // ── Employees being reviewed ───────────────────────────────────
  const [selectionMap,  setSelectionMap]  = useState({});   // { empId: category }
  const [defaultCat,    setDefaultCat]    = useState('supervisor');
  const [empSearch,     setEmpSearch]     = useState('');

  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [result,  setResult]  = useState(null);
  const [copied,  setCopied]  = useState(false);

  // Load all people once
  useEffect(() => {
    getAllEmployees().then(supabaseEmps => {
      const supaEmps = supabaseEmps || [];
      const orgEmps  = getOrgEmployees();
      const levels   = getHierarchyLevels();
      const levelMap     = Object.fromEntries(levels.map(l => [l.id, l.abbreviation || l.name]));
      const levelFullMap = Object.fromEntries(levels.map(l => [l.id, l.name]));
      const supaEmails   = new Set(supaEmps.map(e => (e.email || '').toLowerCase()));

      const orgMapped = orgEmps
        .filter(e => (e.status || 'active') !== 'inactive')
        .filter(e => !supaEmails.has((e.email || '').toLowerCase()))
        .map(e => {
          let division = e.division || '';
          let grade    = '';
          try { const cfMap = getEmployeeFieldMap(e.id); division = cfMap['division'] || division; grade = cfMap['grade_band'] || ''; } catch {}
          return {
            id: e.id, name: e.name, email: e.email || '',
            jobTitle: levelMap[e.levelId] || '', levelFull: levelFullMap[e.levelId] || '',
            division, grade, organization: e.organization || '', _source: 'org',
          };
        });

      const supaMapped = supaEmps.map(e => ({
        ...e, levelFull: e.level || e.jobTitle || '',
        division: e.department || '', grade: '', organization: '', _source: 'supabase',
      }));

      setAllPeople([...supaMapped, ...orgMapped]);
      setLoadingEmps(false);
    });
  }, []);

  // ── Reviewer picker list (existing mode) ──────────────────────
  const reviewerList = allPeople.filter(p => {
    if (!reviewerSearch) return true;
    const q = reviewerSearch.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)
      || p.jobTitle?.toLowerCase().includes(q) || p.organization?.toLowerCase().includes(q);
  });

  const pickReviewer = (person) => {
    setReviewerPick(person);
    setErrors(e => ({ ...e, reviewer: '' }));
  };

  // ── Employee (being reviewed) checklist ───────────────────────
  // Exclude the picked reviewer from the "being reviewed" list
  const reviewedList = allPeople.filter(p => {
    if (reviewerPick && p.id === reviewerPick.id) return false;
    if (empSearch) {
      const q = empSearch.toLowerCase();
      return p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)
        || p.jobTitle?.toLowerCase().includes(q) || p.organization?.toLowerCase().includes(q);
    }
    return true;
  });

  const selectedIds = Object.keys(selectionMap);

  const toggleEmp = (id) => {
    setSelectionMap(prev => {
      if (prev[id] !== undefined) { const n = { ...prev }; delete n[id]; return n; }
      return { ...prev, [id]: defaultCat };
    });
    setErrors(e => ({ ...e, employeeIds: '' }));
  };

  const applyDefaultToAll = (cat) => {
    setDefaultCat(cat);
    setSelectionMap(prev => { const n = { ...prev }; Object.keys(n).forEach(id => { n[id] = cat; }); return n; });
  };

  // ── Resolve reviewer form values ──────────────────────────────
  const reviewerForm = mode === 'existing' && reviewerPick
    ? { name: reviewerPick.name, email: reviewerPick.email,
        designation: reviewerPick.jobTitle || reviewerPick.levelFull || '',
        department: reviewerPick.organization || reviewerPick.division || '', phone: '' }
    : extForm;

  const setExt = (k) => (ev) => { setExtForm(f => ({ ...f, [k]: ev.target.value })); setErrors(e => ({ ...e, [k]: '' })); };

  // ── Validate + submit ─────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (mode === 'existing') {
      if (!reviewerPick) e.reviewer = 'Please select a reviewer from the list';
    } else {
      if (!extForm.name.trim())  e.name  = 'Full name is required';
      if (!extForm.email.trim()) e.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(extForm.email)) e.email = 'Invalid email';
      if (!extForm.designation.trim()) e.designation = 'Designation is required';
    }
    if (selectedIds.length === 0) e.employeeIds = 'Select at least one employee to be reviewed';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    const res = await adminCreateReviewer({
      ...reviewerForm,
      employeeIds: selectedIds,
      categoryMap: selectionMap,
    });
    setSaving(false);
    if (!res.success) { setErrors({ general: res.error }); return; }
    setResult({
      ...res,
      selectedEmployees: allPeople
        .filter(p => selectedIds.includes(p.id))
        .map(p => ({ ...p, assignedCategory: selectionMap[p.id] })),
    });
    onSave();
  };

  const copy = (v) => { navigator.clipboard?.writeText(v).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // ── Result screen ─────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-4">
        <Alert type="success">
          <div className="font-semibold flex gap-2">
            <CheckCircle size={15} />
            {result.isExistingUser
              ? `Reviewer linked to existing account — assigned to ${result.assignedCount} employee${result.assignedCount !== 1 ? 's' : ''}!`
              : `Reviewer account created — assigned to ${result.assignedCount} employee${result.assignedCount !== 1 ? 's' : ''}!`}
          </div>
        </Alert>
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
          <p className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1.5"><Users size={13} />Assigned to review:</p>
          <ul className="space-y-1.5">
            {result.selectedEmployees.map(emp => (
              <li key={emp.id} className="flex items-center gap-2 text-xs text-indigo-900">
                <CheckCircle size={12} className="text-indigo-500 shrink-0" />
                <span className="font-medium">{emp.name}</span>
                {emp.jobTitle && <span className="text-indigo-400">· {emp.jobTitle}</span>}
                <span className="ml-auto shrink-0 px-2 py-0.5 rounded-lg bg-indigo-200 text-indigo-800 font-semibold text-[10px]">
                  {CATEGORY_LABELS[emp.assignedCategory] || emp.assignedCategory}
                </span>
              </li>
            ))}
          </ul>
          {result.failedCount > 0 && <p className="mt-2 text-xs text-amber-700">⚠ {result.failedCount} assignment{result.failedCount !== 1 ? 's' : ''} failed.</p>}
        </div>
        <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-2">
          <p className="text-sm font-semibold text-amber-800 flex items-center gap-2"><KeyRound size={14} />Login Credentials</p>
          <div className="bg-white rounded-xl px-3 py-2 border border-amber-200 text-sm">
            Email: <strong>{reviewerForm.email}</strong>
          </div>
          <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-amber-200 text-sm">
            <span>{result.isExistingUser ? 'Current Password: ' : 'Temp Password: '}<code className="font-bold text-amber-700">{result.tempPassword}</code></span>
            <button onClick={() => copy(result.tempPassword)} className="text-xs text-indigo-600 flex items-center gap-1 ml-2">
              {copied ? <><CheckCircle size={12} />Copied</> : <><Copy size={12} />Copy</>}
            </button>
          </div>
          {result.isExistingUser
            ? <p className="text-xs text-blue-700">ℹ Reviewer already has an account — new assignments added.</p>
            : <p className="text-xs text-amber-700">⚠ Share with the reviewer. They must change the password on first login.</p>}
        </div>
        <Button className="w-full" onClick={onClose}>Done</Button>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {errors.general && <Alert type="error"><div className="flex gap-2"><AlertCircle size={14} />{errors.general}</div></Alert>}

      {/* ══ STEP 1: Who is the reviewer? ══════════════════════════ */}
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-2">
          Step 1 — Who is the reviewer?
        </p>

        {/* Mode toggle */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-3 text-sm font-medium">
          <button type="button" onClick={() => { setMode('existing'); setReviewerPick(null); setReviewerSearch(''); setErrors({}); }}
            className={`flex-1 py-2 flex items-center justify-center gap-2 transition-colors
              ${mode === 'existing' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            <UserCheck size={14} />Existing Employee
          </button>
          <button type="button" onClick={() => { setMode('external'); setReviewerPick(null); setErrors({}); }}
            className={`flex-1 py-2 flex items-center justify-center gap-2 transition-colors border-l border-gray-200
              ${mode === 'external' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            <Users size={14} />External Reviewer
          </button>
        </div>

        {/* ── Existing employee mode ── */}
        {mode === 'existing' && (
          <div>
            {/* Selected reviewer preview */}
            {reviewerPick ? (
              <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl mb-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">{reviewerPick.name?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-indigo-900">{reviewerPick.name}</p>
                  <p className="text-xs text-indigo-500 truncate">{reviewerPick.email}</p>
                  <div className="flex gap-1.5 mt-0.5 flex-wrap">
                    {reviewerPick.jobTitle && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-semibold">{reviewerPick.jobTitle}</span>}
                    {reviewerPick.organization && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{reviewerPick.organization}</span>}
                  </div>
                </div>
                <button type="button" onClick={() => { setReviewerPick(null); setReviewerSearch(''); }}
                  className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700 flex-shrink-0">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative mb-1.5">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type="text" placeholder="Search employees by name, email, level…"
                    value={reviewerSearch} onChange={e => setReviewerSearch(e.target.value)}
                    className={`w-full pl-8 pr-8 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300
                      ${errors.reviewer ? 'border-red-400' : 'border-gray-300'}`} />
                  {reviewerSearch && (
                    <button onClick={() => setReviewerSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="border border-gray-200 rounded-xl overflow-y-auto bg-white" style={{ maxHeight: '180px' }}>
                  {loadingEmps ? (
                    <p className="text-center py-6 text-sm text-gray-400">Loading…</p>
                  ) : reviewerList.length === 0 ? (
                    <p className="text-center py-6 text-sm text-gray-400">No employees found</p>
                  ) : reviewerList.map((p, idx) => (
                    <button key={p.id} type="button" onClick={() => pickReviewer(p)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-indigo-50 transition-colors
                        ${idx !== reviewerList.length - 1 ? 'border-b border-gray-100' : ''}`}>
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-700 text-xs font-bold">{p.name?.[0]?.toUpperCase()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{p.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.jobTitle && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">{p.jobTitle}</span>}
                        {p.organization && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{p.organization}</span>}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-gray-400">{reviewerList.length} of {allPeople.length} shown</p>
              </>
            )}
            {errors.reviewer && <p className="mt-1 text-xs text-red-600">{errors.reviewer}</p>}
          </div>
        )}

        {/* ── External reviewer mode ── */}
        {mode === 'external' && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Name" value={extForm.name} onChange={setExt('name')} error={errors.name} required />
            <Input label="Email" type="email" value={extForm.email} onChange={setExt('email')} error={errors.email} required />
            <Input label="Designation" value={extForm.designation} onChange={setExt('designation')} error={errors.designation} required />
            <Input label="Department / Company" value={extForm.department} onChange={setExt('department')} />
            <Input label="Phone" value={extForm.phone} onChange={setExt('phone')} />
          </div>
        )}
      </div>

      {/* ══ STEP 2: Who are they reviewing? ═══════════════════════ */}
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-2">
          Step 2 — Who are they reviewing?
          {selectedIds.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-semibold">
              {selectedIds.length} selected
            </span>
          )}
        </p>

        {/* Default category + bulk-apply */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Category:</span>
          <CategoryPills value={defaultCat} onChange={applyDefaultToAll} />
          {selectedIds.length > 0 && (
            <button type="button" onClick={() => applyDefaultToAll(defaultCat)}
              className="text-[11px] text-indigo-500 hover:text-indigo-700 underline ml-auto">
              Apply to all
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-1.5">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input type="text" placeholder="Search employees…"
            value={empSearch} onChange={e => setEmpSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
        </div>

        {/* Checklist */}
        <div className={`border rounded-xl overflow-y-auto bg-white ${errors.employeeIds ? 'border-red-400' : 'border-gray-200'}`}
          style={{ maxHeight: '200px' }}>
          {loadingEmps ? (
            <p className="text-center py-6 text-sm text-gray-400">Loading employees…</p>
          ) : reviewedList.length === 0 ? (
            <p className="text-center py-6 text-sm text-gray-400">No employees found</p>
          ) : reviewedList.map((emp, idx) => {
            const isSel = selectionMap[emp.id] !== undefined;
            return (
              <div key={emp.id}
                className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors cursor-pointer
                  ${isSel ? 'bg-indigo-50' : 'hover:bg-gray-50'}
                  ${idx !== reviewedList.length - 1 ? 'border-b border-gray-100' : ''}`}
                onClick={() => toggleEmp(emp.id)}>
                <input type="checkbox" checked={isSel} onChange={() => {}} onClick={e => e.stopPropagation()}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 shrink-0 pointer-events-none" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {emp.jobTitle && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">{emp.jobTitle}</span>}
                    {(emp.organization || emp.division) && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">{emp.organization || emp.division}</span>}
                  </div>
                </div>
                {isSel && (
                  <div className="shrink-0" onClick={e => e.stopPropagation()}>
                    <CategoryPills value={selectionMap[emp.id]}
                      onChange={cat => setSelectionMap(prev => ({ ...prev, [emp.id]: cat }))} size="xs" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {errors.employeeIds && <p className="mt-1 text-xs text-red-600">{errors.employeeIds}</p>}
        <p className="mt-1 text-[11px] text-gray-400">
          {reviewedList.length} of {allPeople.length} shown{selectedIds.length > 0 ? ` · ${selectedIds.length} selected` : ''}
        </p>

        {/* Selected chips */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {selectedIds.map(id => {
              const emp = allPeople.find(p => p.id === id);
              if (!emp) return null;
              return (
                <span key={id} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 font-medium">
                  {emp.name}
                  <span className="px-1.5 py-0.5 bg-indigo-200 text-indigo-800 rounded-lg text-[10px] font-semibold">
                    {CATEGORY_LABELS[selectionMap[id]] || selectionMap[id]}
                  </span>
                  <button type="button" onClick={() => toggleEmp(id)} className="text-indigo-400 hover:text-indigo-700 ml-0.5"><X size={11} /></button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end pt-1">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || loadingEmps}>
          <Plus size={14} />
          {saving ? 'Creating…' : `Add Reviewer${selectedIds.length > 0 ? ` (${selectedIds.length} assigned)` : ''}`}
        </Button>
      </div>
    </div>
  );
}

// ─── Password Reset Modal (for reviewers) ─────────────────────
function ReviewerPasswordModal({ reviewer, onClose }) {
  const [mode,   setMode]   = useState('reset');
  const [newPw,  setNewPw]  = useState('');
  const [confPw, setConfPw] = useState('');
  const [error,  setError]  = useState('');
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserByNominationId(reviewer.id).then(u => {
      setUserId(u?.id || null);
      setLoading(false);
    });
  }, [reviewer.id]);

  const copy = (v) => { navigator.clipboard?.writeText(v).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const handleReset = async () => {
    if (!userId) return;
    setSaving(true);
    const res = await adminResetPassword(userId);
    setSaving(false);
    setResult({ tempPassword: res.tempPassword });
  };

  const handleSet = async () => {
    if (!userId) return;
    if (newPw.length < 6)  { setError('Minimum 6 characters.'); return; }
    if (newPw !== confPw)  { setError('Passwords do not match.'); return; }
    setSaving(true);
    await adminSetPassword(userId, newPw);
    setSaving(false);
    setResult({ message: 'Password updated successfully.' });
  };

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm">Loading user info…</div>;
  if (!userId) return <Alert type="warning">No login account found for this reviewer. They may not have been approved yet.</Alert>;

  if (result) {
    return (
      <div className="space-y-4">
        {result.tempPassword ? (
          <>
            <Alert type="success"><div className="font-semibold flex gap-2"><CheckCircle size={14} />Temporary password generated</div></Alert>
            <div className="flex items-center justify-between bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-3">
              <code className="text-lg font-bold tracking-widest text-amber-800">{result.tempPassword}</code>
              <button onClick={() => copy(result.tempPassword)} className="text-xs text-indigo-600 flex items-center gap-1 ml-3">
                {copied ? <><CheckCircle size={12} />Copied</> : <><Copy size={12} />Copy</>}
              </button>
            </div>
            <p className="text-xs text-gray-500">Share with <strong>{reviewer.name}</strong>. They must change it on next login.</p>
          </>
        ) : (
          <Alert type="success"><div className="flex gap-2"><CheckCircle size={14} />{result.message}</div></Alert>
        )}
        <Button className="w-full" onClick={onClose}>Done</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-2">
        {[['reset', 'Auto-generate Temp Password'], ['set', 'Set Specific Password']].map(([val, lbl]) => (
          <button key={val} onClick={() => { setMode(val); setError(''); }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${mode === val ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {lbl}
          </button>
        ))}
      </div>

      {mode === 'reset' ? (
        <div className="space-y-3">
          <Alert type="info">A temporary password will be generated for <strong>{reviewer.name}</strong>. They will be required to change it on next login.</Alert>
          <Button className="w-full" onClick={handleReset} disabled={saving}>
            <RefreshCw size={14} />{saving ? 'Generating…' : 'Generate Temporary Password'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Input label="New Password"     type="password" placeholder="Min 6 characters" value={newPw}  onChange={e => { setNewPw(e.target.value); setError(''); }} />
          <Input label="Confirm Password" type="password" placeholder="Repeat password"  value={confPw} onChange={e => { setConfPw(e.target.value); setError(''); }} />
          <Button className="w-full" onClick={handleSet} disabled={saving}>
            <Lock size={14} />{saving ? 'Saving…' : 'Set New Password'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Edit Reviewer Modal ───────────────────────────────────────
function EditReviewerModal({ reviewer, onSave, onClose }) {
  const [form, setForm] = useState({
    name:        reviewer.name        || '',
    designation: reviewer.designation || '',
    department:  reviewer.department  || '',
    email:       reviewer.email       || '',
    phone:       reviewer.phone       || '',
    role:        reviewer.role        || '',
  });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div className="space-y-3">
      <Alert type="info">Correct any inaccurate details before approving this reviewer profile.</Alert>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Full Name"          value={form.name}        onChange={set('name')}        required />
        <Input label="Email"  type="email" value={form.email}       onChange={set('email')}       required />
        <Input label="Designation"        value={form.designation} onChange={set('designation')} />
        <Input label="Department"         value={form.department}  onChange={set('department')} />
        <Input label="Phone"              value={form.phone}       onChange={set('phone')} />
        <Input label="Role on Assignment" value={form.role}        onChange={set('role')} />
      </div>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(form)}>Save Changes</Button>
      </div>
    </div>
  );
}

// ─── Reviewer Card ─────────────────────────────────────────────
function ReviewerCard({ reviewer, onApprove, onReject, onEdit, onPassword, onToggleStatus, onViewResults }) {
  const [expanded, setExpanded] = useState(false);
  const isApproved = reviewer.approvalStatus === 'approved';
  const isRejected = reviewer.approvalStatus === 'rejected';

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all
      ${reviewer.approvalStatus === 'pending'  ? 'border-amber-200 bg-amber-50/30'   :
        reviewer.approvalStatus === 'approved' ? 'border-emerald-200 bg-emerald-50/20' :
        'border-red-200 bg-red-50/20'}`}>
      <div className="p-4 flex items-start gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
          ${isApproved ? 'bg-gradient-to-br from-emerald-300 to-emerald-500' :
            isRejected ? 'bg-gradient-to-br from-red-200 to-red-400' :
            'bg-gradient-to-br from-indigo-300 to-indigo-500'}`}>
          <span className="text-white font-bold text-sm">{reviewer.name?.[0]?.toUpperCase()}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-800">{reviewer.name}</span>
                <Badge variant={STATUS_COLORS[reviewer.approvalStatus] || 'default'}>
                  {reviewer.approvalStatus?.toUpperCase()}
                </Badge>
                <Badge variant="info">{CATEGORY_LABELS[reviewer.category] || reviewer.category}</Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {reviewer.designation}{reviewer.department ? ` · ${reviewer.department}` : ''}
              </p>
              <p className="text-xs text-gray-500">{reviewer.email}</p>
              {reviewer.phone && <p className="text-xs text-gray-400">{reviewer.phone}</p>}
            </div>

            {/* Action buttons */}
            <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
              {reviewer.approvalStatus === 'pending' && (
                <>
                  <Button size="xs" variant="ghost"   onClick={() => onEdit(reviewer)}><Edit3 size={12} />Edit</Button>
                  <Button size="xs" variant="danger"  onClick={() => onReject(reviewer.id)}><X size={12} />Reject</Button>
                  <Button size="xs" variant="success" onClick={() => onApprove(reviewer.id)}><CheckCircle size={12} />Approve</Button>
                </>
              )}
              {isApproved && (
                <>
                  <Button size="xs" variant="ghost" onClick={() => onEdit(reviewer)}><Edit3 size={12} />Edit</Button>
                  <Button size="xs" variant="ghost" onClick={() => onPassword(reviewer)} title="Reset Password">
                    <KeyRound size={12} />Password
                  </Button>
                  <Button size="xs" variant="warning" onClick={() => onToggleStatus(reviewer, 'rejected')} title="Deactivate reviewer">
                    <PowerOff size={12} />Deactivate
                  </Button>
                </>
              )}
              {isRejected && (
                <>
                  <Button size="xs" variant="ghost" onClick={() => onPassword(reviewer)} title="Reset Password">
                    <KeyRound size={12} />Password
                  </Button>
                  <Button size="xs" variant="success" onClick={() => onToggleStatus(reviewer, 'approved')} title="Reactivate reviewer">
                    <Power size={12} />Reactivate
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span>For: <strong>{reviewer.forEmployeeName || '—'}</strong></span>
            <button onClick={() => setExpanded(!expanded)} className="text-indigo-600 flex items-center gap-1">
              Details {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {isApproved && (
              <button onClick={() => onViewResults(reviewer)}
                className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition-colors font-medium">
                <BarChart2 size={11} />View Results
              </button>
            )}
          </div>

          {expanded && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {[
                ['Role on Assignment', reviewer.role],
                ['Created', reviewer.createdAt?.substring(0, 10)],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="bg-white rounded-xl p-2 border border-gray-200">
                  <div className="text-gray-400 font-medium">{k}</div>
                  <div className="text-gray-700 mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          )}

          {isApproved && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
              <Shield size={11} />Account active
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reviewer Results Modal ────────────────────────────────────
const RATING_LABELS = { 5:'Always', 4:'Often', 3:'Sometimes', 2:'Seldom', 1:'Never', 0:'Not Observed' };
const RATING_COLOR  = { 5:'text-emerald-600', 4:'text-green-600', 3:'text-amber-600', 2:'text-orange-500', 1:'text-red-500', 0:'text-gray-400' };
const CATEGORY_LABELS_MAP = {
  sponsor:'Sponsor', supervisor:'Supervisor', peer:'Peer', client:'Client', teamMember:'Team Member',
};

function ReviewerResultsModal({ reviewer, onClose }) {
  const [results,  setResults]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [activeEmp, setActiveEmp] = useState(null); // employeeId of selected tab
  const [expanded, setExpanded] = useState({});     // { sectionId: bool }

  useEffect(() => {
    getReviewerSubmittedResults(reviewer.id).then(data => {
      setResults(data || []);
      if (data && data.length > 0) setActiveEmp(data[0].employeeId);
      setLoading(false);
    });
  }, [reviewer.id]);

  const toggleSection = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
      Loading results…
    </div>
  );

  if (!results || results.length === 0) return (
    <div className="py-8 text-center">
      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
        <BarChart2 size={24} className="text-gray-400" />
      </div>
      <p className="text-sm font-semibold text-gray-600 mb-1">No submitted reviews yet</p>
      <p className="text-xs text-gray-400">{reviewer.name} hasn't submitted any assessments.</p>
    </div>
  );

  const current = results.find(r => r.employeeId === activeEmp) || results[0];
  const allAvgs = current.sections.map(s => s.avg).filter(v => v !== null);
  const overallAvg = allAvgs.length
    ? (allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length).toFixed(2)
    : null;

  return (
    <div className="space-y-4">
      {/* Reviewer summary header */}
      <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center shrink-0">
          <span className="text-white font-bold">{reviewer.name?.[0]?.toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-indigo-900">{reviewer.name}</p>
          <p className="text-xs text-indigo-600">
            {reviewer.designation}{reviewer.department ? ` · ${reviewer.department}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold text-indigo-700">
            {CATEGORY_LABELS_MAP[reviewer.category] || reviewer.category}
          </p>
          <p className="text-xs text-indigo-500">{results.length} review{results.length !== 1 ? 's' : ''} submitted</p>
        </div>
      </div>

      {/* Employee tabs — only shown when reviewer has multiple employees */}
      {results.length > 1 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Reviewing employees:</p>
          <div className="flex gap-2 flex-wrap">
            {results.map(r => (
              <button key={r.employeeId} onClick={() => setActiveEmp(r.employeeId)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all
                  ${activeEmp === r.employeeId
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
                <div className="w-5 h-5 rounded-lg bg-current/20 flex items-center justify-center">
                  <span className="font-bold" style={{ fontSize: '10px' }}>{r.employee.name?.[0]?.toUpperCase()}</span>
                </div>
                {r.employee.name}
                {activeEmp === r.employeeId && <ChevronRight size={11} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected employee context */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-gray-500">Reviewing</p>
          <p className="text-sm font-bold text-gray-800">{current.employee.name}</p>
          <p className="text-xs text-gray-500">
            {current.employee.jobTitle}{current.employee.department ? ` · ${current.employee.department}` : ''}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {overallAvg && (
            <div className="text-center px-4 py-2 bg-emerald-50 border-2 border-emerald-200 rounded-2xl">
              <p className="text-xs font-semibold text-emerald-600">Overall Avg</p>
              <p className="text-xl font-bold text-emerald-700">{overallAvg}</p>
              <p className="text-xs text-emerald-500">out of 5</p>
            </div>
          )}
          <div className="text-center px-3 py-2 bg-gray-50 border border-gray-200 rounded-2xl">
            <p className="text-xs font-semibold text-gray-500">Sections</p>
            <p className="text-lg font-bold text-gray-700">
              {current.sections.filter(s => s.avg !== null).length}/{current.sections.length}
            </p>
            <p className="text-xs text-gray-400">rated</p>
          </div>
          {current.submittedAt && (
            <div className="text-center px-3 py-2 bg-blue-50 border border-blue-200 rounded-2xl">
              <p className="text-xs font-semibold text-blue-500">Submitted</p>
              <p className="text-sm font-bold text-blue-700">
                {new Date(current.submittedAt).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
              </p>
              <p className="text-xs text-blue-400">
                {new Date(current.submittedAt).getFullYear()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Section-by-section scores */}
      <div className="space-y-2">
        {current.sections.map(sec => (
          <div key={sec.id} className="border border-gray-200 rounded-2xl overflow-hidden">
            {/* Section header — always visible */}
            <button onClick={() => toggleSection(sec.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-semibold text-gray-800 truncate">{sec.title}</span>
                {sec.avg !== null ? (
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg shrink-0">
                    {sec.avg.toFixed(2)}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-xs rounded-lg shrink-0">—</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {/* Mini progress dots */}
                <div className="flex gap-0.5">
                  {sec.statements.map(stmt => (
                    <div key={stmt.id} title={stmt.value !== null ? `${stmt.value} — ${RATING_LABELS[stmt.value]}` : 'Not rated'}
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        stmt.value === null ? 'bg-gray-200' :
                        stmt.value === 0    ? 'bg-gray-300' :
                        stmt.value >= 4     ? 'bg-emerald-400' :
                        stmt.value === 3    ? 'bg-amber-400' : 'bg-red-400'
                      }`} />
                  ))}
                </div>
                {expanded[sec.id] ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>
            </button>

            {/* Statement detail — expanded */}
            {expanded[sec.id] && (
              <div className="divide-y divide-gray-50">
                {sec.statements.map((stmt, idx) => (
                  <div key={stmt.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50/50">
                    <span className="text-xs text-gray-300 font-mono w-5 shrink-0 mt-0.5">{idx + 1}</span>
                    <p className="flex-1 text-xs text-gray-700 leading-relaxed">{stmt.text}</p>
                    <div className="shrink-0 flex flex-col items-end gap-0.5 ml-2">
                      {stmt.value !== null ? (
                        <>
                          <div className="flex items-center gap-1">
                            <Star size={10} className={stmt.value > 0 ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
                            <span className={`text-xs font-bold ${RATING_COLOR[stmt.value] || 'text-gray-400'}`}>
                              {stmt.value > 0 ? stmt.value : '—'}
                            </span>
                          </div>
                          <span className={`text-xs ${RATING_COLOR[stmt.value] || 'text-gray-400'}`}>
                            {RATING_LABELS[stmt.value]}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-300">Not rated</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Assignment ratings */}
      {Object.keys(current.assignmentRatings || {}).length > 0 && (
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Assignment Ratings</span>
          </div>
          <div className="divide-y divide-gray-50">
            {Object.entries(current.assignmentRatings).map(([assignId, ratings]) => (
              <div key={assignId} className="px-4 py-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">Assignment: {assignId.substring(0, 8)}…</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ratings).map(([qId, val]) => (
                    <div key={qId} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg">
                      <span className="text-xs text-gray-500">{qId}</span>
                      <span className={`text-xs font-bold ${RATING_COLOR[val] || 'text-gray-500'}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={onClose}
        className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors">
        Close
      </button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
export default function AdminProfiles() {
  const { refresh, tick } = useApp();
  const [filter,        setFilter]        = useState('pending');
  const [allReviewers,  setAllReviewers]  = useState([]);
  const [createModal,   setCreateModal]   = useState(false);
  const [editModal,     setEditModal]     = useState(null);
  const [rejectModal,   setRejectModal]   = useState(null);
  const [rejectReason,  setRejectReason]  = useState('');
  const [passwordModal, setPasswordModal] = useState(null);
  const [resultsModal,  setResultsModal]  = useState(null); // reviewer object
  const [notification,  setNotification]  = useState({ msg: '', type: 'success' });
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    getAllReviewers().then(revs => { setAllReviewers(revs || []); setLoading(false); });
  }, [tick]);

  const displayed = filter === 'all' ? allReviewers : allReviewers.filter(r => r.approvalStatus === filter);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification({ msg: '', type: 'success' }), 4000);
  };

  const handleApprove = async (id) => {
    await approveReviewer(id);
    refresh();
    notify('Reviewer approved. Login credentials are active.');
  };

  const handleReject = async (id) => {
    await rejectReviewer(id, rejectReason);
    refresh();
    setRejectModal(null);
    setRejectReason('');
    notify('Reviewer rejected.');
  };

  const handleSaveEdit = async (updates) => {
    await updateReviewer(editModal.id, updates);
    refresh();
    setEditModal(null);
    notify('Reviewer profile updated.');
  };

  const handleToggleStatus = async (reviewer, newStatus) => {
    await setReviewerStatus(reviewer.id, newStatus);
    refresh();
    notify(newStatus === 'approved' ? 'Reviewer reactivated.' : 'Reviewer deactivated.');
  };

  const counts = {
    pending:  allReviewers.filter(r => r.approvalStatus === 'pending').length,
    approved: allReviewers.filter(r => r.approvalStatus === 'approved').length,
    rejected: allReviewers.filter(r => r.approvalStatus === 'rejected').length,
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading profiles…</div>;

  return (
    <div>
      <PageHeader
        title="Reviewer Profiles"
        subtitle="Create, approve, manage, and control access for all reviewer accounts."
        action={
          <Button onClick={() => setCreateModal(true)} size="sm">
            <Plus size={15} />Create Reviewer
          </Button>
        }
      />

      {notification.msg && (
        <Alert type={notification.type} className="mb-4">
          <div className="flex items-center gap-2"><CheckCircle size={14} />{notification.msg}</div>
        </Alert>
      )}

      {/* Stats + Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          ['pending',  'Pending',  counts.pending,            'bg-amber-100 text-amber-700'],
          ['approved', 'Active',   counts.approved,           'bg-emerald-100 text-emerald-700'],
          ['rejected', 'Inactive', counts.rejected,           'bg-red-100 text-red-700'],
          ['all',      'All',      allReviewers.length,       'bg-gray-100 text-gray-600'],
        ].map(([val, label, count, badgeCls]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-2
              ${filter === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'}`}>
            {label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${filter === val ? 'bg-white/20 text-white' : badgeCls}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Reviewer list */}
      {displayed.length === 0 ? (
        <Card>
          <EmptyState icon={Users}
            title={filter === 'all' ? 'No reviewer profiles' : `No ${filter} reviewers`}
            description={allReviewers.length === 0
              ? 'No reviewers yet. Create one directly or wait for employee nominations.'
              : `No reviewers with "${filter}" status.`}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map(r => (
            <ReviewerCard
              key={r.id}
              reviewer={r}
              onApprove={handleApprove}
              onReject={(id) => { setRejectModal(id); setRejectReason(''); }}
              onEdit={setEditModal}
              onPassword={setPasswordModal}
              onToggleStatus={handleToggleStatus}
              onViewResults={setResultsModal}
            />
          ))}
        </div>
      )}

      {/* Create Reviewer Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create New Reviewer" size="lg">
        <CreateReviewerModal
          onSave={() => { notify('Reviewer created and approved.'); refresh(); }}
          onClose={() => setCreateModal(false)}
        />
      </Modal>

      {/* Edit Reviewer Modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Reviewer Profile" size="lg">
        {editModal && <EditReviewerModal reviewer={editModal} onSave={handleSaveEdit} onClose={() => setEditModal(null)} />}
      </Modal>

      {/* Reject Modal */}
      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Reviewer?" size="sm">
        <Input
          label="Reason for rejection (optional)"
          placeholder="Incorrect details, duplicate…"
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
          className="mb-4"
        />
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setRejectModal(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => handleReject(rejectModal)}><X size={14} />Reject</Button>
        </div>
      </Modal>

      {/* Password Modal */}
      <Modal open={!!passwordModal} onClose={() => setPasswordModal(null)}
        title={`Password — ${passwordModal?.name}`} size="sm">
        {passwordModal && (
          <ReviewerPasswordModal reviewer={passwordModal} onClose={() => setPasswordModal(null)} />
        )}
      </Modal>

      {/* Results Modal */}
      <Modal open={!!resultsModal} onClose={() => setResultsModal(null)}
        title={`Assessment Results — ${resultsModal?.name}`} size="lg">
        {resultsModal && (
          <ReviewerResultsModal reviewer={resultsModal} onClose={() => setResultsModal(null)} />
        )}
      </Modal>
    </div>
  );
}
