import { useState, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { getProgressSummary, getAllEmployees, getAllReviewers } from '../store/db';
import { StatCard, Card, Badge, ProgressBar, PageHeader, Button } from '../components/UI';
import { Users, ClipboardList, CheckCircle, Clock, AlertCircle, ChevronRight } from 'lucide-react';

export default function AdminDashboard({ onNavigate }) {
  const { currentUser } = useApp();
  const progress   = useMemo(() => getProgressSummary(), [currentUser]);
  const reviewers  = useMemo(() => getAllReviewers(), [currentUser]);
  const pendingRev = reviewers.filter(r => r.status === 'pending');
  const totalEmp   = progress.length;
  const submitted  = progress.filter(p => p.selfAssessmentStatus === 'submitted').length;
  const inProgress = progress.filter(p => p.selfAssessmentStatus === 'in_progress').length;
  const completedReviews = reviewers.filter(r => r.status === 'approved').length;

  return (
    <div>
      <PageHeader title="Administrator Dashboard" subtitle="Monitor 360° assessment activity across all employees." />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Employees" value={totalEmp} icon={Users} color="indigo" />
        <StatCard label="Assessments Submitted" value={submitted} sub={`of ${totalEmp}`} icon={CheckCircle} color="green" />
        <StatCard label="In Progress" value={inProgress} icon={Clock} color="amber" />
        <StatCard label="Pending Approvals" value={pendingRev.length} icon={AlertCircle} color="red" />
      </div>

      {/* Pending approvals alert */}
      {pendingRev.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-amber-800">{pendingRev.length} reviewer profile(s) awaiting approval</div>
              <div className="text-xs text-amber-600">Review and approve to give reviewers access to the tool.</div>
            </div>
          </div>
          <Button size="sm" variant="warning" onClick={() => onNavigate('adm-profiles')}>Review Now →</Button>
        </div>
      )}

      {/* Employee list */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Employee Progress Overview</h3>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('adm-employees')}>View All <ChevronRight size={14} /></Button>
        </div>
        {progress.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No employees registered yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {progress.slice(0, 5).map(p => (
              <div key={p.employee.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">{p.employee.name?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{p.employee.name}</span>
                    <Badge variant={p.selfAssessmentStatus === 'submitted' ? 'success' : p.selfAssessmentStatus === 'in_progress' ? 'warning' : 'default'} size="xs">
                      {p.selfAssessmentStatus === 'submitted' ? 'Self-Assess Done' : p.selfAssessmentStatus === 'in_progress' ? 'In Progress' : 'Not Started'}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.employee.jobTitle} · {p.employee.department}</div>
                  <ProgressBar value={p.selfAssessmentProgress} className="mt-1.5 max-w-48" showPercent={false} />
                </div>
                <div className="text-right text-xs text-gray-500 flex-shrink-0">
                  <div>{p.completedReviewCount} reviews done</div>
                  <div className="text-gray-400">{p.approvedReviewerCount} reviewers</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
