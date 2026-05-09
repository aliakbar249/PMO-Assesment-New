import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import {
  getReviewerByUserId, getEmployeeById, getAssignmentsByEmployee,
  getReview, saveReviewProgress, saveAssignmentReview, submitReview,
  getTemplateForEmployee
} from '../lib/supabase';
import { RATING_SCALE, NOT_OBSERVED } from '../data/competencies';
import { Button, Card, Alert, Badge, ProgressBar, TipBox, PageHeader, Modal } from '../components/UI';
import { CheckCircle, Save, Send, ChevronLeft, ChevronRight, Briefcase, Info } from 'lucide-react';

const ALL_RATINGS = [...RATING_SCALE, NOT_OBSERVED];

// ─── Assignment-specific questions ────────────────────────────
const ASSIGNMENT_QUESTIONS = [
  { id: 'q1', text: 'Demonstrated strong project leadership throughout this assignment' },
  { id: 'q2', text: 'Communicated effectively with stakeholders throughout the assignment' },
  { id: 'q3', text: 'Managed risks and issues proactively' },
  { id: 'q4', text: 'Delivered the assignment objectives successfully' },
  { id: 'q5', text: 'Showed strategic thinking in aligning work to business goals' },
  { id: 'q6', text: 'Built and maintained strong team collaboration' },
  { id: 'q7', text: 'Adapted effectively to changes and challenges during the assignment' },
  { id: 'q8', text: 'Demonstrated accountability for results and decisions' },
];

// ─── Helper: prefix statement with employee first name ────────
// Statements are written in 3rd-person base form (no subject).
// We prepend the first name so they read: "John engages team members..."
function withFirstName(text, firstName) {
  if (!text) return text;
  const name = firstName || 'This person';
  // Lower-case first letter of original text then prepend name
  const body = text.charAt(0).toLowerCase() + text.slice(1);
  return `${name} ${body}`;
}

