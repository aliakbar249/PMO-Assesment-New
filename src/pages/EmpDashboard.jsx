import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import {
  getEmployeeByUserId, getAssessment, getAssignmentsByEmployee,
  getNominations, getTemplateForEmployee, getAssessmentResults
} from '../lib/supabase';
import { StatCard, Card, ProgressBar, Badge, Button, Alert } from '../components/UI';
import { Star, Briefcase, Users, ClipboardList, CheckCircle, Clock, AlertCircle, BarChart2 } from 'lucide-react';

export default function EmpDashboard({ onNavigate }) {
  const { currentUser, tick } = useApp();
  const [employee,    setEmployee]    = useState(null);
  const [assessment,  setAssessment]  = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [nominations, setNominations] = useState(null);
  const [templates,   setTemplates]   = useState([]);
  const [selfResults, setSelfResults] = useState(null); // section-wise self-avg after submission
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    getEmployeeByUserId(currentUser.id).then(async emp => {
      setEmployee(emp);
      if (emp) {
        const [a, asgns, noms, tpls] = await Promise.all([
          getAssessment(emp.id),
          getAssignmentsByEmployee(emp.id),
          getNominations(emp.id),
          getTemplateForEmployee(emp),
        ]);
        setAssessment(a);
        setAssignments(asgns || []);
        setNominations(noms);
        setTemplates(tpls || []);
        // Load self-average results if self-assessment is submitted
        if (a?.status === 'submitted') {
          const res = await getAssessmentResults(emp.id);
          setSelfResults(res);
        }
      }
      setLoading(false);
    });
  }, [currentUser?.id, tick]);

  const totalStatements = templates.reduce((s, sec) => s + (sec.statements?.length || 0), 0);
  const ratedStatements = Object.values(assessment?.sections || {}).reduce((s, sec) => s + Object.keys(sec).length, 0);

  const steps = [
    {
      id: 'profile', label: 'Complete Profile', icon: Star,
      done: !!employee, nav: 'emp-profile',
      badge: employee ? 'success' : 'warning',
      status: employee ? 'Done' : 'Pending',
    },
    {
      id: 'assessment', label: 'Self Assessment', icon: ClipboardList,
      done: assessment?.status === 'submitted', inProgress: assessment?.status === 'in_progress',
      nav: 'emp-assessment', badge: assessment?.status === 'submitted' ? 'success' : assessment ? 'warning' : 'default',
      status: assessment?.status === 'submitted' ? 'Submitted' : assessment ? `${ratedStatements}/${totalStatements} rated` : 'Not started',
      progress: totalStatements > 0 ? Math.round((ratedStatements / totalStatements) * 100) : 0,
    },
    {
      id: 'assignments', label: 'Add Assignments', icon: Briefcase,
      done: assignments.length > 0, nav: 'emp-assignments',
      badge: assignments.length >= 1 ? 'success' : 'default',
      status: assignments.length > 0 ? `${assignments.length}/3 added` : 'None added',
    },
    {
      id: 'nominations', label: 'Nominate Reviewers', icon: Users,
      done: nominations?.submitted, nav: 'emp-nominations',
      badge: nominations?.submitted ? 'success' : nominations ? 'warning' : 'default',
      status: nominations?.submitted ? 'Submitted' : nominations ? 'In progress' : 'Not started',
    },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading dashboard…</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Welcome back, {currentUser.name?.split(' ')[0]}!</h1>
        <p className="text-sm text-gray-500 mt-1">Track your 360° assessment progress below.</p>
      </div>

      {!employee && (
        <Alert type="warning" className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2"><AlertCircle size={15} />Your profile is incomplete. Please complete your professional profile to get started.</div>
            <Button size="sm" variant="warning" onClick={() => onNavigate('emp-profile')}>Complete Now</Button>
          </div>
        </Alert>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Sections Rated" value={`${Object.keys(assessment?.sections || {}).length}/${templates.length}`} icon={Star} color="indigo" />
        <StatCard label="Statements Done" value={`${ratedStatements}/${totalStatements}`} icon={ClipboardList} color="blue" />
        <StatCard label="Assignments" value={assignments.length} sub="max 3" icon={Briefcase} color="amber" />
        <StatCard label="Nominations" value={nominations?.submitted ? '✓' : 'Pending'} icon={Users} color={nominations?.submitted ? 'green' : 'red'} />
      </div>

      {/* Journey steps */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {steps.map((s, i) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.done ? 'bg-emerald-50' : s.inProgress ? 'bg-amber-50' : 'bg-gray-100'}`}>
                  {s.done ? <CheckCircle size={20} className="text-emerald-600" /> : s.inProgress ? <Clock size={20} className="text-amber-600" /> : <s.icon size={20} className="text-gray-400" />}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">Step {i + 1}: {s.label}</div>
                  <Badge variant={s.badge} size="xs" className="mt-0.5">{s.status}</Badge>
                </div>
              </div>
            </div>
            {s.progress !== undefined && (
              <ProgressBar value={s.progress} className="mb-3" label="Progress" />
            )}
            <Button variant={s.done ? 'secondary' : 'primary'} size="sm" onClick={() => onNavigate(s.nav)}>
              {s.done ? 'Review' : s.inProgress ? 'Continue' : 'Start'}
            </Button>
          </Card>
        ))}
      </div>

      {/* Self-Assessment Results (shown only after submission) */}
      {selfResults && selfResults.sections && selfResults.sections.length > 0 && (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} className="text-indigo-500" />
            <h3 className="text-sm font-semibold text-gray-700">My Self-Assessment Results</h3>
            <Badge variant="success" size="xs">Submitted</Badge>
          </div>

          {/* Overall self-avg */}
          {(() => {
            const vals = selfResults.sections.map(s => s.selfAvg).filter(v => v !== null);
            const overall = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
            return overall ? (
              <div className="mb-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-indigo-700">Overall Self-Average</span>
                <span className="text-2xl font-bold text-indigo-600">{overall}</span>
              </div>
            ) : null;
          })()}

          {/* Per-section self-avg */}
          <div className="space-y-2">
            {selfResults.sections.map(sec => (
              <div key={sec.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-xs font-medium text-gray-700">{sec.title}</span>
                <div className="flex items-center gap-3">
                  {sec.selfAvg !== null ? (
                    <>
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${(sec.selfAvg / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-indigo-600 w-10 text-right">{sec.selfAvg.toFixed(2)}</span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">No ratings</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Scale 1–5 · Your self-rating average per section.</p>
        </Card>
      )}

      {/* Tips */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">About This Assessment</h3>
        <div className="space-y-2">
          {[
            'Your responses are saved automatically as you progress — you can return anytime.',
            'Self-assessment requires honest, self-critical reflection. No score is final.',
            'After you nominate reviewers, an administrator will verify and approve their profiles.',
            'Approved reviewers will receive access to rate you on the same 4 competency sections.',
            'All sections must be completed before final submission.',
          ].map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
              <span className="text-indigo-400 font-bold flex-shrink-0">•</span>{t}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
