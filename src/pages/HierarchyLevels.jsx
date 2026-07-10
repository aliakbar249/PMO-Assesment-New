import { useState, useMemo } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Layers, Plus, Edit2, Trash2, GripVertical, Check, X,
  AlertTriangle, ChevronDown, ChevronUp, Info, Users,
} from 'lucide-react';
import {
  getHierarchyLevels, saveHierarchyLevel, deleteHierarchyLevel,
  reorderHierarchyLevels, countEmployeesAtLevel, ACCESS_ROLES,
} from '../lib/orgDb';
import {
  Button, Badge, Input, Select, Modal, PageHeader, StatCard, Alert, EmptyState,
} from '../components/UI';

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onClose }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
      ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? <Check size={15} /> : <AlertTriangle size={15} />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={13} /></button>
    </div>
  );
}

// ─── Color picker ─────────────────────────────────────────────────────────────
const PRESET_COLORS = [
  '#7C3AED','#0891B2','#059669','#D97706','#DC2626','#6B7280',
  '#DB2777','#2563EB','#16A34A','#EA580C','#9333EA','#0F172A',
];

function ColorPicker({ value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">Color Tag</label>
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="w-7 h-7 rounded-full border-2 transition-all"
            style={{ background: c, borderColor: value === c ? '#000' : 'transparent', transform: value === c ? 'scale(1.2)' : 'scale(1)' }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input
          type="color"
          value={value || '#6B7280'}
          onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-gray-300"
        />
        <span className="text-xs text-gray-500">Custom colour</span>
      </div>
    </div>
  );
}

// ─── Toggle component ─────────────────────────────────────────────────────────
function Toggle({ value, onChange, label, hint }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <div
        onClick={() => onChange(!value)}
        className={`relative w-10 h-6 rounded-full cursor-pointer transition-colors ${value ? 'bg-teal-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
    </div>
  );
}

// ─── Level Form Modal ─────────────────────────────────────────────────────────
const BLANK = {
  name: '', abbreviation: '', rank: '', colorTag: '#6B7280',
  canBeAssessed: true, canBeReviewer: true, hasPlatformAccess: true, accessRole: 'employee',
};

function LevelFormModal({ level, maxRank, onClose, onSaved }) {
  const isEdit = !!level?.id;
  const [form, setForm] = useState(level ? { ...level } : { ...BLANK, rank: maxRank + 1 });
  const [errors, setErrors] = useState({});

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: '' })); };
  const setB = k => v => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Level name is required';
    if (!form.rank || isNaN(Number(form.rank))) e.rank = 'Rank must be a number';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSave = () => {
    if (!validate()) return;
    saveHierarchyLevel({ ...form, rank: Number(form.rank) });
    onSaved('Level saved successfully.');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit Level — ${level.name}` : 'Add Hierarchy Level'} size="lg">
      <div className="space-y-4">
        <Alert type="info">
          <div className="flex items-start gap-2 text-xs">
            <Info size={12} className="mt-0.5 flex-shrink-0" />
            Changes apply to future assignments only. Existing employees are not retroactively affected.
          </div>
        </Alert>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Level Name" placeholder="e.g. Regional Sales Manager" value={form.name} onChange={set('name')} error={errors.name} required />
          <Input label="Abbreviation" placeholder="e.g. RSM" value={form.abbreviation} onChange={set('abbreviation')} hint="Optional short code" />
        </div>

        <Input label="Rank" type="number" placeholder="1 = most senior" value={form.rank} onChange={set('rank')} error={errors.rank} hint="Lower number = more senior. Drag-to-reorder updates this automatically." required />

        <ColorPicker value={form.colorTag} onChange={c => setForm(f => ({ ...f, colorTag: c }))} />

        <div className="border border-gray-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Permissions</p>
          <Toggle value={form.canBeAssessed}    onChange={setB('canBeAssessed')}    label="Can be assessed"      hint="Employees at this level appear as subjects in assessment cycles" />
          <Toggle value={form.canBeReviewer}    onChange={setB('canBeReviewer')}    label="Can be a reviewer"    hint="Can be assigned as reviewer in 360° cycles" />
          <Toggle value={form.hasPlatformAccess} onChange={setB('hasPlatformAccess')} label="Has platform access" hint="Can log in to the platform" />
          {form.hasPlatformAccess && (
            <div className="pt-2">
              <Select label="Access Role" value={form.accessRole} onChange={set('accessRole')}>
                {ACCESS_ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </Select>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>{isEdit ? 'Save Changes' : 'Add Level'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ level, empCount, onClose, onConfirm }) {
  return (
    <Modal open onClose={onClose} title="Delete Hierarchy Level" size="sm">
      <div className="space-y-4">
        {empCount > 0 ? (
          <Alert type="error">
            <div className="flex items-start gap-2">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Cannot delete "{level.name}"</p>
                <p className="text-xs mt-1">{empCount} employee{empCount !== 1 ? 's are' : ' is'} currently assigned to this level. Reassign them first.</p>
              </div>
            </div>
          </Alert>
        ) : (
          <Alert type="warning">
            <div className="flex items-start gap-2">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Delete "{level.name}"?</p>
                <p className="text-xs mt-1">This action cannot be undone.</p>
              </div>
            </div>
          </Alert>
        )}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {empCount === 0 && <Button variant="danger" onClick={onConfirm}><Trash2 size={14} />Delete Level</Button>}
        </div>
      </div>
    </Modal>
  );
}

// ─── Sortable Level Row ───────────────────────────────────────────────────────
function SortableLevelRow({ level, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: level.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const empCount = countEmployeesAtLevel(level.id);

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-gray-50 transition-colors">
      <td className="px-3 py-3">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-1">
          <GripVertical size={16} />
        </button>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: level.colorTag || '#6B7280' }} />
          <span className="font-medium text-gray-800 text-sm">{level.name}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        {level.abbreviation && (
          <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">{level.abbreviation}</span>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        <span className="text-sm font-bold text-gray-600">{level.rank}</span>
      </td>
      <td className="px-3 py-3 text-center">
        {level.canBeAssessed ? <Check size={14} className="text-emerald-500 mx-auto" /> : <X size={14} className="text-gray-300 mx-auto" />}
      </td>
      <td className="px-3 py-3 text-center">
        {level.canBeReviewer ? <Check size={14} className="text-emerald-500 mx-auto" /> : <X size={14} className="text-gray-300 mx-auto" />}
      </td>
      <td className="px-3 py-3 text-center">
        {level.hasPlatformAccess ? (
          <Badge variant={level.accessRole === 'admin' ? 'purple' : level.accessRole === 'manager' ? 'warning' : 'success'} size="xs">
            {level.accessRole}
          </Badge>
        ) : <span className="text-xs text-gray-400">—</span>}
      </td>
      <td className="px-3 py-3 text-center">
        <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${empCount > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>
          {empCount}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(level)} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Edit">
            <Edit2 size={13} />
          </button>
          <button onClick={() => onDelete(level)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HierarchyLevels() {
  const [tick, setTick]       = useState(0);
  const [formTarget, setFormTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast]     = useState(null);

  const refresh = () => setTick(t => t + 1);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const levels = useMemo(() => getHierarchyLevels(), [tick]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIdx = levels.findIndex(l => l.id === active.id);
      const newIdx = levels.findIndex(l => l.id === over.id);
      const reordered = arrayMove(levels, oldIdx, newIdx);
      reorderHierarchyLevels(reordered.map(l => l.id));
      refresh();
      showToast('Hierarchy order updated.');
    }
  };

  const confirmDelete = () => {
    try {
      deleteHierarchyLevel(deleteTarget.id);
      showToast(`"${deleteTarget.name}" deleted.`);
    } catch (e) {
      showToast(e.message, 'error');
    }
    setDeleteTarget(null);
    refresh();
  };

  const totalEmployees = levels.reduce((s, l) => s + countEmployeesAtLevel(l.id), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hierarchy Level Builder"
        subtitle="Define the organisational tiers from most senior to most junior. Drag rows to reorder — ranks update automatically."
        action={
          <Button onClick={() => setFormTarget({ ...BLANK, rank: levels.length + 1 })}>
            <Plus size={14} />Add Level
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Hierarchy Levels" value={levels.length}   icon={Layers} color="indigo" />
        <StatCard label="Total Employees"  value={totalEmployees}  icon={Users}  color="green"  sub="across all levels" />
        <StatCard label="Platform-Access"  value={levels.filter(l => l.hasPlatformAccess).length} icon={Check} color="amber" sub="levels with login" />
      </div>

      {/* Drag-and-drop table */}
      {levels.length === 0 ? (
        <EmptyState icon={Layers} title="No hierarchy levels yet" description="Add your first level to start configuring the organisational structure."
          action={<Button onClick={() => setFormTarget({ ...BLANK, rank: 1 })}><Plus size={14} />Add First Level</Button>} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-3 w-10" />
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Level Name</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Abbr.</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Rank</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Assessed</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Reviewer</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Access Role</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Employees</th>
                  <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={levels.map(l => l.id)} strategy={verticalListSortingStrategy}>
                  <tbody className="divide-y divide-gray-100">
                    {levels.map(level => (
                      <SortableLevelRow
                        key={level.id}
                        level={level}
                        onEdit={l => setFormTarget({ ...l })}
                        onDelete={l => setDeleteTarget(l)}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </DndContext>
            </table>
          </div>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            Drag rows by the <GripVertical size={11} className="inline" /> handle to reorder. Rank numbers update automatically.
          </div>
        </div>
      )}

      {formTarget && (
        <LevelFormModal
          level={formTarget.id ? formTarget : null}
          maxRank={levels.length}
          onClose={() => setFormTarget(null)}
          onSaved={msg => { showToast(msg); refresh(); }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          level={deleteTarget}
          empCount={countEmployeesAtLevel(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
