import { useState, useMemo } from 'react';
import {
  Target, TrendingUp, AlertTriangle, CheckCircle, Users,
  ChevronDown, ChevronUp, Search, Filter, Plus, Edit2, Save,
  X, BookOpen, BarChart2, Award, Activity
} from 'lucide-react';
import {
  buildTeamSummary, buildScorecard, getKPITemplates, getKPIItems,
  getKPIAssignments, saveKPIAssignment, deleteKPIAssignment,
  bulkSaveActuals, getKPIActualsByAssignment,
  KPI_CATEGORY_LABELS, KPI_CATEGORY_COLORS, STATUS_CONFIG,
  getLinkedModulesForKPI,
} from '../lib/kpiTraining';
import { useApp } from '../store/AppContext';
import { Button, Badge, Input, Select, Modal, PageHeader, StatCard, Card, CardHeader, ProgressBar, EmptyState } from '../components/UI';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function attainmentColor(pct) {
  if (pct === null) return 'gray';
  if (pct >= 90) return 'green';
  if (pct >= 70) return 'amber';
  return 'red';
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_entered;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function CategoryBadge({ cat }) {
  const cfg = KPI_CATEGORY_COLORS[cat] || {};
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge || 'bg-gray-100 text-gray-600'}`}>{KPI_CATEGORY_LABELS[cat] || cat}</span>;
}

function AttainmentRing({ pct, size = 56 }) {
  if (pct === null) return <div className="text-gray-400 text-xs font-medium text-center">—</div>;
  const color = pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={size/2 - 4} fill="none" stroke="#f1f5f9" strokeWidth={5} />
        <circle cx={size/2} cy={size/2} r={size/2 - 4} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${2 * Math.PI * (size/2 - 4)}`}
          strokeDashoffset={`${2 * Math.PI * (size/2 - 4) * (1 - Math.min(pct, 100) / 100)}`}
          strokeLinecap="round" />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>{pct}%</span>
    </div>
  );
}

