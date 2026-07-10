import { useState, useMemo } from 'react';
import {
  BookOpen, Plus, Search, Edit2, Trash2, Save, X,
  AlertTriangle, CheckCircle, Clock, Users, BarChart2,
  Award, Zap, ChevronDown, ChevronUp, Link2
} from 'lucide-react';
import {
  getTrainingModules, saveTrainingModule, deleteTrainingModule,
  getTrainingAssignments, saveTrainingAssignment, deleteTrainingAssignment,
  updateTrainingProgress, buildTrainingTeamSummary,
  getAssessmentScores, getTrainingRecommendations,
  TRAIN_STATUS_CONFIG, TRAIN_CATEGORY_LABELS, TRAIN_CATEGORY_COLORS, FORMAT_LABELS,
  getKPIItems, KPI_CATEGORY_LABELS,
} from '../lib/kpiTraining';
import { useApp } from '../store/AppContext';
import {
  Button, Badge, Input, Select, Textarea, Modal,
  PageHeader, StatCard, ProgressBar, EmptyState, Alert,
} from '../components/UI';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = TRAIN_STATUS_CONFIG[status] || TRAIN_STATUS_CONFIG.not_started;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function CategoryBadge({ cat }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRAIN_CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-600'}`}>{TRAIN_CATEGORY_LABELS[cat] || cat}</span>;
}

