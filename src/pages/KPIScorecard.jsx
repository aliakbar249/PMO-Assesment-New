import { useState, useMemo } from 'react';
import {
  Target, AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  BookOpen, Edit2, Save, ArrowLeft, Award, Activity, BarChart2
} from 'lucide-react';
import {
  getKPIAssignments, buildScorecard, bulkSaveActuals, getKPIActualsByAssignment,
  getKPITemplates, getKPIItems, getLinkedModulesForKPI,
  KPI_CATEGORY_LABELS, KPI_CATEGORY_COLORS, STATUS_CONFIG,
} from '../lib/kpiTraining';
import {
  getTrainingAssignmentsByEmployee, saveTrainingAssignment, getTrainingModules,
  TRAIN_STATUS_CONFIG, TRAIN_CATEGORY_LABELS, TRAIN_CATEGORY_COLORS,
} from '../lib/kpiTraining';
import { useApp } from '../store/AppContext';
import { Button, Badge, Input, Modal, PageHeader, ProgressBar, Alert } from '../components/UI';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function attainmentColor(pct) {
  if (pct === null || pct === undefined) return 'gray';
  if (pct >= 90) return 'green';
  if (pct >= 70) return 'amber';
  return 'red';
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_entered;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function AttainmentRing({ pct, size = 80 }) {
  if (pct === null || pct === undefined) return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <span className="text-gray-400 text-sm font-medium">—</span>
    </div>
  );
  const color = pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={7} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.min(pct, 100) / 100)}
          strokeLinecap="round" />
      </svg>
      <div className="absolute text-center">
        <div className="text-base font-bold" style={{ color }}>{pct}%</div>
      </div>
    </div>
  );
}

