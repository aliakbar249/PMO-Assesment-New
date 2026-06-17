import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { getCompanyProgressSummary, getAssessmentResults, getCompanyReviewerProgress, getReviewerSubmittedResults } from '../lib/supabase';
import { Card, Badge, ProgressBar, PageHeader, StatCard, Modal } from '../components/UI';
import {
  Users, CheckCircle, Clock, AlertCircle,
  BarChart2, ChevronDown, ChevronUp, Building2,
  UserCheck, Eye, Search, X, Star, ChevronRight,
} from 'lucide-react';

const STATUS_BADGE = { submitted: 'success', in_progress: 'warning', not_started: 'default' };
const STATUS_LABEL = { submitted: 'Submitted', in_progress: 'In Progress', not_started: 'Not Started' };

const CATEGORY_LABEL = {
  sponsor: 'Sponsor', supervisor: 'Supervisor',
  peer: 'Peer', client: 'Client', teamMember: 'Team Member',
};
const CATEGORY_COLOR = {
  sponsor:    'bg-purple-50  border-purple-200  text-purple-700',
  supervisor: 'bg-indigo-50  border-indigo-200  text-indigo-700',
  peer:       'bg-blue-50    border-blue-200    text-blue-700',
  client:     'bg-amber-50   border-amber-200   text-amber-700',
  teamMember: 'bg-teal-50    border-teal-200    text-teal-700',
};

