import { useState, useEffect } from 'react';
import { getCompanies, createCompany, updateCompany, deleteCompany } from '../lib/supabase';
import { Button, Card, Input, Alert, Badge, PageHeader, Modal, EmptyState } from '../components/UI';
import {
  Building2, Plus, Edit3, Trash2, CheckCircle, AlertCircle,
  Search, Phone, Mail, MapPin, Briefcase, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';

const INDUSTRIES = [
  'Architecture & Design', 'Construction', 'Consulting', 'Education', 'Energy',
  'Engineering', 'Finance & Banking', 'Government & Public Sector', 'Healthcare',
  'Hospitality & Tourism', 'Infrastructure', 'IT & Technology', 'Legal',
  'Logistics & Supply Chain', 'Manufacturing', 'Media & Communications',
  'Non-Profit', 'Oil & Gas', 'Pharmaceuticals', 'Real Estate',
  'Retail & Commerce', 'Telecommunications', 'Transportation', 'Other',
];

const EMPTY_FORM = {
  name: '', industry: '', contactName: '', contactEmail: '',
  contactPhone: '', address: '', notes: '',
};

// ─── Company Form (shared by Create + Edit) ────────────────────
function CompanyForm({ initial = EMPTY_FORM, onSave, onCancel, saving, serverError = '' }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [errors, setErrors] = useState({});
  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: '' })); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Company name is required';
    if (form.contactEmail && !/\S+@\S+\.\S+/.test(form.contactEmail)) e.contactEmail = 'Invalid email';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave(form);
  };

  return (
    <div className="space-y-4">
      {serverError && (
        <Alert type="error"><div className="flex gap-2"><AlertCircle size={14} />{serverError}</div></Alert>
      )}
      {/* Company name + industry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Company Name"
          value={form.name}
          onChange={set('name')}
          error={errors.name}
          required
          placeholder="Acme Corporation"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
          <select
            value={form.industry}
            onChange={set('industry')}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 bg-white"
          >
            <option value="">Select industry</option>
            {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
          </select>
        </div>
      </div>

      {/* Contact info */}
      <div className="p-3 bg-gray-50 rounded-2xl space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact Information</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Contact Name"  value={form.contactName}  onChange={set('contactName')}  placeholder="Jane Smith" />
          <Input label="Contact Email" value={form.contactEmail} onChange={set('contactEmail')} error={errors.contactEmail} type="email" placeholder="jane@company.com" />
          <Input label="Contact Phone" value={form.contactPhone} onChange={set('contactPhone')} type="tel" placeholder="+971 50 123 4567" />
          <Input label="Address / Location" value={form.address} onChange={set('address')} placeholder="Dubai, UAE" />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={3}
          placeholder="Any additional notes about this company…"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 resize-none"
        />
      </div>

      <div className="flex gap-3 justify-end pt-1">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          <CheckCircle size={14} />{saving ? 'Saving…' : 'Save Company'}
        </Button>
      </div>
    </div>
  );
}

