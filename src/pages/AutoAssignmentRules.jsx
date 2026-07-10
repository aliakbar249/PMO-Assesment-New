import { useState, useMemo, useEffect } from 'react';
import {
  getAutoRules, saveAutoRule, deleteAutoRule, toggleAutoRule,
  getActiveCustomFields, getHierarchyLevels, getOrgEmployees,
  evaluateRulesForEmployee, evaluateAndFireRules,
  getAllAutoRuleLogs, clearAutoRuleLogs, logAutoRuleAction,
  RULE_OPERATORS, RULE_ACTION_TYPES, RULE_TRIGGERS,
} from '../lib/orgDb';
import { getKPITemplates, getTrainingModules } from '../lib/kpiTraining';
import { getAssessmentTemplates } from '../lib/supabase';
import {
  Plus, Edit2, Trash2, CheckCircle, AlertTriangle, X, ChevronDown, ChevronRight,
  Zap, ToggleLeft, ToggleRight, Play, ArrowUp, ArrowDown, Settings,
  List, RefreshCw, Filter, Trash, Clock, User, Activity,
} from 'lucide-react';

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
      ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── Condition row ────────────────────────────────────────────────────────────
function ConditionRow({ condition, index, fields, levels, onChange, onRemove }) {
  // Extended field options — includes position-derived fields beyond legacy hierarchyLevel
  const fieldOptions = [
    { value: 'hierarchyLevel',         label: 'Hierarchy Level (employee)' },
    { value: 'position_levelId',       label: 'Position — Level' },
    { value: 'position_orgUnitId',     label: 'Position — Org Unit' },
    { value: 'position_division',      label: 'Position — Division' },
    { value: 'position_positionCode',  label: 'Position — Position Code' },
    ...fields.map(f => ({ value: f.id, label: f.label })),
  ];

  const POSITION_FIELD_VALUES = {
    position_levelId:   levels.map(l => ({ value: l.id, label: `${l.name} (${l.abbreviation})` })),
    position_division:  ['Primary Care','Oncology','Vaccines','CNS','Cardiology','Respiratory'].map(v => ({ value: v, label: v })),
  };

  const selectedField    = fields.find(f => f.id === condition.field);
  const isLevelField     = condition.field === 'hierarchyLevel';
  const isPosLevelField  = condition.field === 'position_levelId';
  const isPosOtherKnown  = condition.field in POSITION_FIELD_VALUES;

  const renderValueInput = () => {
    if (isLevelField) {
      return (
        <select value={condition.value || ''} onChange={e => onChange(index, 'value', e.target.value)}
          className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]">
          <option value="">— select level —</option>
          {levels.map(l => <option key={l.id} value={l.id}>{l.name} ({l.abbreviation})</option>)}
        </select>
      );
    }
    if (isPosLevelField) {
      return (
        <select value={condition.value || ''} onChange={e => onChange(index, 'value', e.target.value)}
          className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]">
          <option value="">— select level —</option>
          {levels.map(l => <option key={l.id} value={l.id}>{l.name} ({l.abbreviation})</option>)}
        </select>
      );
    }
    if (isPosOtherKnown) {
      return (
        <select value={condition.value || ''} onChange={e => onChange(index, 'value', e.target.value)}
          className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]">
          <option value="">— select —</option>
          {(POSITION_FIELD_VALUES[condition.field] || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (selectedField?.fieldType === 'dropdown_single' || selectedField?.fieldType === 'dropdown_multi') {
      return (
        <select value={condition.value || ''} onChange={e => onChange(index, 'value', e.target.value)}
          className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]">
          <option value="">— select —</option>
          {(selectedField.options || []).map(o => <option key={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input type="text" value={condition.value || ''} onChange={e => onChange(index, 'value', e.target.value)}
        placeholder="Value"
        className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]" />
    );
  };

  return (
    <div className="flex items-center gap-2">
      {index > 0 && <span className="px-2 py-1 bg-indigo-100 text-indigo-600 text-xs font-bold rounded flex-shrink-0">AND</span>}
      {index === 0 && <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-semibold rounded flex-shrink-0">IF</span>}
      <select value={condition.field || ''} onChange={e => onChange(index, 'field', e.target.value)}
        className="w-52 flex-shrink-0 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]">
        <option value="">— field —</option>
        {fieldOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select value={condition.operator || 'equals'} onChange={e => onChange(index, 'operator', e.target.value)}
        className="w-28 flex-shrink-0 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]">
        {RULE_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {renderValueInput()}
      <button type="button" onClick={() => onRemove(index)}
        className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Entity picker config per action type ────────────────────────────────────
const ENTITY_CONFIG = {
  assign_assessment_template: {
    placeholder: 'Select assessment template…',
    emptyMsg:    'No assessment templates found',
  },
  assign_kpi_template: {
    placeholder: 'Select KPI template…',
    emptyMsg:    'No KPI templates found',
  },
  assign_training_module: {
    placeholder: 'Select training module…',
    emptyMsg:    'No training modules found',
  },
};

// ─── Action row ───────────────────────────────────────────────────────────────
function ActionRow({ action, index, onChange, onRemove, entityLists }) {
  // entityLists = { assessmentTemplates: [], kpiTemplates: [], trainingModules: [] }
  const { assessmentTemplates = [], kpiTemplates = [], trainingModules = [] } = entityLists || {};

  // Map action type → list of { id, label } for the dropdown
  const getOptions = (type) => {
    if (type === 'assign_assessment_template')
      return assessmentTemplates.map(t => ({ id: t.id, label: t.name || t.id }));
    if (type === 'assign_kpi_template')
      return kpiTemplates.map(t => ({ id: t.id, label: t.name || t.id }));
    if (type === 'assign_training_module')
      return trainingModules.map(t => ({ id: t.id, label: t.title || t.name || t.id }));
    return [];
  };

  const cfg     = ENTITY_CONFIG[action.type] || {};
  const options = getOptions(action.type);
  const hasType = !!action.type;

  const handleTypeChange = (e) => {
    // Change type AND clear entityId in one update
    onChange(index, 'type',     e.target.value);
    onChange(index, 'entityId', '');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-xs font-bold rounded flex-shrink-0">THEN</span>
        <select value={action.type || ''} onChange={handleTypeChange}
          className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]">
          <option value="">— select action type —</option>
          {RULE_ACTION_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="button" onClick={() => onRemove(index)}
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0">
          <X size={14} />
        </button>
      </div>

      {/* Entity dropdown — only shown once a type is selected */}
      {hasType && (
        <div className="ml-[60px]">
          {options.length === 0 ? (
            <p className="text-xs text-gray-400 italic px-1">{cfg.emptyMsg || 'No items found'}</p>
          ) : (
            <select
              value={action.entityId || ''}
              onChange={e => onChange(index, 'entityId', e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1] bg-white">
              <option value="">{cfg.placeholder || '— select —'}</option>
              {options.map(o => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {action.entityId && (
            <p className="mt-0.5 text-[10px] text-gray-400 font-mono px-1">ID: {action.entityId}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ rule, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><Trash2 size={18} className="text-red-600" /></div>
          <h2 className="text-base font-semibold text-gray-800">Delete Rule?</h2>
        </div>
        <p className="text-sm text-gray-600 mb-1">Delete <strong>{rule.name}</strong>?</p>
        <p className="text-xs text-gray-400 mb-5">This action cannot be undone. Execution logs for this rule will be preserved.</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Test Rule Panel ──────────────────────────────────────────────────────────
function TestPanel({ employees, onClose }) {
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [triggerFilter, setTriggerFilter] = useState('');
  const [results, setResults] = useState(null);

  const runTest = () => {
    if (!selectedEmpId) return;
    const matched = evaluateRulesForEmployee(selectedEmpId, triggerFilter || null);
    setResults(matched);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2"><Play size={16} className="text-[#01A2B1]" />Test Rules Against Employee</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Select Employee</label>
              <select value={selectedEmpId} onChange={e => { setSelectedEmpId(e.target.value); setResults(null); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]">
                <option value="">— select —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Trigger Filter <span className="text-gray-400 font-normal">(optional)</span></label>
              <select value={triggerFilter} onChange={e => { setTriggerFilter(e.target.value); setResults(null); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]">
                <option value="">All triggers</option>
                {RULE_TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label.split(' (')[0]}</option>)}
              </select>
            </div>
          </div>
          <button onClick={runTest} disabled={!selectedEmpId}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-opacity"
            style={{ background: '#01A2B1' }}>
            Run Test (dry-run — no logs written)
          </button>
          {results !== null && (
            <div className="mt-3">
              {results.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No rules matched this employee.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500">{results.length} rule{results.length !== 1 ? 's' : ''} matched:</p>
                  {results.map(({ rule, actions }) => (
                    <div key={rule.id} className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="font-medium text-sm text-emerald-800 mb-1 flex items-center gap-2">
                        {rule.name}
                        {rule.trigger && (
                          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${rule.trigger === 'position_filled' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                            {rule.trigger === 'position_filled' ? 'Position filled' : 'Field updated'}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {(actions || []).map((a, i) => (
                          <div key={i} className="text-xs text-emerald-700 flex items-center gap-1.5">
                            <CheckCircle size={12} />
                            {RULE_ACTION_TYPES.find(t => t.value === a.type)?.label || a.type}
                            {a.entityId && <span className="text-emerald-500 font-mono">→ {a.entityId}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Rule Form Modal ──────────────────────────────────────────────────────────
function RuleFormModal({ rule, allRules, fields, levels, onClose, onSaved }) {
  const isEdit = !!rule?.id;
  const maxPriority = allRules.length > 0 ? Math.max(...allRules.map(r => r.priority)) : 0;

  const [form, setForm] = useState({
    name:       rule?.name       || '',
    trigger:    rule?.trigger    || 'position_filled',
    priority:   rule?.priority   ?? maxPriority + 5,
    isActive:   rule?.isActive   ?? true,
    conditions: rule?.conditions || [{ field: '', operator: 'equals', value: '' }],
    actions:    rule?.actions    || [{ type: '', entityId: '' }],
  });
  const [errors, setErrors] = useState({});

  // ── Load entity lists for the action dropdowns ─────────────────
  const [entityLists, setEntityLists] = useState({
    assessmentTemplates: [],
    kpiTemplates:        [],
    trainingModules:     [],
  });
  const [loadingEntities, setLoadingEntities] = useState(true);

  useEffect(() => {
    // KPI templates + training modules are synchronous (localStorage)
    const kpiTemplates   = getKPITemplates()   || [];
    const trainingModules = getTrainingModules() || [];
    // Assessment templates are async (Supabase)
    getAssessmentTemplates().then(assessmentTemplates => {
      setEntityLists({
        assessmentTemplates: assessmentTemplates || [],
        kpiTemplates,
        trainingModules,
      });
      setLoadingEntities(false);
    }).catch(() => {
      setEntityLists({ assessmentTemplates: [], kpiTemplates, trainingModules });
      setLoadingEntities(false);
    });
  }, []);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(er => ({ ...er, [k]: '' })); };

  const addCondition    = () => set('conditions', [...form.conditions, { field: '', operator: 'equals', value: '' }]);
  const removeCondition = (i) => set('conditions', form.conditions.filter((_, idx) => idx !== i));
  const changeCondition = (i, key, val) => {
    const next = [...form.conditions];
    next[i] = { ...next[i], [key]: val };
    if (key === 'field') next[i].value = '';
    set('conditions', next);
  };

  const addAction    = () => set('actions', [...form.actions, { type: '', entityId: '' }]);
  const removeAction = (i) => set('actions', form.actions.filter((_, idx) => idx !== i));
  const changeAction = (i, key, val) => {
    const next = [...form.actions];
    if (key === 'type') {
      // When action type changes, always clear the entityId to avoid stale IDs
      next[i] = { ...next[i], type: val, entityId: '' };
    } else {
      next[i] = { ...next[i], [key]: val };
    }
    set('actions', next);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (form.conditions.length === 0) e.conditions = 'At least one condition required';
    if (form.actions.length === 0) e.actions = 'At least one action required';
    if (form.conditions.some(c => !c.field || !c.operator || !c.value)) e.conditions = 'All condition fields must be complete';
    if (form.actions.some(a => !a.type)) e.actions = 'All actions must have a type selected';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const record = {
      ...(isEdit ? rule : {}),
      name:       form.name.trim(),
      trigger:    form.trigger,
      priority:   Number(form.priority),
      isActive:   form.isActive,
      conditions: form.conditions,
      actions:    form.actions,
      createdBy:  'admin',
    };
    saveAutoRule(record);
    onSaved(isEdit ? 'Rule updated.' : 'Rule created.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{isEdit ? 'Edit Rule' : 'Add Auto-Assignment Rule'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">
          {/* Rule name + priority */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Rule Name <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. MR Oncology — Auto KPI Assignment"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority <span className="text-gray-400 font-normal">(higher = first)</span></label>
              <input type="number" min={1} value={form.priority} onChange={e => set('priority', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]" />
            </div>
          </div>

          {/* Trigger */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Trigger <span className="text-gray-400 font-normal">(when this rule fires automatically)</span></label>
            <div className="flex flex-col gap-2">
              {RULE_TRIGGERS.map(t => (
                <button key={t.value} type="button" onClick={() => set('trigger', t.value)}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm font-medium border transition-all text-left ${form.trigger === t.value ? 'border-[#01A2B1] bg-[#01A2B1]/5 text-[#01A2B1]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  <Zap size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">{t.label.split(' (')[0]}</div>
                    <div className="text-xs font-normal text-gray-400 mt-0.5">
                      {t.value === 'position_filled'
                        ? 'Fires when a new Primary occupancy is saved for a position'
                        : 'Fires when any custom field value is saved for this employee'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-sm font-medium text-gray-700">Active</span>
            <button type="button" onClick={() => set('isActive', !form.isActive)}
              className="relative w-10 h-5 rounded-full transition-colors"
              style={{ background: form.isActive ? '#01A2B1' : '#D1D5DB' }}>
              <span className="absolute bg-white rounded-full shadow transition-transform"
                style={{ width: 16, height: 16, top: 2, left: 2, transform: form.isActive ? 'translateX(20px)' : 'none' }} />
            </button>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-sm font-semibold text-gray-700">Conditions (AND logic)</label>
                {errors.conditions && <p className="text-xs text-red-500 mt-0.5">{errors.conditions}</p>}
              </div>
              <button type="button" onClick={addCondition}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#01A2B1] text-[#01A2B1] text-xs font-medium hover:bg-[#01A2B1]/5 transition-colors">
                <Plus size={13} /> Add Condition
              </button>
            </div>
            <div className="space-y-2 bg-gray-50 rounded-xl p-3">
              {form.conditions.map((cond, i) => (
                <ConditionRow key={i} condition={cond} index={i} fields={fields} levels={levels}
                  onChange={changeCondition} onRemove={removeCondition} />
              ))}
              {form.conditions.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">No conditions yet. Add at least one.</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-sm font-semibold text-gray-700">Actions</label>
                {errors.actions && <p className="text-xs text-red-500 mt-0.5">{errors.actions}</p>}
              </div>
              <button type="button" onClick={addAction}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500 text-emerald-600 text-xs font-medium hover:bg-emerald-50 transition-colors">
                <Plus size={13} /> Add Action
              </button>
            </div>
            <div className="space-y-3 bg-emerald-50/40 rounded-xl p-3">
              {loadingEntities && (
                <p className="text-xs text-gray-400 text-center py-1">Loading templates & modules…</p>
              )}
              {form.actions.map((action, i) => (
                <ActionRow key={i} action={action} index={i} onChange={changeAction} onRemove={removeAction}
                  entityLists={entityLists} />
              ))}
              {form.actions.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">No actions yet. Add at least one.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={handleSubmit} className="px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#01A2B1' }}>
            {isEdit ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────
function RuleCard({ rule, fields, levels, onEdit, onDelete, onToggle, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(false);

  const fieldLabel = (fieldId) => {
    if (fieldId === 'hierarchyLevel')       return 'Hierarchy Level (employee)';
    if (fieldId === 'position_levelId')     return 'Position — Level';
    if (fieldId === 'position_orgUnitId')   return 'Position — Org Unit';
    if (fieldId === 'position_division')    return 'Position — Division';
    if (fieldId === 'position_positionCode') return 'Position — Code';
    return fields.find(f => f.id === fieldId)?.label || fieldId;
  };
  const levelLabel  = (levelId)  => levels.find(l => l.id === levelId)?.name || levelId;
  const actionLabel = (type)     => RULE_ACTION_TYPES.find(t => t.value === type)?.label || type;

  return (
    <div className={`bg-white rounded-xl border-2 transition-all ${rule.isActive ? 'border-gray-200 hover:border-gray-300' : 'border-dashed border-gray-200 opacity-60'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-gray-600">{rule.priority}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-800 flex items-center gap-2 flex-wrap">
            {rule.name}
            {rule.isActive
              ? <span className="px-1.5 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-600 font-medium">Active</span>
              : <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500 font-medium">Inactive</span>}
          </div>
          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
            {rule.trigger && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${rule.trigger === 'position_filled' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                {rule.trigger === 'position_filled' ? '⚡ On position filled' : '⚡ On field update'}
              </span>
            )}
            <span>{rule.conditions?.length || 0} condition{(rule.conditions?.length || 0) !== 1 ? 's' : ''} · {rule.actions?.length || 0} action{(rule.actions?.length || 0) !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button onClick={onMoveUp}   disabled={isFirst} className="p-1 rounded text-gray-300 hover:text-gray-600 disabled:opacity-20 transition-colors"><ArrowUp size={12} /></button>
          <button onClick={onMoveDown} disabled={isLast}  className="p-1 rounded text-gray-300 hover:text-gray-600 disabled:opacity-20 transition-colors"><ArrowDown size={12} /></button>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <button onClick={onToggle}
            className={`p-1.5 rounded-lg transition-colors ${rule.isActive ? 'text-[#01A2B1] hover:bg-[#01A2B1]/10' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
            title={rule.isActive ? 'Deactivate' : 'Activate'}>
            {rule.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          </button>
          <button onClick={onEdit}   className="p-1.5 rounded-lg text-gray-400 hover:text-[#01A2B1] hover:bg-[#01A2B1]/10 transition-colors"><Edit2 size={14} /></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 grid sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Conditions (AND)</div>
            <div className="space-y-1.5">
              {(rule.conditions || []).map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {i > 0 && <span className="text-indigo-400 font-semibold">AND</span>}
                  <span className="font-medium text-gray-700">{fieldLabel(c.field)}</span>
                  <span className="text-gray-400">{RULE_OPERATORS.find(o => o.value === c.operator)?.label}</span>
                  <span className="font-medium text-gray-700">
                    {(c.field === 'hierarchyLevel' || c.field === 'position_levelId')
                      ? levelLabel(c.value)
                      : c.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Actions</div>
            <div className="space-y-1.5">
              {(rule.actions || []).map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="font-medium text-gray-700">{actionLabel(a.type)}</span>
                  {a.entityId && <span className="text-gray-400 font-mono">→ {a.entityId}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Execution Log Tab ────────────────────────────────────────────────────────
function ExecutionLog({ employees, rules, onBumpParent }) {
  const [filterEmpId,   setFilterEmpId]   = useState('');
  const [filterRuleId,  setFilterRuleId]  = useState('');
  const [filterTrigger, setFilterTrigger] = useState('');
  const [refresh,       setRefresh]       = useState(0);
  const [confirmClear,  setConfirmClear]  = useState(false);
  const [runAllResult,  setRunAllResult]  = useState(null);
  const bump = () => setRefresh(r => r + 1);

  const allLogs = useMemo(() => getAllAutoRuleLogs(), [refresh]); // eslint-disable-line

  const filtered = useMemo(() => {
    let l = allLogs;
    if (filterEmpId)   l = l.filter(x => x.employeeId   === filterEmpId);
    if (filterRuleId)  l = l.filter(x => x.ruleId       === filterRuleId);
    if (filterTrigger) l = l.filter(x => x.trigger      === filterTrigger);
    return l;
  }, [allLogs, filterEmpId, filterRuleId, filterTrigger]);

  const empName = (id) => employees.find(e => e.id === id)?.name || id;
  const ruleName = (id, fallback) => fallback || rules.find(r => r.id === id)?.name || id;
  const actionLabel = (type) => RULE_ACTION_TYPES.find(t => t.value === type)?.label || type;

  const handleRunAll = () => {
    let total = 0;
    employees.forEach(emp => {
      RULE_TRIGGERS.forEach(t => {
        const res = evaluateAndFireRules(emp.id, t.value, 'admin:run_all');
        total += res.firedCount;
      });
    });
    setRunAllResult(total);
    bump();
    onBumpParent();
    setTimeout(() => setRunAllResult(null), 4000);
  };

  const handleClearLogs = () => {
    clearAutoRuleLogs();
    setConfirmClear(false);
    bump();
    onBumpParent();
  };

  const fmtTime = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' });
    } catch { return iso; }
  };

  const triggerBadge = (trigger) => {
    if (trigger === 'position_filled') return <span className="px-1.5 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 font-medium whitespace-nowrap">Position filled</span>;
    if (trigger === 'field_updated')   return <span className="px-1.5 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600 font-medium whitespace-nowrap">Field updated</span>;
    return <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500 font-medium">{trigger}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <Filter size={14} className="text-gray-400 flex-shrink-0" />
          <select value={filterEmpId} onChange={e => setFilterEmpId(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]">
            <option value="">All employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={filterRuleId} onChange={e => setFilterRuleId(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]">
            <option value="">All rules</option>
            {rules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select value={filterTrigger} onChange={e => setFilterTrigger(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]">
            <option value="">All triggers</option>
            {RULE_TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label.split(' (')[0]}</option>)}
          </select>
          <button onClick={bump} className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleRunAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: '#01A2B1' }}>
            <Play size={14} /> Run All Employees Now
          </button>
          <button
            onClick={() => setConfirmClear(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
            <Trash size={14} /> Clear Log
          </button>
        </div>
      </div>

      {/* Run all result banner */}
      {runAllResult !== null && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
          <span>Engine fired <strong>{runAllResult} action{runAllResult !== 1 ? 's' : ''}</strong> across all employees. Log entries appended below.</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total log entries', value: allLogs.length,       icon: List,     color: '#01A2B1' },
          { label: 'Shown (filtered)',  value: filtered.length,      icon: Activity, color: '#059669' },
          { label: 'Unique employees',  value: new Set(allLogs.map(l => l.employeeId)).size, icon: User, color: '#7C3AED' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.color + '18' }}>
              <s.icon size={16} style={{ color: s.color }} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Engine info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Zap size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <span className="font-semibold">Live engine active. </span>
          Rules fire automatically: <strong>position_filled</strong> triggers when a new Primary occupancy is saved in Position Occupancy manager.
          <strong> field_updated</strong> triggers every time a custom field value is saved in an employee profile. All executions are logged here.
        </div>
      </div>

      {/* Log table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-400">
          <Clock size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No execution logs yet.</p>
          <p className="text-xs mt-1 text-gray-400">Logs appear here automatically when rules fire, or use "Run All Employees Now" above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Trigger</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Rule</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Entity / ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Fired by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">{fmtTime(log.triggeredAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#01A2B1]/20 flex items-center justify-center flex-shrink-0">
                          <User size={11} className="text-[#01A2B1]" />
                        </div>
                        <span className="text-sm text-gray-800 font-medium whitespace-nowrap">{empName(log.employeeId)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{triggerBadge(log.trigger)}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 font-medium">{ruleName(log.ruleId, log.ruleName)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700">
                        {actionLabel(log.actionType)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.assignedEntityId
                        ? <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{log.assignedEntityId}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400 font-mono">{log.firedBy || log.triggeredBy || 'system'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            Showing {filtered.length} of {allLogs.length} total log entries · newest first
          </div>
        </div>
      )}

      {/* Clear log confirm */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><Trash size={18} className="text-red-600" /></div>
              <h2 className="text-base font-semibold text-gray-800">Clear Execution Log?</h2>
            </div>
            <p className="text-sm text-gray-600 mb-5">All {allLogs.length} log entries will be permanently deleted. This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmClear(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={handleClearLogs} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium">Clear All Logs</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AutoAssignmentRules() {
  const [tab,           setTab]           = useState('rules'); // 'rules' | 'log'
  const [toast,         setToast]         = useState(null);
  const [formTarget,    setFormTarget]    = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [showTest,      setShowTest]      = useState(false);
  const [refresh,       setRefresh]       = useState(0);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };
  const bump = () => setRefresh(r => r + 1);

  const rules     = getAutoRules();
  const fields    = getActiveCustomFields();
  const levels    = getHierarchyLevels();
  const employees = getOrgEmployees();
  const logCount  = useMemo(() => getAllAutoRuleLogs().length, [refresh]); // eslint-disable-line

  const handleDelete = () => {
    deleteAutoRule(deleteTarget.id);
    setDeleteTarget(null);
    showToast('Rule deleted.');
    bump();
  };

  const handleToggle = (rule) => {
    toggleAutoRule(rule.id);
    showToast(rule.isActive ? 'Rule deactivated.' : 'Rule activated.');
    bump();
  };

  const handleMoveUp = (idx) => {
    const sorted = [...rules];
    if (idx === 0) return;
    saveAutoRule({ ...sorted[idx],     priority: sorted[idx - 1].priority + 1 });
    saveAutoRule({ ...sorted[idx - 1], priority: sorted[idx].priority   - 1 });
    bump();
  };

  const handleMoveDown = (idx) => {
    const sorted = [...rules];
    if (idx === sorted.length - 1) return;
    saveAutoRule({ ...sorted[idx],     priority: sorted[idx + 1].priority - 1 });
    saveAutoRule({ ...sorted[idx + 1], priority: sorted[idx].priority    + 1 });
    bump();
  };

  const handleSaved = (msg) => { setFormTarget(null); showToast(msg); bump(); };

  const activeCount   = rules.filter(r => r.isActive).length;
  const inactiveCount = rules.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Auto-Assignment Rules</h1>
          <p className="text-sm text-gray-500 mt-0.5">Define rules that fire automatically when a position is filled or a field is updated.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTest(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-[#01A2B1] text-[#01A2B1] hover:bg-[#01A2B1]/5 transition-colors">
            <Play size={15} /> Test Rules
          </button>
          <button onClick={() => setFormTarget({ id: null })}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-sm hover:opacity-90"
            style={{ background: '#01A2B1' }}>
            <Plus size={16} /> Add Rule
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'rules', label: 'Rules',          icon: Zap  },
          { id: 'log',   label: `Execution Log${logCount > 0 ? ` (${logCount})` : ''}`, icon: List },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── RULES TAB ── */}
      {tab === 'rules' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Rules', value: rules.length,   color: '#01A2B1' },
              { label: 'Active',      value: activeCount,    color: '#059669' },
              { label: 'Inactive',    value: inactiveCount,  color: '#9CA3AF' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.color + '18' }}>
                  <Zap size={16} style={{ color: s.color }} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-800">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Info banner */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-3">
            <Settings size={18} className="text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-indigo-700">
              <span className="font-semibold">Live execution engine active. </span>
              Rules fire automatically in priority order when triggered. Conditions support employee hierarchy level, position-derived fields (level, org unit, division), and any custom field.
              All executions are captured in the <button className="underline font-semibold" onClick={() => setTab('log')}>Execution Log tab</button>.
            </div>
          </div>

          {/* Rules list */}
          {rules.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-400">
              <Zap size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No rules configured yet.</p>
              <button onClick={() => setFormTarget({ id: null })}
                className="mt-4 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Add first rule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule, idx) => (
                <RuleCard key={rule.id} rule={rule} fields={fields} levels={levels}
                  isFirst={idx === 0} isLast={idx === rules.length - 1}
                  onEdit={() => setFormTarget(rule)}
                  onDelete={() => setDeleteTarget(rule)}
                  onToggle={() => handleToggle(rule)}
                  onMoveUp={() => handleMoveUp(idx)}
                  onMoveDown={() => handleMoveDown(idx)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── LOG TAB ── */}
      {tab === 'log' && (
        <ExecutionLog employees={employees} rules={rules} onBumpParent={bump} />
      )}

      {/* Modals */}
      {formTarget !== null && (
        <RuleFormModal rule={formTarget?.id ? formTarget : null} allRules={rules}
          fields={fields} levels={levels}
          onClose={() => setFormTarget(null)} onSaved={handleSaved} />
      )}
      {deleteTarget && (
        <DeleteConfirm rule={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}
      {showTest && <TestPanel employees={employees} onClose={() => setShowTest(false)} />}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