// ─── Score pill ────────────────────────────────────────────────
function ScorePill({ label, value, color }) {
  const colors = {
    indigo:  'bg-indigo-50 border-indigo-200 text-indigo-700',
    purple:  'bg-purple-50 border-purple-200 text-purple-700',
    blue:    'bg-blue-50 border-blue-200 text-blue-700',
    amber:   'bg-amber-50 border-amber-200 text-amber-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
  if (value === null || value === undefined) {
    return (
      <div className="flex flex-col items-center px-3 py-2 rounded-xl border bg-gray-50 border-gray-200 min-w-[70px]">
        <span className="text-xs font-semibold text-gray-400">{label}</span>
        <span className="text-sm font-bold text-gray-300 mt-0.5">—</span>
      </div>
    );
  }
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-xl border min-w-[70px] ${colors[color] || colors.indigo}`}>
      <span className="text-xs font-semibold opacity-70">{label}</span>
      <span className="text-sm font-bold mt-0.5">{value.toFixed(2)}</span>
    </div>
  );
}

// ─── Results panel for one employee ───────────────────────────
function EmployeeResultsPanel({ employeeId }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAssessmentResults(employeeId).then(r => { setResults(r); setLoading(false); });
  }, [employeeId]);

  if (loading) return <div className="py-3 text-center text-xs text-gray-400">Loading results…</div>;
  if (!results?.sections?.length) return (
    <div className="py-3 text-center text-xs text-gray-400">No submitted ratings yet.</div>
  );

  const { sections } = results;
  const avgOf = key => {
    const vals = sections.map(s => s[key]).filter(v => v !== null);
    return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
  };

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <p className="text-xs font-semibold text-gray-600 mb-2">Overall Scores Aggregated:</p>
      <div className="flex gap-2 flex-wrap mb-4">
        <ScorePill label="Self-Avg"    value={avgOf('selfAvg')}    color="indigo"  />
        <ScorePill label="Sponsor Avg" value={avgOf('sponsorAvg')} color="purple"  />
        <ScorePill label="Peers Avg"   value={avgOf('peerAvg')}    color="blue"    />
        <ScorePill label="Team Avg"    value={avgOf('teamAvg')}    color="amber"   />
        <ScorePill label="Overall"     value={avgOf('overallAvg')} color="emerald" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-1.5 pr-3 font-semibold text-gray-500">Section</th>
              <th className="text-center py-1.5 px-2 font-semibold text-indigo-600">Self</th>
              <th className="text-center py-1.5 px-2 font-semibold text-purple-600">Sponsor</th>
              <th className="text-center py-1.5 px-2 font-semibold text-blue-600">Peers</th>
              <th className="text-center py-1.5 px-2 font-semibold text-amber-600">Team</th>
              <th className="text-center py-1.5 px-2 font-semibold text-emerald-600">Overall</th>
            </tr>
          </thead>
          <tbody>
            {sections.map(sec => (
              <tr key={sec.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="py-1.5 pr-3 font-medium text-gray-700">{sec.title}</td>
                {(['selfAvg','sponsorAvg','peerAvg','teamAvg','overallAvg']).map((key, i) => {
                  const colors = ['text-indigo-600','text-purple-600','text-blue-600','text-amber-600','text-emerald-600'];
                  return (
                    <td key={key} className="text-center py-1.5 px-2">
                      {sec[key] !== null
                        ? <span className={`font-bold ${colors[i]}`}>{sec[key].toFixed(2)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">Scale 1–5 · "—" = no submitted ratings for that type.</p>
    </div>
  );
}

// ─── Reviewer Results Modal (company admin) ────────────────────
const RATING_LABELS_CD = { 5:'Always', 4:'Often', 3:'Sometimes', 2:'Seldom', 1:'Never', 0:'Not Observed' };
const RATING_COLOR_CD  = { 5:'text-emerald-600', 4:'text-green-600', 3:'text-amber-600', 2:'text-orange-500', 1:'text-red-500', 0:'text-gray-400' };
const CAT_LABEL_CD     = { sponsor:'Sponsor', supervisor:'Supervisor', peer:'Peer', client:'Client', teamMember:'Team Member' };

// nomId = nominationId, focusEmployeeId = show only this employee's results
function ReviewerResultsModalCD({ reviewerName, reviewerDesignation, nominationId, focusEmployeeId, onClose }) {
  const [results,  setResults]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [activeEmp, setActiveEmp] = useState(focusEmployeeId || null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    getReviewerSubmittedResults(nominationId).then(data => {
      const submitted = (data || []).filter(r => r.status === 'submitted');
      setResults(submitted);
      // Default to focusEmployeeId if available and submitted, else first
      const focus = submitted.find(r => r.employeeId === focusEmployeeId) || submitted[0];
      if (focus) setActiveEmp(focus.employeeId);
      setLoading(false);
    });
  }, [nominationId]);

  const toggleSection = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading results…</div>
  );

  if (!results || results.length === 0) return (
    <div className="py-10 text-center space-y-2">
      <BarChart2 size={28} className="text-gray-300 mx-auto" />
      <p className="text-sm font-semibold text-gray-500">No submitted reviews yet</p>
      <p className="text-xs text-gray-400">{reviewerName} hasn't submitted any assessments.</p>
      <button onClick={onClose} className="mt-4 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">Close</button>
    </div>
  );

  const current = results.find(r => r.employeeId === activeEmp) || results[0];
  const allAvgs = current.sections.map(s => s.avg).filter(v => v !== null);
  const overallAvg = allAvgs.length
    ? (allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length).toFixed(2)
    : null;

  return (
    <div className="space-y-4">
      {/* Reviewer header */}
      <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center shrink-0">
          <span className="text-white font-bold">{reviewerName?.[0]?.toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-indigo-900">{reviewerName}</p>
          {reviewerDesignation && <p className="text-xs text-indigo-600">{reviewerDesignation}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold text-indigo-700">{CAT_LABEL_CD[current.category] || current.category}</p>
          <p className="text-xs text-indigo-500">{results.length} review{results.length !== 1 ? 's' : ''} submitted</p>
        </div>
      </div>

      {/* Employee switcher — only when multiple */}
      {results.length > 1 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Reviewing:</p>
          <div className="flex gap-2 flex-wrap">
            {results.map(r => (
              <button key={r.employeeId} onClick={() => { setActiveEmp(r.employeeId); setExpanded({}); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all
                  ${activeEmp === r.employeeId
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
                {r.employee.name}
                {activeEmp === r.employeeId && <ChevronRight size={11} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-gray-400">Reviewing</p>
          <p className="text-sm font-bold text-gray-800">{current.employee.name}</p>
          <p className="text-xs text-gray-500">{current.employee.jobTitle}{current.employee.department ? ` · ${current.employee.department}` : ''}</p>
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
              <p className="text-xs text-blue-400">{new Date(current.submittedAt).getFullYear()}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sections accordion */}
      <div className="space-y-2">
        {current.sections.map(sec => (
          <div key={sec.id} className="border border-gray-200 rounded-2xl overflow-hidden">
            <button onClick={() => toggleSection(sec.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-semibold text-gray-800 truncate">{sec.title}</span>
                {sec.avg !== null
                  ? <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg shrink-0">{sec.avg.toFixed(2)}</span>
                  : <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-xs rounded-lg shrink-0">—</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <div className="flex gap-0.5">
                  {sec.statements.map(stmt => (
                    <div key={stmt.id}
                      title={stmt.value !== null ? `${stmt.value} — ${RATING_LABELS_CD[stmt.value]}` : 'Not rated'}
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        stmt.value === null ? 'bg-gray-200' :
                        stmt.value === 0    ? 'bg-gray-300' :
                        stmt.value >= 4     ? 'bg-emerald-400' :
                        stmt.value === 3    ? 'bg-amber-400' : 'bg-red-400'}`} />
                  ))}
                </div>
                {expanded[sec.id] ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>
            </button>
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
                            <span className={`text-xs font-bold ${RATING_COLOR_CD[stmt.value] || 'text-gray-400'}`}>
                              {stmt.value > 0 ? stmt.value : '—'}
                            </span>
                          </div>
                          <span className={`text-xs ${RATING_COLOR_CD[stmt.value] || 'text-gray-400'}`}>
                            {RATING_LABELS_CD[stmt.value]}
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

      <button onClick={onClose}
        className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors">
        Close
      </button>
    </div>
  );
}

