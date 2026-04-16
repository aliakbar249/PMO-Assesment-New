import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import {
  getEmployeeByUserId, getAssessment, saveAssessmentProgress,
  submitSelfAssessment, getTemplateForEmployee
} from '../lib/supabase';
import { RATING_SCALE } from '../data/competencies';
import { Button, Card, Alert, ProgressBar, Badge, TipBox, PageHeader, Modal } from '../components/UI';
import { CheckCircle, Save, Send, ChevronRight, ChevronLeft } from 'lucide-react';

export default function SelfAssessment({ onNavigate }) {
  const { currentUser, refresh } = useApp();
  const [employee,   setEmployee]   = useState(null);
  const [sections,   setSections]   = useState([]);
  const [localRatings, setLocalRatings] = useState({});
  const [activeSection, setActiveSection] = useState(0);
  const [saved,      setSaved]      = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [submitModal, setSubmitModal] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [loading,    setLoading]    = useState(true);
  const empRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;
    getEmployeeByUserId(currentUser.id).then(async emp => {
      setEmployee(emp);
      empRef.current = emp;
      if (emp) {
        const [assessment, tpls] = await Promise.all([
          getAssessment(emp.id),
          getTemplateForEmployee(emp),
        ]);
        setSections(tpls || []);
        setLocalRatings(assessment?.sections || {});
        setSubmitted(assessment?.status === 'submitted');
      }
      setLoading(false);
    });
  }, [currentUser?.id]);

  const section = sections[activeSection];

  const handleRate = (statementId, value) => {
    if (!section) return;
    const sId = section.id;
    setLocalRatings(prev => ({ ...prev, [sId]: { ...(prev[sId] || {}), [statementId]: value } }));
    setSaved(false);
  };

  const handleSave = async () => {
    const emp = empRef.current;
    if (!section || !emp) return;
    setSaving(true);
    await saveAssessmentProgress(emp.id, section.id, localRatings[section.id] || {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const sectionComplete = (sId) => {
    const sec = sections.find(s => s.id === sId);
    if (!sec) return false;
    const ratings = localRatings[sId] || {};
    return sec.statements.every(st => ratings[st.id] !== undefined);
  };

  const allComplete = sections.length > 0 && sections.every(s => sectionComplete(s.id));

  const handleSubmit = async () => {
    const emp = empRef.current;
    if (!emp) return;
    setSaving(true);
    for (const sec of sections) {
      await saveAssessmentProgress(emp.id, sec.id, localRatings[sec.id] || {});
    }
    await submitSelfAssessment(emp.id);
    refresh();
    setSaving(false);
    setSubmitted(true);
    setSubmitModal(false);
  };

  const totalStatements = sections.reduce((s, sec) => s + sec.statements.length, 0);
  const totalRated = sections.reduce((s, sec) => s + Object.keys(localRatings[sec.id] || {}).length, 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading assessment…</div>;
  }

  if (!employee) {
    return <Alert type="warning">Please complete your profile first before starting the self-assessment.</Alert>;
  }

  if (submitted) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={40} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Self-Assessment Submitted!</h2>
        <p className="text-gray-500 mb-6 text-sm max-w-sm mx-auto">Your self-assessment has been recorded. The next step is to add your key assignments.</p>
        <Button onClick={() => onNavigate('emp-assignments')}>Go to Assignments <ChevronRight size={16} /></Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Self Assessment" subtitle="Rate yourself honestly on each of the 4 Power Skills sections." />

      {/* Overall progress */}
      <Card className="p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-bold text-indigo-600">{totalRated} / {totalStatements} statements rated</span>
        </div>
        <ProgressBar value={totalRated} max={totalStatements} color="indigo" showPercent />
        <div className="flex gap-2 mt-3 flex-wrap">
          {sections.map((sec, i) => (
            <button key={sec.id} onClick={async () => { await handleSave(); setActiveSection(i); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
                ${i === activeSection ? 'bg-indigo-600 text-white border-indigo-600' : sectionComplete(sec.id) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'}`}>
              {sectionComplete(sec.id) && <CheckCircle size={11} />}
              {sec.title}
            </button>
          ))}
        </div>
      </Card>

      {/* Active section */}
      {section && (
        <Card className="mb-4">
          {/* Section header */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="primary">Section {activeSection + 1} of {sections.length}</Badge>
                  {sectionComplete(section.id) && <Badge variant="success">Complete ✓</Badge>}
                </div>
                <h2 className="text-base font-bold text-gray-800">{section.title}</h2>
                <p className="text-xs text-gray-500 mt-1">{section.description}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-bold text-indigo-600">
                  {Object.keys(localRatings[section.id] || {}).length}/{section.statements.length}
                </div>
                <div className="text-xs text-gray-500">rated</div>
              </div>
            </div>
            {section.selfTip && (
              <TipBox content={section.selfTip} label="Show guidance for this section" />
            )}
          </div>

          {/* Rating scale legend */}
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-gray-500 mr-1">Scale:</span>
              {RATING_SCALE.map(r => (
                <span key={r.value} className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.bg} ${r.textColor} border ${r.border}`}>
                  {r.label}
                </span>
              ))}
            </div>
          </div>

          {/* Statements */}
          <div className="p-6 space-y-4">
            {section.statements.map((stmt, idx) => {
              const currentRating = localRatings[section.id]?.[stmt.id];
              return (
                <StatementRow
                  key={stmt.id}
                  index={idx + 1}
                  statement={stmt}
                  currentRating={currentRating}
                  onRate={(val) => handleRate(stmt.id, val)}
                  isSelf={true}
                />
              );
            })}
          </div>
        </Card>
      )}

      {/* Navigation + Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={async () => { await handleSave(); setActiveSection(a => Math.max(0, a - 1)); }} disabled={activeSection === 0}>
            <ChevronLeft size={16} />Previous
          </Button>
          {activeSection < sections.length - 1 ? (
            <Button size="sm" onClick={async () => { await handleSave(); setActiveSection(a => a + 1); }}>
              Next Section <ChevronRight size={16} />
            </Button>
          ) : null}
        </div>

        <div className="flex gap-2 items-center">
          {saved && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={12} />Saved</span>}
          <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving}><Save size={14} />{saving ? 'Saving…' : 'Save Progress'}</Button>
          {allComplete && (
            <Button variant="success" size="sm" onClick={() => setSubmitModal(true)}><Send size={14} />Submit Assessment</Button>
          )}
        </div>
      </div>

      {/* Submit confirmation modal */}
      <Modal open={submitModal} onClose={() => setSubmitModal(false)} title="Submit Self-Assessment?">
        <p className="text-sm text-gray-600 mb-4">You have rated all {totalStatements} statements across {sections.length} sections. Once submitted, ratings cannot be changed.</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setSubmitModal(false)}>Cancel</Button>
          <Button variant="success" onClick={handleSubmit} disabled={saving}><Send size={14} />{saving ? 'Submitting…' : 'Submit Now'}</Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Statement Row Component ──────────────────────────────────
function StatementRow({ index, statement, currentRating, onRate, isSelf }) {
  const scale = isSelf
    ? RATING_SCALE
    : [...RATING_SCALE, { value: 0, label: 'Not Observed / Unable to Rate', short: 'N/O', bg: 'bg-gray-50', textColor: 'text-gray-500', border: 'border-gray-300', color: 'bg-gray-300' }];
  const rated = currentRating !== undefined;
  const ratingObj = rated ? scale.find(r => r.value === currentRating) : null;

  // Build statement text based on perspective
  const statementText = isSelf
    ? `I ${statement.text.charAt(0).toLowerCase() + statement.text.slice(1)}`
    : statement.text.charAt(0).toUpperCase() + statement.text.slice(1);

  return (
    <div className={`p-4 rounded-xl border transition-all ${rated ? 'border-indigo-100 bg-indigo-50/40' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start gap-3 mb-3">
        <span className="text-xs font-bold text-gray-400 w-6 flex-shrink-0 mt-0.5">{index}.</span>
        <div className="flex-1">
          <p className="text-sm text-gray-800 font-medium leading-snug">{statementText}</p>
          {statement.selfTip && isSelf && (
            <p className="text-xs text-indigo-600 mt-1 italic">{statement.selfTip}</p>
          )}
        </div>
        {ratingObj && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ratingObj.bg} ${ratingObj.textColor} border ${ratingObj.border}`}>
            {ratingObj.label}
          </span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap pl-9">
        {scale.map(r => (
          <button key={r.value} onClick={() => onRate(r.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all
              ${currentRating === r.value
                ? `${r.color} text-white border-transparent shadow-md scale-105`
                : `bg-white ${r.textColor} ${r.border} hover:scale-105 hover:shadow-sm`}`}>
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export { StatementRow };
