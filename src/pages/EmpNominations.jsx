import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import {
  getEmployeeByUserId, getAssignmentsByEmployee, getNominations,
  saveNominationGroup, submitNominations, getReviewerConfigForEmployee,
} from '../lib/supabase';
import { Button, Card, Input, Alert, Badge, PageHeader, Modal } from '../components/UI';
import { Plus, Trash2, Send, CheckCircle, Edit3, Info } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// ── All possible reviewer categories ──────────────────────────────────────────
// Each category maps to a template reviewer_type bucket:
//   sponsor  bucket: sponsor, supervisor
//   peer     bucket: peer, client
//   team     bucket: teamMember
const ALL_CATEGORIES = [
  { id: 'sponsor',    label: 'Sponsor',       defaultMax: 1, color: 'purple', desc: 'Project sponsor who commissioned/funded the work',          bucket: 'sponsor' },
  { id: 'supervisor', label: 'Supervisor(s)', defaultMax: 2, color: 'blue',   desc: 'Direct line manager or supervisors on this assignment',      bucket: 'sponsor' },
  { id: 'peer',       label: 'Peers',         defaultMax: 3, color: 'indigo', desc: 'Colleagues at a similar level who worked with you',          bucket: 'peer'    },
  { id: 'client',     label: 'Client',        defaultMax: 2, color: 'green',  desc: 'Client-side contacts who can provide feedback',              bucket: 'peer'    },
  { id: 'teamMember', label: 'Team Members',  defaultMax: 3, color: 'amber',  desc: 'Direct reports or team members you led on this assignment',  bucket: 'team'    },
];

// Build the active categories list from template reviewer config.
// reviewerTypes: { self, sponsor, peer, team }
// reviewerCounts: { sponsor, peer, team }  ← used as the combined max per bucket,
//   distributed between the two categories that share a bucket (sponsor gets it all,
//   so does the first in each bucket). To keep it simple: the count from the template
//   is the max for each INDIVIDUAL category within that bucket.
function buildCategories(reviewerTypes, reviewerCounts) {
  const rt = reviewerTypes  || { sponsor: true, peer: true, team: true };
  const rc = reviewerCounts || { sponsor: 1, peer: 3, team: 3 };

  return ALL_CATEGORIES
    .filter(cat => {
      if (cat.bucket === 'sponsor') return !!rt.sponsor;
      if (cat.bucket === 'peer')    return !!rt.peer;
      if (cat.bucket === 'team')    return !!rt.team;
      return true;
    })
    .map(cat => ({
      ...cat,
      max: rc[cat.bucket] ?? cat.defaultMax,
    }));
}

const EMPTY_PERSON = { id: '', name: '', role: '', department: '', designation: '', email: '', phone: '' };

function PersonForm({ initial, onSave, onCancel, categoryLabel }) {
  const [form, setForm] = useState({ ...EMPTY_PERSON, ...initial });
  const [errors, setErrors] = useState({});
  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: '' })); };
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.designation.trim()) e.designation = 'Required';
    setErrors(e);
    return !Object.keys(e).length;
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 mb-3">Adding a <strong>{categoryLabel}</strong> — provide their details below. An account will be created after administrator approval.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Full Name" placeholder="Jane Doe" value={form.name} onChange={set('name')} error={errors.name} required />
        <Input label="Email Address" type="email" placeholder="jane@company.com" value={form.email} onChange={set('email')} error={errors.email} required />
        <Input label="Designation / Job Title" placeholder="Senior Manager" value={form.designation} onChange={set('designation')} error={errors.designation} required />
        <Input label="Role on this Assignment" placeholder="Project Sponsor" value={form.role} onChange={set('role')} />
        <Input label="Department" placeholder="Finance" value={form.department} onChange={set('department')} />
        <Input label="Phone / Contact" type="tel" placeholder="+1 555 0000" value={form.phone} onChange={set('phone')} />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => validate() && onSave({ ...form, id: form.id || uuidv4() })}>Add Person</Button>
      </div>
    </div>
  );
}

