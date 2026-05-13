import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { getProgressSummary, getAllReviewers, getAssessmentResults } from '../lib/supabase';
import { Card, Badge, ProgressBar, PageHeader, StatCard } from '../components/UI';
import { Users, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';

const STATUS_BADGE = { submitted: 'success', in_progress: 'warning', not_started: 'default' };
const STATUS_LABEL = { submitted: 'Submitted', in_progress: 'In Progress', not_started: 'Not Started' };

// ─── Avg pill helper ───────────────────────────────────────────
function AvgPill({ label, value, color }) {
  if (value === null || value === undefined) {
    return (
      <div className={`flex flex-col items-center px-3 py-2 rounded-xl border bg-gray-50 border-gray-200 min-w-[70px]`}>
        <span className="text-xs font-semibold text-gray-400">{label}</span>
        <span className="text-sm font-bold text-gray-300 mt-0.5">—</span>
      </div>
    );
  }
  const colors = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    emerald:'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-xl border min-w-[70px] ${colors[color] || colors.indigo}`}>
      <span className="text-xs font-semibold opacity-70">{label}</span>
      <span className="text-sm font-bold mt-0.5">{value.toFixed(2)}</span>
    </div>
  );
}

// ─── Results panel for one employee ───────────────────────────
function EmployeeResultsPanel({ employeeId, employeeName }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAssessmentResults(employeeId).then(r => {
      setResults(r);
      setLoading(false);
    });
  }, [employeeId]);

  if (loading) {
    return <div className="py-4 text-center text-xs text-gray-400">Loading results…</div>;
  }

  if (!results || !results.sections || results.sections.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-gray-400">
        No assessment data available yet.
      </div>
    );
  }

  const { sections } = results;

  // Compute overall aggregates across all sections
  const avgOf = (key) => {
    const vals = sections.map(s => s[key]).filter(v => v !== null);
    return vals.length > 0 ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
  };
  const overallSelf    = avgOf('selfAvg');
  const overallSponsor = avgOf('sponsorAvg');
  const overallPeer    = avgOf('peerAvg');
  const overallTeam    = avgOf('teamAvg');
  const overallAll     = avgOf('overallAvg');

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 size={14} className="text-indigo-500" />
        <span className="text-xs font-semibold text-gray-700">Assessment Overview: {employeeName}</span>
      </div>

      {/* Overall aggregate scores */}
      <div className="mb-4 p-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100">
        <p className="text-xs font-semibold text-gray-600 mb-2">Overall Scores Aggregated:</p>
        <div className="flex gap-2 flex-wrap">
          <AvgPill label="PM Self-Avg"   value={overallSelf}    color="indigo"  />
          <AvgPill label="Sponsor Avg"   value={overallSponsor} color="purple"  />
          <AvgPill label="Peers Avg"     value={overallPeer}    color="blue"    />
          <AvgPill label="Team Avg"      value={overallTeam}    color="amber"   />
          <AvgPill label="Overall"       value={overallAll}     color="emerald" />
        </div>
      </div>

      {/* Per-section table */}
      <p className="text-xs font-semibold text-gray-500 mb-2">Section-wise Breakdown:</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 pr-3 font-semibold text-gray-500">Section</th>
              <th className="text-center py-2 px-2 font-semibold text-indigo-600">Self</th>
              <th className="text-center py-2 px-2 font-semibold text-purple-600">Sponsor</th>
              <th className="text-center py-2 px-2 font-semibold text-blue-600">Peers</th>
              <th className="text-center py-2 px-2 font-semibold text-amber-600">Team</th>
              <th className="text-center py-2 px-2 font-semibold text-emerald-600">Overall</th>
            </tr>
          </thead>
          <tbody>
            {sections.map(sec => (
              <tr key={sec.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="py-2 pr-3 font-medium text-gray-700">{sec.title}</td>
                <td className="text-center py-2 px-2">
                  {sec.selfAvg !== null
                    ? <span className="font-bold text-indigo-600">{sec.selfAvg.toFixed(2)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="text-center py-2 px-2">
                  {sec.sponsorAvg !== null
                    ? <span className="font-bold text-purple-600">{sec.sponsorAvg.toFixed(2)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="text-center py-2 px-2">
                  {sec.peerAvg !== null
                    ? <span className="font-bold text-blue-600">{sec.peerAvg.toFixed(2)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="text-center py-2 px-2">
                  {sec.teamAvg !== null
                    ? <span className="font-bold text-amber-600">{sec.teamAvg.toFixed(2)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="text-center py-2 px-2">
                  {sec.overallAvg !== null
                    ? <span className="font-bold text-emerald-600">{sec.overallAvg.toFixed(2)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Scale 1–5 · "—" means no submitted ratings for that reviewer type in this section.
        Not-Observed (0) ratings are excluded from averages.
      </p>
    </div>
  );
}

export default function AdminProgress() {
  const { tick } = useApp();
  const [progress,  setProgress]  = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expandedResults, setExpandedResults] = useState({}); // { [empId]: bool }

  useEffect(() => {
    setLoading(true);
    Promise.all([getProgressSummary(), getAllReviewers()]).then(([prog, revs]) => {
      setProgress(prog || []);
      setReviewers(revs || []);
      setLoading(false);
    });
  }, [tick]);

  const toggleResults = (empId) => {
    setExpandedResults(prev => ({ ...prev, [empId]: !prev[empId] }));
  };

  const total      = progress.length;
  const submitted  = progress.filter(p => p.selfAssessmentStatus === 'submitted').length;
  const inProg     = progress.filter(p => p.selfAssessmentStatus === 'in_progress').length;
  const notStarted = progress.filter(p => p.selfAssessmentStatus === 'not_started').length;

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading progress…</div>;

  return (
    <div>
      <PageHeader title="Track Progress" subtitle="Monitor assessment completion status for every employee." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Employees" value={total}      icon={Users}        color="indigo" />
        <StatCard label="Self-Assess Done" value={submitted} icon={CheckCircle}  color="green"  />
        <StatCard label="In Progress"      value={inProg}    icon={Clock}        color="amber"  />
        <StatCard label="Not Started"      value={notStarted}icon={AlertCircle}  color="red"    />
      </div>

      {progress.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-gray-500">No employees registered yet.</div></Card>
      ) : (
        <div className="space-y-4">
          {progress.map(p => {
            const empReviewers = reviewers.filter(r => r.employeeId === p.employee.id);
            const approvedRevs = empReviewers.filter(r => r.approvalStatus === 'approved');
            const pendingRevs  = empReviewers.filter(r => r.approvalStatus === 'pending');
            const showResults  = expandedResults[p.employee.id];
            // Show results button only when self-assessment or any review has been submitted
            const hasAnySubmission = p.selfAssessmentStatus === 'submitted' || p.completedReviewCount > 0;
            return (
              <Card key={p.employee.id} className="p-5">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">{p.employee.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="text-sm font-bold text-gray-800">{p.employee.name}</h3>
                        <p className="text-xs text-gray-500">{p.employee.jobTitle} · {p.employee.department} · {p.employee.organization}</p>
                      </div>
                      <Badge variant={STATUS_BADGE[p.selfAssessmentStatus]}>{STATUS_LABEL[p.selfAssessmentStatus]}</Badge>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <ProgressBar value={p.selfAssessmentProgress} label="Self-Assessment Progress" className="mb-0" />
                  <ProgressBar
                    value={approvedRevs.length ? p.completedReviewCount : 0}
                    max={Math.max(approvedRevs.length, 1)}
                    label="Reviews Completed"
                    color="green"
                    className="mb-0"
                  />
                </div>

                <div className="flex gap-2 flex-wrap text-xs items-center">
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-medium">{p.assignmentCount} assignment{p.assignmentCount !== 1 ? 's' : ''}</span>
                  <span className={`px-2.5 py-1 rounded-lg font-medium ${p.nominationsSubmitted ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    Nominations: {p.nominationsSubmitted ? 'Submitted' : 'Pending'}
                  </span>
                  <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-lg font-medium">{approvedRevs.length} reviewer{approvedRevs.length !== 1 ? 's' : ''} approved</span>
                  {pendingRevs.length > 0 && (
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-medium">{pendingRevs.length} pending approval</span>
                  )}
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium">{p.completedReviewCount} review{p.completedReviewCount !== 1 ? 's' : ''} received</span>

                  {/* View Results button */}
                  {hasAnySubmission && (
                    <button
                      onClick={() => toggleResults(p.employee.id)}
                      className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all
                        ${showResults
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-indigo-600 border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50'}`}
                    >
                      <BarChart2 size={11} />
                      {showResults ? 'Hide Results' : 'View Results'}
                      {showResults ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  )}
                </div>

                {empReviewers.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Reviewer Status</p>
                    <div className="space-y-1.5">
                      {empReviewers.map(rev => (
                        <div key={rev.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-gray-600 text-xs font-bold">{rev.name?.[0]?.toUpperCase()}</span>
                            </div>
                            <span className="text-gray-700 font-medium">{rev.name}</span>
                            <span className="text-gray-400">{rev.designation}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="info" size="xs">{rev.category}</Badge>
                            <Badge variant={STATUS_BADGE[rev.approvalStatus] || 'default'} size="xs">{rev.approvalStatus}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Results panel (lazy-loaded) */}
                {showResults && (
                  <EmployeeResultsPanel
                    employeeId={p.employee.id}
                    employeeName={p.employee.name}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
