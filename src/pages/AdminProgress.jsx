import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { getProgressSummary, getAllReviewers } from '../lib/supabase';
import { Card, Badge, ProgressBar, PageHeader, StatCard } from '../components/UI';
import { Users, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const STATUS_BADGE = { submitted: 'success', in_progress: 'warning', not_started: 'default' };
const STATUS_LABEL = { submitted: 'Submitted', in_progress: 'In Progress', not_started: 'Not Started' };

export default function AdminProgress() {
  const { tick } = useApp();
  const [progress,  setProgress]  = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getProgressSummary(), getAllReviewers()]).then(([prog, revs]) => {
      setProgress(prog || []);
      setReviewers(revs || []);
      setLoading(false);
    });
  }, [tick]);

  const total      = progress.length;
  const submitted  = progress.filter(p => p.selfAssessmentStatus === 'submitted').length;
  const inProg     = progress.filter(p => p.selfAssessmentStatus === 'in_progress').length;
  const notStarted = progress.filter(p => p.selfAssessmentStatus === 'not_started').length;

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading progress…</div>;

  return (
    <div>
      <PageHeader title="Track Progress" subtitle="Monitor assessment completion status for every employee." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Employees" value={total} icon={Users} color="indigo" />
        <StatCard label="Self-Assess Done" value={submitted} icon={CheckCircle} color="green" />
        <StatCard label="In Progress" value={inProg} icon={Clock} color="amber" />
        <StatCard label="Not Started" value={notStarted} icon={AlertCircle} color="red" />
      </div>

      {progress.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-gray-500">No employees registered yet.</div></Card>
      ) : (
        <div className="space-y-4">
          {progress.map(p => {
            const empReviewers = reviewers.filter(r => r.employeeId === p.employee.id);
            const approvedRevs = empReviewers.filter(r => r.approvalStatus === 'approved');
            const pendingRevs  = empReviewers.filter(r => r.approvalStatus === 'pending');
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

                <div className="flex gap-2 flex-wrap text-xs">
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-medium">{p.assignmentCount} assignment{p.assignmentCount !== 1 ? 's' : ''}</span>
                  <span className={`px-2.5 py-1 rounded-lg font-medium ${p.nominationsSubmitted ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    Nominations: {p.nominationsSubmitted ? 'Submitted' : 'Pending'}
                  </span>
                  <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-lg font-medium">{approvedRevs.length} reviewer{approvedRevs.length !== 1 ? 's' : ''} approved</span>
                  {pendingRevs.length > 0 && (
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-medium">{pendingRevs.length} pending approval</span>
                  )}
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium">{p.completedReviewCount} review{p.completedReviewCount !== 1 ? 's' : ''} received</span>
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
