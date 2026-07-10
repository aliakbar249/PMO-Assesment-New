import { useState, useMemo } from 'react';
import {
  BookOpen, CheckCircle, Clock, AlertTriangle, Zap,
  BarChart2, Award, Link2, ChevronRight
} from 'lucide-react';
import {
  getTrainingAssignmentsByEmployee, getTrainingModules,
  getTrainingRecommendations,
  TRAIN_STATUS_CONFIG, TRAIN_CATEGORY_LABELS, TRAIN_CATEGORY_COLORS, FORMAT_LABELS,
  getKPIItems,
} from '../lib/kpiTraining';
import { useApp } from '../store/AppContext';
import { Badge, ProgressBar, PageHeader, StatCard, EmptyState, Alert } from '../components/UI';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = TRAIN_STATUS_CONFIG[status] || TRAIN_STATUS_CONFIG.not_started;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function CategoryBadge({ cat }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRAIN_CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-600'}`}>{TRAIN_CATEGORY_LABELS[cat] || cat}</span>;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Module Card ─────────────────────────────────────────────────────────────
function ModuleCard({ assignment, module }) {
  const linkedKpis = getKPIItems().filter(k => (module?.linkedKPIs || []).includes(k.id));
  const days = daysUntil(assignment.deadline);
  const isOverdue = days !== null && days < 0;
  const isDueSoon = days !== null && days >= 0 && days <= 7;

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${isOverdue ? 'border-red-200' : isDueSoon ? 'border-amber-200' : 'border-gray-200'}`}>
      {/* Status stripe */}
      <div className={`h-1 ${assignment.status === 'completed' ? 'bg-emerald-400' : assignment.status === 'overdue' ? 'bg-red-400' : assignment.status === 'in_progress' ? 'bg-amber-400' : 'bg-gray-200'}`} />

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {module && <CategoryBadge cat={module.category} />}
              {module?.isMandatory && <Badge variant="danger" size="xs">Mandatory</Badge>}
            </div>
            <h3 className="font-semibold text-sm text-gray-800 leading-snug">{module?.title || 'Unknown Module'}</h3>
          </div>
          <StatusBadge status={assignment.status} />
        </div>

        {/* Description */}
        {module?.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{module.description}</p>
        )}

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Completion</span>
            <span className="text-xs font-bold text-gray-700">{assignment.completionPct}%</span>
          </div>
          <ProgressBar
            value={assignment.completionPct || 0}
            max={100}
            color={assignment.completionPct >= 100 ? 'green' : assignment.completionPct >= 50 ? 'amber' : 'red'}
            showPercent={false}
          />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
          {module?.format && <span className="flex items-center gap-1"><BookOpen size={10} />{FORMAT_LABELS[module.format]}</span>}
          {module?.duration && <span>{module.duration} min</span>}
          {assignment.deadline && (
            <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-gray-500'}`}>
              <Clock size={10} />
              {isOverdue ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue` : days === 0 ? 'Due today' : `${days} day${days !== 1 ? 's' : ''} left`}
            </span>
          )}
        </div>

        {/* KPI link */}
        {linkedKpis.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link2 size={11} className="text-indigo-400 flex-shrink-0" />
            <span className="text-xs text-indigo-600 font-medium">Supports KPIs:</span>
            {linkedKpis.map(k => (
              <span key={k.id} className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{k.name}</span>
            ))}
          </div>
        )}

        {/* Assigned by */}
        {assignment.assignedBy && (
          <div className="text-xs text-gray-400">Assigned by: {assignment.assignedBy}</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Employee Training View ──────────────────────────────────────────────
export default function TrainingMyModules() {
  const { currentUser } = useApp();

  // Use demo employee ID if employee, or first demo otherwise
  const employeeId = currentUser?.employeeId || 'demo_emp_carol';
  const employeeName = currentUser?.name || 'Demo Employee';

  const assignments = useMemo(() => getTrainingAssignmentsByEmployee(employeeId), [employeeId]);
  const allModules  = useMemo(() => getTrainingModules(), []);
  const recommendations = useMemo(() => getTrainingRecommendations(employeeId), [employeeId]);

  // Enrich assignments with module data
  const enriched = assignments.map(a => ({
    assignment: a,
    module: allModules.find(m => m.id === a.moduleId),
  }));

  // Stats
  const total     = enriched.length;
  const completed = enriched.filter(e => e.assignment.status === 'completed').length;
  const overdue   = enriched.filter(e => e.assignment.status === 'overdue').length;
  const inProg    = enriched.filter(e => e.assignment.status === 'in_progress').length;
  const overall   = total ? Math.round(enriched.reduce((s, e) => s + (e.assignment.completionPct || 0), 0) / total) : 0;

  // Sort: overdue first, then in_progress, then not_started, then completed
  const ORDER = { overdue: 0, in_progress: 1, not_started: 2, completed: 3 };
  const sorted = [...enriched].sort((a, b) => (ORDER[a.assignment.status] || 99) - (ORDER[b.assignment.status] || 99));

  // Group by status
  const overdueList   = sorted.filter(e => e.assignment.status === 'overdue');
  const inProgList    = sorted.filter(e => e.assignment.status === 'in_progress');
  const notStartList  = sorted.filter(e => e.assignment.status === 'not_started');
  const completedList = sorted.filter(e => e.assignment.status === 'completed');

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Training"
        subtitle="Track your assigned training modules, deadlines, and completion progress"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Overall Progress" value={`${overall}%`} icon={BarChart2} color="indigo" />
        <StatCard label="Completed" value={completed} icon={CheckCircle} color="green" sub={`of ${total} total`} />
        <StatCard label="In Progress" value={inProg} icon={Clock} color="amber" />
        <StatCard label="Overdue" value={overdue} icon={AlertTriangle} color="red" />
      </div>

      {/* Overall progress bar */}
      {total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Overall Completion</span>
            <span className="text-sm font-bold text-gray-800">{overall}%</span>
          </div>
          <ProgressBar value={overall} max={100} color={overall >= 80 ? 'green' : overall >= 50 ? 'amber' : 'red'} showPercent={false} />
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />{completed} Completed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{inProg} In Progress</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />{overdue} Overdue</span>
          </div>
        </div>
      )}

      {/* Assessment recommendations */}
      {recommendations.filter(r => !r.alreadyAssigned).length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-purple-600" />
            <span className="font-semibold text-sm text-purple-800">Recommended for You</span>
            <Badge variant="purple" size="xs">{recommendations.filter(r => !r.alreadyAssigned).length} new</Badge>
          </div>
          <p className="text-xs text-purple-600 mb-4">Based on your latest 360° assessment results, your manager may assign the following training modules:</p>
          <div className="space-y-2">
            {recommendations.filter(r => !r.alreadyAssigned).map(rec => (
              <div key={rec.module.id} className="flex items-center justify-between gap-3 bg-white rounded-xl px-4 py-3 border border-purple-100">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{rec.module.title}</div>
                  <div className="text-xs text-purple-600 mt-0.5">
                    Your <strong>{rec.competency}</strong> score: {rec.score.toFixed(1)} / 5.0
                    (below {rec.threshold.toFixed(1)} threshold)
                  </div>
                </div>
                <CategoryBadge cat={rec.module.category} />
              </div>
            ))}
          </div>
        </div>
      )}

      {total === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No training modules assigned"
          description="Your manager will assign training modules here. Check back soon."
        />
      ) : (
        <div className="space-y-6">
          {/* Overdue */}
          {overdueList.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-bold text-red-700 mb-3">
                <AlertTriangle size={14} />Overdue ({overdueList.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {overdueList.map(e => <ModuleCard key={e.assignment.id} assignment={e.assignment} module={e.module} />)}
              </div>
            </section>
          )}

          {/* In Progress */}
          {inProgList.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-bold text-amber-700 mb-3">
                <Clock size={14} />In Progress ({inProgList.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inProgList.map(e => <ModuleCard key={e.assignment.id} assignment={e.assignment} module={e.module} />)}
              </div>
            </section>
          )}

          {/* Not Started */}
          {notStartList.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-3">
                <BookOpen size={14} />Not Started ({notStartList.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {notStartList.map(e => <ModuleCard key={e.assignment.id} assignment={e.assignment} module={e.module} />)}
              </div>
            </section>
          )}

          {/* Completed */}
          {completedList.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-bold text-emerald-700 mb-3">
                <CheckCircle size={14} />Completed ({completedList.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completedList.map(e => <ModuleCard key={e.assignment.id} assignment={e.assignment} module={e.module} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
