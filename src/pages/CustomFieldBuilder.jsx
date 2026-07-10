import { useState, useCallback } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  getCustomFields, saveCustomField, archiveCustomField, restoreCustomField,
  reorderCustomFields, getHierarchyLevels,
  FIELD_SECTIONS, FIELD_TYPES,
} from '../lib/orgDb';
import {
  GripVertical, Plus, Edit2, Archive, RotateCcw, Eye, EyeOff,
  CheckCircle, AlertTriangle, X, ChevronDown, ChevronRight,
  Settings, Search,
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

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, label, hint }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative flex-shrink-0 w-10 h-5.5 rounded-full transition-colors duration-200 ${value ? '' : 'bg-gray-200'}`}
        style={value ? { background: '#01A2B1' } : {}}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform duration-200 ${value ? 'translate-x-4' : ''}`}
          style={{ width: 18, height: 18, top: 1, left: 1 }}
        />
      </button>
    </div>
  );
}

// ─── Field type icon label ─────────────────────────────────────────────────────
function FieldTypeTag({ type }) {
  const label = FIELD_TYPES[type] || type;
  const colors = {
    text:             'bg-blue-50 text-blue-600',
    textarea:         'bg-indigo-50 text-indigo-600',
    number:           'bg-purple-50 text-purple-600',
    date:             'bg-rose-50 text-rose-600',
    dropdown_single:  'bg-amber-50 text-amber-600',
    dropdown_multi:   'bg-orange-50 text-orange-600',
    toggle:           'bg-teal-50 text-teal-600',
    hierarchy_lookup: 'bg-cyan-50 text-cyan-600',
    org_unit_lookup:  'bg-teal-50 text-teal-600',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-600'}`}>{label}</span>;
}

// ─── Sortable Field Row ───────────────────────────────────────────────────────
function SortableFieldRow({ field, levels, onEdit, onArchive, onRestore, showArchived }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const isArchived = field.status === 'archived';
  if (isArchived && !showArchived) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all
        ${isDragging ? 'bg-blue-50 border-[#01A2B1] shadow-lg' : isArchived ? 'bg-gray-50 border-dashed border-gray-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}
    >
      {/* Drag handle */}
      {!isArchived && (
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 p-1 -ml-1 flex-shrink-0" tabIndex={-1}>
          <GripVertical size={14} />
        </button>
      )}
      {isArchived && <div className="w-6 flex-shrink-0" />}

      {/* Field info */}
      <div className="flex-1 min-w-0 grid grid-cols-12 gap-x-3 items-center">
        <div className="col-span-4 min-w-0">
          <div className={`font-medium text-sm truncate ${isArchived ? 'text-gray-400' : 'text-gray-800'}`}>{field.label}</div>
          <div className="text-xs text-gray-400 font-mono truncate">{field.fieldKey}</div>
        </div>
        <div className="col-span-3"><FieldTypeTag type={field.fieldType} /></div>
        <div className="col-span-3 text-xs text-gray-500 truncate">{field.section}</div>
        <div className="col-span-2 flex items-center gap-2 justify-end">
          {field.isFilterable  && <span title="Filterable"  className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">F</span>}
          {!field.isVisibleToEmployee && <EyeOff size={13} className="text-amber-400" title="Hidden from employee" />}
          {field.isRequired    && <span className="text-red-400 text-xs font-bold" title="Required">*</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {!isArchived ? (
          <>
            <button onClick={() => onEdit(field)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#01A2B1] hover:bg-[#01A2B1]/10 transition-colors" title="Edit">
              <Edit2 size={14} />
            </button>
            <button onClick={() => onArchive(field)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors" title="Archive">
              <Archive size={14} />
            </button>
          </>
        ) : (
          <button onClick={() => onRestore(field)} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Restore">
            <RotateCcw size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Archive Confirm Modal ────────────────────────────────────────────────────
function ArchiveConfirm({ field, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"><Archive size={20} className="text-amber-600" /></div>
          <h2 className="text-base font-semibold text-gray-800">Archive Field?</h2>
        </div>
        <p className="text-sm text-gray-600 mb-1">Archive <strong>{field.label}</strong>?</p>
        <p className="text-xs text-gray-400 mb-5">It will be hidden from new profiles but existing data is preserved. You can restore it anytime.</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium">Archive</button>
        </div>
      </div>
    </div>
  );
}

// ─── Field Form Modal ─────────────────────────────────────────────────────────
function FieldFormModal({ field, allFields, onClose, onSaved }) {
  const isEdit = !!field?.id;
  const levels = getHierarchyLevels();

  const [form, setForm] = useState({
    label:              field?.label || '',
    fieldType:          field?.fieldType || 'text',
    options:            Array.isArray(field?.options) ? field.options.join(', ') : '',
    section:            field?.section || FIELD_SECTIONS[0],
    displayOrder:       field?.displayOrder ?? (allFields.filter(f => f.section === (field?.section || FIELD_SECTIONS[0])).length + 1),
    isRequired:         field?.isRequired ?? false,
    isFilterable:       field?.isFilterable ?? true,
    isVisibleToEmployee:field?.isVisibleToEmployee ?? true,
    appliesToLevels:    field?.appliesToLevels || [],
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(er => ({ ...er, [k]: '' })); };

  // Auto-generate fieldKey from label (only on create)
  const fieldKey = isEdit
    ? field.fieldKey
    : form.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || '…';

  const needsOptions = form.fieldType === 'dropdown_single' || form.fieldType === 'dropdown_multi';

  const validate = () => {
    const e = {};
    if (!form.label.trim()) e.label = 'Required';
    if (!isEdit) {
      const key = form.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const dup = allFields.find(f => f.fieldKey === key && f.id !== field?.id);
      if (dup) e.label = `Field key "${key}" already exists. Choose a different label.`;
    }
    if (needsOptions && !form.options.trim()) e.options = 'At least one option required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleToggleLevel = (levelId) => {
    const cur = form.appliesToLevels;
    set('appliesToLevels', cur.includes(levelId) ? cur.filter(id => id !== levelId) : [...cur, levelId]);
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const opts = needsOptions
      ? form.options.split(',').map(o => o.trim()).filter(Boolean)
      : [];
    const record = {
      ...(isEdit ? field : {}),
      label:              form.label.trim(),
      fieldKey:           isEdit ? field.fieldKey : fieldKey,
      fieldType:          form.fieldType,
      options:            opts,
      section:            form.section,
      displayOrder:       Number(form.displayOrder),
      isRequired:         form.isRequired,
      isFilterable:       form.isFilterable,
      isVisibleToEmployee:form.isVisibleToEmployee,
      appliesToLevels:    form.appliesToLevels,
    };
    saveCustomField(record);
    onSaved(isEdit ? 'Field updated.' : 'Field created.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{isEdit ? 'Edit Field' : 'Add Custom Field'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Field Label <span className="text-red-500">*</span></label>
            <input
              value={form.label}
              onChange={e => set('label', e.target.value)}
              placeholder="e.g. Territory Code"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1] focus:ring-1 focus:ring-[#01A2B1]/20"
            />
            {errors.label && <p className="text-xs text-red-500 mt-1">{errors.label}</p>}
            <p className="text-xs text-gray-400 mt-1">
              Field key: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">{fieldKey}</code>
              {isEdit && ' (fixed after creation)'}
            </p>
          </div>

          {/* Field type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Field Type <span className="text-red-500">*</span></label>
            <select
              value={form.fieldType}
              onChange={e => set('fieldType', e.target.value)}
              disabled={isEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1] disabled:bg-gray-50 disabled:text-gray-400"
            >
              {Object.entries(FIELD_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {isEdit && <p className="text-xs text-gray-400 mt-1">Field type cannot be changed after creation.</p>}
          </div>

          {/* Options (for dropdowns) */}
          {needsOptions && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Options <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(comma-separated)</span></label>
              <textarea
                value={form.options}
                onChange={e => set('options', e.target.value)}
                rows={3}
                placeholder="Option A, Option B, Option C"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1] resize-none"
              />
              {errors.options && <p className="text-xs text-red-500 mt-1">{errors.options}</p>}
              {form.options && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.options.split(',').map(o => o.trim()).filter(Boolean).map((opt, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{opt}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section + order row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
              <select
                value={form.section}
                onChange={e => set('section', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]"
              >
                {FIELD_SECTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Display Order</label>
              <input
                type="number"
                min={1}
                value={form.displayOrder}
                onChange={e => set('displayOrder', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 border border-gray-100 rounded-xl p-4 bg-gray-50/50">
            <Toggle value={form.isRequired} onChange={v => set('isRequired', v)}
              label="Required" hint="Profile must fill this before being marked complete" />
            <Toggle value={form.isFilterable} onChange={v => set('isFilterable', v)}
              label="Filterable" hint="Appears as a filter in dashboards, lists, and exports" />
            <Toggle value={form.isVisibleToEmployee} onChange={v => set('isVisibleToEmployee', v)}
              label="Visible to Employee" hint="OFF = admin and managers only (e.g. compensation data)" />
          </div>

          {/* Applies to levels */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Applies to Levels <span className="text-gray-400 font-normal">(leave empty = all levels)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {levels.map(l => {
                const active = form.appliesToLevels.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleToggleLevel(l.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all
                      ${active ? 'border-transparent text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}
                    style={active ? { background: l.colorTag, borderColor: l.colorTag } : {}}
                  >
                    {l.abbreviation} — {l.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: '#01A2B1' }}
          >
            {isEdit ? 'Save Changes' : 'Create Field'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Live Preview Panel ───────────────────────────────────────────────────────
function LivePreview({ fields, levels }) {
  const sections = FIELD_SECTIONS;
  const lvlMap = Object.fromEntries(levels.map(l => [l.id, l]));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 bg-gradient-to-r from-gray-50 to-white">
        <Eye size={15} className="text-[#01A2B1]" />
        <h3 className="text-sm font-semibold text-gray-700">Live Employee Profile Preview</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Fixed header section preview */}
        <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 p-4">
          <div className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-3">Fixed Fields (always shown)</div>
          <div className="grid grid-cols-2 gap-2">
            {['Full Name', 'Email', 'Employee ID', 'Date of Joining', 'Status', 'Hierarchy Level'].map(f => (
              <div key={f} className="bg-white rounded-lg px-3 py-2 border border-indigo-100">
                <div className="text-xs text-gray-400">{f}</div>
                <div className="text-xs font-medium text-gray-300 mt-0.5 italic">auto-populated</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic custom field sections */}
        {sections.map(section => {
          const sectionFields = fields
            .filter(f => f.section === section && f.status === 'active')
            .sort((a, b) => a.displayOrder - b.displayOrder);
          if (sectionFields.length === 0) return null;
          return (
            <div key={section} className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600">{section}</span>
                <span className="text-xs text-gray-400">{sectionFields.length} field{sectionFields.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                {sectionFields.map(f => (
                  <div
                    key={f.id}
                    className={`rounded-lg px-3 py-2 border ${
                      f.fieldType === 'textarea' ? 'col-span-2' : ''
                    } ${f.isRequired ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-gray-50/50'}`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-medium text-gray-600 truncate">{f.label}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {f.isRequired && <span className="text-red-400 text-xs">*</span>}
                        {!f.isVisibleToEmployee && <EyeOff size={10} className="text-amber-400" />}
                        {f.isFilterable && <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center" style={{fontSize:8}}>F</span>}
                      </div>
                    </div>
                    <div className="mt-1">
                      {f.fieldType === 'text' && <div className="h-5 bg-white rounded border border-gray-200 w-full" />}
                      {f.fieldType === 'textarea' && <div className="h-10 bg-white rounded border border-gray-200 w-full" />}
                      {f.fieldType === 'number' && <div className="h-5 bg-white rounded border border-gray-200 w-20" />}
                      {f.fieldType === 'date' && <div className="h-5 bg-white rounded border border-gray-200 w-28" />}
                      {(f.fieldType === 'dropdown_single' || f.fieldType === 'dropdown_multi') && (
                        <div className="h-5 bg-white rounded border border-gray-200 w-full flex items-center px-2">
                          <div className="flex gap-1 flex-wrap">
                            {(f.options || []).slice(0, 2).map(o => (
                              <span key={o} className="text-xs bg-gray-100 text-gray-500 px-1 rounded" style={{fontSize:9}}>{o}</span>
                            ))}
                            {(f.options || []).length > 2 && <span className="text-xs text-gray-400" style={{fontSize:9}}>+{(f.options||[]).length - 2}</span>}
                          </div>
                        </div>
                      )}
                      {f.fieldType === 'toggle' && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-7 h-3.5 rounded-full bg-gray-200" />
                          <span className="text-xs text-gray-400" style={{fontSize:9}}>Yes / No</span>
                        </div>
                      )}
                      {f.fieldType === 'hierarchy_lookup' && <div className="h-5 bg-cyan-50 rounded border border-cyan-200 w-full" />}
                      {f.fieldType === 'org_unit_lookup' && <div className="h-5 bg-teal-50 rounded border border-teal-200 w-full text-teal-500 text-xs flex items-center px-1" style={{fontSize:9}}>Org Unit</div>}
                    </div>
                    {f.appliesToLevels?.length > 0 && (
                      <div className="mt-1 flex gap-1 flex-wrap">
                        {f.appliesToLevels.slice(0, 3).map(lvlId => {
                          const l = lvlMap[lvlId];
                          return l ? (
                            <span key={lvlId} className="text-xs px-1 rounded" style={{fontSize:8, background: l.colorTag + '22', color: l.colorTag}}>{l.abbreviation}</span>
                          ) : null;
                        })}
                        {f.appliesToLevels.length > 3 && <span className="text-xs text-gray-300" style={{fontSize:8}}>+{f.appliesToLevels.length-3}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {fields.filter(f => f.status === 'active').length === 0 && (
          <div className="text-center py-8 text-gray-300">
            <Settings size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">Add fields to see the profile preview</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="text-red-400 font-bold">*</span> Required</span>
        <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center" style={{fontSize:8}}>F</span> Filterable</span>
        <span className="flex items-center gap-1"><EyeOff size={10} className="text-amber-400" /> Admin only</span>
      </div>
    </div>
  );
}

// ─── Section Panel with DnD ───────────────────────────────────────────────────
function SectionPanel({ section, fields, levels, onEdit, onArchive, onRestore, onReorder, showArchived }) {
  const sectionFields = fields
    .filter(f => f.section === section)
    .filter(f => showArchived || f.status === 'active')
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const [collapsed, setCollapsed] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = sectionFields.map(f => f.id);
    const oldIdx = ids.indexOf(active.id);
    const newIdx = ids.indexOf(over.id);
    const reordered = arrayMove(ids, oldIdx, newIdx);
    onReorder(section, reordered);
  };

  const activeCount   = sectionFields.filter(f => f.status === 'active').length;
  const archivedCount = sectionFields.filter(f => f.status === 'archived').length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        {collapsed ? <ChevronRight size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        <span className="font-semibold text-gray-700 text-sm">{section}</span>
        <div className="ml-auto flex items-center gap-2">
          {activeCount > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#01A2B1]/10 text-[#01A2B1]">{activeCount} active</span>}
          {archivedCount > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{archivedCount} archived</span>}
        </div>
      </button>

      {!collapsed && (
        <div className="p-3 space-y-1.5">
          {sectionFields.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No fields in this section yet.</p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sectionFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
              {sectionFields.map(f => (
                <SortableFieldRow
                  key={f.id}
                  field={f}
                  levels={levels}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onRestore={onRestore}
                  showArchived={showArchived}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomFieldBuilder() {
  const [toast, setToast]           = useState(null);
  const [formTarget, setFormTarget] = useState(null); // null | field | 'new'
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [showArchived, setShowArchived]   = useState(false);
  const [search, setSearch]         = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [refresh, setRefresh]       = useState(0);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };
  const bump = () => setRefresh(r => r + 1);

  const allFields = getCustomFields();
  const levels    = getHierarchyLevels();

  const filtered = allFields
    .filter(f => showArchived || f.status === 'active')
    .filter(f => filterSection === '' || f.section === filterSection)
    .filter(f => !search || f.label.toLowerCase().includes(search.toLowerCase()) || f.fieldKey.toLowerCase().includes(search.toLowerCase()));

  // Stats
  const totalActive   = allFields.filter(f => f.status === 'active').length;
  const totalFiltr    = allFields.filter(f => f.status === 'active' && f.isFilterable).length;
  const totalReq      = allFields.filter(f => f.status === 'active' && f.isRequired).length;
  const totalArchived = allFields.filter(f => f.status === 'archived').length;

  const handleReorder = (section, orderedIds) => { reorderCustomFields(section, orderedIds); bump(); };
  const handleArchive = () => { archiveCustomField(archiveTarget.id); setArchiveTarget(null); showToast('Field archived.'); bump(); };
  const handleRestore = (f) => { restoreCustomField(f.id); showToast('Field restored.'); bump(); };
  const handleSaved   = (msg) => { setFormTarget(null); showToast(msg); bump(); };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Custom Field Builder</h1>
          <p className="text-sm text-gray-500 mt-0.5">Define additional employee profile fields — no code required.</p>
        </div>
        <button
          onClick={() => setFormTarget({ id: null })}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-sm hover:opacity-90"
          style={{ background: '#01A2B1' }}
        >
          <Plus size={16} /> Add Custom Field
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Fields',  value: totalActive,   color: '#01A2B1' },
          { label: 'Filterable',     value: totalFiltr,    color: '#059669' },
          { label: 'Required',       value: totalReq,      color: '#DC2626' },
          { label: 'Archived',       value: totalArchived, color: '#9CA3AF' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3.5">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Two-column layout: field list + live preview */}
      <div className="grid lg:grid-cols-5 gap-5">
        {/* Field list — 3 cols */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search fields…"
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#01A2B1]"
              />
            </div>
            <select
              value={filterSection}
              onChange={e => setFilterSection(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-[#01A2B1]"
            >
              <option value="">All Sections</option>
              {FIELD_SECTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="rounded" />
              Show archived
            </label>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-x-3 text-xs font-semibold text-gray-400 uppercase tracking-wide px-9 py-1">
            <div className="col-span-4">Field Label / Key</div>
            <div className="col-span-3">Type</div>
            <div className="col-span-3">Section</div>
            <div className="col-span-2 text-right">Flags</div>
          </div>

          {/* Sections */}
          {(filterSection ? [filterSection] : FIELD_SECTIONS).map(section => (
            <SectionPanel
              key={section}
              section={section}
              fields={search ? filtered : allFields}
              levels={levels}
              onEdit={f => setFormTarget(f)}
              onArchive={f => setArchiveTarget(f)}
              onRestore={handleRestore}
              onReorder={handleReorder}
              showArchived={showArchived}
            />
          ))}
        </div>

        {/* Live preview — 2 cols */}
        <div className="lg:col-span-2 sticky top-4" style={{ height: 'calc(100vh - 200px)' }}>
          <LivePreview fields={allFields} levels={levels} />
        </div>
      </div>

      {/* Modals */}
      {formTarget !== null && (
        <FieldFormModal
          field={formTarget?.id ? formTarget : null}
          allFields={allFields}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}
      {archiveTarget && (
        <ArchiveConfirm
          field={archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onConfirm={handleArchive}
        />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
