import { useState, useCallback } from 'react';
import {
  getOrgUnits, saveOrgUnit, deleteOrgUnit, getOrgUnitTree, ORG_UNIT_TYPES,
} from '../lib/orgDb';
import { PageHeader, Button, Badge } from '../components/UI';
import {
  Plus, Edit2, Trash2, ChevronRight, ChevronDown, Map, X, Check, AlertTriangle,
} from 'lucide-react';

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  const bg = type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium ${bg}`}>
      {type === 'error' ? <AlertTriangle size={15} /> : <Check size={15} />}
      <span>{msg}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={13} /></button>
    </div>
  );
}

// ─── OrgUnit Form Modal ────────────────────────────────────────────────────────
function OrgUnitModal({ unit, units, onSave, onClose }) {
  const isEdit = !!unit?.id;
  const [form, setForm] = useState({
    name: unit?.name || '',
    unitType: unit?.unitType || 'Zone',
    parentOrgUnitId: unit?.parentOrgUnitId || '',
    unitCode: unit?.unitCode || '',
    customType: '',
  });
  const [error, setError] = useState('');

  // All unit types (standard + any custom ones already used)
  const usedTypes = [...new Set(units.map(u => u.unitType))];
  const allTypes = [...new Set([...ORG_UNIT_TYPES, ...usedTypes])];
  const [showCustom, setShowCustom] = useState(!allTypes.includes(form.unitType));

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // Prevent selecting self or descendant as parent (when editing)
  const forbiddenIds = new Set();
  if (isEdit) {
    forbiddenIds.add(unit.id);
    // BFS descendants
    const queue = [unit.id];
    while (queue.length) {
      const cur = queue.shift();
      units.forEach(u => { if (u.parentOrgUnitId === cur) { forbiddenIds.add(u.id); queue.push(u.id); } });
    }
  }
  const parentOptions = units.filter(u => !forbiddenIds.has(u.id));

  function submit() {
    if (!form.name.trim()) { setError('Unit name is required.'); return; }
    const chosenType = showCustom ? form.customType.trim() : form.unitType;
    if (!chosenType) { setError('Unit type is required.'); return; }
    onSave({
      ...(isEdit ? { id: unit.id } : {}),
      name: form.name.trim(),
      unitType: chosenType,
      parentOrgUnitId: form.parentOrgUnitId || null,
      unitCode: form.unitCode.trim(),
      createdBy: 'admin',
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-800">{isEdit ? 'Edit Org Unit' : 'Add Org Unit'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-600 text-xs rounded-lg border border-red-200">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unit Name <span className="text-red-400">*</span></label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
              value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. North Zone" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unit Type <span className="text-red-400">*</span></label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
              value={showCustom ? '__custom__' : form.unitType}
              onChange={e => {
                if (e.target.value === '__custom__') { setShowCustom(true); }
                else { setShowCustom(false); set('unitType', e.target.value); }
              }}>
              {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
              <option value="__custom__">+ Custom type…</option>
            </select>
            {showCustom && (
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
                value={form.customType} onChange={e => set('customType', e.target.value)} placeholder="Enter custom type name" />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Parent Org Unit</label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
              value={form.parentOrgUnitId} onChange={e => set('parentOrgUnitId', e.target.value)}>
              <option value="">— Top level (no parent) —</option>
              {parentOptions.map(u => <option key={u.id} value={u.id}>{u.name} ({u.unitType})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unit Code (optional)</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
              value={form.unitCode} onChange={e => set('unitCode', e.target.value)} placeholder="e.g. LHR-N" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} className="flex-1 py-2 rounded-xl text-sm font-medium text-white" style={{background:'#01A2B1'}}>
            {isEdit ? 'Save Changes' : 'Add Unit'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmModal({ unit, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 size={16} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Delete Org Unit</h3>
            <p className="text-xs text-gray-500 mt-1">
              Are you sure you want to delete <strong>{unit.name}</strong>? This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Tree Node ────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  Division:      'bg-purple-100 text-purple-700',
  Zone:          'bg-blue-100 text-blue-700',
  Region:        'bg-teal-100 text-teal-700',
  Area:          'bg-amber-100 text-amber-700',
  Territory:     'bg-emerald-100 text-emerald-700',
  'Business Unit': 'bg-indigo-100 text-indigo-700',
};

function TreeNode({ node, depth, onEdit, onDelete }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const typeCls = TYPE_COLORS[node.unitType] || 'bg-gray-100 text-gray-600';

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-gray-50 group transition-colors cursor-default"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {/* Expand / collapse */}
        <button
          className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${hasChildren ? 'hover:bg-gray-200' : ''}`}
          onClick={() => hasChildren && setOpen(o => !o)}
        >
          {hasChildren
            ? open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />
            : <span className="w-1.5 h-1.5 rounded-full bg-gray-200 inline-block" />}
        </button>

        <Map size={14} className="text-gray-400 flex-shrink-0" />
        <span className="text-sm text-gray-800 font-medium flex-1 truncate">{node.name}</span>
        {node.unitCode && <span className="text-xs text-gray-400 font-mono">{node.unitCode}</span>}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeCls}`}>{node.unitType}</span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(node)}
            className="p-1 rounded-lg hover:bg-[#01A2B1]/10 text-gray-400 hover:text-[#01A2B1]">
            <Edit2 size={13} />
          </button>
          <button onClick={() => onDelete(node)}
            className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {hasChildren && open && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OrgUnits() {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick(t => t + 1), []);

  const units = getOrgUnits();
  const tree  = getOrgUnitTree();

  const [modal, setModal]     = useState(null); // null | { mode: 'add' | 'edit', unit }
  const [confirm, setConfirm] = useState(null); // unit to delete
  const [toast, setToast]     = useState({ msg: '', type: 'success' });

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3500);
  }

  function handleSave(unitData) {
    try {
      saveOrgUnit(unitData);
      bump();
      setModal(null);
      showToast(unitData.id ? 'Org unit updated.' : 'Org unit created.');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function handleDelete(unit) {
    try {
      deleteOrgUnit(unit.id);
      bump();
      setConfirm(null);
      showToast(`"${unit.name}" deleted.`);
    } catch (e) {
      setConfirm(null);
      showToast(e.message, 'error');
    }
  }

  return (
    <div>
      <PageHeader
        title="Org Unit Master"
        subtitle={`${units.length} unit${units.length !== 1 ? 's' : ''} across your organisation`}
        action={
          <Button icon={Plus} onClick={() => setModal({ mode: 'add', unit: null })}>
            Add Org Unit
          </Button>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {ORG_UNIT_TYPES.map(type => {
          const count = units.filter(u => u.unitType === type).length;
          if (count === 0) return null;
          return (
            <div key={type} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <div className="text-xl font-bold text-gray-800">{count}</div>
              <div className="text-xs text-gray-500 mt-0.5">{type}{count !== 1 ? 's' : ''}</div>
            </div>
          );
        })}
      </div>

      {/* Tree */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Organisation Structure</h2>
          <span className="text-xs text-gray-400">{units.length} units total</span>
        </div>
        <div className="p-3">
          {tree.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Map size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No org units yet. Add your first unit above.</p>
            </div>
          ) : (
            tree.map(node => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                onEdit={u => setModal({ mode: 'edit', unit: u })}
                onDelete={u => setConfirm(u)}
              />
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      {modal && (
        <OrgUnitModal
          unit={modal.unit}
          units={units}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {confirm && (
        <ConfirmModal
          unit={confirm}
          onConfirm={() => handleDelete(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
      <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg: '' })} />
    </div>
  );
}
