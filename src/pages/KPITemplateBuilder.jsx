import { useState, useMemo, useCallback } from 'react';
import {
  LayoutTemplate, Plus, Edit2, Trash2, Save, ChevronDown, ChevronUp,
  CheckSquare, Square, Search, X, ArrowUpCircle, ArrowDownCircle,
  AlertTriangle, Info, Copy, Eye, Package, Check
} from 'lucide-react';
import {
  getKPITemplates, saveKPITemplate, deleteKPITemplate,
  getActiveKPIItems, getEffectiveTarget,
  KPI_CATEGORY_LABELS, KPI_CATEGORY_COLORS,
  KPI_UNIT_LABELS, KPI_FREQUENCY_LABELS,
  INTENDED_ROLES,
} from '../lib/kpiTraining';
import { useApp } from '../store/AppContext';
import {
  Button, Badge, Input, Select, Textarea, Modal,
  PageHeader, StatCard, EmptyState, Alert, Card, CardHeader, Accordion,
} from '../components/UI';

// ─── Constants ────────────────────────────────────────────────────────────────
const REVIEW_CYCLES = [
  'Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026',
  'Q1 2027', 'Q2 2027', 'Q3 2027', 'Q4 2027',
  'H1 2026', 'H2 2026', 'Annual 2026', 'Annual 2027',
];

const BLANK_TEMPLATE = {
  name: '',
  description: '',
  intendedRole: '',
  cycle: '',
  period: { start: '', end: '' },
  kpiEntries: [],
};

