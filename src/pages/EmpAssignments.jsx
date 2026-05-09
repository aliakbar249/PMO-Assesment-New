import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { getEmployeeByUserId, getAssignmentsByEmployee, upsertAssignment, deleteAssignment } from '../lib/supabase';
import { Button, Card, Input, Select, Textarea, Alert, Badge, PageHeader, Modal, EmptyState } from '../components/UI';
import { Plus, Edit3, Trash2, Briefcase, Save } from 'lucide-react';

const ASSIGNMENT_TYPES = ['Project', 'Programme', 'Consulting Engagement', 'Internal Initiative', 'Change Programme', 'Operational', 'Other'];
const SECTORS = ['Banking & Finance', 'Technology', 'Healthcare', 'Energy', 'Government', 'Retail', 'Manufacturing', 'Telecoms', 'Construction', 'Other'];
const ROLES_ON_ASSIGNMENT = ['Project Manager', 'Programme Manager', 'Project Sponsor', 'Team Lead', 'Consultant', 'Subject Matter Expert', 'Analyst', 'Change Manager', 'Other'];
const STATUS_OPTIONS = ['Ongoing', 'Completed', 'On Hold', 'Cancelled'];
const BUDGET_RANGES = ['< $100K', '$100K–$500K', '$500K–$1M', '$1M–$5M', '$5M–$20M', '$20M+', 'Confidential'];

const EMPTY_FORM = {
  id: '', title: '', type: '', sector: '', clientOrg: '',
  role: '', startDate: '', endDate: '', status: '',
  budget: '', teamSize: '', location: '',
  description: '', outcomes: '', challenges: '',
  slotNumber: 1,
};

function AssignmentForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [errors, setErrors] = useState({});
  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: '' })); };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Required';
    if (!form.type) e.type = 'Required';
    if (!form.clientOrg?.trim()) e.clientOrg = 'Required';
    if (!form.role) e.role = 'Required';
    if (!form.startDate) e.startDate = 'Required';
    if (!form.status) e.status = 'Required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSave = () => { if (validate()) onSave(form); };

  return (
    <div className="space-y-4">
      <Input label="Assignment / Project Title" placeholder="ERP System Rollout" value={form.title} onChange={set('title')} error={errors.title} required />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select label="Assignment Type" value={form.type} onChange={set('type')} error={errors.type} required>
          <option value="">Select type</option>
          {ASSIGNMENT_TYPES.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Select label="Industry / Sector" value={form.sector} onChange={set('sector')}>
          <option value="">Select sector</option>
          {SECTORS.map(t => <option key={t}>{t}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Client / Organization" placeholder="Client Corp Ltd" value={form.clientOrg || ''} onChange={set('clientOrg')} error={errors.clientOrg} required />
        <Select label="Your Role on Assignment" value={form.role} onChange={set('role')} error={errors.role} required>
          <option value="">Select role</option>
          {ROLES_ON_ASSIGNMENT.map(r => <option key={r}>{r}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Input label="Start Date" type="month" value={form.startDate} onChange={set('startDate')} error={errors.startDate} required />
        <Input label="End Date" type="month" value={form.endDate} onChange={set('endDate')} hint="Leave blank if ongoing" />
        <Select label="Status" value={form.status} onChange={set('status')} error={errors.status} required>
          <option value="">Status</option>
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </Select>
        <Select label="Budget Range" value={form.budget || ''} onChange={set('budget')}>
          <option value="">Select range</option>
          {BUDGET_RANGES.map(b => <option key={b}>{b}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Team Size" type="number" placeholder="12" min="1" value={form.teamSize || ''} onChange={set('teamSize')} />
        <Input label="Location / Geography" placeholder="New York / Remote" value={form.location || ''} onChange={set('location')} />
      </div>

      <Textarea label="Assignment Description" placeholder="Brief description of the assignment scope and objectives…" value={form.description || ''} onChange={set('description')} rows={3} />
      <Textarea label="Key Outcomes / Achievements" placeholder="What were the key results, deliverables, or achievements…" value={form.outcomes || ''} onChange={set('outcomes')} rows={3} />
      <Textarea label="Key Challenges Overcome" placeholder="Significant challenges or risks you managed…" value={form.challenges || ''} onChange={set('challenges')} rows={2} />

      <div className="flex gap-3 justify-end pt-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave}><Save size={14} />Save Assignment</Button>
      </div>
    </div>
  );
}

export default function EmpAssignments({ onNavigate }) {
  const { currentUser, tick } = useApp();
  const [employee, setEmployee] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const empRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    getEmployeeByUserId(currentUser.id).then(async emp => {
      setEmployee(emp);
      empRef.current = emp;
      if (emp) {
        const asgns = await getAssignmentsByEmployee(emp.id);
        setAssignments(asgns || []);
      }
      setLoading(false);
    });
  }, [currentUser?.id, tick]);

  const reload = async () => {
    const emp = empRef.current;
    if (emp) {
      const asgns = await getAssignmentsByEmployee(emp.id);
      setAssignments(asgns || []);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading assignments…</div>;
  if (!employee) return <Alert type="warning">Please complete your profile first.</Alert>;

  const handleSave = async (data) => {
    setSaving(true);
    setSaveError('');
    // For edits, preserve the existing slot number; for new records upsertAssignment picks the free slot
    const slotNumber = data.id
      ? (assignments.find(a => a.id === data.id)?.slotNumber || 1)
      : null; // upsertAssignment will find the first free slot (1/2/3)
    const result = await upsertAssignment(employee.id, { ...data, slotNumber });
    setSaving(false);
    if (result && !result.success) {
      setSaveError(result.error || 'Failed to save assignment. Please try again.');
      return; // keep modal open so user sees the error
    }
    await reload();
    setModal(null);
  };

  const handleDelete = async (id) => {
    await deleteAssignment(id);
    await reload();
    setDeleteModal(null);
  };

  const editing = modal && modal !== 'add' ? assignments.find(a => a.id === modal) : null;

  return (
    <div>
      <PageHeader
        title="My Assignments"
        subtitle="Share up to 3 of your most successful assignments for 360° review."
        action={
          assignments.length < 3 && (
            <Button onClick={() => setModal('add')}><Plus size={16} />Add Assignment</Button>
          )
        }
      />

      {assignments.length >= 3 && (
        <Alert type="info" className="mb-4">You have added the maximum of 3 assignments. Remove one to add a different assignment.</Alert>
      )}

      {assignments.length === 0 ? (
        <Card>
          <EmptyState icon={Briefcase} title="No assignments yet"
            description="Add up to 3 of your most significant assignments. Reviewers will rate you on these."
            action={<Button onClick={() => setModal('add')}><Plus size={16} />Add First Assignment</Button>} />
        </Card>
      ) : (
        <div className="space-y-4">
          {assignments.map((asgn, i) => (
            <Card key={asgn.id} className="p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Briefcase size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-800">{asgn.title}</h3>
                      <Badge variant={asgn.status === 'Completed' ? 'success' : asgn.status === 'Ongoing' ? 'primary' : 'warning'}>
                        {asgn.status}
                      </Badge>
                      <span className="text-xs text-gray-400">Assignment {i + 1}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{asgn.role} · {asgn.clientOrg}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="secondary" size="xs" onClick={() => setModal(asgn.id)}><Edit3 size={13} />Edit</Button>
                  <Button variant="danger" size="xs" onClick={() => setDeleteModal(asgn.id)}><Trash2 size={13} /></Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                {[
                  { label: 'Type', val: asgn.type },
                  { label: 'Sector', val: asgn.sector },
                  { label: 'Period', val: `${asgn.startDate || '?'}${asgn.endDate ? ' → ' + asgn.endDate : ' → Present'}` },
                  { label: 'Budget', val: asgn.budget },
                  { label: 'Team Size', val: asgn.teamSize ? `${asgn.teamSize} people` : null },
                  { label: 'Location', val: asgn.location },
                ].filter(f => f.val).map(f => (
                  <div key={f.label} className="bg-gray-50 rounded-lg p-2">
                    <div className="text-gray-400 font-medium">{f.label}</div>
                    <div className="text-gray-700 font-medium mt-0.5">{f.val}</div>
                  </div>
                ))}
              </div>

              {asgn.description && <p className="text-xs text-gray-600 mb-2"><span className="font-semibold">Description:</span> {asgn.description}</p>}
              {asgn.outcomes && <p className="text-xs text-gray-600 mb-2"><span className="font-semibold">Key Outcomes:</span> {asgn.outcomes}</p>}
              {asgn.challenges && <p className="text-xs text-gray-600"><span className="font-semibold">Challenges:</span> {asgn.challenges}</p>}
            </Card>
          ))}
        </div>
      )}

      {assignments.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => onNavigate('emp-nominations')}>Continue to Nominate Reviewers →</Button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={!!modal} onClose={() => { setModal(null); setSaveError(''); }}
        title={modal === 'add' ? 'Add New Assignment' : 'Edit Assignment'} size="xl">
        {saveError && (
          <Alert type="error" className="mb-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">Save failed:</span> {saveError}
            </div>
          </Alert>
        )}
        {saving && (
          <Alert type="info" className="mb-4">Saving assignment…</Alert>
        )}
        <AssignmentForm
          initial={editing || EMPTY_FORM}
          onSave={handleSave}
          onCancel={() => { setModal(null); setSaveError(''); }}
        />
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Assignment?" size="sm">
        <p className="text-sm text-gray-600 mb-4">This will permanently remove this assignment. This cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteModal(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => handleDelete(deleteModal)}><Trash2 size={14} />Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
