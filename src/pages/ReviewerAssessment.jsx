import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import {
  getReviewerByUserId, getEmployeeById, getAssignmentsByEmployee,
  getReview, saveReviewProgress, saveAssignmentReview, submitReview,
  getTemplateForEmployee
} from '../lib/supabase';
import { RATING_SCALE, NOT_OBSERVED } from '../data/competencies';
import { Button, Card, Alert, Badge, ProgressBar, TipBox, PageHeader, Modal } from '../components/UI';
import { CheckCircle, Save, Send, ChevronLeft, ChevronRight, Briefcase } from 'lucide-react';

const ALL_RATINGS = [...RATING_SCALE, NOT_OBSERVED];

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
  if (!reviewer || !employee) return <Alert type="warning">No employee linked to your account.</Alert>;

  if (submitted) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><CheckCircle size={40} className="text-emerald-600" /></div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Assessment Submitted!</h2>
        <p className="text-gray-500 text-sm max-w-sm mx-auto">Thank you. Your ratings for <strong>{employee.name}</strong> have been recorded.</p>
        <Button className="mt-4" onClick={() => onNavigate('rev-dashboard')}>← Back to Dashboard</Button>
      </div>
    );
  }

  const STEPS = [
    ...sections.map(s => ({ type: 'section', ...s })),
    { type: 'assignments', id: 'assignments', title: 'Assignment Ratings' },
  ];
  const step = STEPS[activeStep];

  const handleRateSection = (sectionId, stmtId, value) => {
    setLocalSections(prev => ({ ...prev, [sectionId]: { ...(prev[sectionId] || {}), [stmtId]: value } }));
    setSaved(false);
  };

  const handleRateAssignment = (assignId, stmtKey, value) => {
    setLocalAssignRatings(prev => ({ ...prev, [assignId]: { ...(prev[assignId] || {}), [stmtKey]: value } }));
    setSaved(false);
  };

  const handleSave = async () => {
    const rev = revRef.current;
    const emp = empRef.current;
    if (!rev?.id || !emp) return;
    setSaving(true);
    if (step?.type === 'section') {
      await saveReviewProgress(rev.id, emp.id, step.id, localSections[step.id] || {});
    } else {
      await saveAssignmentReview(rev.id, emp.id, localAssignRatings);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const sectionDone = (sId) => {
    const sec = sections.find(s => s.id === sId);
    if (!sec) return false;
    return sec.statements.every(st => localSections[sId]?.[st.id] !== undefined);
  };

  const allDone = sections.length > 0 && sections.every(s => sectionDone(s.id));

  const handleSubmit = async () => {
    const rev = revRef.current;
    const emp = empRef.current;
    if (!rev?.id || !emp) return;
    setSaving(true);
    for (const sec of sections) {
      await saveReviewProgress(rev.id, emp.id, sec.id, localSections[sec.id] || {});
    }
    await saveAssignmentReview(rev.id, emp.id, localAssignRatings);
    await submitReview(rev.id, emp.id);
    refresh();
    setSaving(false);
    setSubmitted(true);
    setSubmitModal(false);
  };

  const totalStatements = sections.reduce((s, sec) => s + sec.statements.length, 0);
  const totalRated = sections.reduce((s, sec) => s + Object.keys(localSections[sec.id] || {}).length, 0);

  return (
    <div>
      <PageHeader title={`Rating: ${employee.name}`} subtitle={`${employee.jobTitle} · ${employee.organization}`} />

      <Card className="p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-bold text-indigo-600">{totalRated}/{totalStatements} statements rated</span>
        </div>
        <ProgressBar value={totalRated} max={totalStatements} />
        <div className="flex gap-2 mt-3 flex-wrap">
          {STEPS.map((s, i) => (
            <button key={s.id} onClick={async () => { await handleSave(); setActiveStep(i); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1
                ${i === activeStep ? 'bg-indigo-600 text-white border-indigo-600' :
                  (s.type === 'section' && sectionDone(s.id)) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'}`}>
              {s.type === 'section' && sectionDone(s.id) && <CheckCircle size={11} />}
              {s.title}
            </button>
          ))}
        </div>
      </Card>

      {step?.type === 'section' && (
        <SectionPanel
          section={step}
          ratings={localSections[step.id] || {}}
          onRate={(stmtId, val) => handleRateSection(step.id, stmtId, val)}
          stepNum={activeStep + 1}
          totalSteps={STEPS.length}
        />
      )}

      {step?.type === 'assignments' && (
        <AssignmentRatingsPanel
          assignments={assignments}
          ratings={localAssignRatings}
          onRate={handleRateAssignment}
        />
      )}

      <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={async () => { await handleSave(); setActiveStep(a => Math.max(0, a - 1)); }} disabled={activeStep === 0}>
            <ChevronLeft size={16} />Previous
          </Button>
          {activeStep < STEPS.length - 1 && (
            <Button size="sm" onClick={async () => { await handleSave(); setActiveStep(a => a + 1); }}>Next <ChevronRight size={16} /></Button>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {saved && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={12} />Saved</span>}
          <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving}><Save size={14} />{saving ? '…' : 'Save'}</Button>
          {allDone && <Button variant="success" size="sm" onClick={() => setSubmitModal(true)}><Send size={14} />Submit</Button>}
        </div>
      </div>

      <Modal open={submitModal} onClose={() => setSubmitModal(false)} title="Submit Assessment?">
        <p className="text-sm text-gray-600 mb-4">Once submitted, your ratings for <strong>{employee.name}</strong> cannot be changed.</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setSubmitModal(false)}>Cancel</Button>
          <Button variant="success" onClick={handleSubmit} disabled={saving}><Send size={14} />{saving ? 'Submitting…' : 'Submit Now'}</Button>
        </div>
      </Modal>
    </div>
  );
}

function SectionPanel({ section, ratings, onRate, stepNum, totalSteps }) {
  return (
    <Card className="mb-4">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
        <Badge variant="info" className="mb-1">Section {stepNum} of {totalSteps}</Badge>
        <h2 className="text-base font-bold text-gray-800">{section.title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
        {section.reviewerTip && <TipBox content={section.reviewerTip} label="Show reviewer guidance" />}
      </div>
      <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">Scale:</span>
          {ALL_RATINGS.map(r => (
            <span key={r.value} className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.bg} ${r.textColor} border ${r.border}`}>{r.label}</span>
          ))}
        </div>
      </div>
      <div className="p-6 space-y-4">
        {section.statements.map((stmt, idx) => {
          const currentRating = ratings[stmt.id];
          const ratingObj = currentRating !== undefined ? ALL_RATINGS.find(r => r.value === currentRating) : null;
          return (
            <div key={stmt.id} className={`p-4 rounded-xl border transition-all ${currentRating !== undefined ? 'border-blue-100 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-start gap-3 mb-3">
                <span className="text-xs font-bold text-gray-400 w-6 flex-shrink-0 mt-0.5">{idx + 1}.</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-800 font-medium leading-snug">{stmt.text}</p>
                </div>
                {ratingObj && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ratingObj.bg} ${ratingObj.textColor} border ${ratingObj.border}`}>{ratingObj.label}</span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap pl-9">
                {ALL_RATINGS.map(r => (
                  <button key={r.value} onClick={() => onRate(stmt.id, r.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all
                      ${currentRating === r.value ? `${r.color} text-white border-transparent shadow-md scale-105` : `bg-white ${r.textColor} ${r.border} hover:scale-105 hover:shadow-sm`}`}>
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

const ASSIGNMENT_QUESTIONS = [
  { id: 'q1', text: 'Demonstrated strong project leadership on this assignment' },
  { id: 'q2', text: 'Communicated effectively with stakeholders throughout the assignment' },
  { id: 'q3', text: 'Managed risks and problems proactively' },
  { id: 'q4', text: 'Delivered the assignment objectives successfully' },
  { id: 'q5', text: 'Showed strategic thinking in aligning work to business goals' },
  { id: 'q6', text: 'Built and maintained strong team collaboration' },
  { id: 'q7', text: 'Adapted effectively to changes and challenges during the assignment' },
  { id: 'q8', text: 'Demonstrated accountability for results and decisions' },
];

function AssignmentRatingsPanel({ assignments, ratings, onRate }) {
  if (!assignments.length) {
    return <Card className="p-8 text-center text-sm text-gray-500">No assignments added by the employee yet.</Card>;
  }
  return (
    <div className="space-y-5">
      {assignments.map(assign => (
        <Card key={assign.id}>
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-white">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0"><Briefcase size={17} className="text-amber-700" /></div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">{assign.title}</h3>
                <p className="text-xs text-gray-500">{assign.role} · {assign.clientOrg}</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {ASSIGNMENT_QUESTIONS.map((q, idx) => {
              const cur = ratings?.[assign.id]?.[q.id];
              const rObj = cur !== undefined ? ALL_RATINGS.find(r => r.value === cur) : null;
              return (
                <div key={q.id} className={`p-3 rounded-xl border transition-all ${cur !== undefined ? 'border-amber-100 bg-amber-50/30' : 'border-gray-200'}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-400 w-5 flex-shrink-0">{idx + 1}.</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-700 font-medium">{q.text}</p>
                    </div>
                    {rObj && <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${rObj.bg} ${rObj.textColor} border ${rObj.border}`}>{rObj.label}</span>}
                  </div>
                  <div className="flex gap-1.5 flex-wrap pl-7">
                    {ALL_RATINGS.map(r => (
                      <button key={r.value} onClick={() => onRate(assign.id, q.id, r.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border-2 transition-all
                          ${cur === r.value ? `${r.color} text-white border-transparent shadow-sm scale-105` : `bg-white ${r.textColor} ${r.border} hover:scale-105`}`}>
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
