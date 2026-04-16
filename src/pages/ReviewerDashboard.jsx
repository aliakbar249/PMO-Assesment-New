import { useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { getReviewerByUserId, getReviewsForEmployee, getEmployeeById, getAssignmentsByEmployee } from '../store/db';
import { StatCard, Card, Badge, Button, ProgressBar, Alert, PageHeader } from '../components/UI';
import { ClipboardList, User, CheckCircle, Clock } from 'lucide-react';

export default function ReviewerDashboard({ onNavigate }) {
  const { currentUser } = useApp();
  const reviewer = useMemo(() => getReviewerByUserId(currentUser.id), [currentUser]);
  const employee = useMemo(() => reviewer ? getEmployeeById(reviewer.forEmployeeId) : null, [reviewer]);
  const reviews  = useMemo(() => reviewer ? getReviewsForEmployee(reviewer.forEmployeeId) : [], [reviewer]);
  const myReview = useMemo(() => reviews.find(r => r.reviewerId === reviewer?.id), [reviews, reviewer]);
  const assignments = useMemo(() => employee ? getAssignmentsByEmployee(employee.id) : [], [employee]);

  if (!reviewer || !employee) {
    return <Alert type="warning">No employee linked to your reviewer account. Please contact the administrator.</Alert>;
  }

  const isSubmitted = myReview?.status === 'submitted';
  const inProgress  = myReview?.status === 'in_progress';
  const totalSections = 4 + 1; // 4 competency + 1 assignment
  const doneSections  = myReview ? Object.keys(myReview.sections || {}).length + (myReview.assignmentRatings ? 1 : 0) : 0;

  return (
    <div>
      <PageHeader title="Reviewer Dashboard" subtitle="You have been invited to provide a 360° assessment." />

      {/* Employee card */}
      <Card className="p-5 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xl font-bold">{employee.name?.[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-gray-800">{employee.name}</h2>
                <p className="text-sm text-gray-500">{employee.jobTitle} · {employee.department}</p>
                <p className="text-xs text-gray-400 mt-1">{employee.organization}</p>
              </div>
              <div>
                <Badge variant="info">{reviewer.category}</Badge>
                <p className="text-xs text-gray-400 mt-1">{reviewer.role}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <StatCard label="Sections Completed" value={`${doneSections}/${totalSections}`} icon={ClipboardList} color="indigo" />
        <StatCard label="Status" value={isSubmitted ? 'Submitted' : inProgress ? 'In Progress' : 'Not Started'} icon={isSubmitted ? CheckCircle : Clock} color={isSubmitted ? 'green' : 'amber'} />
      </div>

      {isSubmitted ? (
        <div className="text-center py-10">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-gray-800 mb-1">Assessment Submitted!</h3>
          <p className="text-sm text-gray-500">Thank you for completing the 360° assessment for <strong>{employee.name}</strong>.</p>
        </div>
      ) : (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Your Assessment Progress</h3>
          <ProgressBar value={doneSections} max={totalSections} label="Sections done" className="mb-4" />
          <p className="text-sm text-gray-600 mb-4">
            You will rate <strong>{employee.name}</strong> on 4 Power Skills sections and their {assignments.length} assignment(s). All ratings use the <em>Always / Often / Sometimes / Seldom / Never</em> scale, with an option to mark "Not Observed" for behaviours you haven't witnessed.
          </p>
          <Button onClick={() => onNavigate('rev-assessment')}>
            {inProgress ? 'Continue Assessment →' : 'Start Assessment →'}
          </Button>
        </Card>
      )}
    </div>
  );
}