export default function ReviewerAssessment({ onNavigate }) {
  const { currentUser, refresh } = useApp();
  const [reviewer,    setReviewer]    = useState(null);
  const [employee,    setEmployee]    = useState(null);
  const [sections,    setSections]    = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [localSections, setLocalSections] = useState({});
  const [localAssignRatings, setLocalAssignRatings] = useState({});
  const [activeStep,  setActiveStep]  = useState(0);
  const [saved,       setSaved]       = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const [saving,      setSaving]      = useState(false);
  const [submitModal, setSubmitModal] = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [loading,     setLoading]     = useState(true);
  const revRef  = useRef(null);
  const empRef  = useRef(null);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    getReviewerByUserId(currentUser.id).then(async rev => {
      setReviewer(rev);
      revRef.current = rev;
      if (rev?.employeeId) {
        const [emp, tpls, asgns] = await Promise.all([
          getEmployeeById(rev.employeeId),
          getTemplateForEmployee({ id: rev.employeeId }),
          getAssignmentsByEmployee(rev.employeeId),
        ]);
        setEmployee(emp);
        empRef.current = emp;
        setSections(tpls || []);
        setAssignments(asgns || []);

        if (rev.id) {
          const existingReview = await getReview(rev.id, rev.employeeId);
          if (existingReview) {
            setLocalSections(existingReview.sections || {});
            setLocalAssignRatings(existingReview.assignmentRatings || {});
            setSubmitted(existingReview.status === 'submitted');
          }
        }
      }
      setLoading(false);
    });
  }, [currentUser?.id]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading assessment…</div>;
  if (!reviewer || !employee) return <Alert type="warning">No employee linked to your reviewer account. Please contact the administrator.</Alert>;

  // Build steps: all competency sections + one assignments step
  const STEPS = [
    ...sections.map(s => ({ type: 'section', ...s })),
    { type: 'assignments', id: 'assignments', title: 'Assignment Ratings' },
  ];
  const step = STEPS[activeStep];

  const handleRateSection = (sectionId, stmtId, value) => {
    setLocalSections(prev => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] || {}), [stmtId]: value }
    }));
    setSaved(false);
  };

  const handleRateAssignment = (assignId, stmtKey, value) => {
    setLocalAssignRatings(prev => ({
      ...prev,
      [assignId]: { ...(prev[assignId] || {}), [stmtKey]: value }
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    const rev = revRef.current;
    const emp = empRef.current;
    if (!rev?.id || !emp) return;
    setSaving(true);
    setSaveError('');
    let result;
    if (step?.type === 'section') {
      result = await saveReviewProgress(rev.id, emp.id, step.id, localSections[step.id] || {});
    } else {
      result = await saveAssignmentReview(rev.id, emp.id, localAssignRatings);
    }
    setSaving(false);
    if (result && !result.success) {
      setSaveError(result.error || 'Failed to save. Please try again.');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const sectionDone = (sId) => {
    const sec = sections.find(s => s.id === sId);
    if (!sec) return false;
    return sec.statements.every(st => localSections[sId]?.[st.id] !== undefined);
  };

  const allSectionsDone = sections.length > 0 && sections.every(s => sectionDone(s.id));

  const handleSubmit = async () => {
    const rev = revRef.current;
    const emp = empRef.current;
    if (!rev?.id || !emp) return;
    setSaving(true);
    setSaveError('');
    for (const sec of sections) {
      const r = await saveReviewProgress(rev.id, emp.id, sec.id, localSections[sec.id] || {});
      if (r && !r.success) {
        setSaveError(r.error || 'Failed to save. Please try again.');
        setSaving(false);
        setSubmitModal(false);
        return;
      }
    }
    const r2 = await saveAssignmentReview(rev.id, emp.id, localAssignRatings);
    if (r2 && !r2.success) {
      setSaveError(r2.error || 'Failed to save assignment ratings.');
      setSaving(false);
      setSubmitModal(false);
      return;
    }
    await submitReview(rev.id, emp.id);
    refresh();
    setSaving(false);
    setSubmitted(true);
    setSubmitModal(false);
  };

  const totalStatements = sections.reduce((s, sec) => s + sec.statements.length, 0);
  const totalRated = sections.reduce((s, sec) => s + Object.keys(localSections[sec.id] || {}).length, 0);

  // Submission success screen
  if (submitted) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={40} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Assessment Submitted!</h2>
        <p className="text-gray-500 text-sm max-w-sm mx-auto">
          Thank you. Your ratings for <strong>{employee.name}</strong> have been recorded successfully.
        </p>
        <Button className="mt-6" onClick={() => onNavigate('rev-dashboard')}>← Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Rating: ${employee.name}`}
        subtitle={`${employee.jobTitle || ''}${employee.organization ? ' · ' + employee.organization : ''}`}
      />

      {/* Rating perspective note */}
      <Alert type="info" className="mb-4">
        <div className="flex items-start gap-2">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <span className="text-xs">
            Rate based on <strong>observable behaviours</strong> you have directly witnessed.
            Statements are worded as third-person — how you observe this person behaving.
            Use <strong>"Not Observed / Unable to Rate"</strong> if you haven't had sufficient opportunity to observe a behaviour.
          </span>
        </div>
      </Alert>

      {/* Overall progress */}
      <Card className="p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Competency Ratings Progress</span>
          <span className="text-sm font-bold text-indigo-600">{totalRated}/{totalStatements} rated</span>
        </div>
        <ProgressBar value={totalRated} max={totalStatements} />
        <div className="flex gap-2 mt-3 flex-wrap">
          {STEPS.map((s, i) => (
            <button key={s.id} onClick={async () => { await handleSave(); setActiveStep(i); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1
                ${i === activeStep
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : (s.type === 'section' && sectionDone(s.id))
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : s.type === 'assignments'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'
                }`}>
              {s.type === 'section' && sectionDone(s.id) && <CheckCircle size={11} />}
              {s.type === 'assignments' && <Briefcase size={11} />}
              {s.title}
            </button>
          ))}
        </div>
      </Card>

      {/* Active step */}
      {step?.type === 'section' && (
        <SectionPanel
          section={step}
          employeeFirstName={employee.name?.split(' ')[0] || 'This person'}
          ratings={localSections[step.id] || {}}
          onRate={(stmtId, val) => handleRateSection(step.id, stmtId, val)}
          stepNum={activeStep + 1}
          totalSteps={STEPS.length}
        />
      )}

      {step?.type === 'assignments' && (
        <AssignmentRatingsPanel
          assignments={assignments}
          employeeName={employee.name}
          employeeFirstName={employee.name?.split(' ')[0] || 'This person'}
          ratings={localAssignRatings}
          onRate={handleRateAssignment}
        />
      )}

      {/* Navigation + Actions */}
      <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
        <div className="flex gap-2">
          <Button
            variant="secondary" size="sm"
            onClick={async () => { await handleSave(); setActiveStep(a => Math.max(0, a - 1)); }}
            disabled={activeStep === 0}
          >
            <ChevronLeft size={16} />Previous
          </Button>
          {activeStep < STEPS.length - 1 && (
            <Button size="sm" onClick={async () => { await handleSave(); setActiveStep(a => a + 1); }}>
              Next <ChevronRight size={16} />
            </Button>
          )}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {saved && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={12} />Saved</span>}
          {saveError && <span className="text-xs text-red-600 flex items-center gap-1 max-w-xs">{saveError}</span>}
          <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving}>
            <Save size={14} />{saving ? 'Saving…' : 'Save Progress'}
          </Button>
          {allSectionsDone && (
            <Button variant="success" size="sm" onClick={() => setSubmitModal(true)}>
              <Send size={14} />Submit Assessment
            </Button>
          )}
        </div>
      </div>

      {/* Submit confirmation modal */}
      <Modal open={submitModal} onClose={() => setSubmitModal(false)} title="Submit Assessment?">
        <p className="text-sm text-gray-600 mb-4">
          Once submitted, your ratings for <strong>{employee.name}</strong> cannot be changed.
          Make sure you have reviewed all sections before submitting.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setSubmitModal(false)}>Review Again</Button>
          <Button variant="success" onClick={handleSubmit} disabled={saving}>
            <Send size={14} />{saving ? 'Submitting…' : 'Submit Now'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Section Panel (third-person wording) ─────────────────────
function SectionPanel({ section, employeeFirstName, ratings, onRate, stepNum, totalSteps }) {
  const firstName = employeeFirstName || 'This person';

  return (
    <Card className="mb-4">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="info" className="mb-1">Section {stepNum} of {totalSteps - 1}</Badge>
            <h2 className="text-base font-bold text-gray-800">{section.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-indigo-600">
              {Object.keys(ratings).length}/{section.statements.length}
            </div>
            <div className="text-xs text-gray-500">rated</div>
          </div>
        </div>
        {section.reviewerTip && (
          <TipBox content={section.reviewerTip} label="Show reviewer guidance" />
        )}
      </div>

      {/* Rating scale legend */}
      <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">Scale:</span>
          {ALL_RATINGS.map(r => (
            <span key={r.value} className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.bg} ${r.textColor} border ${r.border}`}>
              {r.label}
            </span>
          ))}
        </div>
      </div>

      {/* Statements with third-person wording */}
      <div className="p-6 space-y-4">
        {section.statements.map((stmt, idx) => {
          const currentRating = ratings[stmt.id];
          const ratingObj = currentRating !== undefined ? ALL_RATINGS.find(r => r.value === currentRating) : null;
          return (
            <div
              key={stmt.id}
              className={`p-4 rounded-xl border transition-all ${currentRating !== undefined ? 'border-blue-100 bg-blue-50/30' : 'border-gray-200 bg-white'}`}
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="text-xs font-bold text-gray-400 w-6 flex-shrink-0 mt-0.5">{idx + 1}.</span>
                <div className="flex-1">
                  {/* Prefixed with employee first name */}
                  <p className="text-sm text-gray-800 font-medium leading-snug">
                    {withFirstName(stmt.text, firstName)}
                  </p>
                  {stmt.reviewerTip && (
                    <p className="text-xs text-blue-600 mt-1 italic">{stmt.reviewerTip}</p>
                  )}
                </div>
                {ratingObj && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ratingObj.bg} ${ratingObj.textColor} border ${ratingObj.border}`}>
                    {ratingObj.label}
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap pl-9">
                {ALL_RATINGS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => onRate(stmt.id, r.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all
                      ${currentRating === r.value
                        ? `${r.color} text-white border-transparent shadow-md scale-105`
                        : `bg-white ${r.textColor} ${r.border} hover:scale-105 hover:shadow-sm`}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Assignment Ratings Panel ──────────────────────────────────
function AssignmentRatingsPanel({ assignments, employeeName, employeeFirstName, ratings, onRate }) {
  const firstName = employeeFirstName || 'this person';

  if (!assignments || assignments.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Briefcase size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No assignments have been added by {employeeName} yet.</p>
        <p className="text-xs text-gray-400 mt-1">You can proceed to submit your competency ratings.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Intro note */}
      <Alert type="info">
        <div className="flex items-start gap-2">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <span className="text-xs">
            The questions below are specific to each assignment. Rate <strong>{employeeName}</strong>'s performance on each assignment independently.
            These ratings are separate from the competency sections above.
          </span>
        </div>
      </Alert>

      {assignments.map((assign, assignIdx) => (
        <Card key={assign.id}>
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-white">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Briefcase size={18} className="text-amber-700" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="warning">Assignment {assignIdx + 1}</Badge>
                  {assign.type && <Badge variant="default">{assign.type}</Badge>}
                </div>
                <h3 className="text-sm font-bold text-gray-800 mt-0.5">{assign.title}</h3>
                <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                  {assign.role && <span>Role: {assign.role}</span>}
                  {assign.clientOrg && <span>Client: {assign.clientOrg}</span>}
                  {assign.startDate && <span>Period: {assign.startDate}{assign.endDate ? ` → ${assign.endDate}` : ' (ongoing)'}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Rating scale legend */}
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-gray-500 mr-1">Scale:</span>
              {ALL_RATINGS.map(r => (
                <span key={r.value} className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.bg} ${r.textColor} border ${r.border}`}>
                  {r.label}
                </span>
              ))}
            </div>
          </div>

          <div className="p-5 space-y-3">
            {ASSIGNMENT_QUESTIONS.map((q, idx) => {
              const cur = ratings?.[assign.id]?.[q.id];
              const rObj = cur !== undefined ? ALL_RATINGS.find(r => r.value === cur) : null;
              return (
                <div
                  key={q.id}
                  className={`p-3 rounded-xl border transition-all ${cur !== undefined ? 'border-amber-100 bg-amber-50/30' : 'border-gray-200 bg-white'}`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-400 w-5 flex-shrink-0">{idx + 1}.</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-700 font-medium">{withFirstName(q.text, firstName)}</p>
                    </div>
                    {rObj && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${rObj.bg} ${rObj.textColor} border ${rObj.border}`}>
                        {rObj.label}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-wrap pl-7">
                    {ALL_RATINGS.map(r => (
                      <button
                        key={r.value}
                        onClick={() => onRate(assign.id, q.id, r.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border-2 transition-all
                          ${cur === r.value
                            ? `${r.color} text-white border-transparent shadow-sm scale-105`
                            : `bg-white ${r.textColor} ${r.border} hover:scale-105`}`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