export default function EmpNominations({ onNavigate }) {
  const { currentUser, tick } = useApp();
  const [employee,      setEmployee]      = useState(null);
  const [assignments,   setAssignments]   = useState([]);
  const [nominations,   setNominations]   = useState(null);
  const [activeAssign,  setActiveAssign]  = useState(null);
  const [modal,         setModal]         = useState(null);
  const [submitModal,   setSubmitModal]   = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [reviewerConfig, setReviewerConfig] = useState(null); // { reviewerTypes, reviewerCounts }
  const empRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    getEmployeeByUserId(currentUser.id).then(async emp => {
      setEmployee(emp);
      empRef.current = emp;
      if (emp) {
        const [asgns, noms, revCfg] = await Promise.all([
          getAssignmentsByEmployee(emp.id),
          getNominations(emp.id),
          getReviewerConfigForEmployee(emp),
        ]);
        setAssignments(asgns || []);
        setNominations(noms);
        setReviewerConfig(revCfg);
        if (asgns?.length > 0 && !activeAssign) setActiveAssign(asgns[0].id);
      }
      setLoading(false);
    });
  }, [currentUser?.id, tick]);

  const reload = async () => {
    const emp = empRef.current;
    if (emp) {
      const noms = await getNominations(emp.id);
      setNominations(noms);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading nominations…</div>;
  if (!employee) return <Alert type="warning">Please complete your profile first.</Alert>;

  if (assignments.length === 0) {
    return (
      <div>
        <PageHeader title="Nominate Reviewers" />
        <Alert type="warning">You need to add at least one assignment before nominating reviewers. <button className="underline ml-1 font-medium" onClick={() => onNavigate('emp-assignments')}>Add Assignments →</button></Alert>
      </div>
    );
  }

  // Build the active categories list from the employee's template reviewer config
  const CATEGORIES = buildCategories(
    reviewerConfig?.reviewerTypes,
    reviewerConfig?.reviewerCounts,
  );

  // If no external reviewer types are enabled, this page shouldn't even be accessible.
  // Show a friendly notice just in case the employee navigates here directly.
  const needsExternalReviewers = CATEGORIES.length > 0;

  if (!needsExternalReviewers) {
    return (
      <div>
        <PageHeader title="Nominate Reviewers" />
        <Alert type="info">
          <div className="flex items-start gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5 text-blue-500" />
            <div>
              <p className="font-medium text-blue-800">No reviewer nominations required</p>
              <p className="text-sm text-blue-700 mt-0.5">
                Your assessment template is configured as <strong>self-assessment only</strong>.
                External reviewer nominations are not required — you can proceed directly to your self-assessment.
              </p>
              <button className="mt-2 text-sm font-medium text-blue-700 underline" onClick={() => onNavigate('emp-assessment')}>
                Go to Self-Assessment →
              </button>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  if (nominations?.submitted) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={40} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Nominations Submitted!</h2>
        <p className="text-gray-500 text-sm max-w-sm mx-auto">Your nominations have been sent to the administrator for review and approval. You will be notified when reviewers are activated.</p>
      </div>
    );
  }

  const getCatPeople = (assignId, catId) => nominations?.byAssignment?.[assignId]?.[catId] || [];

  const handleSavePerson = async (assignId, catId, person) => {
    setSaving(true);
    const current = getCatPeople(assignId, catId);
    const exists = current.findIndex(p => p.id === person.id);
    const updated = exists >= 0 ? current.map(p => p.id === person.id ? person : p) : [...current, person];
    await saveNominationGroup(employee.id, assignId, catId, updated);
    await reload();
    setSaving(false);
    setModal(null);
  };

  const handleDelete = async (assignId, catId, personId) => {
    const updated = getCatPeople(assignId, catId).filter(p => p.id !== personId);
    await saveNominationGroup(employee.id, assignId, catId, updated);
    await reload();
  };

  const totalNominated = assignments.reduce((sum, a) =>
    sum + CATEGORIES.reduce((s, c) => s + getCatPeople(a.id, c.id).length, 0), 0);

  const handleSubmit = async () => {
    setSaving(true);
    await submitNominations(employee.id);
    await reload();
    setSaving(false);
    setSubmitModal(false);
  };

  const BADGE_COLORS = { purple: 'purple', blue: 'primary', indigo: 'primary', green: 'success', amber: 'warning' };

  // Build a human-readable list of required reviewer types for the info banner
  const activeTypeLabels = [
    reviewerConfig?.reviewerTypes?.sponsor && 'Sponsors & Supervisors',
    reviewerConfig?.reviewerTypes?.peer    && 'Peers & Clients',
    reviewerConfig?.reviewerTypes?.team    && 'Team Members',
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title="Nominate Reviewers"
        subtitle="For each assignment, nominate people who can provide 360° feedback on your performance."
        action={
          totalNominated > 0 && (
            <Button variant="success" onClick={() => setSubmitModal(true)}><Send size={15} />Submit Nominations</Button>
          )
        }
      />

      {/* Template reviewer-type indicator */}
      {activeTypeLabels.length > 0 && activeTypeLabels.length < 3 && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>Required reviewer types for your assessment:</strong>{' '}
            {activeTypeLabels.join(' · ')}.
            Only the relevant categories are shown below.
          </span>
        </div>
      )}

      {assignments.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {assignments.map(a => (
            <button key={a.id} onClick={() => setActiveAssign(a.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-all
                ${activeAssign === a.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'}`}>
              {a.title}
            </button>
          ))}
        </div>
      )}

      {assignments.filter(a => !activeAssign || a.id === activeAssign).map(assign => (
        <div key={assign.id}>
          <div className="bg-gradient-to-r from-indigo-50 to-white rounded-2xl border border-indigo-100 p-4 mb-4">
            <div className="text-sm font-bold text-gray-800">{assign.title}</div>
            <div className="text-xs text-gray-500 mt-0.5">{assign.role} · {assign.clientOrg} · {assign.sector}</div>
            <div className="text-xs text-indigo-600 mt-1 font-medium">Nominate at least one person per relevant category below.</div>
          </div>

          <div className="space-y-4">
            {CATEGORIES.map(cat => {
              const people = getCatPeople(assign.id, cat.id);
              const canAdd = people.length < cat.max;
              return (
                <Card key={cat.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800">{cat.label}</span>
                        <Badge variant={BADGE_COLORS[cat.color]}>{people.length}/{cat.max}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{cat.desc}</p>
                    </div>
                    {canAdd && (
                      <Button size="xs" onClick={() => setModal({ assignId: assign.id, catId: cat.id, catLabel: cat.label })}>
                        <Plus size={13} />Add
                      </Button>
                    )}
                  </div>

                  {people.length === 0 ? (
                    <div className="text-xs text-gray-400 italic py-2">No one nominated yet for this category.</div>
                  ) : (
                    <div className="space-y-2">
                      {people.map(person => (
                        <div key={person.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-indigo-600 text-xs font-bold">{person.name?.[0]?.toUpperCase()}</span>
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-800">{person.name}</div>
                              <div className="text-xs text-gray-500">{person.designation}{person.department ? ` · ${person.department}` : ''}</div>
                              <div className="text-xs text-gray-400">{person.email}</div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="xs" onClick={() => setModal({ assignId: assign.id, catId: cat.id, catLabel: cat.label, person })}>
                              <Edit3 size={12} />
                            </Button>
                            <Button variant="danger" size="xs" onClick={() => handleDelete(assign.id, cat.id, person.id)}>
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {modal && (
        <Modal open={!!modal} onClose={() => setModal(null)} title={`Add ${modal.catLabel}`} size="lg">
          <PersonForm
            initial={modal.person || EMPTY_PERSON}
            categoryLabel={modal.catLabel}
            onSave={(person) => handleSavePerson(modal.assignId, modal.catId, person)}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      <Modal open={submitModal} onClose={() => setSubmitModal(false)} title="Submit Nominations for Review?">
        <p className="text-sm text-gray-600 mb-2">You are about to submit <strong>{totalNominated} reviewer nominations</strong> for administrator approval.</p>
        <p className="text-sm text-gray-500 mb-4">Once the admin approves profiles, reviewers will receive access to complete their assessments.</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setSubmitModal(false)}>Cancel</Button>
          <Button variant="success" onClick={handleSubmit} disabled={saving}><Send size={14} />{saving ? 'Submitting…' : 'Submit Nominations'}</Button>
        </div>
      </Modal>
    </div>
  );
}
