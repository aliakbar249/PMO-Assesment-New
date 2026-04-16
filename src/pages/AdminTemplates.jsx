import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { getTemplates, saveTemplates } from '../lib/supabase';
import { Button, Card, Input, Textarea, Alert, Badge, Modal, PageHeader } from '../components/UI';
import { Plus, Edit3, Trash2, Save, Settings, CheckCircle, GripVertical } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// ─── Statement row editor ──────────────────────────────────────
function StatementEditor({ stmt, sectionIdx, stmtIdx, onChange, onDelete }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 group">
      <GripVertical size={14} className="text-gray-300 mt-2 flex-shrink-0" />
      <span className="text-xs text-gray-400 font-bold mt-2 flex-shrink-0 w-5">{stmtIdx + 1}.</span>
      <input value={stmt.text} onChange={e => onChange(sectionIdx, stmtIdx, 'text', e.target.value)}
        className="flex-1 text-sm text-gray-700 bg-transparent border-none outline-none focus:bg-white focus:border focus:border-indigo-200 focus:rounded-lg focus:px-2 focus:py-1 transition-all" />
      <button onClick={() => onDelete(sectionIdx, stmtIdx)}
        className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 mt-1">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

export default function AdminTemplates() {
  const { refresh, tick } = useApp();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    getTemplates().then(tpls => {
      setSections(tpls || []);
      setLoading(false);
    });
  }, [tick]);
  const [addSectionModal, setAddSectionModal] = useState(false);
  const [newSection, setNewSection] = useState({ title: '', description: '', selfTip: '', reviewerTip: '' });
  const [editSectionModal, setEditSectionModal] = useState(null);
  const [deleteSectionModal, setDeleteSectionModal] = useState(null);

  const handleStatementChange = (sIdx, stIdx, field, value) => {
    setSections(prev => prev.map((sec, si) =>
      si !== sIdx ? sec : { ...sec, statements: sec.statements.map((st, ti) => ti !== stIdx ? st : { ...st, [field]: value }) }
    ));
    setSaved(false);
  };

  const handleDeleteStatement = (sIdx, stIdx) => {
    setSections(prev => prev.map((sec, si) => si !== sIdx ? sec : { ...sec, statements: sec.statements.filter((_, ti) => ti !== stIdx) }));
    setSaved(false);
  };

  const handleAddStatement = (sIdx) => {
    setSections(prev => prev.map((sec, si) => si !== sIdx ? sec : {
      ...sec, statements: [...sec.statements, { id: `stmt_${uuidv4().substring(0, 8)}`, text: 'New statement — click to edit' }]
    }));
    setSaved(false);
  };

  const handleSectionMetaChange = (sIdx, field, value) => {
    setSections(prev => prev.map((sec, si) => si !== sIdx ? sec : { ...sec, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    await saveTemplates(sections);
    refresh();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAddSection = () => {
    if (!newSection.title.trim()) return;
    const id = newSection.title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
    setSections(prev => [...prev, { id: `${id}_${uuidv4().substring(0, 6)}`, ...newSection, statements: [] }]);
    setNewSection({ title: '', description: '', selfTip: '', reviewerTip: '' });
    setAddSectionModal(false);
    setSaved(false);
  };

  const handleDeleteSection = (sIdx) => {
    setSections(prev => prev.filter((_, i) => i !== sIdx));
    setDeleteSectionModal(null);
    setSaved(false);
  };

  const [openSection, setOpenSection] = useState(null);

  return (
    <div>
      <PageHeader
        title="Assessment Templates"
        subtitle="Manage competency sections and statements. Changes affect all new assessments."
        action={
          <div className="flex gap-2">
            {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle size={14} />Saved</span>}
            <Button onClick={() => setAddSectionModal(true)} variant="secondary" size="sm"><Plus size={15} />Add Section</Button>
            <Button onClick={handleSave} size="sm"><Save size={15} />Save All Changes</Button>
          </div>
        }
      />

      <Alert type="info" className="mb-4">
        <strong>Note:</strong> Changes to sections and statements will apply to employees who have not yet started their assessment. Existing in-progress or submitted assessments will not be affected.
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
                <input value={sec.title} onChange={e => handleSectionMetaChange(sIdx, 'title', e.target.value)}
                  className="text-base font-bold text-gray-800 bg-transparent border-b-2 border-transparent focus:border-indigo-300 outline-none w-full transition-all" />
                <input value={sec.description || ''} onChange={e => handleSectionMetaChange(sIdx, 'description', e.target.value)}
                  placeholder="Section description…"
                  className="text-xs text-gray-500 bg-transparent border-b border-transparent focus:border-gray-300 outline-none w-full mt-0.5 transition-all" />
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="xs" variant="ghost" onClick={() => setOpenSection(openSection === sIdx ? null : sIdx)}>
                  {openSection === sIdx ? 'Collapse' : 'Edit Tips'}
                </Button>
                <Button size="xs" variant="danger" onClick={() => setDeleteSectionModal(sIdx)}><Trash2 size={12} /></Button>
              </div>
            </div>

            {/* Tip fields (collapsible) */}
            {openSection === sIdx && (
              <div className="px-5 py-4 border-b border-gray-100 bg-indigo-50/30 grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Self-Rating Tip / Guidance</label>
                  <textarea value={sec.selfTip || ''} onChange={e => handleSectionMetaChange(sIdx, 'selfTip', e.target.value)}
                    placeholder="Guidance shown to the employee when self-rating this section…"
                    rows={4} className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reviewer Tip / Guidance</label>
                  <textarea value={sec.reviewerTip || ''} onChange={e => handleSectionMetaChange(sIdx, 'reviewerTip', e.target.value)}
                    placeholder="Guidance shown to external reviewers when rating this section…"
                    rows={4} className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white resize-none" />
                </div>
              </div>
            )}

            {/* Statements */}
            <div className="p-5 space-y-2">
              {sec.statements.map((stmt, stIdx) => (
                <StatementEditor key={stmt.id} stmt={stmt} sectionIdx={sIdx} stmtIdx={stIdx}
                  onChange={handleStatementChange} onDelete={handleDeleteStatement} />
              ))}
              <button onClick={() => handleAddStatement(sIdx)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:text-indigo-600 hover:border-indigo-300 transition-all">
                <Plus size={13} />Add Statement
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Section Modal */}
      <Modal open={addSectionModal} onClose={() => setAddSectionModal(false)} title="Add New Section" size="lg">
        <div className="space-y-3">
          <Input label="Section Title" placeholder="e.g., Stakeholder Engagement" value={newSection.title} onChange={e => setNewSection(s => ({ ...s, title: e.target.value }))} required />
          <Input label="Short Description" placeholder="What this section measures…" value={newSection.description} onChange={e => setNewSection(s => ({ ...s, description: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Self-Rating Tip</label>
            <textarea value={newSection.selfTip} onChange={e => setNewSection(s => ({ ...s, selfTip: e.target.value }))}
              placeholder="Guidance for employee self-rating…" rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reviewer Tip</label>
            <textarea value={newSection.reviewerTip} onChange={e => setNewSection(s => ({ ...s, reviewerTip: e.target.value }))}
              placeholder="Guidance for external reviewers…" rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white resize-none" />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setAddSectionModal(false)}>Cancel</Button>
            <Button onClick={handleAddSection} disabled={!newSection.title.trim()}><Plus size={14} />Add Section</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Section Modal */}
      <Modal open={deleteSectionModal !== null} onClose={() => setDeleteSectionModal(null)} title="Delete Section?" size="sm">
        <p className="text-sm text-gray-600 mb-4">This will permanently remove the section and all its statements. This cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteSectionModal(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => handleDeleteSection(deleteSectionModal)}><Trash2 size={14} />Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
