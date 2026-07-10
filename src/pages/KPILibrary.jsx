import { useState, useMemo } from 'react';
import {
  Library, Plus, Edit2, Archive, RotateCcw, Search,
  ChevronDown, ChevronUp, CheckCircle, AlertTriangle,
  Info, ArrowUpCircle, ArrowDownCircle, Filter, X
} from 'lucide-react';
import {
  getKPIItems, saveKPIItem, archiveKPIItem, restoreKPIItem, countKPIUsage,
  KPI_CATEGORY_LABELS, KPI_CATEGORY_COLORS,
  KPI_UNIT_LABELS, KPI_FREQUENCY_LABELS, ASSESSMENT_COMPETENCIES,
} from '../lib/kpiTraining';
import { useApp } from '../store/AppContext';
import {
  Button, Badge, Input, Select, Textarea, Modal,
  PageHeader, StatCard, EmptyState, Alert,
} from '../components/UI';

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES  = Object.entries(KPI_CATEGORY_LABELS);
const UNITS       = Object.entries(KPI_UNIT_LABELS);
const FREQUENCIES = Object.entries(KPI_FREQUENCY_LABELS);

const BLANK_FORM = {
  name: '', category: 'activity', description: '', unit: '%',
  targetValue: '', targetDirection: 'higher', frequency: 'monthly',
  isMandatory: false, linkedCompetency: '',
};