// ─── Enter Actuals inline form ────────────────────────────────────────────────
function EnterActualsPanel({ assignment, onSaved, onCancel }) {
  const { currentUser } = useApp();
  const templates = getKPITemplates();
  const items = getKPIItems();
  const tpl = templates.find(t => t.id === assignment.templateId);
  const kpiIds = tpl?.kpiIds || [];
  const tplItems = items.filter(i => kpiIds.includes(i.id));
  const existingActuals = getKPIActualsByAssignment(assignment.id);
  const existingMap = Object.fromEntries(existingActuals.map(a => [a.kpiItemId, a.actualValue]));
  const [values, setValues] = useState(() => Object.fromEntries(tplItems.map(i => [i.id, existingMap[i.id] ?? ''])));

  const handleSave = () => {
    bulkSaveActuals(assignment.id, values, currentUser?.name || 'Admin');
    onSaved();
  };

  const cats = ['activity', 'output', 'engagement', 'compliance'];

  return (
    <div className="bg-white border-2 border-indigo-200 rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">Enter KPI Actuals</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={handleSave}><Save size={13} />Save</Button>
        </div>
      </div>
      {cats.map(cat => {
        const catItems = tplItems.filter(i => i.category === cat);
        if (!catItems.length) return null;
        const cfg = KPI_CATEGORY_COLORS[cat];
        return (
          <div key={cat}>
            <div className={`text-xs font-semibold uppercase tracking-wide px-2 py-1.5 rounded-lg mb-2 ${cfg.badge}`}>{KPI_CATEGORY_LABELS[cat]}</div>
            <div className="space-y-2">
              {catItems.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="flex-1 text-sm text-gray-700">{item.name}</div>
                  <div className="text-xs text-gray-400 w-24 text-right">Target: {item.targetValue}{item.unit === '%' ? '%' : ` ${item.unit}`}</div>
                  <Input
                    type="number"
                    placeholder="Actual"
                    value={values[item.id]}
                    onChange={e => setValues(v => ({ ...v, [item.id]: e.target.value }))}
                    wrapClass="w-28"
                    className="text-sm"
                  />
                  <div className="text-xs text-gray-400 w-10">{item.unit}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Assign Training Modal ────────────────────────────────────────────────────
function AssignTrainingModal({ employeeId, employeeName, moduleId, onClose, onSaved }) {
  const allModules = getTrainingModules();
  const mod = allModules.find(m => m.id === moduleId);
  const { currentUser } = useApp();
  const [deadline, setDeadline] = useState('');

  const handleAssign = () => {
    saveTrainingAssignment({
      moduleId,
      employeeId,
      employeeName,
      assignedBy: currentUser?.name || 'Admin',
      assignedDate: new Date().toISOString().split('T')[0],
      deadline,
      status: 'not_started',
      completionPct: 0,
    });
    onSaved();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Assign Training Module" size="sm">
      <div className="space-y-4">
        <div className="p-3 bg-indigo-50 rounded-xl text-sm text-indigo-800">
          <div className="font-semibold">{mod?.title}</div>
          <div className="text-xs text-indigo-600 mt-0.5">{mod?.format} · {mod?.duration} min · Assigning to: <strong>{employeeName}</strong></div>
        </div>
        <Input label="Deadline" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} required />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAssign} disabled={!deadline}>Assign Module</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Individual Scorecard ─────────────────────────────────────────────────
export default function KPIScorecard({ onNavigate }) {
  const { currentUser } = useApp();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'company_admin';

  const assignments = useMemo(() => getKPIAssignments(), []);
  const [selectedId, setSelectedId] = useState(assignments[0]?.id || null);
  const [editMode, setEditMode]     = useState(false);
  const [assignTraining, setAssignTraining] = useState(null); // { moduleId }
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  const assignment = useMemo(() => assignments.find(a => a.id === selectedId), [selectedId, assignments]);
  const sc = useMemo(() => assignment ? buildScorecard(assignment) : null, [assignment, tick]);

  // Training assignments for this employee
  const trainingAsgns = useMemo(() => assignment ? getTrainingAssignmentsByEmployee(assignment.employeeId) : [], [assignment, tick]);
  const assignedModuleIds = new Set(trainingAsgns.map(a => a.moduleId));

  if (!assignment || !sc) {
    return (
      <div className="space-y-4">
        <PageHeader title="KPI Scorecard" subtitle="Individual KPI performance view" />
        <div className="text-center py-12 text-gray-400 text-sm">No KPI assignments found. Create an assignment from the KPI Dashboard.</div>
      </div>
    );
  }

  const { sections, overallAvg, actions } = sc;

  // Strongest / weakest category
  const catAvgs = sections.filter(s => s.avg !== null).sort((a, b) => b.avg - a.avg);
  const strongest = catAvgs[0];
  const weakest   = catAvgs[catAvgs.length - 1];

  return (
    <div className="space-y-6">
      <PageHeader
        title="KPI Scorecard"
        subtitle="Individual performance view across all KPI categories"
        action={
          <Button variant="secondary" size="sm" onClick={() => onNavigate('adm-kpis')}>
            <ArrowLeft size={13} />Team Dashboard
          </Button>
        }
      />

      {/* Rep selector */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-gray-500">Select Rep:</span>
          {assignments.map(a => (
            <button key={a.id} onClick={() => { setSelectedId(a.id); setEditMode(false); }}
              className={`text-sm px-3 py-1.5 rounded-xl font-medium transition-all ${selectedId === a.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {a.employeeName}
            </button>
          ))}
        </div>
      </div>

      {/* Summary panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-5">
          <AttainmentRing pct={overallAvg} size={80} />
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Overall Attainment</div>
            <div className="text-lg font-bold text-gray-800">{overallAvg !== null ? `${overallAvg}%` : 'No data'}</div>
            <div className="text-xs text-gray-500 mt-1">{assignment.period} · {assignment.territory}</div>
          </div>
        </div>
        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5 flex items-center gap-3">
          <TrendingUp size={28} className="text-emerald-500 flex-shrink-0" />
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Strongest Category</div>
            <div className="text-sm font-bold text-gray-800">{strongest ? KPI_CATEGORY_LABELS[strongest.category] : '—'}</div>
            <div className="text-sm font-bold text-emerald-600">{strongest?.avg !== null ? `${strongest.avg}%` : '—'}</div>
          </div>
        </div>
        <div className="bg-red-50 rounded-2xl border border-red-100 p-5 flex items-center gap-3">
          <TrendingDown size={28} className="text-red-400 flex-shrink-0" />
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Needs Attention</div>
            <div className="text-sm font-bold text-gray-800">{weakest ? KPI_CATEGORY_LABELS[weakest.category] : '—'}</div>
            <div className="text-sm font-bold text-red-600">{weakest?.avg !== null ? `${weakest.avg}%` : '—'}</div>
          </div>
        </div>
      </div>

      {/* Edit actuals toggle */}
      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" variant={editMode ? 'secondary' : 'outline'} onClick={() => setEditMode(m => !m)}>
            <Edit2 size={13} />{editMode ? 'Cancel Editing' : 'Enter Actuals'}
          </Button>
        </div>
      )}

      {editMode && (
        <EnterActualsPanel
          assignment={assignment}
          onSaved={() => { refresh(); setEditMode(false); }}
          onCancel={() => setEditMode(false)}
        />
      )}

      {/* KPI Categories */}
      {sections.map(sec => {
        const cfg = KPI_CATEGORY_COLORS[sec.category];
        return (
          <div key={sec.category} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className={`px-6 py-4 flex items-center justify-between border-b border-gray-100 ${cfg.bg}`}>
              <span className={`font-bold text-sm ${cfg.text}`}>{KPI_CATEGORY_LABELS[sec.category]} KPIs</span>
              <span className={`text-sm font-bold ${sec.avg >= 90 ? 'text-emerald-600' : sec.avg >= 70 ? 'text-amber-600' : sec.avg !== null ? 'text-red-600' : 'text-gray-400'}`}>
                {sec.avg !== null ? `${sec.avg}% avg` : 'No data'}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {sec.kpis.map(kpi => {
                const linkedMods = getLinkedModulesForKPI(kpi.id);
                const showTraining = (kpi.status === 'below_target' || kpi.status === 'at_risk' || kpi.status === 'mandatory_failed') && linkedMods.length > 0;
                return (
                  <div key={kpi.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-sm font-semibold text-gray-800">{kpi.name}</span>
                          {kpi.isMandatory && <Badge variant="danger" size="xs">Mandatory</Badge>}
                        </div>
                        <div className="text-xs text-gray-400">{kpi.description}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Target: <strong>{kpi.targetValue}{kpi.unit === '%' ? '%' : ` ${kpi.unit}`}</strong> · {kpi.frequency}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {kpi.actual !== null ? (
                          <span className="text-base font-bold text-gray-800">
                            {kpi.actual}{kpi.unit === '%' ? '%' : ` ${kpi.unit}`}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Not entered</span>
                        )}
                        <StatusBadge status={kpi.status} />
                      </div>
                    </div>

                    {kpi.attainmentPct !== null && (
                      <div className="mb-2">
                        <ProgressBar value={kpi.attainmentPct} max={100} color={attainmentColor(kpi.attainmentPct)} label={`Attainment: ${kpi.attainmentPct}%`} />
                      </div>
                    )}

                    {/* Training link */}
                    {showTraining && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {linkedMods.map(mod => (
                          <div key={mod.id} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs">
                            <BookOpen size={11} className="text-indigo-500" />
                            <span className="text-indigo-700 font-medium">{mod.title}</span>
                            {isAdmin && !assignedModuleIds.has(mod.id) && (
                              <button
                                onClick={() => setAssignTraining({ moduleId: mod.id })}
                                className="ml-1 text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                              >Assign →</button>
                            )}
                            {assignedModuleIds.has(mod.id) && (
                              <Badge variant="success" size="xs">Assigned</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Management Action Panel */}
      {actions.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-amber-200 overflow-hidden">
          <div className="px-6 py-4 bg-amber-50 flex items-center gap-2 border-b border-amber-100">
            <AlertTriangle size={16} className="text-amber-600" />
            <h3 className="font-bold text-sm text-amber-800">Management Action Panel</h3>
            <span className="ml-auto text-xs text-amber-600">{actions.length} recommendation{actions.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-amber-50">
            {actions.map((a, i) => (
              <div key={i} className="px-6 py-3 flex items-start gap-3">
                <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-bold mt-0.5 ${
                  a.level === 'critical' ? 'bg-red-100 text-red-700'
                  : a.level === 'high'   ? 'bg-orange-100 text-orange-700'
                  : 'bg-amber-100 text-amber-700'
                }`}>{a.level.toUpperCase()}</span>
                <p className="text-sm text-gray-700 leading-relaxed">{a.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {actions.length === 0 && overallAvg !== null && overallAvg >= 90 && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <CheckCircle size={20} className="text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">Excellent performance — all KPIs are on track. Keep it up!</p>
        </div>
      )}

      {/* Assign training modal */}
      {assignTraining && (
        <AssignTrainingModal
          employeeId={assignment.employeeId}
          employeeName={assignment.employeeName}
          moduleId={assignTraining.moduleId}
          onClose={() => setAssignTraining(null)}
          onSaved={() => { refresh(); setAssignTraining(null); }}
        />
      )}
    </div>
  );
}
