import { useState, useCallback, useRef } from 'react';
import {
  getPositions, getActivePositions, savePosition, deactivatePosition,
  getHierarchyLevels, getOrgUnits, getCurrentPrimaryOccupant,
  getOrgEmployeeById, getVacantPositions, bulkImportPositions,
} from '../lib/orgDb';
import { PageHeader, Button, Badge } from '../components/UI';
import {
  Plus, Edit2, ToggleLeft, ToggleRight, Upload, X, Check, AlertTriangle,
  Search, Filter, ChevronDown, ChevronUp, Briefcase, Users,
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

// ─── Position Form Modal ──────────────────────────────────────────────────────
function PositionModal({ position, positions, levels, units, onSave, onClose }) {
  const isEdit = !!position?.id;
  const [form, setForm] = useState({
    positionCode: position?.positionCode || '',
    title:        position?.title || '',
    hierarchyLevelId: position?.hierarchyLevelId || '',
    parentPositionId: position?.parentPositionId || '',
    orgUnitId:    position?.orgUnitId || '',
    division:     position?.division || '',
    isActive:     position?.isActive !== false,
  });
  const [error, setError] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // When level changes, filter parent positions to only those with a higher (lower rank number) level
  const selectedLevel = levels.find(l => l.id === form.hierarchyLevelId);
  const parentOptions = positions.filter(p => {
    if (isEdit && p.id === position.id) return false;
    if (!form.hierarchyLevelId) return true;
    const pLevel = levels.find(l => l.id === p.hierarchyLevelId);
    if (!pLevel || !selectedLevel) return true;
    return pLevel.rank < selectedLevel.rank; // parent must be more senior
  });

  // Divisions
  const DIVISIONS = ['Primary Care', 'Oncology', 'Vaccines', 'CNS', 'Cardiology', 'Respiratory'];

  function submit() {
    if (!form.positionCode.trim()) { setError('Position code is required.'); return; }
    if (!form.title.trim()) { setError('Position title is required.'); return; }
    if (!form.hierarchyLevelId) { setError('Hierarchy level is required.'); return; }
    // Check code uniqueness
    const dup = positions.find(p => p.positionCode === form.positionCode.trim() && (!isEdit || p.id !== position.id));
    if (dup) { setError(`Position code "${form.positionCode}" is already in use.`); return; }
    onSave({
      ...(isEdit ? { id: position.id } : {}),
      positionCode:     form.positionCode.trim(),
      title:            form.title.trim(),
      hierarchyLevelId: form.hierarchyLevelId,
      parentPositionId: form.parentPositionId || null,
      orgUnitId:        form.orgUnitId || null,
      division:         form.division,
      isActive:         form.isActive,
      createdBy:        'admin',
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-800">{isEdit ? 'Edit Position' : 'Add Position'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-600 text-xs rounded-lg border border-red-200">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Position Code <span className="text-red-400">*</span></label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
              value={form.positionCode} onChange={e => set('positionCode', e.target.value)} placeholder="e.g. NSM-001" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Division</label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
              value={form.division} onChange={e => set('division', e.target.value)}>
              <option value="">— Select —</option>
              {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Position Title <span className="text-red-400">*</span></label>
          <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
            value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. NSM Pakistan" />
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Hierarchy Level <span className="text-red-400">*</span></label>
          <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
            value={form.hierarchyLevelId} onChange={e => { set('hierarchyLevelId', e.target.value); set('parentPositionId', ''); }}>
            <option value="">— Select level —</option>
            {levels.map(l => <option key={l.id} value={l.id}>{l.name} ({l.abbreviation})</option>)}
          </select>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Parent Position
            {form.hierarchyLevelId && <span className="text-gray-400 ml-1 font-normal">(must be higher rank than selected level)</span>}
          </label>
          <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
            value={form.parentPositionId} onChange={e => set('parentPositionId', e.target.value)}>
            <option value="">— Top level (no parent) —</option>
            {parentOptions.map(p => {
              const lvl = levels.find(l => l.id === p.hierarchyLevelId);
              return <option key={p.id} value={p.id}>{p.positionCode} — {p.title}{lvl ? ` (${lvl.abbreviation})` : ''}</option>;
            })}
          </select>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Org Unit</label>
          <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
            value={form.orgUnitId} onChange={e => set('orgUnitId', e.target.value)}>
            <option value="">— None —</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.unitType})</option>)}
          </select>
        </div>

        {isEdit && (
          <div className="mt-4 flex items-center gap-3">
            <button onClick={() => set('isActive', !form.isActive)} className="flex items-center gap-2 text-sm text-gray-700">
              {form.isActive
                ? <ToggleRight size={20} style={{color:'#01A2B1'}} />
                : <ToggleLeft size={20} className="text-gray-300" />}
              <span>{form.isActive ? 'Active' : 'Inactive'}</span>
            </button>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} className="flex-1 py-2 rounded-xl text-sm font-medium text-white" style={{background:'#01A2B1'}}>
            {isEdit ? 'Save Changes' : 'Add Position'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Import Modal ────────────────────────────────────────────────────────
function BulkImportModal({ onClose, onImport }) {
  const fileRef = useRef();
  const [preview, setPreview] = useState(null);
  const [result, setResult]   = useState(null);
  const [dragging, setDragging] = useState(false);

  function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ''; });
      return row;
    });
  }

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const rows = parseCSV(e.target.result);
      setPreview(rows.slice(0, 5));
      setResult(null);
    };
    reader.readAsText(file);
  }

  function doImport() {
    if (!fileRef.current?.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
      const rows = parseCSV(e.target.result);
      const res = onImport(rows);
      setResult(res);
    };
    reader.readAsText(fileRef.current.files[0]);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">Bulk Import Positions</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {!result ? (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Upload a CSV with columns: <code className="bg-gray-100 px-1 rounded">position_code, title, hierarchy_level_name, parent_position_code, org_unit_name, division</code>
            </p>
            {/* Template download */}
            <button
              className="mb-4 text-xs text-[#01A2B1] hover:underline"
              onClick={() => {
                const csv = 'position_code,title,hierarchy_level_name,parent_position_code,org_unit_name,division\nNSM-002,NSM South,National Sales Manager,,South Zone,Primary Care';
                const a = document.createElement('a');
                a.href = 'data:text/csv,' + encodeURIComponent(csv);
                a.download = 'positions_template.csv';
                a.click();
              }}
            >
              Download CSV template
            </button>

            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-[#01A2B1] bg-[#01A2B1]/5' : 'border-gray-200 hover:border-gray-300'}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); fileRef.current.files = e.dataTransfer.files; }}
              onClick={() => fileRef.current.click()}
            >
              <Upload size={24} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">Drop CSV here or <span className="text-[#01A2B1]">browse</span></p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={e => handleFile(e.target.files[0])} />
            </div>

            {preview && (
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-600 mb-2">Preview (first 5 rows)</p>
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="text-xs w-full">
                    <thead className="bg-gray-50">
                      <tr>{Object.keys(preview[0] || {}).map(k => <th key={k} className="px-2 py-1.5 text-left font-medium text-gray-500">{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          {Object.values(row).map((v, j) => <td key={j} className="px-2 py-1.5 text-gray-700">{v}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={doImport} disabled={!preview}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40" style={{background:'#01A2B1'}}>
                Import
              </button>
            </div>
          </>
        ) : (
          <div>
            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <Check size={16} className="text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">{result.created} position{result.created !== 1 ? 's' : ''} created</span>
              </div>
              {result.skipped > 0 && (
                <div className="px-4 py-3 bg-amber-50 rounded-xl border border-amber-100 text-sm text-amber-700">
                  {result.skipped} row{result.skipped !== 1 ? 's' : ''} skipped (position code already exists)
                </div>
              )}
              {result.failed.length > 0 && (
                <div className="px-4 py-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-sm font-medium text-red-700 mb-2">{result.failed.length} row{result.failed.length !== 1 ? 's' : ''} failed:</p>
                  <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                    {result.failed.map((f, i) => <li key={i}>Row {f.row}: {f.reason}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <button onClick={onClose} className="w-full py-2 rounded-xl text-sm font-medium text-white" style={{background:'#01A2B1'}}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Confirm Deactivate Modal ─────────────────────────────────────────────────
function ConfirmModal({ pos, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Deactivate Position</h3>
            <p className="text-xs text-gray-500 mt-1">
              Deactivate <strong>{pos.title}</strong> ({pos.positionCode})? It will be hidden from assignments and the org chart.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600">Deactivate</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PositionMaster() {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick(t => t + 1), []);

  const allPositions = getPositions();
  const levels = getHierarchyLevels();
  const units  = getOrgUnits();
  const vacant = getVacantPositions();

  // ── Filters ──
  const [search, setSearch]       = useState('');
  const [filterLevel, setFL]      = useState('');
  const [filterUnit, setFU]       = useState('');
  const [filterDiv, setFDiv]      = useState('');
  const [filterVacancy, setFVac]  = useState(''); // '' | 'vacant' | 'filled'
  const [showActive, setShowActive] = useState(true);

  // ── Modals ──
  const [modal, setModal]     = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast]     = useState({ msg: '', type: 'success' });

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '' }), 3500);
  }

  // Compute filtered list
  const vacantIds = new Set(vacant.map(p => p.id));
  const filtered = allPositions.filter(p => {
    if (showActive && !p.isActive) return false;
    if (!showActive && p.isActive) return false;
    if (filterLevel && p.hierarchyLevelId !== filterLevel) return false;
    if (filterUnit  && p.orgUnitId !== filterUnit) return false;
    if (filterDiv   && p.division !== filterDiv) return false;
    if (filterVacancy === 'vacant'  && !vacantIds.has(p.id)) return false;
    if (filterVacancy === 'filled'  && vacantIds.has(p.id))  return false;
    if (search) {
      const q = search.toLowerCase();
      return p.positionCode.toLowerCase().includes(q) || p.title.toLowerCase().includes(q);
    }
    return true;
  });

  const DIVISIONS = ['Primary Care', 'Oncology', 'Vaccines', 'CNS', 'Cardiology', 'Respiratory'];

  function handleSave(data) {
    try {
      savePosition(data);
      bump();
      setModal(null);
      showToast(data.id ? 'Position updated.' : 'Position created.');
    } catch (e) { showToast(e.message, 'error'); }
  }

  function handleDeactivate(pos) {
    try {
      deactivatePosition(pos.id);
      bump();
      setConfirm(null);
      showToast(`"${pos.title}" deactivated.`);
    } catch (e) { showToast(e.message, 'error'); }
  }

  function handleImport(rows) {
    const result = bulkImportPositions(rows);
    bump();
    return result;
  }

  // Lookup helpers
  const levelById = Object.fromEntries(levels.map(l => [l.id, l]));
  const unitById  = Object.fromEntries(units.map(u => [u.id, u]));
  const posById   = Object.fromEntries(allPositions.map(p => [p.id, p]));

  return (
    <div>
      <PageHeader
        title="Position Master"
        subtitle={`${allPositions.filter(p => p.isActive).length} active positions · ${vacant.length} vacant`}
        action={
          <div className="flex gap-2">
            <Button icon={Upload} variant="secondary" onClick={() => setShowImport(true)}>Bulk Import</Button>
            <Button icon={Plus} onClick={() => setModal({ mode: 'add', position: null })}>Add Position</Button>
          </div>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <div className="text-2xl font-bold text-gray-800">{allPositions.filter(p => p.isActive).length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Active Positions</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <div className="text-2xl font-bold text-emerald-600">{allPositions.filter(p => p.isActive).length - vacant.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Filled</div>
        </div>
        <div className="bg-white rounded-xl border border-red-100 px-4 py-3">
          <div className="text-2xl font-bold text-red-500">{vacant.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Vacant</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <div className="text-2xl font-bold text-gray-400">{allPositions.filter(p => !p.isActive).length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Inactive</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[180px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#01A2B1]/30"
              placeholder="Search code or title…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={filterLevel} onChange={e => setFL(e.target.value)}>
            <option value="">All Levels</option>
            {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={filterUnit} onChange={e => setFU(e.target.value)}>
            <option value="">All Org Units</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={filterDiv} onChange={e => setFDiv(e.target.value)}>
            <option value="">All Divisions</option>
            {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={filterVacancy} onChange={e => setFVac(e.target.value)}>
            <option value="">Vacant & Filled</option>
            <option value="vacant">Vacant Only</option>
            <option value="filled">Filled Only</option>
          </select>
          <button onClick={() => setShowActive(s => !s)}
            className={`px-3 py-2 rounded-xl text-sm border transition-colors ${showActive ? 'border-[#01A2B1] text-[#01A2B1] bg-[#01A2B1]/5' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {showActive ? 'Active' : 'Inactive'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Level</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Parent Position</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Org Unit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Occupant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                    <Briefcase size={28} className="mx-auto mb-3 opacity-30" />
                    No positions match your filters.
                  </td>
                </tr>
              ) : filtered.map(pos => {
                const lvl      = levelById[pos.hierarchyLevelId];
                const unit     = unitById[pos.orgUnitId];
                const parent   = posById[pos.parentPositionId];
                const occupantId = getCurrentPrimaryOccupant(pos.id);
                const occupant = occupantId ? getOrgEmployeeById(occupantId) : null;
                const isVacant = !occupant;

                return (
                  <tr key={pos.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">{pos.positionCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{pos.title}</div>
                      {pos.division && <div className="text-xs text-gray-400 mt-0.5">{pos.division}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {lvl ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{background: lvl.colorTag || '#6B7280'}}>
                          {lvl.abbreviation}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {parent ? `${parent.positionCode}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {unit ? unit.name : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isVacant ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100 font-medium">Vacant</span>
                      ) : (
                        <div>
                          <div className="text-xs font-medium text-gray-700">{occupant.name}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pos.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                        {pos.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setModal({ mode: 'edit', position: pos })}
                          className="p-1.5 rounded-lg hover:bg-[#01A2B1]/10 text-gray-400 hover:text-[#01A2B1]">
                          <Edit2 size={13} />
                        </button>
                        {pos.isActive && (
                          <button onClick={() => setConfirm(pos)}
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-500">
                            <ToggleRight size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
          Showing {filtered.length} of {allPositions.length} positions
        </div>
      </div>

      {/* Modals */}
      {modal && (
        <PositionModal
          position={modal.position}
          positions={allPositions}
          levels={levels}
          units={units}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {confirm && (
        <ConfirmModal pos={confirm} onConfirm={() => handleDeactivate(confirm)} onClose={() => setConfirm(null)} />
      )}
      {showImport && (
        <BulkImportModal
          onClose={() => { setShowImport(false); bump(); }}
          onImport={handleImport}
        />
      )}
      <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg: '' })} />
    </div>
  );
}
