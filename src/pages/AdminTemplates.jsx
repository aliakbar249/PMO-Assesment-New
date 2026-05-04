import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import {
  getTemplates, saveTemplates,
  getAssessmentTemplates, saveAssessmentTemplates, deleteAssessmentTemplate
} from '../lib/supabase';
import { Button, Card, Input, Badge, Modal, PageHeader, Alert } from '../components/UI';
import {
  Plus, Trash2, Save, CheckCircle, GripVertical, Settings,
  Layers, ChevronDown, ChevronUp, Edit3, Copy, Target, Users, AlertCircle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const LEVELS = ['Junior', 'Mid-Level', 'Senior', 'Lead', 'Manager', 'Senior Manager', 'Director', 'VP', 'C-Suite'];
const DEPARTMENTS = ['Engineering', 'Project Management', 'Operations', 'Finance', 'HR', 'Sales', 'Marketing', 'IT', 'Legal', 'Procurement', 'Other'];

// ─── Statement row editor ──────────────────────────────────────
function StatementEditor({ stmt, sectionIdx, stmtIdx, onChange, onDelete }) {
  const [showTips, setShowTips] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl bg-white group">
      <div className="flex items-start gap-2 p-3">
        <GripVertical size={14} className="text-gray-300 mt-2 flex-shrink-0" />
        <span className="text-xs text-gray-400 font-bold mt-2 flex-shrink-0 w-5">{stmtIdx + 1}.</span>
        <input
          value={stmt.text}
          onChange={e => onChange(sectionIdx, stmtIdx, 'text', e.target.value)}
          className="flex-1 text-sm text-gray-700 bg-transparent border-none outline-none focus:bg-gray-50 focus:px-2 focus:py-1 rounded-lg transition-all"
          placeholder="Statement text…"
        />
        <div className="flex gap-1 flex-shrink-0 ml-1">
          <button
            onClick={() => setShowTips(s => !s)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all"
            title="Edit tips for this statement"
          >
            <Edit3 size={12} />
          </button>
          <button
            onClick={() => onDelete(sectionIdx, stmtIdx)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {showTips && (
        <div className="px-4 pb-3 pt-1 grid sm:grid-cols-2 gap-3 border-t border-gray-100 bg-indigo-50/30">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Self-Rating Tip (for this statement)</label>
            <textarea
              value={stmt.selfTip || ''}
              onChange={e => onChange(sectionIdx, stmtIdx, 'selfTip', e.target.value)}
              placeholder="Optional: guidance for employee when rating this statement…"
              rows={2}
              className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Reviewer Tip (for this statement)</label>
            <textarea
              value={stmt.reviewerTip || ''}
              onChange={e => onChange(sectionIdx, stmtIdx, 'reviewerTip', e.target.value)}
              placeholder="Optional: guidance for external reviewer when rating this statement…"
              rows={2}
              className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Assessment Template Card ──────────────────────────────────
function AssessmentTemplateCard({ template, allSections, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`border rounded-2xl overflow-hidden ${template.isDefault ? 'border-indigo-200 bg-indigo-50/20' : 'border-gray-200 bg-white'}`}>
      <div className="p-4 flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${template.isDefault ? 'bg-indigo-100' : 'bg-gray-100'}`}>
          <Layers size={18} className={template.isDefault ? 'text-indigo-600' : 'text-gray-500'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-800">{template.name}</span>
            {template.isDefault && <Badge variant="primary">Default</Badge>}
            <Badge variant="default">{template.sectionIds?.length || 0} sections</Badge>
          </div>
          {template.description && <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>}
          <div className="flex gap-2 mt-1.5 flex-wrap">
            {template.targetLevels?.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Target size={10} />
                Levels: {template.targetLevels.join(', ')}
              </div>
            )}
            {template.targetDepartments?.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Users size={10} />
                Depts: {template.targetDepartments.join(', ')}
              </div>
            )}
            {(!template.targetLevels?.length && !template.targetDepartments?.length && !template.isDefault) && (
              <span className="text-xs text-amber-600">⚠ No targeting rules set</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="xs" variant="ghost" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => onEdit(template)}>
            <Edit3 size={12} />Edit
          </Button>
          {!template.isDefault && (
            <Button size="xs" variant="danger" onClick={() => onDelete(template.id)}>
              <Trash2 size={12} />
            </Button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-2 mt-3">Included Sections:</p>
          <div className="space-y-1">
            {(template.sectionIds || []).map(sid => {
              const sec = allSections.find(s => s.id === sid);
              return sec ? (
                <div key={sid} className="flex items-center gap-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                  <CheckCircle size={10} className="text-emerald-500" />
                  {sec.title}
                  <span className="text-gray-400 ml-auto">{sec.statements?.length} statements</span>
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Assessment Template Form Modal ───────────────────────────
function TemplateFormModal({ template, allSections, onSave, onClose, saving, saveError }) {
  const [form, setForm] = useState({
    id: template?.id || null,
    name: template?.name || '',
    description: template?.description || '',
    isDefault: template?.isDefault || false,
    targetLevels: template?.targetLevels || [],
    targetDepartments: template?.targetDepartments || [],
    sectionIds: template?.sectionIds || allSections.map(s => s.id),
  });

  const toggleLevel = (lvl) => {
    setForm(f => ({
      ...f,
      targetLevels: f.targetLevels.includes(lvl)
        ? f.targetLevels.filter(l => l !== lvl)
        : [...f.targetLevels, lvl],
    }));
  };

  const toggleDept = (dept) => {
    setForm(f => ({
      ...f,
      targetDepartments: f.targetDepartments.includes(dept)
        ? f.targetDepartments.filter(d => d !== dept)
        : [...f.targetDepartments, dept],
    }));
  };

  const toggleSection = (sid) => {
    setForm(f => ({
      ...f,
      sectionIds: f.sectionIds.includes(sid)
        ? f.sectionIds.filter(id => id !== sid)
        : [...f.sectionIds, sid],
    }));
  };

  return (
    <div className="space-y-4">
      <Input
        label="Template Name"
        placeholder="e.g., Senior Manager Assessment"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        required
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Brief description of this template…"
          rows={2}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white resize-none"
        />
      </div>

      {/* Sections to include */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Included Sections</label>
        <div className="space-y-2">
          {allSections.map(sec => (
            <label key={sec.id} className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.sectionIds.includes(sec.id)}
                onChange={() => toggleSection(sec.id)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">{sec.title}</div>
                <div className="text-xs text-gray-500">{sec.statements?.length} statements</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Target levels */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Target Levels <span className="text-xs text-gray-400 font-normal">(leave empty to apply to all)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map(lvl => (
            <button
              key={lvl}
              type="button"
              onClick={() => toggleLevel(lvl)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all
                ${form.targetLevels.includes(lvl)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'}`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Target departments */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Target Departments <span className="text-xs text-gray-400 font-normal">(leave empty to apply to all)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {DEPARTMENTS.map(dept => (
            <button
              key={dept}
              type="button"
              onClick={() => toggleDept(dept)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all
                ${form.targetDepartments.includes(dept)
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-purple-300'}`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {saveError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{saveError}</span>
        </div>
      )}
      <div className="flex gap-3 justify-end pt-2">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || form.sectionIds.length === 0 || saving}
        >
          <Save size={14} />{saving ? 'Saving…' : template ? 'Update Template' : 'Create Template'}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────
export default function AdminTemplates() {
  const { refresh, tick } = useApp();
  const [activeTab, setActiveTab] = useState('sections'); // 'sections' | 'templates'
  const [sections, setSections] = useState([]);
  const [assessmentTemplates, setAssessmentTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [savingTemplates, setSavingTemplates] = useState(false);

  // Section modals
  const [addSectionModal, setAddSectionModal] = useState(false);
  const [newSection, setNewSection] = useState({ title: '', description: '', selfTip: '', reviewerTip: '' });
  const [deleteSectionModal, setDeleteSectionModal] = useState(null);
  const [openSection, setOpenSection] = useState(null);

  // Assessment template modals
  const [templateModal, setTemplateModal] = useState(null); // null | 'new' | templateObj
  const [deleteTemplateModal, setDeleteTemplateModal] = useState(null);
  const [templateSaveError, setTemplateSaveError] = useState('');
  const [templateSaved, setTemplateSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getTemplates(), getAssessmentTemplates()]).then(([tpls, atpls]) => {
      setSections(tpls || []);
      setAssessmentTemplates(atpls || []);
      setLoading(false);
    });
  }, [tick]);

  // ── Section handlers ──────────────────────────────────────
  const handleStatementChange = (sIdx, stIdx, field, value) => {
    setSections(prev => prev.map((sec, si) =>
      si !== sIdx ? sec : {
        ...sec,
        statements: sec.statements.map((st, ti) => ti !== stIdx ? st : { ...st, [field]: value })
      }
    ));
    setSaved(false);
  };

  const handleDeleteStatement = (sIdx, stIdx) => {
    setSections(prev => prev.map((sec, si) =>
      si !== sIdx ? sec : { ...sec, statements: sec.statements.filter((_, ti) => ti !== stIdx) }
    ));
    setSaved(false);
  };

  const handleAddStatement = (sIdx) => {
    setSections(prev => prev.map((sec, si) =>
      si !== sIdx ? sec : {
        ...sec,
        statements: [...sec.statements, {
          id: `stmt_${uuidv4().substring(0, 8)}`,
          text: 'New statement — click to edit',
          selfTip: '',
          reviewerTip: '',
        }]
      }
    ));
    setSaved(false);
  };

  const handleSectionMetaChange = (sIdx, field, value) => {
    setSections(prev => prev.map((sec, si) => si !== sIdx ? sec : { ...sec, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSavingTemplates(true);
    await saveTemplates(sections);
    refresh();
    setSaved(true);
    setSavingTemplates(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAddSection = () => {
    if (!newSection.title.trim()) return;
    const id = newSection.title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
    setSections(prev => [...prev, {
      id: `${id}_${uuidv4().substring(0, 6)}`,
      ...newSection,
      statements: []
    }]);
    setNewSection({ title: '', description: '', selfTip: '', reviewerTip: '' });
    setAddSectionModal(false);
    setSaved(false);
  };

  const handleDeleteSection = (sIdx) => {
    setSections(prev => prev.filter((_, i) => i !== sIdx));
    setDeleteSectionModal(null);
    setSaved(false);
  };

  // ── Assessment Template handlers ───────────────────────────
  const handleSaveAssessmentTemplate = async (form) => {
    setSavingTemplates(true);
    setTemplateSaveError('');
    const result = await saveAssessmentTemplates([form]);
    if (result && !result.success) {
      setSavingTemplates(false);
      setTemplateSaveError(result.error || 'Failed to save template. Check console for details.');
      return; // keep modal open so admin can see the error
    }
    // Reload the list fresh from DB
    const atpls = await getAssessmentTemplates();
    setAssessmentTemplates(atpls || []);
    setSavingTemplates(false);
    setTemplateModal(null);
    setTemplateSaveError('');
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 3000);
    refresh();
  };

  const handleDeleteTemplate = async (templateId) => {
    await deleteAssessmentTemplate(templateId);
    setAssessmentTemplates(prev => prev.filter(t => t.id !== templateId));
    setDeleteTemplateModal(null);
    refresh();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading templates…</div>;
  }

  return (
    <div>
      <PageHeader
        title="Assessment Templates"
        subtitle="Manage competency sections, statements, and assessment templates for different roles."
        action={
          activeTab === 'sections' ? (
            <div className="flex gap-2 items-center">
              {saved && (
                <span className="text-sm text-emerald-600 flex items-center gap-1">
                  <CheckCircle size={14} />Saved
                </span>
              )}
              <Button onClick={() => setAddSectionModal(true)} variant="secondary" size="sm">
                <Plus size={15} />Add Section
              </Button>
              <Button onClick={handleSave} size="sm" disabled={savingTemplates}>
                <Save size={15} />{savingTemplates ? 'Saving…' : 'Save All Changes'}
              </Button>
            </div>
          ) : (
            <Button onClick={() => setTemplateModal('new')} size="sm">
              <Plus size={15} />New Template
            </Button>
          )
        }
      />

      {/* Tab nav */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-2xl w-fit">
        {[
          { key: 'sections', label: 'Sections & Statements', icon: Settings },
          { key: 'templates', label: 'Assessment Templates', icon: Layers },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
              activeTab === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── SECTIONS TAB ─────────────────────────────────────── */}
      {activeTab === 'sections' && (
        <>
          <Alert type="info" className="mb-4">
            <strong>Note:</strong> Changes to sections and statements will apply to new assessments. In-progress or submitted assessments are not affected.
          </Alert>

          <div className="space-y-4">
            {sections.map((sec, sIdx) => (
              <Card key={sec.id}>
                {/* Section header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="primary">Section {sIdx + 1}</Badge>
                      <Badge variant="default">{sec.statements.length} statements</Badge>
                    </div>
                    <input
                      value={sec.title}
                      onChange={e => handleSectionMetaChange(sIdx, 'title', e.target.value)}
                      className="text-base font-bold text-gray-800 bg-transparent border-b-2 border-transparent focus:border-indigo-300 outline-none w-full transition-all"
                    />
                    <input
                      value={sec.description || ''}
                      onChange={e => handleSectionMetaChange(sIdx, 'description', e.target.value)}
                      placeholder="Section description…"
                      className="text-xs text-gray-500 bg-transparent border-b border-transparent focus:border-gray-300 outline-none w-full mt-0.5 transition-all"
                    />
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="xs" variant="ghost" onClick={() => setOpenSection(openSection === sIdx ? null : sIdx)}>
                      {openSection === sIdx ? 'Hide Tips' : 'Edit Tips'}
                    </Button>
                    <Button size="xs" variant="danger" onClick={() => setDeleteSectionModal(sIdx)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>

                {/* Section-level tip fields (collapsible) */}
                {openSection === sIdx && (
                  <div className="px-5 py-4 border-b border-gray-100 bg-indigo-50/30 grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Self-Rating Tip / Guidance
                        <span className="text-gray-400 font-normal ml-1">(shown to employees when self-rating)</span>
                      </label>
                      <textarea
                        value={sec.selfTip || ''}
                        onChange={e => handleSectionMetaChange(sIdx, 'selfTip', e.target.value)}
                        placeholder="e.g., 'Think about real situations where you demonstrated or fell short on these behaviours...'"
                        rows={4}
                        className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Reviewer Tip / Guidance
                        <span className="text-gray-400 font-normal ml-1">(shown to stakeholders when rating)</span>
                      </label>
                      <textarea
                        value={sec.reviewerTip || ''}
                        onChange={e => handleSectionMetaChange(sIdx, 'reviewerTip', e.target.value)}
                        placeholder="e.g., 'Rate based on observable behaviours you have directly witnessed. Use Not Observed if you haven't had enough opportunity...'"
                        rows={4}
                        className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Statements */}
                <div className="p-5 space-y-2">
                  {sec.statements.map((stmt, stIdx) => (
                    <StatementEditor
                      key={stmt.id}
                      stmt={stmt}
                      sectionIdx={sIdx}
                      stmtIdx={stIdx}
                      onChange={handleStatementChange}
                      onDelete={handleDeleteStatement}
                    />
                  ))}
                  <button
                    onClick={() => handleAddStatement(sIdx)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:text-indigo-600 hover:border-indigo-300 transition-all"
                  >
                    <Plus size={13} />Add Statement
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ── ASSESSMENT TEMPLATES TAB ────────────────────────── */}
      {activeTab === 'templates' && (
        <>
          <Alert type="info" className="mb-4">
            <strong>Assessment Templates</strong> define which sections are shown for each assessment cycle. Create different templates for different employee levels or departments. Employees are automatically matched to a template based on their profile; the <em>Standard Assessment</em> is the fallback for everyone.
          </Alert>
          {templateSaved && (
            <Alert type="success" className="mb-4">
              <div className="flex items-center gap-2"><CheckCircle size={14} />Template saved successfully.</div>
            </Alert>
          )}

          <div className="space-y-3">
            {assessmentTemplates.map(tmpl => (
              <AssessmentTemplateCard
                key={tmpl.id}
                template={tmpl}
                allSections={sections}
                onEdit={(t) => setTemplateModal(t)}
                onDelete={(id) => setDeleteTemplateModal(id)}
              />
            ))}
            {assessmentTemplates.length === 0 && (
              <div className="text-center py-10 text-sm text-gray-400">
                No assessment templates found. Create one to get started.
              </div>
            )}
          </div>
        </>
      )}

      {/* ── MODALS ────────────────────────────────────────────── */}

      {/* Add Section Modal */}
      <Modal open={addSectionModal} onClose={() => setAddSectionModal(false)} title="Add New Section" size="lg">
        <div className="space-y-3">
          <Input
            label="Section Title"
            placeholder="e.g., Stakeholder Engagement"
            value={newSection.title}
            onChange={e => setNewSection(s => ({ ...s, title: e.target.value }))}
            required
          />
          <Input
            label="Short Description"
            placeholder="What this section measures…"
            value={newSection.description}
            onChange={e => setNewSection(s => ({ ...s, description: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Self-Rating Tip
              <span className="text-gray-400 font-normal ml-1">(guidance for employee self-rating)</span>
            </label>
            <textarea
              value={newSection.selfTip}
              onChange={e => setNewSection(s => ({ ...s, selfTip: e.target.value }))}
              placeholder="Guidance for employee self-rating…"
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Reviewer Tip
              <span className="text-gray-400 font-normal ml-1">(guidance for external reviewers)</span>
            </label>
            <textarea
              value={newSection.reviewerTip}
              onChange={e => setNewSection(s => ({ ...s, reviewerTip: e.target.value }))}
              placeholder="Guidance for external reviewers…"
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setAddSectionModal(false)}>Cancel</Button>
            <Button onClick={handleAddSection} disabled={!newSection.title.trim()}>
              <Plus size={14} />Add Section
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Section Modal */}
      <Modal open={deleteSectionModal !== null} onClose={() => setDeleteSectionModal(null)} title="Delete Section?" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          This will permanently remove the section and all its statements. This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteSectionModal(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => handleDeleteSection(deleteSectionModal)}>
            <Trash2 size={14} />Delete Section
          </Button>
        </div>
      </Modal>

      {/* Assessment Template Modal (new / edit) */}
      <Modal
        open={!!templateModal}
        onClose={() => { setTemplateModal(null); setTemplateSaveError(''); }}
        title={templateModal === 'new' ? 'Create Assessment Template' : 'Edit Assessment Template'}
        size="lg"
      >
        {templateModal && (
          <TemplateFormModal
            template={templateModal === 'new' ? null : templateModal}
            allSections={sections}
            onSave={handleSaveAssessmentTemplate}
            onClose={() => { setTemplateModal(null); setTemplateSaveError(''); }}
            saving={savingTemplates}
            saveError={templateSaveError}
          />
        )}
      </Modal>

      {/* Delete Assessment Template Modal */}
      <Modal open={!!deleteTemplateModal} onClose={() => setDeleteTemplateModal(null)} title="Delete Template?" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          This will permanently delete this assessment template. Employees currently matched to it will fall back to the Standard Assessment.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTemplateModal(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => handleDeleteTemplate(deleteTemplateModal)}>
            <Trash2 size={14} />Delete Template
          </Button>
        </div>
      </Modal>
    </div>
  );
}