// ─── Small helpers ────────────────────────────────────────────────────────────
function CategoryBadge({ cat }) {
  const cfg = KPI_CATEGORY_COLORS[cat] || {};
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge || 'bg-gray-100 text-gray-600'}`}>
      {KPI_CATEGORY_LABELS[cat] || cat}
    </span>
  );
}

function DirectionBadge({ dir }) {
  return dir === 'lower'
    ? <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium"><ArrowDownCircle size={11} />Lower is better</span>
    : <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><ArrowUpCircle size={11} />Higher is better</span>;
}

// ─── KPI Form Modal (Add / Edit) ──────────────────────────────────────────────
function KPIFormModal({ item, onClose, onSaved }) {
  const isEdit = !!item?.id;
  const [form, setForm] = useState(item ? { ...item } : { ...BLANK_FORM });
  const [errors, setErrors] = useState({});

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: '' })); };
  const setCheck = k => e => setForm(f => ({ ...f, [k]: e.target.checked }));

  const validate = () => {
    const e = {};
    if (!form.name.trim())       e.name = 'KPI name is required';
    if (!form.targetValue && form.targetValue !== 0) e.targetValue = 'Target value is required';
    if (isNaN(parseFloat(form.targetValue))) e.targetValue = 'Must be a number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    saveKPIItem({
      ...(isEdit ? { id: item.id } : {}),
      ...form,
      targetValue: parseFloat(form.targetValue),
      archived: form.archived ?? false,
    });
    onSaved();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit KPI' : 'Add New KPI to Library'} size="lg">
      <div className="space-y-5">

        {isEdit && (
          <Alert type="info">
            <div className="flex items-start gap-2">
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              <span className="text-xs">Edits apply to <strong>future template uses only</strong>. Existing assignments are not retroactively changed.</span>
            </div>
          </Alert>
        )}

        {/* Name */}
        <Input
          label="KPI Name"
          placeholder="e.g. Weekly Digital Engagement Rate"
          value={form.name}
          onChange={set('name')}
          error={errors.name}
          required
        />

        {/* Category + Unit */}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Category" value={form.category} onChange={set('category')} required>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select label="Unit" value={form.unit} onChange={set('unit')} required>
            {UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>

        {/* Description */}
        <Textarea
          label="Description"
          placeholder="Brief explanation of what this KPI measures and how it is calculated…"
          value={form.description}
          onChange={set('description')}
          rows={2}
        />

        {/* Target value + direction */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Default Target Value"
            type="number"
            placeholder="e.g. 90"
            value={form.targetValue}
            onChange={set('targetValue')}
            error={errors.targetValue}
            hint="Can be overridden per template"
            required
          />
          <Select label="Target Direction" value={form.targetDirection} onChange={set('targetDirection')} required>
            <option value="higher">Higher is better (e.g. coverage %)</option>
            <option value="lower">Lower is better (e.g. violation count)</option>
          </Select>
        </div>

        {/* Frequency + Mandatory */}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Measurement Frequency" value={form.frequency} onChange={set('frequency')} required>
            {FREQUENCIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Mandatory <span className="text-gray-400 text-xs font-normal">(must reach 100%)</span>
            </label>
            <label className="flex items-center gap-2.5 mt-2 cursor-pointer select-none">
              <div
                onClick={() => setForm(f => ({ ...f, isMandatory: !f.isMandatory }))}
                className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${form.isMandatory ? 'bg-indigo-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isMandatory ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className={`text-sm font-medium ${form.isMandatory ? 'text-indigo-700' : 'text-gray-500'}`}>
                {form.isMandatory ? 'Yes — mandatory' : 'No — optional'}
              </span>
            </label>
          </div>
        </div>

        {/* Linked competency */}
        <Select
          label="Linked Assessment Competency"
          value={form.linkedCompetency}
          onChange={set('linkedCompetency')}
          hint="Optional — surfaces this KPI alongside assessment gaps for the same competency"
        >
          <option value="">None</option>
          {ASSESSMENT_COMPETENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>
            {isEdit ? <><Edit2 size={14} />Update KPI</> : <><Plus size={14} />Add to Library</>}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Archive Confirm ──────────────────────────────────────────────────────────
function ArchiveConfirmModal({ item, usageCount, onClose, onConfirm }) {
  return (
    <Modal open onClose={onClose} title="Archive KPI" size="sm">
      <div className="space-y-4">
        <Alert type="warning">
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Archive "{item.name}"?</p>
              <p className="text-xs mt-1">This KPI will be hidden from new template creation but preserved in all existing historical records and assignments.{usageCount > 0 ? ` It is currently used in ${usageCount} template${usageCount !== 1 ? 's' : ''}.` : ''}</p>
            </div>
          </div>
        </Alert>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="warning" onClick={onConfirm}><Archive size={14} />Archive KPI</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Library Page ────────────────────────────────────────────────────────
export default function KPILibrary({ onNavigate }) {
  const { currentUser } = useApp();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'company_admin';

  const [search, setSearch]         = useState('');
  const [filterCat, setFilterCat]   = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy]         = useState('category'); // category | name | mandatory
  const [sortDir, setSortDir]       = useState('asc');
  const [formItem, setFormItem]     = useState(null);  // null | BLANK | existing item
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [tick, setTick]             = useState(0);
  const refresh = () => setTick(t => t + 1);

  const allItems = useMemo(() => getKPIItems(), [tick]);

  // Stats
  const activeCount    = allItems.filter(i => !i.archived).length;
  const archivedCount  = allItems.filter(i => i.archived).length;
  const mandatoryCount = allItems.filter(i => !i.archived && i.isMandatory).length;
  const catCounts      = Object.keys(KPI_CATEGORY_LABELS).map(cat => ({
    cat, count: allItems.filter(i => !i.archived && i.category === cat).length,
  }));

  // Filter + sort
  const displayed = useMemo(() => {
    let list = allItems.filter(i => {
      const q = search.toLowerCase();
      const matchSearch = !q || i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q);
      const matchCat    = filterCat === 'all' || i.category === filterCat;
      const matchArch   = showArchived ? i.archived : !i.archived;
      return matchSearch && matchCat && matchArch;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name')      cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'category') {
        cmp = a.category.localeCompare(b.category);
        if (cmp === 0) cmp = a.name.localeCompare(b.name);
      }
      else if (sortBy === 'mandatory') cmp = (b.isMandatory ? 1 : 0) - (a.isMandatory ? 1 : 0);
      else if (sortBy === 'unit')  cmp = a.unit.localeCompare(b.unit);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [allItems, search, filterCat, showArchived, sortBy, sortDir, tick]);

  const toggleSort = col => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ChevronDown size={12} className="text-gray-300" />;
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-indigo-500" /> : <ChevronDown size={12} className="text-indigo-500" />;
  };

  const handleArchive = (item) => {
    archiveKPIItem(item.id);
    setArchiveTarget(null);
    refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="KPI Library"
        subtitle="Central repository of all reusable KPI definitions. Create and manage individual KPIs here — then select them when building templates."
        action={isAdmin && (
          <Button onClick={() => setFormItem({ ...BLANK_FORM })}>
            <Plus size={15} />Add New KPI
          </Button>
        )}
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Active KPIs"    value={activeCount}    icon={CheckCircle} color="green" />
        <StatCard label="Mandatory"       value={mandatoryCount} icon={AlertTriangle} color="amber" sub="non-skippable" />
        <StatCard label="Archived"        value={archivedCount}  icon={Archive}     color="indigo" sub="preserved, not shown" />
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">By Category</div>
          <div className="space-y-1.5">
            {catCounts.map(({ cat, count }) => {
              const cfg = KPI_CATEGORY_COLORS[cat];
              return (
                <div key={cat} className="flex items-center justify-between">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${cfg.badge}`}>{KPI_CATEGORY_LABELS[cat]}</span>
                  <span className="text-xs font-bold text-gray-700">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-indigo-400 focus:ring-indigo-100 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <Select value={filterCat} onChange={e => setFilterCat(e.target.value)} wrapClass="w-full sm:w-44">
          <option value="all">All Categories</option>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <button
          onClick={() => setShowArchived(s => !s)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${showArchived ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          <Archive size={14} />
          {showArchived ? 'Showing Archived' : 'Show Archived'}
        </button>
      </div>

      {/* Table */}
      {displayed.length === 0 ? (
        <EmptyState
          icon={Library}
          title={showArchived ? 'No archived KPIs' : 'No KPIs found'}
          description={showArchived ? 'All KPIs are active.' : 'Add your first KPI to start building templates.'}
          action={isAdmin && !showArchived && (
            <Button onClick={() => setFormItem({ ...BLANK_FORM })}>
              <Plus size={14} />Add First KPI
            </Button>
          )}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {/* KPI Name */}
                  <th className="text-left px-5 py-3">
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                      KPI Name <SortIcon col="name" />
                    </button>
                  </th>
                  {/* Category */}
                  <th className="text-left px-4 py-3">
                    <button onClick={() => toggleSort('category')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                      Category <SortIcon col="category" />
                    </button>
                  </th>
                  {/* Unit */}
                  <th className="text-left px-4 py-3 hidden md:table-cell">
                    <button onClick={() => toggleSort('unit')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                      Unit <SortIcon col="unit" />
                    </button>
                  </th>
                  {/* Default target */}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Default Target</th>
                  {/* Direction */}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Direction</th>
                  {/* Frequency */}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Frequency</th>
                  {/* Mandatory */}
                  <th className="text-center px-4 py-3">
                    <button onClick={() => toggleSort('mandatory')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 mx-auto">
                      Mandatory <SortIcon col="mandatory" />
                    </button>
                  </th>
                  {/* Used in */}
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Used In</th>
                  {/* Actions */}
                  {isAdmin && <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayed.map(item => {
                  const usageCount = countKPIUsage(item.id);
                  return (
                    <tr key={item.id} className={`transition-colors ${item.archived ? 'bg-gray-50/60 opacity-60' : 'hover:bg-gray-50'}`}>
                      {/* Name + description */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-800 text-sm leading-snug">{item.name}</div>
                            {item.description && (
                              <div className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-xs">{item.description}</div>
                            )}
                            {item.linkedCompetency && (
                              <div className="text-xs text-purple-600 mt-0.5">↔ {item.linkedCompetency}</div>
                            )}
                            {item.archived && <Badge variant="default" size="xs" className="mt-1">Archived</Badge>}
                          </div>
                        </div>
                      </td>
                      {/* Category */}
                      <td className="px-4 py-3.5">
                        <CategoryBadge cat={item.category} />
                      </td>
                      {/* Unit */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{item.unit}</span>
                      </td>
                      {/* Default target */}
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <span className="text-sm font-bold text-gray-700">
                          {item.targetValue}{item.unit === '%' ? '%' : ` ${item.unit}`}
                        </span>
                      </td>
                      {/* Direction */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <DirectionBadge dir={item.targetDirection} />
                      </td>
                      {/* Frequency */}
                      <td className="px-4 py-3.5 hidden lg:table-cell text-xs text-gray-500 capitalize">
                        {KPI_FREQUENCY_LABELS[item.frequency] || item.frequency}
                      </td>
                      {/* Mandatory */}
                      <td className="px-4 py-3.5 text-center">
                        {item.isMandatory
                          ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium"><AlertTriangle size={10} />Yes</span>
                          : <span className="text-xs text-gray-400">—</span>
                        }
                      </td>
                      {/* Used in */}
                      <td className="px-4 py-3.5 text-center hidden sm:table-cell">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${usageCount > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>
                          {usageCount} template{usageCount !== 1 ? 's' : ''}
                        </span>
                      </td>
                      {/* Actions */}
                      {isAdmin && (
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            {!item.archived ? (
                              <>
                                <button
                                  onClick={() => setFormItem({ ...item })}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                  title="Edit KPI"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => setArchiveTarget(item)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                  title="Archive KPI"
                                >
                                  <Archive size={14} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => { restoreKPIItem(item.id); refresh(); }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="Restore KPI"
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {displayed.length} KPI{displayed.length !== 1 ? 's' : ''} {showArchived ? 'archived' : 'active'}
              {filterCat !== 'all' || search ? ` (filtered)` : ''}
            </span>
            {isAdmin && !showArchived && (
              <Button size="xs" variant="ghost" onClick={() => setFormItem({ ...BLANK_FORM })}>
                <Plus size={12} />Add KPI
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {formItem && (
        <KPIFormModal
          item={formItem.id ? formItem : null}
          onClose={() => setFormItem(null)}
          onSaved={refresh}
        />
      )}
      {archiveTarget && (
        <ArchiveConfirmModal
          item={archiveTarget}
          usageCount={countKPIUsage(archiveTarget.id)}
          onClose={() => setArchiveTarget(null)}
          onConfirm={() => handleArchive(archiveTarget)}
        />
      )}
    </div>
  );
}