// ─── Small helpers ─────────────────────────────────────────────────────────────
function CategoryBadge({ cat }) {
  const cfg = KPI_CATEGORY_COLORS[cat] || {};
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge || 'bg-gray-100 text-gray-600'}`}>
      {KPI_CATEGORY_LABELS[cat] || cat}
    </span>
  );
}

function DirectionIcon({ dir }) {
  return dir === 'lower'
    ? <ArrowDownCircle size={12} className="text-orange-500 flex-shrink-0" title="Lower is better" />
    : <ArrowUpCircle size={12} className="text-emerald-500 flex-shrink-0" title="Higher is better" />;
}

// ─── Template list card ───────────────────────────────────────────────────────
function TemplateCard({ tpl, allItems, onEdit, onDelete, onDuplicate }) {
  const kpiCount = (tpl.kpiEntries || []).length;
  const overrideCount = (tpl.kpiEntries || []).filter(e => e.targetOverride !== null && e.targetOverride !== undefined && e.targetOverride !== '').length;

  // Category breakdown
  const cats = ['activity', 'output', 'engagement', 'compliance'];
  const catCounts = cats.map(cat => ({
    cat,
    count: (tpl.kpiEntries || []).filter(e => {
      const item = allItems.find(i => i.id === e.kpiId);
      return item?.category === cat;
    }).length,
  })).filter(c => c.count > 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-indigo-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-800 text-sm leading-snug">{tpl.name}</h3>
          {tpl.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tpl.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onDuplicate(tpl)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="Duplicate template"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => onEdit(tpl)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="Edit template"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onDelete(tpl)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete template"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {tpl.intendedRole && (
          <Badge variant="primary" size="xs">{tpl.intendedRole}</Badge>
        )}
        {tpl.cycle && (
          <Badge variant="default" size="xs">{tpl.cycle}</Badge>
        )}
        {tpl.period?.start && (
          <Badge variant="default" size="xs">{tpl.period.start} → {tpl.period.end || '…'}</Badge>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-indigo-600">{kpiCount} KPI{kpiCount !== 1 ? 's' : ''}</span>
          {overrideCount > 0 && (
            <span className="text-amber-600">{overrideCount} override{overrideCount !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex gap-1">
          {catCounts.map(({ cat, count }) => {
            const cfg = KPI_CATEGORY_COLORS[cat];
            return (
              <span key={cat} className={`px-1.5 py-0.5 rounded text-xs ${cfg.badge}`}>{count}</span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Picker (step 2 of the builder) ──────────────────────────────────────
function KPIPicker({ allItems, selectedEntries, onChange }) {
  const [search, setSearch] = useState('');
  const [expandedCat, setExpandedCat] = useState('activity');

  const isSelected = kpiId => selectedEntries.some(e => e.kpiId === kpiId);

  const toggle = useCallback(kpiId => {
    const currentEntry = selectedEntries.find(e => e.kpiId === kpiId);
    if (currentEntry) {
      // Remove
      onChange(selectedEntries.filter(e => e.kpiId !== kpiId));
    } else {
      // Add with null override (will show library default)
      onChange([...selectedEntries, { kpiId, targetOverride: null }]);
    }
  }, [selectedEntries, onChange]);

  const cats = Object.keys(KPI_CATEGORY_LABELS);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allItems.filter(i => !q || i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
  }, [allItems, search]);

  const byCategory = useMemo(() => {
    return cats.map(cat => ({
      cat,
      items: filtered.filter(i => i.category === cat),
    }));
  }, [filtered]);

  const selectAll = cat => {
    const catItems = allItems.filter(i => i.category === cat);
    const catIds = catItems.map(i => i.kpiId);
    // Add all from this category that aren't already selected
    const toAdd = catItems.filter(i => !isSelected(i.id)).map(i => ({ kpiId: i.id, targetOverride: null }));
    onChange([...selectedEntries, ...toAdd]);
  };

  const deselectAll = cat => {
    const catIds = allItems.filter(i => i.category === cat).map(i => i.id);
    onChange(selectedEntries.filter(e => !catIds.includes(e.kpiId)));
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search KPIs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-8 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-indigo-400 focus:ring-indigo-100 bg-white"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Category groups */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {byCategory.map(({ cat, items }) => {
          if (items.length === 0) return null;
          const cfg = KPI_CATEGORY_COLORS[cat];
          const allCatSelected = items.every(i => isSelected(i.id));
          const someCatSelected = items.some(i => isSelected(i.id));
          const isExpanded = expandedCat === cat;

          return (
            <div key={cat} className={`rounded-xl border ${isExpanded ? 'border-gray-200' : 'border-gray-200'} overflow-hidden`}>
              {/* Category header */}
              <div
                className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer select-none bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={() => setExpandedCat(isExpanded ? null : cat)}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                    {KPI_CATEGORY_LABELS[cat]}
                  </span>
                  <span className="text-xs text-gray-500">{items.length} KPIs</span>
                  {someCatSelected && (
                    <span className={`text-xs font-medium ${allCatSelected ? 'text-indigo-600' : 'text-indigo-500'}`}>
                      ({items.filter(i => isSelected(i.id)).length} selected)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); allCatSelected ? deselectAll(cat) : selectAll(cat); }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {allCatSelected ? 'Deselect all' : 'Select all'}
                  </button>
                  {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </div>

              {/* KPI rows */}
              {isExpanded && (
                <div className="divide-y divide-gray-100 bg-white">
                  {items.map(item => {
                    const sel = isSelected(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggle(item.id)}
                        className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${sel ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'}`}
                      >
                        {sel
                          ? <CheckSquare size={16} className="text-indigo-600 flex-shrink-0" />
                          : <Square size={16} className="text-gray-300 flex-shrink-0" />
                        }
                        <DirectionIcon dir={item.targetDirection} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium leading-snug ${sel ? 'text-indigo-700' : 'text-gray-700'}`}>
                            {item.name}
                          </div>
                          {item.description && (
                            <div className="text-xs text-gray-400 truncate">{item.description}</div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs font-bold text-gray-600">
                            {item.targetValue}{item.unit === '%' ? '%' : ''} <span className="font-normal text-gray-400">{item.unit !== '%' ? item.unit : ''}</span>
                          </div>
                          <div className="text-xs text-gray-400 capitalize">{KPI_FREQUENCY_LABELS[item.frequency] || item.frequency}</div>
                        </div>
                        {item.isMandatory && (
                          <AlertTriangle size={12} className="text-red-500 flex-shrink-0" title="Mandatory KPI" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-400">No KPIs match your search.</div>
        )}
      </div>
    </div>
  );
}

// ─── Override panel (step 3 — set per-template targets) ───────────────────────
function OverridePanel({ selectedEntries, allItems, onChange }) {
  const updateOverride = (kpiId, value) => {
    onChange(selectedEntries.map(e => e.kpiId === kpiId ? { ...e, targetOverride: value === '' ? null : value } : e));
  };

  const removeEntry = kpiId => {
    onChange(selectedEntries.filter(e => e.kpiId !== kpiId));
  };

  if (selectedEntries.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        <Package size={28} className="mx-auto mb-2 text-gray-300" />
        No KPIs selected yet. Go back to the KPI Picker to add KPIs.
      </div>
    );
  }

  // Group by category for display
  const cats = ['activity', 'output', 'engagement', 'compliance'];
  const grouped = cats.map(cat => ({
    cat,
    entries: selectedEntries.filter(e => {
      const item = allItems.find(i => i.id === e.kpiId);
      return item?.category === cat;
    }),
  })).filter(g => g.entries.length > 0);

  return (
    <div className="space-y-4">
      <Alert type="info">
        <div className="flex items-start gap-2">
          <Info size={13} className="flex-shrink-0 mt-0.5" />
          <span className="text-xs">
            Each KPI shows its <strong>library default target</strong> pre-filled.
            Leave blank to use the default, or enter a value to override it for this template only.
          </span>
        </div>
      </Alert>

      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {grouped.map(({ cat, entries }) => {
          const cfg = KPI_CATEGORY_COLORS[cat];
          return (
            <div key={cat}>
              <div className={`text-xs font-semibold px-1 mb-1.5 ${cfg.text}`}>
                {KPI_CATEGORY_LABELS[cat]}
              </div>
              <div className="space-y-2">
                {entries.map(entry => {
                  const item = allItems.find(i => i.id === entry.kpiId);
                  if (!item) return null;
                  const hasOverride = entry.targetOverride !== null && entry.targetOverride !== undefined && entry.targetOverride !== '';
                  return (
                    <div
                      key={entry.kpiId}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border ${hasOverride ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}
                    >
                      <DirectionIcon dir={item.targetDirection} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700 leading-snug truncate">{item.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">Default: <strong>{item.targetValue}{item.unit === '%' ? '%' : ` ${item.unit}`}</strong></span>
                          {item.isMandatory && <AlertTriangle size={10} className="text-red-500" title="Mandatory" />}
                          {hasOverride && (
                            <span className="text-xs text-amber-600 font-medium">↳ overridden</span>
                          )}
                        </div>
                      </div>
                      {/* Override input */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="relative">
                          <input
                            type="number"
                            placeholder={String(item.targetValue)}
                            value={entry.targetOverride ?? ''}
                            onChange={e => updateOverride(entry.kpiId, e.target.value)}
                            className={`w-20 px-2.5 py-1.5 rounded-lg border text-sm text-right focus:outline-none focus:ring-2
                              ${hasOverride
                                ? 'border-amber-300 bg-amber-50 text-amber-800 focus:ring-amber-200'
                                : 'border-gray-300 bg-white text-gray-700 focus:border-indigo-400 focus:ring-indigo-100'
                              }`}
                          />
                          {item.unit !== 'count' && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                              {item.unit === '%' ? '%' : item.unit}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeEntry(entry.kpiId)}
                          className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Remove from template"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Template Builder Modal (create / edit) ───────────────────────────────────
function TemplateBuilderModal({ template, allItems, onClose, onSaved }) {
  const isEdit = !!(template?.id && !template?._isDuplicate);

  const [step, setStep] = useState(0); // 0=metadata, 1=kpi picker, 2=overrides, 3=review
  const [form, setForm] = useState(() => template ? { ...template } : { ...BLANK_TEMPLATE });
  const [errors, setErrors] = useState({});

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: '' })); };
  const setPeriod = k => e => setForm(f => ({ ...f, period: { ...f.period, [k]: e.target.value } }));

  const validateMeta = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Template name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 0 && !validateMeta()) return;
    setStep(s => s + 1);
  };

  const handleSave = () => {
    if (!validateMeta()) { setStep(0); return; }
    const toSave = {
      ...(isEdit ? { id: template.id, createdAt: template.createdAt, createdBy: template.createdBy } : {}),
      name: form.name.trim(),
      description: form.description,
      intendedRole: form.intendedRole,
      cycle: form.cycle,
      period: form.period,
      kpiEntries: form.kpiEntries,
    };
    saveKPITemplate(toSave);
    onSaved();
    onClose();
  };

  const STEPS = ['Details', 'Select KPIs', 'Set Targets', 'Review'];

  const selectedCount = (form.kpiEntries || []).length;
  const overrideCount = (form.kpiEntries || []).filter(e => e.targetOverride !== null && e.targetOverride !== undefined && e.targetOverride !== '').length;

  // Build category summary for the review step
  const cats = ['activity', 'output', 'engagement', 'compliance'];
  const reviewByCat = cats.map(cat => ({
    cat,
    entries: (form.kpiEntries || []).filter(e => {
      const item = allItems.find(i => i.id === e.kpiId);
      return item?.category === cat;
    }),
  })).filter(g => g.entries.length > 0);

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit Template — ${template.name}` : 'New KPI Template'} size="xl">
      <div className="space-y-5">

        {/* Step indicator */}
        <div className="flex items-center gap-0">
          {STEPS.map((label, i) => {
            const done = i < step, active = i === step;
            return (
              <div key={i} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={() => { if (i < step || (i === step + 1 && (step !== 0 || validateMeta()))) { if (i > step) { if (step === 0 && !validateMeta()) return; } setStep(i); } }}
                  className="flex flex-col items-center flex-shrink-0"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                    ${done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-gray-200 text-gray-500'}`}>
                    {done ? <Check size={12} /> : i + 1}
                  </div>
                  <span className={`text-xs mt-1 hidden sm:block ${active ? 'text-indigo-600 font-medium' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1.5 mb-4 sm:mb-5 ${i < step ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Step 0: Template Metadata ── */}
        {step === 0 && (
          <div className="space-y-4">
            <Input
              label="Template Name"
              placeholder="e.g. Senior MR KPI Set Q3 2026"
              value={form.name}
              onChange={set('name')}
              error={errors.name}
              required
            />

            <Textarea
              label="Description"
              placeholder="Brief description of this template's purpose, intended audience, or key focus areas…"
              value={form.description}
              onChange={set('description')}
              rows={2}
            />

            <div className="grid grid-cols-2 gap-3">
              <Select label="Intended Role / Level" value={form.intendedRole} onChange={set('intendedRole')}>
                <option value="">— Select role —</option>
                {INTENDED_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
              <Select label="Review Cycle" value={form.cycle} onChange={set('cycle')}>
                <option value="">— Select cycle —</option>
                {REVIEW_CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Period Start"
                type="date"
                value={form.period?.start || ''}
                onChange={setPeriod('start')}
                hint="Optional"
              />
              <Input
                label="Period End"
                type="date"
                value={form.period?.end || ''}
                onChange={setPeriod('end')}
                hint="Optional"
              />
            </div>
          </div>
        )}

        {/* ── Step 1: KPI Picker ── */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Select KPIs from the library to include in this template.</p>
              {selectedCount > 0 && (
                <span className="text-sm font-semibold text-indigo-600">{selectedCount} selected</span>
              )}
            </div>
            <KPIPicker
              allItems={allItems}
              selectedEntries={form.kpiEntries || []}
              onChange={entries => setForm(f => ({ ...f, kpiEntries: entries }))}
            />
            {selectedCount === 0 && (
              <Alert type="warning">
                <div className="flex items-center gap-2 text-xs">
                  <AlertTriangle size={12} />
                  Select at least one KPI before continuing.
                </div>
              </Alert>
            )}
          </div>
        )}

        {/* ── Step 2: Target Overrides ── */}
        {step === 2 && (
          <OverridePanel
            selectedEntries={form.kpiEntries || []}
            allItems={allItems}
            onChange={entries => setForm(f => ({ ...f, kpiEntries: entries }))}
          />
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
              <div className="font-semibold text-indigo-800 text-sm">{form.name || '(Unnamed template)'}</div>
              {form.description && <div className="text-xs text-indigo-700">{form.description}</div>}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.intendedRole && <Badge variant="primary" size="xs">{form.intendedRole}</Badge>}
                {form.cycle && <Badge variant="default" size="xs">{form.cycle}</Badge>}
                {form.period?.start && <Badge variant="default" size="xs">{form.period.start} → {form.period.end || '…'}</Badge>}
              </div>
              <div className="flex gap-4 text-xs text-indigo-700 pt-1 border-t border-indigo-200 mt-2">
                <span><strong>{selectedCount}</strong> KPIs included</span>
                {overrideCount > 0 && <span><strong>{overrideCount}</strong> target override{overrideCount !== 1 ? 's' : ''}</span>}
              </div>
            </div>

            {/* KPI breakdown by category */}
            {reviewByCat.length === 0 ? (
              <Alert type="warning">
                <div className="flex items-center gap-2 text-xs">
                  <AlertTriangle size={12} />
                  No KPIs selected. Go back to Step 2 to add KPIs.
                </div>
              </Alert>
            ) : (
              <div className="space-y-3">
                {reviewByCat.map(({ cat, entries }) => {
                  const cfg = KPI_CATEGORY_COLORS[cat];
                  return (
                    <div key={cat} className={`rounded-xl border ${cfg.bg} border-opacity-50`} style={{ borderColor: 'transparent' }}>
                      <div className={`px-3.5 py-2 rounded-t-xl ${cfg.bg}`}>
                        <span className={`text-xs font-semibold ${cfg.text}`}>
                          {KPI_CATEGORY_LABELS[cat]} — {entries.length} KPI{entries.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-100 bg-white rounded-b-xl border border-t-0 border-gray-100">
                        {entries.map(entry => {
                          const item = allItems.find(i => i.id === entry.kpiId);
                          if (!item) return null;
                          const hasOverride = entry.targetOverride !== null && entry.targetOverride !== undefined && entry.targetOverride !== '';
                          const effectiveTarget = hasOverride ? parseFloat(entry.targetOverride) : item.targetValue;
                          return (
                            <div key={entry.kpiId} className="flex items-center gap-2.5 px-3.5 py-2">
                              <DirectionIcon dir={item.targetDirection} />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-700 font-medium">{item.name}</span>
                                {item.isMandatory && (
                                  <span className="ml-1.5 text-xs text-red-600 font-medium">mandatory</span>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className={`text-sm font-bold ${hasOverride ? 'text-amber-600' : 'text-gray-700'}`}>
                                  {effectiveTarget}{item.unit === '%' ? '%' : ` ${item.unit}`}
                                </span>
                                {hasOverride && (
                                  <div className="text-xs text-gray-400 line-through">
                                    {item.targetValue}{item.unit === '%' ? '%' : ` ${item.unit}`}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Navigation footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div>
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep(s => s - 1)}>
                ← Back
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={handleNext}
                disabled={step === 1 && selectedCount === 0}
              >
                Next →
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={selectedCount === 0}>
                <Save size={14} />
                {isEdit ? 'Save Changes' : 'Create Template'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirmModal({ tpl, onClose, onConfirm }) {
  return (
    <Modal open onClose={onClose} title="Delete Template" size="sm">
      <div className="space-y-4">
        <Alert type="error">
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Delete "{tpl.name}"?</p>
              <p className="text-xs mt-1">
                This template will be permanently removed. Existing KPI assignments that use this template will retain their data, but the template itself cannot be recovered.
              </p>
            </div>
          </div>
        </Alert>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>
            <Trash2 size={14} />Delete Template
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Template Builder Page ───────────────────────────────────────────────
export default function KPITemplateBuilder({ onNavigate }) {
  const { currentUser } = useApp();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'company_admin';

  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  const [builderTarget, setBuilderTarget] = useState(null); // null | blank | existing template
  const [deleteTarget, setDeleteTarget]   = useState(null);

  const templates = useMemo(() => getKPITemplates(), [tick]);
  const allItems  = useMemo(() => getActiveKPIItems(), [tick]);

  const handleOpenNew = () => {
    setBuilderTarget({ ...BLANK_TEMPLATE });
  };

  const handleEdit = tpl => {
    setBuilderTarget({ ...tpl });
  };

  const handleDuplicate = tpl => {
    setBuilderTarget({
      ...tpl,
      id: undefined,
      _isDuplicate: true,
      name: `${tpl.name} (Copy)`,
      createdAt: undefined,
      createdBy: undefined,
    });
  };

  const handleDelete = tpl => {
    setDeleteTarget(tpl);
  };

  const confirmDelete = () => {
    deleteKPITemplate(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  };

  // Stats
  const totalTemplates = templates.length;
  const totalKpiSlots  = templates.reduce((s, t) => s + (t.kpiEntries?.length || t.kpiIds?.length || 0), 0);
  const withOverrides  = templates.filter(t => (t.kpiEntries || []).some(e => e.targetOverride !== null && e.targetOverride !== undefined && e.targetOverride !== '')).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="KPI Template Builder"
        subtitle="Assemble reusable KPI sets from your library. Set per-template target overrides, assign templates to reps, teams, or territories."
        action={isAdmin && (
          <Button onClick={handleOpenNew}>
            <Plus size={15} />New Template
          </Button>
        )}
      />

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Templates"      value={totalTemplates} icon={LayoutTemplate} color="indigo" />
        <StatCard label="KPI Slots"      value={totalKpiSlots}  icon={Package}        color="green"  sub="across all templates" />
        <StatCard label="With Overrides" value={withOverrides}   icon={Edit2}          color="amber"  sub="custom targets set" />
      </div>

      {/* Template grid */}
      {templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No templates yet"
          description="Create your first KPI template by selecting KPIs from the library and setting your targets."
          action={isAdmin && (
            <Button onClick={handleOpenNew}>
              <Plus size={14} />Create First Template
            </Button>
          )}
        />
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">{totalTemplates} Template{totalTemplates !== 1 ? 's' : ''}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(tpl => (
              <TemplateCard
                key={tpl.id}
                tpl={tpl}
                allItems={allItems}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick-access tip */}
      {templates.length > 0 && (
        <Alert type="info">
          <div className="flex items-start gap-2 text-xs">
            <Info size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              To assign a template to an employee or team, go to{' '}
              <button
                onClick={() => onNavigate && onNavigate(currentUser?.role === 'admin' ? 'adm-kpis' : 'co-kpis')}
                className="font-medium text-indigo-700 hover:underline"
              >
                KPI Management
              </button>
              {' '}and use the "Assign Template" action on any employee card.
            </span>
          </div>
        </Alert>
      )}

      {/* Builder Modal */}
      {builderTarget !== null && (
        <TemplateBuilderModal
          template={builderTarget.name !== undefined && Object.keys(builderTarget).length > 0 ? builderTarget : null}
          allItems={allItems}
          onClose={() => setBuilderTarget(null)}
          onSaved={refresh}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <DeleteConfirmModal
          tpl={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