// ─── Employees tab ─────────────────────────────────────────────
function EmployeesTab({ organization }) {
  const { tick } = useApp();
  const [progress,  setProgress]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState({});
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    if (!organization) return;
    setLoading(true);
    getCompanyProgressSummary(organization).then(data => {
      setProgress(data || []);
      setLoading(false);
    });
  }, [organization, tick]);

  const toggle = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const filtered = progress.filter(p => {
    const q = search.toLowerCase();
    return !q || p.employee.name?.toLowerCase().includes(q) ||
      p.employee.jobTitle?.toLowerCase().includes(q) ||
      p.employee.department?.toLowerCase().includes(q);
  });

  const total      = progress.length;
  const submitted  = progress.filter(p => p.selfAssessmentStatus === 'submitted').length;
  const inProg     = progress.filter(p => p.selfAssessmentStatus === 'in_progress').length;
  const notStarted = progress.filter(p => p.selfAssessmentStatus === 'not_started').length;

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>;

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Total Employees"  value={total}       icon={Users}       color="indigo" />
        <StatCard label="Self-Assess Done" value={submitted}   icon={CheckCircle} color="green"  />
        <StatCard label="In Progress"      value={inProg}      icon={Clock}       color="amber"  />
        <StatCard label="Not Started"      value={notStarted}  icon={AlertCircle} color="red"    />
      </div>

      {/* Search */}
      {progress.length > 4 && (
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search employees…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-gray-500">
          {search ? `No employees match "${search}".` : `No employees found for ${organization}.`}
        </div></Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(p => {
            const hasResults = p.selfAssessmentStatus === 'submitted' || p.completedReviewCount > 0;
            return (
              <Card key={p.employee.id} className="p-5">
                <div className="flex items-start gap-4 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">{p.employee.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="text-sm font-bold text-gray-800">{p.employee.name}</h3>
                        <p className="text-xs text-gray-500">
                          {p.employee.jobTitle}{p.employee.department ? ` · ${p.employee.department}` : ''}
                        </p>
                      </div>
                      <Badge variant={STATUS_BADGE[p.selfAssessmentStatus]}>
                        {STATUS_LABEL[p.selfAssessmentStatus]}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 mb-3">
                  <ProgressBar value={p.selfAssessmentProgress} label="Self-Assessment Progress" className="mb-0" />
                  <ProgressBar
                    value={p.completedReviewCount}
                    max={Math.max(p.approvedReviewerCount, 1)}
                    label="Reviews Completed"
                    color="green"
                    className="mb-0"
                  />
                </div>
                <div className="flex gap-2 flex-wrap text-xs items-center">
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-medium">
                    {p.assignmentCount} assignment{p.assignmentCount !== 1 ? 's' : ''}
                  </span>
                  <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-lg font-medium">
                    {p.approvedReviewerCount} reviewer{p.approvedReviewerCount !== 1 ? 's' : ''} approved
                  </span>
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium">
                    {p.completedReviewCount} review{p.completedReviewCount !== 1 ? 's' : ''} received
                  </span>
                  {hasResults && (
                    <button onClick={() => toggle(p.employee.id)}
                      className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all
                        ${expanded[p.employee.id]
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-indigo-600 border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50'}`}>
                      <BarChart2 size={11} />
                      {expanded[p.employee.id] ? 'Hide Results' : 'View Results'}
                      {expanded[p.employee.id] ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  )}
                </div>
                {expanded[p.employee.id] && <EmployeeResultsPanel employeeId={p.employee.id} />}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Reviewers tab ─────────────────────────────────────────────
function ReviewersTab({ organization }) {
  const { tick } = useApp();
  const [reviewers, setReviewers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filterStatus,   setFilterStatus]   = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [groupBy,   setGroupBy]   = useState('reviewer');
  const [resultsModal,   setResultsModal]   = useState(null); // { nominationId, reviewerName, reviewerDesignation, focusEmployeeId }

  useEffect(() => {
    if (!organization) return;
    setLoading(true);
    getCompanyReviewerProgress(organization).then(data => {
      setReviewers(data || []);
      setLoading(false);
    });
  }, [organization, tick]);

  const total      = reviewers.length;
  const submitted  = reviewers.filter(r => r.reviewStatus === 'submitted').length;
  const inProg     = reviewers.filter(r => r.reviewStatus === 'in_progress').length;
  const notStarted = reviewers.filter(r => r.reviewStatus === 'not_started').length;

  // Filtered list
  const filtered = reviewers.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.reviewerName?.toLowerCase().includes(q) ||
      r.reviewerEmail?.toLowerCase().includes(q) ||
      r.reviewerDesignation?.toLowerCase().includes(q) ||
      r.employee?.name?.toLowerCase().includes(q);
    const matchStatus   = filterStatus   === 'all' || r.reviewStatus === filterStatus;
    const matchCategory = filterCategory === 'all' || r.category     === filterCategory;
    return matchSearch && matchStatus && matchCategory;
  });

  // Group by reviewer: collapse multiple employee assignments under one reviewer name
  const groupedByReviewer = filtered.reduce((acc, r) => {
    const key = r.reviewerEmail;
    if (!acc[key]) acc[key] = { ...r, assignments: [] };
    acc[key].assignments.push({ employee: r.employee, category: r.category, reviewStatus: r.reviewStatus, nominationId: r.nominationId });
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading…</div>;

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Total Reviewers"   value={total}       icon={UserCheck}   color="indigo" />
        <StatCard label="Reviews Submitted" value={submitted}   icon={CheckCircle} color="green"  />
        <StatCard label="In Progress"       value={inProg}      icon={Clock}       color="amber"  />
        <StatCard label="Not Started"       value={notStarted}  icon={AlertCircle} color="red"    />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search reviewers or employees…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="all">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="in_progress">In Progress</option>
          <option value="not_started">Not Started</option>
        </select>

        {/* Category filter */}
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="all">All Categories</option>
          <option value="sponsor">Sponsor</option>
          <option value="supervisor">Supervisor</option>
          <option value="peer">Peer</option>
          <option value="client">Client</option>
          <option value="teamMember">Team Member</option>
        </select>

        {/* Group-by toggle */}
        <div className="flex rounded-xl border border-gray-300 overflow-hidden text-sm">
          {[['reviewer','By Reviewer'],['employee','By Employee']].map(([val, label]) => (
            <button key={val} onClick={() => setGroupBy(val)}
              className={`px-3 py-2 font-medium transition-colors
                ${groupBy === val ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-gray-500">
          {search || filterStatus !== 'all' || filterCategory !== 'all'
            ? 'No reviewers match the current filters.'
            : 'No approved reviewers found for this organisation yet.'}
        </div></Card>
      ) : groupBy === 'reviewer' ? (
        // ── Grouped by reviewer ──────────────────────────────────
        <div className="space-y-3">
          {Object.values(groupedByReviewer).map(rev => {
            const allSubmitted = rev.assignments.every(a => a.reviewStatus === 'submitted');
            const anyInProgress = rev.assignments.some(a => a.reviewStatus === 'in_progress');
            const overallStatus = allSubmitted ? 'submitted' : anyInProgress ? 'in_progress' : 'not_started';
            return (
              <Card key={rev.reviewerEmail} className="p-4">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-violet-700 flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">{rev.reviewerName?.[0]?.toUpperCase()}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{rev.reviewerName}</p>
                        <p className="text-xs text-gray-500">
                          {rev.reviewerDesignation}{rev.reviewerDepartment ? ` · ${rev.reviewerDepartment}` : ''}
                        </p>
                        <p className="text-xs text-gray-400">{rev.reviewerEmail}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={STATUS_BADGE[overallStatus]}>
                          {STATUS_LABEL[overallStatus]}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {rev.assignments.filter(a => a.reviewStatus === 'submitted').length}/{rev.assignments.length} submitted
                        </span>
                      </div>
                    </div>

                    {/* Assignment rows */}
                    <div className="mt-2 space-y-1.5">
                      {rev.assignments.map((asgn, i) => (
                        <div key={i} className="flex items-center gap-2 flex-wrap">
                          {/* Employee pill */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg">
                            <Eye size={10} className="text-gray-400 shrink-0" />
                            <span className="text-xs font-medium text-gray-700">{asgn.employee?.name}</span>
                          </div>
                          {/* Category pill */}
                          <span className={`px-2 py-0.5 rounded-lg border text-xs font-medium ${CATEGORY_COLOR[asgn.category] || 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                            {CATEGORY_LABEL[asgn.category] || asgn.category}
                          </span>
                          {/* Status indicator */}
                          {asgn.reviewStatus === 'submitted' && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                              <CheckCircle size={11} />Submitted
                            </span>
                          )}
                          {asgn.reviewStatus === 'in_progress' && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                              <Clock size={11} />In Progress
                            </span>
                          )}
                          {asgn.reviewStatus === 'not_started' && (
                            <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                              <AlertCircle size={11} />Not Started
                            </span>
                          )}
                          {/* View Results — only for submitted assignments */}
                          {asgn.reviewStatus === 'submitted' && asgn.nominationId && (
                            <button
                              onClick={() => setResultsModal({
                                nominationId: asgn.nominationId,
                                reviewerName: rev.reviewerName,
                                reviewerDesignation: rev.reviewerDesignation,
                                focusEmployeeId: asgn.employee?.id,
                              })}
                              className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition-colors text-xs font-medium">
                              <BarChart2 size={11} />View Results
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        // ── Grouped by employee ──────────────────────────────────
        (() => {
          const byEmployee = filtered.reduce((acc, r) => {
            const key = r.employee?.id;
            if (!acc[key]) acc[key] = { employee: r.employee, reviewers: [] };
            acc[key].reviewers.push(r);
            return acc;
          }, {});

          return (
            <div className="space-y-4">
              {Object.values(byEmployee).map(group => {
                const empSubmitted  = group.reviewers.filter(r => r.reviewStatus === 'submitted').length;
                const empTotal      = group.reviewers.length;
                return (
                  <Card key={group.employee?.id} className="p-4">
                    {/* Employee header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-sm">{group.employee?.name?.[0]?.toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800">{group.employee?.name}</p>
                        <p className="text-xs text-gray-500">
                          {group.employee?.jobTitle}{group.employee?.department ? ` · ${group.employee.department}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-indigo-700">{empSubmitted}/{empTotal}</p>
                        <p className="text-xs text-gray-400">reviews done</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <ProgressBar value={empSubmitted} max={Math.max(empTotal, 1)} label="Reviews submitted" color="green" className="mb-3" />

                    {/* Reviewer rows */}
                    <div className="space-y-2">
                      {group.reviewers.map(r => (
                        <div key={r.nominationId} className="flex items-center gap-2 flex-wrap py-1.5 border-t border-gray-50">
                          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                            <span className="text-violet-700 font-bold text-xs">{r.reviewerName?.[0]?.toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">{r.reviewerName}</p>
                            {r.reviewerDesignation && <p className="text-xs text-gray-400 truncate">{r.reviewerDesignation}</p>}
                          </div>
                          <span className={`px-2 py-0.5 rounded-lg border text-xs font-medium shrink-0 ${CATEGORY_COLOR[r.category] || 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                            {CATEGORY_LABEL[r.category] || r.category}
                          </span>
                          <Badge variant={STATUS_BADGE[r.reviewStatus]} className="shrink-0">
                            {STATUS_LABEL[r.reviewStatus]}
                          </Badge>
                          {/* View Results button for submitted reviews */}
                          {r.reviewStatus === 'submitted' && r.nominationId && (
                            <button
                              onClick={() => setResultsModal({
                                nominationId: r.nominationId,
                                reviewerName: r.reviewerName,
                                reviewerDesignation: r.reviewerDesignation,
                                focusEmployeeId: r.employee?.id,
                              })}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition-colors text-xs font-medium shrink-0">
                              <BarChart2 size={11} />View Results
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          );
        })()
      )}

      {/* Results modal */}
      <Modal
        open={!!resultsModal}
        onClose={() => setResultsModal(null)}
        title={`Assessment Results — ${resultsModal?.reviewerName || ''}`}
        size="lg"
      >
        {resultsModal && (
          <ReviewerResultsModalCD
            reviewerName={resultsModal.reviewerName}
            reviewerDesignation={resultsModal.reviewerDesignation}
            nominationId={resultsModal.nominationId}
            focusEmployeeId={resultsModal.focusEmployeeId}
            onClose={() => setResultsModal(null)}
          />
        )}
      </Modal>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
export default function CompanyDashboard() {
  const { currentUser } = useApp();
  const organization = currentUser?.organization || '';
  const [activeTab, setActiveTab] = useState('employees');

  if (!organization) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        No organisation assigned to this account. Please contact the system administrator.
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${organization} — Overview`}
        subtitle="Assessment progress and ratings for your organisation."
        action={
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl">
            <Building2 size={14} className="text-indigo-500" />
            <span className="text-xs font-semibold text-indigo-700">{organization}</span>
          </div>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
            ${activeTab === 'employees'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Users size={15} />
          Employees
        </button>
        <button
          onClick={() => setActiveTab('reviewers')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
            ${activeTab === 'reviewers'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'}`}
        >
          <UserCheck size={15} />
          Reviewers
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'employees' && <EmployeesTab organization={organization} />}
      {activeTab === 'reviewers' && <ReviewersTab organization={organization} />}
    </div>
  );
}
