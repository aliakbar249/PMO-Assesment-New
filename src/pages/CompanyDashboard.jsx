import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { getCompanyProgressSummary, getAssessmentResults } from '../lib/supabase';
import { Card, Badge, ProgressBar, PageHeader, StatCard } from '../components/UI';
import {
  Users, CheckCircle, Clock, AlertCircle,
  BarChart2, ChevronDown, ChevronUp, Building2
} from 'lucide-react';

const STATUS_BADGE = { submitted: 'success', in_progress: 'warning', not_started: 'default' };
const STATUS_LABEL = { submitted: 'Submitted', in_progress: 'In Progress', not_started: 'Not Started' };

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
      {/* Overall aggregates */}
      <p className="text-xs font-semibold text-gray-600 mb-2">Overall Scores Aggregated:</p>
      <div className="flex gap-2 flex-wrap mb-4">
        <ScorePill label="Self-Avg"    value={avgOf('selfAvg')}    color="indigo"  />
        <ScorePill label="Sponsor Avg" value={avgOf('sponsorAvg')} color="purple"  />
        <ScorePill label="Peers Avg"   value={avgOf('peerAvg')}    color="blue"    />
        <ScorePill label="Team Avg"    value={avgOf('teamAvg')}    color="amber"   />
        <ScorePill label="Overall"     value={avgOf('overallAvg')} color="emerald" />
      </div>

      {/* Section table */}
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

// ─── Main Page ─────────────────────────────────────────────────
export default function CompanyDashboard() {
  const { currentUser, tick } = useApp();
  const organization = currentUser?.organization || '';

  const [progress,  setProgress]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState({}); // { empId: bool }

  useEffect(() => {
    if (!organization) return;
    setLoading(true);
    getCompanyProgressSummary(organization).then(data => {
      setProgress(data || []);
      setLoading(false);
    });
  }, [organization, tick]);

  const toggle = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const total      = progress.length;
  const submitted  = progress.filter(p => p.selfAssessmentStatus === 'submitted').length;
  const inProg     = progress.filter(p => p.selfAssessmentStatus === 'in_progress').length;
  const notStarted = progress.filter(p => p.selfAssessmentStatus === 'not_started').length;

  if (!organization) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        No organisation assigned to this account. Please contact the system administrator.
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;

  return (
    <div>
      <PageHeader
        title={`${organization} — Overview`}
        subtitle="Assessment progress and ratings for your organisation's employees."
        action={
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl">
            <Building2 size={14} className="text-indigo-500" />
            <span className="text-xs font-semibold text-indigo-700">{organization}</span>
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Employees" value={total}       icon={Users}        color="indigo" />
        <StatCard label="Self-Assess Done" value={submitted}  icon={CheckCircle}  color="green"  />
        <StatCard label="In Progress"      value={inProg}     icon={Clock}        color="amber"  />
        <StatCard label="Not Started"      value={notStarted} icon={AlertCircle}  color="red"    />
      </div>

      {progress.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-sm text-gray-500">
            No employees found for organisation <strong>{organization}</strong>. Make sure employee profiles have the matching organisation name.
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {progress.map(p => {
            const hasResults = p.selfAssessmentStatus === 'submitted' || p.completedReviewCount > 0;
            return (
              <Card key={p.employee.id} className="p-5">
                {/* Employee header */}
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

                {/* Progress bars */}
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

                {/* Quick stats */}
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
                    <button
                      onClick={() => toggle(p.employee.id)}
                      className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all
                        ${expanded[p.employee.id]
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-indigo-600 border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50'}`}
                    >
                      <BarChart2 size={11} />
                      {expanded[p.employee.id] ? 'Hide Results' : 'View Results'}
                      {expanded[p.employee.id] ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  )}
                </div>

                {/* Expandable results */}
                {expanded[p.employee.id] && (
                  <EmployeeResultsPanel employeeId={p.employee.id} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
