import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import {
  getAllReviewers, approveReviewer, rejectReviewer, updateReviewer,
  setReviewerStatus, getAllEmployees, getAssignmentsByEmployee,
  adminCreateReviewer, adminResetPassword, adminSetPassword,
  getUserByNominationId
} from '../lib/supabase';
import { Button, Card, Badge, Input, Select, Alert, Modal, PageHeader, EmptyState } from '../components/UI';
import {
  CheckCircle, X, Edit3, ChevronDown, ChevronUp, Shield,
  Plus, KeyRound, Copy, Power, PowerOff, RefreshCw, Lock,
  Users, AlertCircle, UserCheck
} from 'lucide-react';

const STATUS_COLORS = { pending: 'warning', approved: 'success', rejected: 'danger' };
const CATEGORY_LABELS = {
  sponsor: 'Sponsor', supervisor: 'Supervisor', peer: 'Peer',
  client: 'Client', teamMember: 'Team Member'
};
const CATEGORIES = ['sponsor', 'supervisor', 'peer', 'client', 'teamMember'];

// ─── Create Reviewer Modal ─────────────────────────────────────
function CreateReviewerModal({ onSave, onClose }) {
  const [employees,    setEmployees]    = useState([]);
  const [assignments,  setAssignments]  = useState([]);
  const [loadingEmps,  setLoadingEmps]  = useState(true);
  const [form, setForm] = useState({
    name: '', email: '', designation: '', department: '',
    phone: '', role: '', category: 'peer',
    employeeId: '', assignmentId: '',
  });
  const [errors, setErrors]   = useState({});
  const [saving, setSaving]   = useState(false);
  const [result, setResult]   = useState(null);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    getAllEmployees().then(emps => {
      setEmployees(emps || []);
      setLoadingEmps(false);
    });
  }, []);

  // Load assignments when employee selected
  useEffect(() => {
    if (!form.employeeId) { setAssignments([]); return; }
    getAssignmentsByEmployee(form.employeeId).then(a => setAssignments(a || []));
  }, [form.employeeId]);

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: '' })); };

  const validate = () => {
    const e = {};
    if (!form.name.trim())        e.name = 'Full name is required';
    if (!form.email.trim())       e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    if (!form.designation.trim()) e.designation = 'Designation is required';
    if (!form.employeeId)         e.employeeId = 'Select an employee being reviewed';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    const res = await adminCreateReviewer({
      ...form,
      assignmentId: form.assignmentId || null,
    });
    setSaving(false);
    if (!res.success) { setErrors({ general: res.error }); return; }
    setResult(res);
    onSave();
  };

  const copy = (v) => { navigator.clipboard?.writeText(v).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (result) {
    return (
      <div className="space-y-4">
        <Alert type="success">
          <div className="font-semibold flex gap-2"><CheckCircle size={15} />Reviewer account created & approved!</div>
        </Alert>
        <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-2">
          <p className="text-sm font-semibold text-amber-800 flex items-center gap-2"><KeyRound size={14} />Temporary Login Credentials</p>
          <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-amber-200 text-sm">
            <span>Email: <strong>{form.email}</strong></span>
          </div>
          <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-amber-200 text-sm">
            <span>Temp Password: <code className="font-bold text-amber-700">{result.tempPassword}</code></span>
            <button onClick={() => copy(result.tempPassword)} className="text-xs text-indigo-600 flex items-center gap-1 ml-2">
              {copied ? <><CheckCircle size={12} />Copied</> : <><Copy size={12} />Copy</>}
            </button>
          </div>
          <p className="text-xs text-amber-700">⚠ Share with the reviewer. They must change the password on first login.</p>
        </div>
        <Button className="w-full" onClick={onClose}>Done</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errors.general && <Alert type="error"><div className="flex gap-2"><AlertCircle size={14} />{errors.general}</div></Alert>}

      {/* Employee & Category */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Employee Being Reviewed <span className="text-red-500">*</span>
          </label>
          <select value={form.employeeId} onChange={set('employeeId')}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white ${errors.employeeId ? 'border-red-400' : 'border-gray-300'}`}>
            <option value="">Select employee…</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.jobTitle}</option>)}
          </select>
          {errors.employeeId && <p className="mt-1 text-xs text-red-600">{errors.employeeId}</p>}
        </div>

        {form.employeeId && (
          <div className="col-span-2">
            <Select label="Linked Assignment (optional)" value={form.assignmentId} onChange={set('assignmentId')}>
              <option value="">No specific assignment</option>
              {assignments.map(a => <option key={a.id} value={a.id}>{a.title} · {a.role}</option>)}
            </Select>
          </div>
        )}

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Reviewer Category <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat} type="button" onClick={() => setForm(f => ({ ...f, category: cat }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all
                  ${form.category === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'}`}>
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reviewer details */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Input label="Full Name"    value={form.name}        onChange={set('name')}        error={errors.name}        required />
        <Input label="Email"        value={form.email}       onChange={set('email')}       error={errors.email}       type="email" required />
        <Input label="Designation"  value={form.designation} onChange={set('designation')} error={errors.designation} required />
        <Input label="Department"   value={form.department}  onChange={set('department')} />
        <Input label="Phone"        value={form.phone}       onChange={set('phone')} />
        <Input label="Role / Title" value={form.role}        onChange={set('role')} />
      </div>

      <Alert type="info" className="mt-1">
        Reviewer will be auto-approved. A temporary password is generated — share it with the reviewer.
      </Alert>

      <div className="flex gap-3 justify-end pt-1">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || loadingEmps}>
          <Plus size={14} />{saving ? 'Creating…' : 'Create Reviewer'}
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
function ReviewerCard({ reviewer, onApprove, onReject, onEdit, onPassword, onToggleStatus }) {
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
    </div>
  );
}
