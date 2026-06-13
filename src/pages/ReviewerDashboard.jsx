import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { getReviewersByUserId, getReviewsForEmployee, getEmployeeById, getAssignmentsByEmployee, getTemplateForEmployee } from '../lib/supabase';
import { StatCard, Card, Badge, Button, ProgressBar, Alert, PageHeader } from '../components/UI';
import { ClipboardList, CheckCircle, Clock, ChevronRight, Users } from 'lucide-react';

// ─── Single employee card in the list ────────────────────────────
function EmployeeReviewCard({ reviewer, onStart }) {
  const [employee,    setEmployee]    = useState(null);
  const [myReview,    setMyReview]    = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [templateSections, setTemplateSections] = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!reviewer?.employeeId) { setLoading(false); return; }
    Promise.all([
      getEmployeeById(reviewer.employeeId),
      getReviewsForEmployee(reviewer.employeeId),
      getAssignmentsByEmployee(reviewer.employeeId),
      getTemplateForEmployee({ id: reviewer.employeeId }),
    ]).then(([emp, reviews, asgns, tmplSections]) => {
      setEmployee(emp);
      setAssignments(asgns || []);
      setTemplateSections(tmplSections || []);
      const mine = reviews.find(r => r.reviewerId === reviewer.id);
      setMyReview(mine || null);
      setLoading(false);
    });
  }, [reviewer?.employeeId, reviewer?.id]);

  if (loading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </Card>
    );
  }

  if (!employee) return null;

  const isSubmitted = myReview?.status === 'submitted';
  const inProgress  = myReview?.status === 'in_progress';

  const numSections   = templateSections.length || 0;
  const totalSections = numSections + (assignments.length > 0 ? 1 : 0);
  const savedSections = Math.min(Object.keys(myReview?.sections || {}).length, numSections);
  const assignDone    = Object.keys(myReview?.assignmentRatings || {}).length > 0 ? 1 : 0;
  const doneSections  = savedSections + (assignments.length > 0 ? assignDone : 0);

  return (
    <Card className={`p-4 transition-all ${isSubmitted ? 'border-emerald-200 bg-emerald-50/30' : 'hover:shadow-md'}`}>
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center shrink-0">
          <span className="text-white text-base font-bold">{employee.name?.[0]?.toUpperCase()}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800 truncate">{employee.name}</p>
            <Badge variant={isSubmitted ? 'success' : inProgress ? 'warning' : 'default'}>
              {isSubmitted ? 'Submitted' : inProgress ? 'In Progress' : 'Not Started'}
            </Badge>
            <Badge variant="info">{reviewer.category}</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{employee.jobTitle}{employee.department ? ` · ${employee.department}` : ''}</p>
          {totalSections > 0 && !isSubmitted && (
            <div className="mt-2">
              <ProgressBar value={doneSections} max={totalSections} label={`${doneSections}/${totalSections} sections`} />
            </div>
          )}
        </div>

        {/* Action */}
        <div className="shrink-0">
          {isSubmitted ? (
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle size={18} className="text-emerald-600" />
            </div>
          ) : (
            <Button onClick={() => onStart(reviewer)} className="flex items-center gap-1 text-sm px-3 py-2">
              {inProgress ? 'Continue' : 'Start'}
              <ChevronRight size={14} />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────
export default function ReviewerDashboard({ onNavigate, onSelectReviewer }) {
  const { currentUser, tick } = useApp();
  const [reviewers, setReviewers] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    getReviewersByUserId(currentUser.id).then(rows => {
      setReviewers(rows || []);
      setLoading(false);
    });
  }, [currentUser?.id, tick]);

  const handleStart = (reviewer) => {
    onSelectReviewer(reviewer.id);   // tell App which reviewer row to use
    onNavigate('rev-assessment');
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading dashboard…</div>;

  if (reviewers.length === 0) {
    return (
      <>
        <PageHeader title="Reviewer Dashboard" subtitle="You have been invited to provide 360° assessments." />
        <Alert type="warning">No employee linked to your reviewer account. Please contact the administrator.</Alert>
      </>
    );
  }

  const submittedCount  = reviewers.filter(r => r._submitted).length; // approximate; card handles per-row

  return (
    <div>
      <PageHeader
        title="Reviewer Dashboard"
        subtitle={`You are assigned to review ${reviewers.length} employee${reviewers.length !== 1 ? 's' : ''}.`}
      />

      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <StatCard label="Assigned Employees" value={reviewers.length} icon={Users}         color="indigo" />
        <StatCard label="Awaiting Review"     value={reviewers.length} icon={ClipboardList} color="amber"  />
      </div>

      {/* Employee list */}
      <div className="space-y-3">
        {reviewers.map(rev => (
          <EmployeeReviewCard key={rev.id} reviewer={rev} onStart={handleStart} />
        ))}
      </div>
    </div>
  );
}
