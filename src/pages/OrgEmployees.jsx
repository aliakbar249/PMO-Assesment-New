import { useState, useMemo, useEffect } from 'react';
import {
  getOrgEmployees, saveOrgEmployee, deleteOrgEmployee,
  getHierarchyLevels,
  getCustomFields, getCustomFieldValues, saveCustomFieldValue, getProfileCompleteness,
  getPositions, getOccupancies, getEmployeePrimaryPosition,
  OCCUPANCY_TYPES,
} from '../lib/orgDb';
import {
  getAssessment, getAssignmentsByEmployee, getNominations, getAllReviewers,
  getUserByEmployeeId, assignTemplateToEmployee, getAssessmentTemplates,
  getEmployeeTemplateId, adminResetPassword, adminSetPassword,
  getAllEmployees, getCompanies,
} from '../lib/supabase';
import {
  Users, Plus, Edit2, Trash2, Search, X, CheckCircle, AlertTriangle,
  ChevronDown, ChevronRight, EyeOff, GitBranch, Briefcase, Mail,
  MapPin, Save, Settings, KeyRound, Layers, RefreshCw, Lock, Copy,
  AlertCircle, Star, Building2,
} from 'lucide-react';

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
      ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── Field editor — renders correct input per fieldType ───────────────────────
function FieldEditor({ field, value, onChange }) {
  if (field.fieldType === 'dropdown_single') {
    return (
      <select value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]">
        <option value="">— select —</option>
        {(field.options || []).map(o => <option key={o}>{o}</option>)}
      </select>
    );
  }
  if (field.fieldType === 'dropdown_multi') {
    let selected = [];
    try { selected = JSON.parse(value || '[]'); } catch {}
    return (
      <div className="flex flex-wrap gap-1.5">
        {(field.options || []).map(o => {
          const isSel = selected.includes(o);
          return (
            <button key={o} type="button"
              onClick={() => onChange(JSON.stringify(isSel ? selected.filter(v => v !== o) : [...selected, o]))}
              className={`px-2 py-0.5 text-xs rounded-full border transition-all
                ${isSel ? 'bg-[#01A2B1] text-white border-[#01A2B1]' : 'border-gray-200 text-gray-600 hover:border-[#01A2B1]/50 bg-white'}`}>
              {o}
            </button>
          );
        })}
      </div>
    );
  }
  if (field.fieldType === 'toggle') {
    return (
      <div className="flex items-center gap-2">
        <button type="button"
          onClick={() => onChange(value === 'true' ? 'false' : 'true')}
          className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
          style={{ background: value === 'true' ? '#01A2B1' : '#D1D5DB' }}>
          <span className="absolute bg-white rounded-full shadow transition-transform"
            style={{ width: 16, height: 16, top: 2, left: 2, transform: value === 'true' ? 'translateX(20px)' : 'none' }} />
        </button>
        <span className="text-sm text-gray-600">{value === 'true' ? 'Yes' : 'No'}</span>
      </div>
    );
  }
  if (field.fieldType === 'textarea') {
    return (
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={2}
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1] resize-none" />
    );
  }
  if (field.fieldType === 'org_unit_lookup') {
    // free text for now — the lookup dropdown is handled in OrgUnits context
    return (
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder="Org unit ID or name"
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]" />
    );
  }
  return (
    <input
      type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
      value={value || ''} onChange={e => onChange(e.target.value)}
      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]" />
  );
}

// ─── Display value for a custom field ────────────────────────────────────────
function FieldDisplay({ value, fieldType }) {
  if (!value || value === '' || value === '[]') {
    return <span className="text-gray-300 italic text-xs">—</span>;
  }
  try {
    const arr = JSON.parse(value);
    if (Array.isArray(arr) && arr.length > 0) {
      return (
        <div className="flex flex-wrap gap-1">
          {arr.map(v => <span key={v} className="px-1.5 py-0.5 bg-[#01A2B1]/10 text-[#01A2B1] text-xs rounded-full">{v}</span>)}
        </div>
      );
    }
  } catch {}
  if (value === 'true')  return <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">Yes</span>;
  if (value === 'false') return <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">No</span>;
  return <span className="text-sm text-gray-800">{value}</span>;
}