// ─── Enter Actuals Modal ──────────────────────────────────────────────────────
function EnterActualsModal({ assignment, onClose, onSaved }) {
  const { currentUser } = useApp();
  const templates = getKPITemplates();
  const items = getKPIItems();
  const tpl = templates.find(t => t.id === assignment.templateId);
  const kpiIds = tpl?.kpiIds || [];
  const tplItems = items.filter(i => kpiIds.includes(i.id));
  const existingActuals = getKPIActualsByAssignment(assignment.id);
  const existingMap = Object.fromEntries(existingActuals.map(a => [a.kpiItemId, a.actualValue]));

  const [values, setValues] = useState(() => Object.fromEntries(tplItems.map(i => [i.id, existingMap[i.id] ?? ''])));
  const [saving, setSaving] = useState(false);

  const cats = ['activity', 'output', 'engagement', 'compliance'];

  const handleSave = () => {
    setSaving(true);
    bulkSaveActuals(assignment.id, values, currentUser?.name || 'Admin');
    setTimeout(() => { setSaving(false); onSaved(); onClose(); }, 300);
  };

  return (
    <Modal open onClose={onClose} title={`Enter KPI Actuals — ${assignment.employeeName}`} size="xl">
      <div className="space-y-6">
        <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl text-sm text-indigo-800">
          <BarChart2 size={15} className="text-indigo-500 flex-shrink-0" />
          <span>Period: <strong>{assignment.period}</strong> · Template: <strong>{tpl?.name}</strong></span>
        </div>

        {cats.map(cat => {
          const catItems = tplItems.filter(i => i.category === cat);
          if (!catItems.length) return null;
          const cfg = KPI_CATEGORY_COLORS[cat];
          return (
            <div key={cat}>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-3 ${cfg.bg}`}>
                <span className={`text-sm font-semibold ${cfg.text}`}>{KPI_CATEGORY_LABELS[cat]}</span>
              </div>
              <div className="space-y-2">
                {catItems.map(item => (
                  <div key={item.id} className="grid grid-cols-12 items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50">
                    <div className="col-span-5">
                      <div className="text-sm font-medium text-gray-800">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.frequency} · target: {item.targetValue}{item.unit === '%' ? '%' : ` ${item.unit}`}</div>
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        placeholder={`Target: ${item.targetValue}`}
                        value={values[item.id]}
                        onChange={e => setValues(v => ({ ...v, [item.id]: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                    <div className="col-span-2 text-xs text-gray-500">{item.unit}</div>
                    {item.isMandatory && <div className="col-span-2"><Badge variant="danger" size="xs">Mandatory</Badge></div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}><Save size={14} />{saving ? 'Saving…' : 'Save Actuals'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Assign Template Modal ────────────────────────────────────────────────────
function AssignTemplateModal({ onClose, onSaved }) {
  const templates = getKPITemplates();
  const [form, setForm] = useState({ templateId: '', employeeId: '', employeeName: '', territory: '', team: '', period: 'Q2 2026' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.templateId || !form.employeeName) return;
    saveKPIAssignment({ ...form, status: 'active' });
    onSaved();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Assign KPI Template to Employee" size="md">
      <div className="space-y-4">
        <Select label="KPI Template" value={form.templateId} onChange={set('templateId')} required>
          <option value="">Select template…</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Input label="Employee Name" placeholder="Full name" value={form.employeeName} onChange={set('employeeName')} required />
        <Input label="Employee ID" placeholder="Internal ID (optional)" value={form.employeeId} onChange={set('employeeId')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Territory" placeholder="e.g. North Region" value={form.territory} onChange={set('territory')} />
          <Input label="Team" placeholder="e.g. Team A" value={form.team} onChange={set('team')} />
        </div>
        <Input label="Review Period" placeholder="e.g. Q2 2026" value={form.period} onChange={set('period')} />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.templateId || !form.employeeName}><Plus size={14} />Assign</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Full Scorecard Drawer ────────────────────────────────────────────────────
function ScorecardDrawer({ assignment, onClose, onEnterActuals }) {
  const sc = buildScorecard(assignment);
  if (!sc) return null;
  const { sections, overallAvg, actions } = sc;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-base font-bold text-gray-800">{assignment.employeeName}</h2>
            <p className="text-xs text-gray-500">{assignment.territory} · {assignment.team} · {assignment.period}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={onEnterActuals}><Edit2 size={13} />Enter Actuals</Button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={16} /></button>
          </div>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {/* Overall summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
              <AttainmentRing pct={overallAvg} size={64} />
              <div>
                <div className="text-xs text-gray-500">Overall Attainment</div>
                <div className="text-sm font-bold text-gray-800">{overallAvg !== null ? `${overallAvg}%` : 'No data yet'}</div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
              {sections.map(s => (
                <div key={s.category} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">{KPI_CATEGORY_LABELS[s.category]}</span>
                  <span className={`text-xs font-bold ${s.avg >= 90 ? 'text-emerald-600' : s.avg >= 70 ? 'text-amber-600' : s.avg !== null ? 'text-red-600' : 'text-gray-400'}`}>
                    {s.avg !== null ? `${s.avg}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* KPI sections */}
          {sections.map(sec => {
            const cfg = KPI_CATEGORY_COLORS[sec.category];
            return (
              <div key={sec.category} className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className={`px-5 py-3 flex items-center justify-between ${cfg.bg}`}>
                  <span className={`font-semibold text-sm ${cfg.text}`}>{KPI_CATEGORY_LABELS[sec.category]}</span>
                  <span className={`text-sm font-bold ${cfg.text}`}>{sec.avg !== null ? `${sec.avg}%` : '—'}</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {sec.kpis.map(kpi => {
                    const linkedMods = getLinkedModulesForKPI(kpi.id);
                    const showTrainingTag = (kpi.status === 'below_target' || kpi.status === 'at_risk' || kpi.status === 'mandatory_failed') && linkedMods.length > 0;
                    return (
                      <div key={kpi.id} className="px-5 py-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800">{kpi.name}</span>
                              {kpi.isMandatory && <Badge variant="danger" size="xs">Mandatory</Badge>}
                              {showTrainingTag && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                                  <BookOpen size={10} />Training available
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">Target: {kpi.targetValue}{kpi.unit === '%' ? '%' : ` ${kpi.unit}`} · {kpi.frequency}</div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {kpi.actual !== null && (
                              <span className="text-sm font-bold text-gray-800">{kpi.actual}{kpi.unit === '%' ? '%' : ` ${kpi.unit}`}</span>
                            )}
                            <StatusBadge status={kpi.status} />
                          </div>
                        </div>
                        {kpi.attainmentPct !== null && (
                          <ProgressBar value={kpi.attainmentPct} max={100} color={attainmentColor(kpi.attainmentPct)} showPercent={false} />
                        )}
                        {kpi.actual === null && <p className="text-xs text-gray-400 italic">No actuals entered yet</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Management Actions */}
          {actions.length > 0 && (
            <div className="border-2 border-amber-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-amber-50 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-600" />
                <span className="font-semibold text-sm text-amber-800">Recommended Actions ({actions.length})</span>
              </div>
              <div className="divide-y divide-amber-100">
                {actions.map((a, i) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-3">
                    <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-bold mt-0.5 ${a.level === 'critical' ? 'bg-red-100 text-red-700' : a.level === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                      {a.level.toUpperCase()}
                    </span>
                    <p className="text-sm text-gray-700">{a.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main KPI Dashboard ───────────────────────────────────────────────────────
export default function KPIDashboard({ onNavigate }) {
  const { currentUser } = useApp();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'company_admin';

  const [search, setSearch]           = useState('');
  const [filterCat, setFilterCat]     = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [selectedAsgn, setSelectedAsgn] = useState(null);  // scorecard drawer
  const [actualsModal, setActualsModal] = useState(null);   // enter actuals
  const [assignModal, setAssignModal]   = useState(false);
  const [tick, setTick]               = useState(0);
  const refresh = () => setTick(t => t + 1);

  const teamData = useMemo(() => buildTeamSummary(), [tick]);
  const assignments = useMemo(() => getKPIAssignments(), [tick]);

  const periods = [...new Set(assignments.map(a => a.period))];

  const filtered = useMemo(() => teamData.filter(row => {
    const q = search.toLowerCase();
    const matchSearch = !q || row.employeeName?.toLowerCase().includes(q) || row.territory?.toLowerCase().includes(q) || row.team?.toLowerCase().includes(q);
    const matchPeriod = filterPeriod === 'all' || row.period === filterPeriod;
    return matchSearch && matchPeriod;
  }), [teamData, search, filterPeriod, tick]);

  // Summary stats
  const totalReps = teamData.length;
  const onTrackReps = teamData.filter(r => r.overallAvg !== null && r.overallAvg >= 90).length;
  const atRiskReps  = teamData.filter(r => r.overallAvg !== null && r.overallAvg >= 70 && r.overallAvg < 90).length;
  const belowReps   = teamData.filter(r => r.overallAvg !== null && r.overallAvg < 70).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="KPI Management"
        subtitle="Track field force key performance indicators across all medical representatives"
        action={isAdmin && (
          <Button onClick={() => setAssignModal(true)}><Plus size={15} />Assign Template</Button>
        )}
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Reps" value={totalReps} icon={Users} color="indigo" />
        <StatCard label="On Track" value={onTrackReps} icon={CheckCircle} color="green" sub="≥90% attainment" />
        <StatCard label="At Risk" value={atRiskReps} icon={Activity} color="amber" sub="70–89% attainment" />
        <StatCard label="Below Target" value={belowReps} icon={AlertTriangle} color="red" sub="<70% attainment" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, territory, team…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-indigo-400 focus:ring-indigo-100 bg-white"
          />
        </div>
        <Select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} wrapClass="w-full sm:w-44">
          <option value="all">All Periods</option>
          {periods.map(p => <option key={p} value={p}>{p}</option>)}
        </Select>
      </div>

      {/* Team grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={Target} title="No KPI assignments found" description="Assign a KPI template to employees to start tracking." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rep Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Territory</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Period</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Overall</th>
                  {['activity','output','engagement','compliance'].map(cat => (
                    <th key={cat} className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">{KPI_CATEGORY_LABELS[cat]}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-gray-800">{row.employeeName}</div>
                      <div className="text-xs text-gray-400">{row.team}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">{row.territory || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-600 text-xs">{row.period}</td>
                    <td className="px-4 py-3 text-center">
                      <AttainmentRing pct={row.overallAvg} size={44} />
                    </td>
                    {['activity','output','engagement','compliance'].map(cat => (
                      <td key={cat} className="px-3 py-3 text-center hidden xl:table-cell">
                        {row.categoryAvgs[cat] !== null && row.categoryAvgs[cat] !== undefined ? (
                          <span className={`text-xs font-bold ${row.categoryAvgs[cat] >= 90 ? 'text-emerald-600' : row.categoryAvgs[cat] >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                            {row.categoryAvgs[cat]}%
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {isAdmin && (
                          <Button size="xs" variant="secondary" onClick={() => { setActualsModal(row); }}>
                            <Edit2 size={11} />Actuals
                          </Button>
                        )}
                        <Button size="xs" variant="ghost" onClick={() => setSelectedAsgn(row)}>
                          View →
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {assignModal && (
        <AssignTemplateModal onClose={() => setAssignModal(false)} onSaved={refresh} />
      )}
      {actualsModal && (
        <EnterActualsModal
          assignment={actualsModal}
          onClose={() => setActualsModal(null)}
          onSaved={refresh}
        />
      )}
      {selectedAsgn && (
        <ScorecardDrawer
          assignment={selectedAsgn}
          onClose={() => setSelectedAsgn(null)}
          onEnterActuals={() => { setActualsModal(selectedAsgn); setSelectedAsgn(null); }}
        />
      )}
    </div>
  );
}