// ─── Company Card ──────────────────────────────────────────────
function CompanyCard({ company, onEdit, onDelete, onToggleActive }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`bg-white rounded-2xl border transition-all ${company.active ? 'border-gray-200 hover:border-indigo-200 hover:shadow-sm' : 'border-gray-200 opacity-60'}`}>
      {/* Header row */}
      <div className="flex items-center gap-4 p-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${company.active ? 'bg-gradient-to-br from-indigo-400 to-indigo-700' : 'bg-gray-400'}`}>
          <Building2 size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-800">{company.name}</span>
            <Badge variant={company.active ? 'success' : 'default'} size="xs">
              {company.active ? 'Active' : 'Inactive'}
            </Badge>
            {company.industry && <Badge variant="default" size="xs">{company.industry}</Badge>}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {[company.contactName, company.address].filter(Boolean).join(' · ') || 'No contact info'}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button size="xs" variant="secondary" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Less' : 'More'}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => onEdit(company)}>
            <Edit3 size={13} />Edit
          </Button>
          <Button
            size="xs"
            variant={company.active ? 'warning' : 'success'}
            onClick={() => onToggleActive(company)}
            title={company.active ? 'Deactivate' : 'Activate'}
          >
            <RefreshCw size={13} />{company.active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="xs" variant="danger" onClick={() => onDelete(company)}>
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-gray-100 pt-3">
          {[
            { icon: Mail,     label: 'Email',   val: company.contactEmail || '—' },
            { icon: Phone,    label: 'Phone',   val: company.contactPhone || '—' },
            { icon: MapPin,   label: 'Address', val: company.address      || '—' },
            { icon: Briefcase,label: 'Notes',   val: company.notes        || '—' },
          ].map(({ icon: Icon, label, val }) => (
            <div key={label} className="p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-0.5"><Icon size={11} />{label}</div>
              <div className="text-xs text-gray-700 break-all">{val}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Delete Confirm Modal ──────────────────────────────────────
function DeleteModal({ company, onConfirm, onCancel, deleting }) {
  return (
    <div className="space-y-4">
      <Alert type="error">
        <div className="flex gap-2 items-start">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Delete <strong>{company.name}</strong>?</p>
            <p className="text-xs mt-1">This cannot be undone. Employees linked to this company will keep their organisation name, but will no longer be associated with this company record.</p>
          </div>
        </div>
      </Alert>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} disabled={deleting}>
          <Trash2 size={14} />{deleting ? 'Deleting…' : 'Delete Company'}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
export default function AdminCompanies() {
  const [companies,    setCompanies]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [createModal,  setCreateModal]  = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [createError,  setCreateError]  = useState('');
  const [editError,    setEditError]    = useState('');
  const [notification, setNotification] = useState({ msg: '', type: 'success' });

  const load = () => {
    setLoading(true);
    getCompanies().then(data => { setCompanies(data || []); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification({ msg: '', type: 'success' }), 4000);
  };

  const handleCreate = async (form) => {
    setSaving(true);
    setCreateError('');
    const res = await createCompany(form);
    setSaving(false);
    if (!res.success) { setCreateError(res.error || 'Failed to save. Check that the Companies table exists in your database.'); return; }
    notify('Company created successfully.');
    setCreateModal(false);
    setCreateError('');
    load();
  };

  const handleEdit = async (form) => {
    setSaving(true);
    setEditError('');
    const res = await updateCompany(editTarget.id, form);
    setSaving(false);
    if (!res.success) { setEditError(res.error || 'Failed to update.'); return; }
    notify('Company updated successfully.');
    setEditTarget(null);
    setEditError('');
    load();
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await deleteCompany(deleteTarget.id);
    setDeleting(false);
    if (!res.success) { notify(res.error, 'error'); return; }
    notify('Company deleted.');
    setDeleteTarget(null);
    load();
  };

  const handleToggleActive = async (company) => {
    await updateCompany(company.id, { active: !company.active });
    notify(`Company ${!company.active ? 'activated' : 'deactivated'}.`);
    load();
  };

  const filtered = companies.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) ||
      c.industry?.toLowerCase().includes(q) ||
      c.contactName?.toLowerCase().includes(q);
    const matchActive = filterActive === 'all' ||
      (filterActive === 'active' && c.active) ||
      (filterActive === 'inactive' && !c.active);
    return matchSearch && matchActive;
  });

  const activeCount   = companies.filter(c => c.active).length;
  const inactiveCount = companies.filter(c => !c.active).length;

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading companies…</div>;

  return (
    <div>
      <PageHeader
        title="Company Management"
        subtitle="Manage companies. Employees and company admins are assigned to companies via dropdown."
        action={
          <Button onClick={() => setCreateModal(true)} size="sm">
            <Plus size={15} />Add Company
          </Button>
        }
      />

      {notification.msg && (
        <Alert type={notification.type} className="mb-4">
          <div className="flex items-center gap-2"><CheckCircle size={14} />{notification.msg}</div>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total',    value: companies.length, color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
          { label: 'Active',   value: activeCount,      color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Inactive', value: inactiveCount,    color: 'text-amber-600',   bg: 'bg-amber-50'   },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search by name, industry, contact…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 bg-white"
          />
        </div>
        <select
          value={filterActive}
          onChange={e => setFilterActive(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white"
        >
          <option value="all">All Companies</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No companies found"
            description={companies.length === 0
              ? 'No companies added yet. Click "Add Company" to create the first one.'
              : 'No companies match your search criteria.'}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(company => (
            <CompanyCard
              key={company.id}
              company={company}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-400 text-right">
        Showing {filtered.length} of {companies.length} companies
      </div>

      {/* Create Modal */}
      <Modal open={createModal} onClose={() => { setCreateModal(false); setCreateError(''); }} title="Add New Company" size="lg">
        <CompanyForm
          onSave={handleCreate}
          onCancel={() => { setCreateModal(false); setCreateError(''); }}
          saving={saving}
          serverError={createError}
        />
      </Modal>

      {/* Edit Modal */}
      {editTarget && (
        <Modal open={!!editTarget} onClose={() => { setEditTarget(null); setEditError(''); }} title={`Edit — ${editTarget.name}`} size="lg">
          <CompanyForm
            initial={editTarget}
            onSave={handleEdit}
            onCancel={() => { setEditTarget(null); setEditError(''); }}
            saving={saving}
            serverError={editError}
          />
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Deletion" size="sm">
          <DeleteModal
            company={deleteTarget}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
            deleting={deleting}
          />
        </Modal>
      )}
    </div>
  );
}