// ─── Employee Form Modal (create + edit + custom fields) ───────────────────────
function EmployeeModal({ employee, levels, customFields, companies, onClose, onSaved }) {
  const isEdit = !!employee?.id;

  // Core profile fields
  const [form, setForm] = useState({
    name:         employee?.name         || '',
    email:        employee?.email        || '',
    levelId:      employee?.levelId      || '',
    organization: employee?.organization || '',
    city:         employee?.city         || '',
    status:       employee?.status       || 'active',
  });
  const [errors, setErrors] = useState({});

  // Custom field values — keyed by fieldDefinitionId
  const existingValues = isEdit ? getCustomFieldValues(employee.id) : [];
  const [cfValues, setCfValues] = useState(() => {
    const map = {};
    existingValues.forEach(v => { map[v.fieldDefinitionId] = v.value; });
    return map;
  });

  const [activeSection, setActiveSection] = useState(null); // which section is expanded

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };
  const setCf = (fieldId, val) => setCfValues(prev => ({ ...prev, [fieldId]: val }));

  // Group custom fields by section
  const sectionedFields = useMemo(() => {
    const active = customFields.filter(f => f.status === 'active');
    const sections = {};
    active.forEach(f => {
      if (!sections[f.section]) sections[f.section] = [];
      sections[f.section].push(f);
    });
    // Sort each section by displayOrder
    Object.keys(sections).forEach(s => sections[s].sort((a, b) => a.displayOrder - b.displayOrder));
    return sections;
  }, [customFields]);

  const validate = () => {
    const e = {};
    if (!form.name.trim())         e.name         = 'Full name is required';
    if (!form.email.trim())        e.email         = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    if (!form.levelId)             e.levelId       = 'Hierarchy level is required';
    if (!form.organization.trim()) e.organization  = 'Company is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    // Save core employee record
    const empRecord = {
      ...(isEdit ? employee : {}),
      name:         form.name.trim(),
      email:        form.email.trim(),
      levelId:      form.levelId,
      organization: form.organization.trim(),
      city:         form.city.trim(),
      status:       form.status,
    };
    saveOrgEmployee(empRecord);

    // If editing, we know the ID. If creating, we need to re-read to get the new ID.
    if (isEdit) {
      // Save custom field values for existing employee
      Object.entries(cfValues).forEach(([fieldId, val]) => {
        if (val !== undefined && val !== null) {
          saveCustomFieldValue(employee.id, fieldId, val, 'admin');
        }
      });
    } else {
      // For new employees, find the newly created record by email
      const all = getOrgEmployees();
      const newEmp = all.find(e => e.email === empRecord.email);
      if (newEmp) {
        Object.entries(cfValues).forEach(([fieldId, val]) => {
          if (val !== undefined && val !== null && val !== '') {
            saveCustomFieldValue(newEmp.id, fieldId, val, 'admin');
          }
        });
      }
    }

    onSaved(isEdit ? 'Employee updated.' : 'Employee created.');
  };

  const sectionNames = Object.keys(sectionedFields);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800">
            {isEdit ? `Edit — ${employee.name}` : 'Add New Employee'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* ── Core Profile ── */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Core Profile</div>
            <div className="grid grid-cols-2 gap-3">
              {/* Name */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Tariq Mahmood"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#01A2B1] ${errors.name ? 'border-red-400' : 'border-gray-300'}`} />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="user@company.com"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#01A2B1] ${errors.email ? 'border-red-400' : 'border-gray-300'}`} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              {/* Company */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Company <span className="text-red-500">*</span></label>
                <select value={form.organization} onChange={e => set('organization', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#01A2B1] ${errors.organization ? 'border-red-400' : 'border-gray-300'}`}>
                  <option value="">— select company —</option>
                  {(companies || []).map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
                {errors.organization && <p className="text-xs text-red-500 mt-1">{errors.organization}</p>}
              </div>

              {/* Hierarchy Level */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hierarchy Level <span className="text-red-500">*</span></label>
                <select value={form.levelId} onChange={e => set('levelId', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#01A2B1] ${errors.levelId ? 'border-red-400' : 'border-gray-300'}`}>
                  <option value="">— select level —</option>
                  {levels.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.abbreviation})</option>
                  ))}
                </select>
                {errors.levelId && <p className="text-xs text-red-500 mt-1">{errors.levelId}</p>}
              </div>

              {/* City */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Lahore"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]" />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Custom Field Sections ── */}
          {sectionNames.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Custom Fields</div>
              <div className="space-y-2">
                {sectionNames.map(sectionName => {
                  const fields = sectionedFields[sectionName];
                  const isOpen = activeSection === sectionName;
                  const filledCount = fields.filter(f => {
                    const v = cfValues[f.id];
                    return v && v !== '' && v !== '[]';
                  }).length;

                  return (
                    <div key={sectionName} className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Section header */}
                      <button
                        type="button"
                        onClick={() => setActiveSection(isOpen ? null : sectionName)}
                        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                      >
                        {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                        <span className="text-sm font-medium text-gray-700">{sectionName}</span>
                        <span className="ml-auto text-xs text-gray-400">{filledCount}/{fields.length} filled</span>
                        {filledCount < fields.length && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        )}
                      </button>

                      {/* Fields */}
                      {isOpen && (
                        <div className="px-4 py-4 space-y-4">
                          {fields.map(f => (
                            <div key={f.id}>
                              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                                {f.label}
                                {f.isRequired && <span className="text-red-400">*</span>}
                                {!f.isVisibleToEmployee && (
                                  <span className="flex items-center gap-0.5 text-amber-500">
                                    <EyeOff size={10} /><span className="text-xs font-normal">Admin only</span>
                                  </span>
                                )}
                              </label>
                              <FieldEditor
                                field={f}
                                value={cfValues[f.id] ?? ''}
                                onChange={val => setCf(f.id, val)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button onClick={handleSave}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90"
            style={{ background: '#01A2B1' }}>
            <Save size={14} />{isEdit ? 'Save Changes' : 'Create Employee'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Employee Actions Modal (Password / Template / Assessment) ──────────────────
// Looks up the org employee in Supabase by email and provides the same
// rich management tabs that AdminEmployees.jsx has.
function EmployeeActionsModal({ orgEmployee, onClose }) {
  const [tab, setTab] = useState('template');

  // Supabase-side data
  const [supEmployee,  setSupEmployee]  = useState(null);  // matched Supabase employee row
  const [linkedUser,   setLinkedUser]   = useState(null);
  const [assessment,   setAssessment]   = useState(null);
  const [assignments,  setAssignments]  = useState([]);
  const [nominations,  setNominations]  = useState(null);
  const [reviewers,    setReviewers]    = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [selectedTmpl, setSelectedTmpl] = useState('');
  const [loading,      setLoading]      = useState(true);
  const [notLinked,    setNotLinked]    = useState(false);

  // Template tab state
  const [tmplSaving, setTmplSaving] = useState(false);
  const [tmplSaved,  setTmplSaved]  = useState(false);
  const [tmplError,  setTmplError]  = useState('');

  // Password tab state
  const [pwMode,   setPwMode]   = useState('reset');
  const [newPw,    setNewPw]    = useState('');
  const [confPw,   setConfPw]   = useState('');
  const [pwError,  setPwError]  = useState('');
  const [pwResult, setPwResult] = useState(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [copied,   setCopied]   = useState(false);

  useEffect(() => {
    // Match org employee to Supabase employee by email
    getAllEmployees().then(allEmps => {
      const matched = (allEmps || []).find(
        e => e.email?.toLowerCase() === orgEmployee.email?.toLowerCase()
      );
      if (!matched) {
        setNotLinked(true);
        setLoading(false);
        return;
      }
      setSupEmployee(matched);
      return Promise.all([
        getAssessment(matched.id),
        getAssignmentsByEmployee(matched.id),
        getNominations(matched.id),
        getAllReviewers(),
        getUserByEmployeeId(matched.id),
        getAssessmentTemplates(),
        getEmployeeTemplateId(matched.id),
      ]);
    }).then(results => {
      if (!results) return; // notLinked path
      const [a, asgns, noms, revs, usr, tmpls, currentTmplId] = results;
      setAssessment(a);
      setAssignments(asgns || []);
      setNominations(noms);
      setReviewers((revs || []).filter(r => r.employeeId === results[0]?.id || r.employeeId));
      setLinkedUser(usr);
      setAllTemplates(tmpls || []);
      setSelectedTmpl(currentTmplId || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [orgEmployee.email]);

  // Re-filter reviewers once supEmployee is known
  const filteredReviewers = supEmployee
    ? reviewers.filter(r => r.employeeId === supEmployee.id)
    : [];
  const approvedRevs = filteredReviewers.filter(r => r.approvalStatus === 'approved');
  const pendingRevs  = filteredReviewers.filter(r => r.approvalStatus === 'pending');
  const currentTemplate = allTemplates.find(t => t.id === selectedTmpl);

  const handleAssignTemplate = async () => {
    if (!supEmployee) return;
    setTmplSaving(true); setTmplError('');
    const res = await assignTemplateToEmployee(supEmployee.id, selectedTmpl || null);
    setTmplSaving(false);
    if (!res.success) {
      setTmplError(res.error === 'MISSING_TABLE' ? '__MISSING_TABLE__' : (res.error || 'Failed to assign template.'));
      return;
    }
    setTmplSaved(true);
    setTimeout(() => setTmplSaved(false), 3000);
  };

  const handleResetPw = async () => {
    if (!linkedUser) return;
    setPwSaving(true);
    const res = await adminResetPassword(linkedUser.id);
    setPwSaving(false);
    setPwResult({ tempPassword: res.tempPassword });
  };

  const handleSetPw = async () => {
    if (newPw.length < 6) { setPwError('Minimum 6 characters.'); return; }
    if (newPw !== confPw)  { setPwError('Passwords do not match.'); return; }
    setPwSaving(true);
    await adminSetPassword(linkedUser.id, newPw);
    setPwSaving(false);
    setPwResult({ message: 'Password updated successfully.' });
  };

  const copyText = (v) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const TABS = [
    { key: 'template',   label: 'Template'   },
    { key: 'assessment', label: 'Assessment' },
    { key: 'password',   label: 'Password'   },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Settings size={16} className="text-[#01A2B1]" />
              {orgEmployee.name} — Admin Actions
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{orgEmployee.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-6 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all
                ${tab === t.key ? 'bg-white text-[#01A2B1] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {loading ? (
            <div className="text-center py-10 text-sm text-gray-400">Loading…</div>
          ) : notLinked ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
              <AlertCircle size={28} className="mx-auto mb-2 text-amber-500" />
              <p className="text-sm font-semibold text-amber-800 mb-1">No Supabase account linked</p>
              <p className="text-xs text-amber-600">
                This org employee (<strong>{orgEmployee.email}</strong>) has no matching record in the
                Supabase employees table. Create a Supabase employee with the same email
                in <em>Supabase Employees</em> to enable password management and template assignment.
              </p>
            </div>
          ) : (
            <>
              {/* ── Template Tab ── */}
              {tab === 'template' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl p-3">
                    Choose which assessment template this employee will use. Leaving it blank applies the default template.
                  </p>

                  {tmplSaved && (
                    <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                      <CheckCircle size={14} />Template assigned successfully.
                    </div>
                  )}

                  {tmplError === '__MISSING_TABLE__' ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
                      <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5"><AlertCircle size={13} />Database migration required</p>
                      <p className="text-xs text-amber-700">The <code>employee_template_assignments</code> table doesn't exist. Run the SQL shown in the Supabase Employees page to create it.</p>
                    </div>
                  ) : tmplError ? (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{tmplError}</div>
                  ) : null}

                  <div className="space-y-2">
                    {/* Default option */}
                    <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all
                      ${!selectedTmpl ? 'border-[#01A2B1] bg-[#01A2B1]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="tmpl" value="" checked={!selectedTmpl}
                        onChange={() => setSelectedTmpl('')} className="mt-0.5 accent-[#01A2B1]" />
                      <div>
                        <div className="text-sm font-semibold text-gray-800">Standard Assessment</div>
                        <p className="text-xs text-gray-400 mt-0.5">Default — applies to all employees unless overridden.</p>
                      </div>
                    </label>

                    {/* Custom templates */}
                    {allTemplates.filter(t => !t.isDefault).map(tmpl => (
                      <label key={tmpl.id} className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all
                        ${selectedTmpl === tmpl.id ? 'border-[#01A2B1] bg-[#01A2B1]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="radio" name="tmpl" value={tmpl.id} checked={selectedTmpl === tmpl.id}
                          onChange={() => setSelectedTmpl(tmpl.id)} className="mt-0.5 accent-[#01A2B1]" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-wrap">
                            {tmpl.name}
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                              {tmpl.sectionIds?.length || 0} sections
                            </span>
                          </div>
                          {tmpl.description && <p className="text-xs text-gray-400 mt-0.5">{tmpl.description}</p>}
                        </div>
                      </label>
                    ))}

                    {allTemplates.filter(t => !t.isDefault).length === 0 && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        No custom templates yet. Go to <strong>Templates → Assessment Templates</strong> to create one.
                      </p>
                    )}
                  </div>

                  {selectedTmpl && currentTemplate && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                      <Layers size={11} className="inline mr-1 text-[#01A2B1]" />
                      Selected: <strong>{currentTemplate.name}</strong>
                    </p>
                  )}

                  <div className="flex justify-end">
                    <button onClick={handleAssignTemplate} disabled={tmplSaving}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                      style={{ background: '#01A2B1' }}>
                      <CheckCircle size={14} />{tmplSaving ? 'Saving…' : 'Assign Template'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Assessment Tab ── */}
              {tab === 'assessment' && (
                <div className="space-y-3">
                  {/* Self-assessment */}
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-indigo-800">Self-Assessment</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                        ${assessment?.status === 'submitted' ? 'bg-emerald-100 text-emerald-700'
                          : assessment ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-500'}`}>
                        {assessment?.status === 'submitted' ? 'Submitted' : assessment ? 'In Progress' : 'Not Started'}
                      </span>
                    </div>
                    {assessment?.updatedAt && (
                      <p className="text-xs text-indigo-600">Last updated: {assessment.updatedAt?.substring(0, 10)}</p>
                    )}
                  </div>

                  {/* Assignments */}
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-amber-800">Reviewer Assignments</span>
                      <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs font-medium rounded-full">{assignments.length} / 3</span>
                    </div>
                    {assignments.length > 0
                      ? assignments.map(a => (
                        <div key={a.id} className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                          <Briefcase size={10} />{a.title} · {a.role} · <span className="text-amber-500">{a.status}</span>
                        </div>
                      ))
                      : <p className="text-xs text-amber-600">No reviewer assignments yet.</p>}
                  </div>

                  {/* Nominations */}
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-emerald-800">Nominations</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                        ${nominations?.submitted ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-100 text-amber-700'}`}>
                        {nominations?.submitted ? 'Submitted' : nominations ? 'In Progress' : 'Not Started'}
                      </span>
                    </div>
                  </div>

                  {/* Reviewers */}
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-blue-800">Reviewers</span>
                      <div className="flex gap-1.5">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">{approvedRevs.length} approved</span>
                        {pendingRevs.length > 0 && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">{pendingRevs.length} pending</span>
                        )}
                      </div>
                    </div>
                    {filteredReviewers.length > 0 ? (
                      <div className="space-y-1.5">
                        {filteredReviewers.map(r => (
                          <div key={r.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-2.5 py-1.5 border border-blue-100">
                            <div>
                              <span className="font-medium text-gray-700">{r.name}</span>
                              {r.designation && <span className="text-gray-400 ml-1">· {r.designation}</span>}
                            </div>
                            <div className="flex gap-1.5">
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{r.category}</span>
                              <span className={`px-1.5 py-0.5 rounded-full text-xs
                                ${r.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-700'
                                  : r.approvalStatus === 'pending' ? 'bg-amber-100 text-amber-700'
                                  : 'bg-gray-100 text-gray-500'}`}>
                                {r.approvalStatus}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-blue-600">No reviewers nominated yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Password Tab ── */}
              {tab === 'password' && (
                <div className="space-y-4">
                  {!linkedUser ? (
                    <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <AlertCircle size={14} className="inline mr-1" />
                      No linked user account found for this employee.
                    </div>
                  ) : pwResult ? (
                    <div className="space-y-4">
                      {pwResult.tempPassword ? (
                        <>
                          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-medium">
                            <CheckCircle size={14} />Temporary password generated
                          </div>
                          <div className="flex items-center justify-between bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-3">
                            <code className="text-lg font-bold tracking-widest text-amber-800">{pwResult.tempPassword}</code>
                            <button onClick={() => copyText(pwResult.tempPassword)}
                              className="text-xs text-indigo-600 flex items-center gap-1 ml-3">
                              {copied ? <><CheckCircle size={12} />Copied</> : <><Copy size={12} />Copy</>}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500">
                            Share this with <strong>{orgEmployee.name}</strong>. They will be prompted to set a new password on next login.
                          </p>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm">
                          <CheckCircle size={14} />{pwResult.message}
                        </div>
                      )}
                      <button onClick={() => { setPwResult(null); setNewPw(''); setConfPw(''); setPwError(''); }}
                        className="w-full py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                        Change Password Again
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Mode tabs */}
                      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                        {[['reset', 'Auto-generate Temp Password'], ['set', 'Set Specific Password']].map(([val, lbl]) => (
                          <button key={val} onClick={() => { setPwMode(val); setPwError(''); }}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all
                              ${pwMode === val ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            {lbl}
                          </button>
                        ))}
                      </div>

                      {pwMode === 'reset' ? (
                        <div className="space-y-3">
                          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl p-3">
                            A secure temporary password will be generated and shown to you. {orgEmployee.name} will need to change it on next login.
                          </p>
                          <button onClick={handleResetPw} disabled={pwSaving}
                            className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
                            style={{ background: '#01A2B1' }}>
                            <RefreshCw size={14} />{pwSaving ? 'Generating…' : 'Generate Temporary Password'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {pwError && <p className="text-xs text-red-600">{pwError}</p>}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
                            <input type="password" value={newPw} onChange={e => { setNewPw(e.target.value); setPwError(''); }}
                              placeholder="Min 6 characters"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Confirm Password</label>
                            <input type="password" value={confPw} onChange={e => { setConfPw(e.target.value); setPwError(''); }}
                              placeholder="Repeat password"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]" />
                          </div>
                          <button onClick={handleSetPw} disabled={pwSaving}
                            className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
                            style={{ background: '#01A2B1' }}>
                            <Lock size={14} />{pwSaving ? 'Saving…' : 'Set New Password'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ employee, onClose, onConfirm }) {
  const primaryPos = getEmployeePrimaryPosition(employee.id);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 size={18} className="text-red-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-800">Delete Employee?</h2>
        </div>
        <p className="text-sm text-gray-600 mb-1">
          Delete <strong>{employee.name}</strong>? This will remove all their custom field values and occupancy records.
        </p>
        {primaryPos && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            ⚠ This employee currently holds <strong>{primaryPos.title}</strong>. Their occupancy will also be removed.
          </p>
        )}
        <p className="text-xs text-gray-400 mb-5">This action cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Employee Row Card ────────────────────────────────────────────────────────
function EmployeeCard({ employee, levels, customFields, onEdit, onDelete, onActions }) {
  const [expanded, setExpanded] = useState(false);
  const level = levels.find(l => l.id === employee.levelId);
  const primaryPos = getEmployeePrimaryPosition(employee.id);
  const cfValues = getCustomFieldValues(employee.id);
  const completeness = getProfileCompleteness(employee.id);

  const getCfValue = (fieldId) => cfValues.find(v => v.fieldDefinitionId === fieldId)?.value || '';

  // Active custom fields that have values
  const filledFields = customFields
    .filter(f => f.status === 'active')
    .filter(f => {
      const v = getCfValue(f.id);
      return v && v !== '' && v !== '[]';
    })
    .slice(0, 6); // cap preview at 6

  return (
    <div className={`bg-white rounded-xl border-2 transition-all ${employee.status === 'active' ? 'border-gray-200 hover:border-gray-300' : 'border-dashed border-gray-200 opacity-60'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-white text-sm"
          style={{ background: level?.colorTag || '#01A2B1' }}>
          {employee.name?.[0]?.toUpperCase() || '?'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-800">{employee.name}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${employee.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {employee.status === 'active' ? 'Active' : 'Inactive'}
            </span>
            {level && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: level.colorTag || '#6B7280' }}>
                {level.abbreviation}
              </span>
            )}
            {employee.organization && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                <Building2 size={9} />{employee.organization}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1"><Mail size={10} />{employee.email}</span>
            {employee.city && <span className="flex items-center gap-1"><MapPin size={10} />{employee.city}</span>}
            {primaryPos
              ? <span className="flex items-center gap-1"><Briefcase size={10} />{primaryPos.title}</span>
              : <span className="flex items-center gap-1 text-amber-500"><Briefcase size={10} />No position</span>}
          </div>

          {/* Completeness bar */}
          {completeness.total > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
                <div className="h-full rounded-full" style={{
                  width: `${completeness.pct}%`,
                  background: completeness.pct >= 80 ? '#059669' : completeness.pct >= 50 ? '#D97706' : '#DC2626',
                }} />
              </div>
              <span className="text-xs text-gray-400">{completeness.pct}% complete</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <button onClick={onActions} title="Password / Template / Assessment"
            className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors">
            <Settings size={14} />
          </button>
          <button onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#01A2B1] hover:bg-[#01A2B1]/10 transition-colors">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expanded detail — shows all filled custom fields */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filledFields.map(f => (
              <div key={f.id} className="bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-xs font-medium text-gray-500">{f.label}</span>
                  {!f.isVisibleToEmployee && <EyeOff size={9} className="text-amber-400" />}
                </div>
                <FieldDisplay value={getCfValue(f.id)} fieldType={f.fieldType} />
              </div>
            ))}
            {filledFields.length === 0 && (
              <p className="col-span-3 text-xs text-gray-400 py-2">No custom field values set yet. Click Edit to fill them in.</p>
            )}
          </div>
          {/* Core context strip */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
            {employee.city && <span className="flex items-center gap-1"><MapPin size={11} />{employee.city}</span>}
            {level         && <span className="flex items-center gap-1"><GitBranch size={11} />{level.name}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OrgEmployees() {
  const [refresh,      setRefresh]      = useState(0);
  const [search,       setSearch]       = useState('');
  const [levelFilter,  setLevelFilter]  = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [formTarget,    setFormTarget]    = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [actionsTarget, setActionsTarget] = useState(null);
  const [toast,         setToast]         = useState(null);
  const [companies,     setCompanies]     = useState([]);

  const bump = () => setRefresh(r => r + 1);
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  // On mount: load companies + silently remove employees with no organization
  useEffect(() => {
    getCompanies().then(cos => setCompanies((cos || []).filter(c => c.active)));

    // Remove any org employees that have no company assigned — they are incomplete/seed records
    const all = getOrgEmployees();
    const toRemove = all.filter(e => !e.organization || !e.organization.trim());
    if (toRemove.length > 0) {
      toRemove.forEach(e => deleteOrgEmployee(e.id));
      bump();
    }
  }, []); // eslint-disable-line

  // Data — re-read on every refresh tick
  const employees    = useMemo(() => getOrgEmployees(),  [refresh]); // eslint-disable-line
  const levels       = useMemo(() => getHierarchyLevels(), [refresh]); // eslint-disable-line
  const customFields = useMemo(() => getCustomFields().filter(f => f.status === 'active'), [refresh]); // eslint-disable-line

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(emp => {
      const matchSearch = !q
        || emp.name?.toLowerCase().includes(q)
        || emp.email?.toLowerCase().includes(q)
        || emp.city?.toLowerCase().includes(q)
        || emp.division?.toLowerCase().includes(q);
      const matchLevel  = !levelFilter  || emp.levelId  === levelFilter;
      const matchStatus = !statusFilter || statusFilter === 'all' || emp.status === statusFilter;
      return matchSearch && matchLevel && matchStatus;
    });
  }, [employees, search, levelFilter, statusFilter]);

  const handleDelete = () => {
    deleteOrgEmployee(deleteTarget.id);
    setDeleteTarget(null);
    showToast('Employee deleted.');
    bump();
  };

  const handleSaved = (msg) => {
    setFormTarget(null);
    showToast(msg);
    bump();
  };

  const activeCount   = employees.filter(e => e.status === 'active').length;
  const inactiveCount = employees.filter(e => e.status !== 'active').length;
  const withPosition  = employees.filter(e => !!getEmployeePrimaryPosition(e.id)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage org employees, hierarchy assignments, and custom profile fields.
          </p>
        </div>
        <button
          onClick={() => setFormTarget({})}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-sm hover:opacity-90"
          style={{ background: '#01A2B1' }}>
          <Plus size={16} /> Add Employee
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',         value: employees.length, color: '#01A2B1' },
          { label: 'Active',        value: activeCount,      color: '#059669' },
          { label: 'Inactive',      value: inactiveCount,    color: '#9CA3AF' },
          { label: 'With Position', value: withPosition,     color: '#7C3AED' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.color + '18' }}>
              <Users size={16} style={{ color: s.color }} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search by name, email, city, division…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/20 focus:border-[#01A2B1] bg-white"
          />
        </div>
        <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none bg-white">
          <option value="">All Levels</option>
          {levels.map(l => <option key={l.id} value={l.id}>{l.name} ({l.abbreviation})</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none bg-white">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Employee list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-400">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {employees.length === 0
              ? 'No employees yet. Click "Add Employee" to create one.'
              : 'No employees match your search/filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(emp => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              levels={levels}
              customFields={customFields}
              onEdit={() => setFormTarget(emp)}
              onDelete={() => setDeleteTarget(emp)}
              onActions={() => setActionsTarget(emp)}
            />
          ))}
        </div>
      )}

      <div className="text-xs text-gray-400 text-right">
        Showing {filtered.length} of {employees.length} employees
      </div>

      {/* Modals */}
      {formTarget !== null && (
        <EmployeeModal
          employee={formTarget?.id ? formTarget : null}
          levels={levels}
          customFields={customFields}
          companies={companies}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          employee={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
      {actionsTarget && (
        <EmployeeActionsModal
          orgEmployee={actionsTarget}
          onClose={() => setActionsTarget(null)}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