// ─── Module Catalog Modal (Create/Edit) ───────────────────────────────────────
function ModuleFormModal({ mod, onClose, onSaved }) {
  const kpiItems = getKPIItems();
  const [form, setForm] = useState(mod ? { ...mod } : {
    title: '', category: 'product_knowledge', description: '', format: 'e-learning',
    duration: 60, isMandatory: false, linkedKPIs: [], passingScore: 80,
    assessmentTrigger: { competency: '', thresholdScore: 3.0 },
  });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setNum = k => e => setForm(f => ({ ...f, [k]: parseFloat(e.target.value) || 0 }));

  const toggleLinkedKPI = (id) => {
    setForm(f => ({
      ...f,
      linkedKPIs: f.linkedKPIs.includes(id) ? f.linkedKPIs.filter(k => k !== id) : [...f.linkedKPIs, id],
    }));
  };

  const handleSave = () => {
    if (!form.title) return;
    saveTrainingModule(form);
    onSaved();
    onClose();
  };

  const COMPETENCIES = ['Product Knowledge', 'Selling Skills', 'Digital Proficiency', 'Compliance & Ethics', 'Customer Focus', 'Field Operations'];

  return (
    <Modal open onClose={onClose} title={mod ? 'Edit Training Module' : 'Create Training Module'} size="xl">
      <div className="space-y-5">
        <Input label="Module Title" placeholder="e.g. Cardio Product Line — Mechanism & Indications" value={form.title} onChange={set('title')} required />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Category" value={form.category} onChange={set('category')}>
            {Object.entries(TRAIN_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select label="Delivery Format" value={form.format} onChange={set('format')}>
            {Object.entries(FORMAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <Textarea label="Description" placeholder="Describe the module content and objectives…" value={form.description} onChange={set('description')} rows={3} />
        <div className="grid grid-cols-3 gap-3">
          <Input label="Duration (min)" type="number" value={form.duration} onChange={setNum('duration')} />
          <Input label="Passing Score (%)" type="number" value={form.passingScore} onChange={setNum('passingScore')} />
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1.5">Mandatory</label>
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="mandatory" checked={!!form.isMandatory} onChange={e => setForm(f => ({ ...f, isMandatory: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
              <label htmlFor="mandatory" className="text-sm text-gray-600">Required for all reps</label>
            </div>
          </div>
        </div>

        {/* Linked KPIs */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Linked KPI Items</label>
          <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-xl p-3 space-y-1">
            {kpiItems.map(k => (
              <label key={k.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded-lg">
                <input type="checkbox" checked={form.linkedKPIs.includes(k.id)} onChange={() => toggleLinkedKPI(k.id)} className="accent-indigo-600" />
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{KPI_CATEGORY_LABELS[k.category]}</span>
                <span>{k.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Assessment trigger */}
        <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-purple-800">
            <Zap size={14} />Assessment Competency Trigger
          </div>
          <p className="text-xs text-purple-600">If an employee scores below the threshold on this competency in their 360° assessment, this module will be recommended.</p>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Competency" value={form.assessmentTrigger?.competency || ''} onChange={e => setForm(f => ({ ...f, assessmentTrigger: { ...f.assessmentTrigger, competency: e.target.value } }))}>
              <option value="">None (no trigger)</option>
              {COMPETENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="Threshold Score (out of 5)" type="number" min="1" max="5" step="0.1"
              value={form.assessmentTrigger?.thresholdScore || 3.0}
              onChange={e => setForm(f => ({ ...f, assessmentTrigger: { ...f.assessmentTrigger, thresholdScore: parseFloat(e.target.value) } }))}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.title}><Save size={14} />{mod ? 'Update Module' : 'Create Module'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Assign Module Modal ──────────────────────────────────────────────────────
function AssignModuleModal({ module, onClose, onSaved }) {
  const { currentUser } = useApp();
  const [form, setForm] = useState({ employeeName: '', employeeId: '', deadline: '' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleAssign = () => {
    if (!form.employeeName || !form.deadline) return;
    saveTrainingAssignment({
      moduleId: module.id,
      employeeId: form.employeeId || `custom_${Date.now()}`,
      employeeName: form.employeeName,
      assignedBy: currentUser?.name || 'Admin',
      assignedDate: new Date().toISOString().split('T')[0],
      deadline: form.deadline,
      status: 'not_started',
      completionPct: 0,
    });
    onSaved();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Assign Training Module" size="sm">
      <div className="space-y-4">
        <div className="p-3 bg-indigo-50 rounded-xl">
          <div className="text-sm font-semibold text-indigo-800">{module.title}</div>
          <div className="text-xs text-indigo-600 mt-0.5">{FORMAT_LABELS[module.format]} · {module.duration} min</div>
        </div>
        <Input label="Employee Name" placeholder="Full name" value={form.employeeName} onChange={set('employeeName')} required />
        <Input label="Employee ID" placeholder="Internal ID (optional)" value={form.employeeId} onChange={set('employeeId')} />
        <Input label="Deadline" type="date" value={form.deadline} onChange={set('deadline')} required />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAssign} disabled={!form.employeeName || !form.deadline}>Assign</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Update Progress Modal ─────────────────────────────────────────────────────
function UpdateProgressModal({ assignment, onClose, onSaved }) {
  const [pct, setPct] = useState(assignment.completionPct || 0);
  const getStatus = (p) => {
    if (p >= 100) return 'completed';
    if (p > 0)    return 'in_progress';
    return 'not_started';
  };

  const handleSave = () => {
    updateTrainingProgress(assignment.id, parseInt(pct), getStatus(parseInt(pct)));
    onSaved();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Update Completion" size="sm">
      <div className="space-y-4">
        <div className="text-sm font-medium text-gray-700">{assignment.employeeName} — completion %</div>
        <Input type="number" min={0} max={100} value={pct} onChange={e => setPct(e.target.value)} label="Completion %" />
        <ProgressBar value={parseInt(pct) || 0} max={100} color={parseInt(pct) >= 100 ? 'green' : parseInt(pct) >= 50 ? 'amber' : 'red'} />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}><Save size={13} />Update</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Assessment Recommendations Panel ─────────────────────────────────────────
function RecommendationsPanel({ onSaved }) {
  const scores = useMemo(() => getAssessmentScores(), []);
  const { currentUser } = useApp();
  const [assigning, setAssigning] = useState(null); // { employeeId, moduleId }
  const [tick, setTick] = useState(0);
  const refresh = () => { setTick(t => t + 1); onSaved(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <Zap size={15} className="text-purple-500" />
        Assessment-Triggered Recommendations
      </div>
      <p className="text-xs text-gray-500">Employees whose 360° assessment scores fell below module thresholds — recommended training shown below.</p>

      {scores.map(emp => {
        const recs = getTrainingRecommendations(emp.employeeId);
        if (!recs.length) return null;
        return (
          <div key={emp.employeeId} className="border border-purple-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-purple-50 flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm text-purple-900">{emp.employeeName}</span>
                <span className="text-xs text-purple-600 ml-2">{recs.length} module{recs.length !== 1 ? 's' : ''} recommended</span>
              </div>
            </div>
            <div className="divide-y divide-purple-50">
              {recs.map(rec => (
                <div key={rec.module.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{rec.module.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Trigger: <strong>{rec.competency}</strong> score {rec.score.toFixed(1)} &lt; threshold {rec.threshold.toFixed(1)}
                    </div>
                  </div>
                  {rec.alreadyAssigned
                    ? <Badge variant="success" size="sm">Already Assigned</Badge>
                    : (
                      <Button size="xs" onClick={() => setAssigning({ employeeId: emp.employeeId, employeeName: emp.employeeName, moduleId: rec.module.id })}>
                        Assign →
                      </Button>
                    )
                  }
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {assigning && (
        <AssignModuleModal
          module={getTrainingModules().find(m => m.id === assigning.moduleId) || {}}
          onClose={() => setAssigning(null)}
          onSaved={() => { setAssigning(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Main Training Dashboard ───────────────────────────────────────────────────
export default function TrainingDashboard() {
  const { currentUser } = useApp();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'company_admin';

  const [activeTab, setActiveTab] = useState('tracker'); // tracker | catalog | recommendations
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCat, setFilterCat]   = useState('all');
  const [groupBy, setGroupBy]       = useState('module'); // module | employee
  const [moduleForm, setModuleForm] = useState(null);      // null | mod object | 'new'
  const [assignModal, setAssignModal] = useState(null);    // module
  const [progressModal, setProgressModal] = useState(null); // assignment
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  const teamSummary = useMemo(() => buildTrainingTeamSummary(), [tick]);
  const allAssignments = useMemo(() => getTrainingAssignments(), [tick]);
  const allModules     = useMemo(() => getTrainingModules(), [tick]);

  // Stats
  const totalAssigned = allAssignments.length;
  const completed = allAssignments.filter(a => a.status === 'completed').length;
  const overdue   = allAssignments.filter(a => a.status === 'overdue').length;
  const mandatory = allModules.filter(m => m.isMandatory).length;
  const mandatoryCompleted = allAssignments.filter(a => {
    const mod = allModules.find(m => m.id === a.moduleId);
    return mod?.isMandatory && a.status === 'completed';
  }).length;

  // Filtered tracker data
  const filteredSummary = useMemo(() => teamSummary.filter(row => {
    const q = search.toLowerCase();
    const matchSearch = !q || row.module.title.toLowerCase().includes(q);
    const matchCat    = filterCat === 'all' || row.module.category === filterCat;
    const matchStatus = filterStatus === 'all' || row.assignments.some(a => a.status === filterStatus);
    return matchSearch && matchCat && matchStatus;
  }), [teamSummary, search, filterCat, filterStatus, tick]);

  const filteredAssignments = useMemo(() => allAssignments.filter(a => {
    const q = search.toLowerCase();
    const mod = allModules.find(m => m.id === a.moduleId);
    const matchSearch = !q || a.employeeName?.toLowerCase().includes(q) || mod?.title.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    const matchCat    = filterCat === 'all' || mod?.category === filterCat;
    return matchSearch && matchStatus && matchCat;
  }), [allAssignments, allModules, search, filterStatus, filterCat, tick]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training Targets"
        subtitle="Manage and track field force training modules, completions, and assessment-linked recommendations"
        action={isAdmin && (
          <Button onClick={() => setModuleForm('new')}><Plus size={15} />New Module</Button>
        )}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Assigned" value={totalAssigned} icon={BookOpen} color="indigo" />
        <StatCard label="Completed" value={completed} icon={CheckCircle} color="green" sub={`${totalAssigned ? Math.round((completed/totalAssigned)*100) : 0}% completion rate`} />
        <StatCard label="Overdue" value={overdue} icon={AlertTriangle} color="red" />
        <StatCard label="Mandatory Modules" value={mandatory} icon={Award} color="amber" sub={`${mandatoryCompleted} completions`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { id: 'tracker',         label: 'Tracker' },
          { id: 'catalog',         label: 'Module Catalog' },
          { id: 'recommendations', label: '⚡ AI Recommendations' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TRACKER TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'tracker' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search by module or employee name…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-indigo-400 focus:ring-indigo-100 bg-white" />
            </div>
            <Select value={filterCat} onChange={e => setFilterCat(e.target.value)} wrapClass="w-full sm:w-48">
              <option value="all">All Categories</option>
              {Object.entries(TRAIN_CATEGORY_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} wrapClass="w-full sm:w-40">
              <option value="all">All Statuses</option>
              {Object.entries(TRAIN_STATUS_CONFIG).map(([v,cfg]) => <option key={v} value={v}>{cfg.label}</option>)}
            </Select>
            <Select value={groupBy} onChange={e => setGroupBy(e.target.value)} wrapClass="w-full sm:w-44">
              <option value="module">Group by Module</option>
              <option value="employee">Group by Employee</option>
            </Select>
          </div>

          {/* By Module grouping */}
          {groupBy === 'module' && (
            <div className="space-y-4">
              {filteredSummary.length === 0 ? (
                <EmptyState icon={BookOpen} title="No training modules found" description="Create modules in the catalog and assign them to employees." />
              ) : filteredSummary.map(row => {
                const { module: mod, assignments, teamCompletionPct, overdueCount, totalAssigned: total } = row;
                const linkedKpiItems = getKPIItems().filter(k => (mod.linkedKPIs || []).includes(k.id));
                return (
                  <div key={mod.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {/* Module header */}
                    <div className="px-5 py-4 border-b border-gray-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-gray-800 text-sm">{mod.title}</span>
                            <CategoryBadge cat={mod.category} />
                            {mod.isMandatory && <Badge variant="danger" size="xs">Mandatory</Badge>}
                            <span className="text-xs text-gray-400">{FORMAT_LABELS[mod.format]} · {mod.duration} min</span>
                          </div>
                          {linkedKpiItems.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              <Link2 size={10} className="text-gray-400" />
                              {linkedKpiItems.map(k => (
                                <span key={k.id} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{k.name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-gray-800">{teamCompletionPct}%</div>
                          <div className="text-xs text-gray-400">{assignments.filter(a => a.status === 'completed').length}/{total} complete</div>
                          {overdueCount > 0 && <div className="text-xs text-red-600 font-medium">{overdueCount} overdue</div>}
                        </div>
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={teamCompletionPct} max={100} color={teamCompletionPct >= 80 ? 'green' : teamCompletionPct >= 50 ? 'amber' : 'red'} showPercent={false} />
                      </div>
                    </div>

                    {/* Per-employee rows */}
                    <div className="divide-y divide-gray-50">
                      {assignments.map(asgn => (
                        <div key={asgn.id} className="px-5 py-3 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800">{asgn.employeeName}</div>
                            <div className="text-xs text-gray-400">Deadline: {asgn.deadline || '—'} · Assigned by: {asgn.assignedBy}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24 hidden sm:block">
                              <ProgressBar value={asgn.completionPct || 0} max={100} showPercent={false} color={asgn.completionPct >= 100 ? 'green' : asgn.completionPct >= 50 ? 'amber' : 'red'} />
                              <div className="text-xs text-gray-400 text-right mt-0.5">{asgn.completionPct}%</div>
                            </div>
                            <StatusBadge status={asgn.status} />
                            {isAdmin && (
                              <Button size="xs" variant="secondary" onClick={() => setProgressModal(asgn)}>
                                <Edit2 size={10} />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {isAdmin && (
                      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
                        <Button size="xs" variant="ghost" onClick={() => setAssignModal(mod)}>
                          <Plus size={11} />Assign to another rep
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* By Employee grouping */}
          {groupBy === 'employee' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {filteredAssignments.length === 0 ? (
                <EmptyState icon={Users} title="No assignments found" />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Module</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Category</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Deadline</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">KPI Link</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Progress</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      {isAdmin && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAssignments.map(asgn => {
                      const mod = allModules.find(m => m.id === asgn.moduleId);
                      const linkedKpis = getKPIItems().filter(k => (mod?.linkedKPIs || []).includes(k.id));
                      return (
                        <tr key={asgn.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 font-medium text-gray-800">{asgn.employeeName}</td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-800">{mod?.title || '—'}</div>
                            {mod?.isMandatory && <Badge variant="danger" size="xs">Mandatory</Badge>}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            {mod && <CategoryBadge cat={mod.category} />}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">{asgn.deadline || '—'}</td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {linkedKpis.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {linkedKpis.slice(0, 2).map(k => (
                                  <span key={k.id} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{k.name}</span>
                                ))}
                                {linkedKpis.length > 2 && <span className="text-xs text-gray-400">+{linkedKpis.length-2}</span>}
                              </div>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-20 hidden sm:block">
                                <ProgressBar value={asgn.completionPct || 0} max={100} showPercent={false} color={asgn.completionPct >= 100 ? 'green' : asgn.completionPct >= 50 ? 'amber' : 'red'} />
                              </div>
                              <span className="text-xs text-gray-600 font-medium">{asgn.completionPct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center"><StatusBadge status={asgn.status} /></td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <Button size="xs" variant="secondary" onClick={() => setProgressModal(asgn)}>
                                <Edit2 size={10} />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── CATALOG TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search modules…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-indigo-400 focus:ring-indigo-100 bg-white" />
            </div>
            <Select value={filterCat} onChange={e => setFilterCat(e.target.value)} wrapClass="w-48">
              <option value="all">All Categories</option>
              {Object.entries(TRAIN_CATEGORY_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allModules.filter(m => {
              const q = search.toLowerCase();
              return (!q || m.title.toLowerCase().includes(q)) && (filterCat === 'all' || m.category === filterCat);
            }).map(mod => {
              const linkedKpis = getKPIItems().filter(k => (mod.linkedKPIs || []).includes(k.id));
              return (
                <div key={mod.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <CategoryBadge cat={mod.category} />
                        {mod.isMandatory && <Badge variant="danger" size="xs">Mandatory</Badge>}
                      </div>
                      <h3 className="font-semibold text-sm text-gray-800">{mod.title}</h3>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setModuleForm(mod)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => { if (window.confirm('Delete this module?')) { deleteTrainingModule(mod.id); refresh(); } }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 leading-relaxed">{mod.description}</p>

                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{FORMAT_LABELS[mod.format]}</span>
                    <span>·</span>
                    <span>{mod.duration} min</span>
                    {mod.passingScore && <><span>·</span><span>Pass: {mod.passingScore}%</span></>}
                  </div>

                  {linkedKpis.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link2 size={11} className="text-gray-400" />
                      <span className="text-xs text-gray-400">Links to:</span>
                      {linkedKpis.map(k => <span key={k.id} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{k.name}</span>)}
                    </div>
                  )}

                  {mod.assessmentTrigger?.competency && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 rounded-lg">
                      <Zap size={10} className="text-purple-500" />
                      <span className="text-xs text-purple-700">Trigger: <strong>{mod.assessmentTrigger.competency}</strong> &lt; {mod.assessmentTrigger.thresholdScore}</span>
                    </div>
                  )}

                  {isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => setAssignModal(mod)}>
                      <Plus size={12} />Assign to Rep
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── RECOMMENDATIONS TAB ─────────────────────────────────────────── */}
      {activeTab === 'recommendations' && (
        <RecommendationsPanel onSaved={refresh} />
      )}

      {/* ─── Modals ───────────────────────────────────────────────────────── */}
      {moduleForm && (
        <ModuleFormModal
          mod={moduleForm === 'new' ? null : moduleForm}
          onClose={() => setModuleForm(null)}
          onSaved={refresh}
        />
      )}
      {assignModal && (
        <AssignModuleModal module={assignModal} onClose={() => setAssignModal(null)} onSaved={refresh} />
      )}
      {progressModal && (
        <UpdateProgressModal assignment={progressModal} onClose={() => setProgressModal(null)} onSaved={refresh} />
      )}
    </div>
  );
}
