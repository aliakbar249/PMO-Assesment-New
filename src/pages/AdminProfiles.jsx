import { useState, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { getAllReviewers, approveReviewer, rejectReviewer, updateReviewer } from '../store/db';
import { Button, Card, Badge, Input, Alert, Modal, PageHeader } from '../components/UI';
import { CheckCircle, X, Edit3, User, ChevronDown, ChevronUp, Shield } from 'lucide-react';

const STATUS_COLORS = { pending: 'warning', approved: 'success', rejected: 'danger' };
const CATEGORY_LABELS = { sponsor: 'Sponsor', supervisor: 'Supervisor', peer: 'Peer', client: 'Client', teamMember: 'Team Member' };

function ReviewerCard({ reviewer, onApprove, onReject, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`border rounded-2xl overflow-hidden ${reviewer.status === 'pending' ? 'border-amber-200 bg-amber-50/30' : reviewer.status === 'approved' ? 'border-emerald-200 bg-emerald-50/20' : 'border-red-200 bg-red-50/20'}`}>
      <div className="p-4 flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-300 to-indigo-500 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">{reviewer.name?.[0]?.toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-800">{reviewer.name}</span>
                <Badge variant={STATUS_COLORS[reviewer.status] || 'default'}>{reviewer.status?.toUpperCase()}</Badge>
                <Badge variant="info">{CATEGORY_LABELS[reviewer.category] || reviewer.category}</Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{reviewer.designation}{reviewer.department ? ` · ${reviewer.department}` : ''}</p>
              <p className="text-xs text-gray-500">{reviewer.email}</p>
              {reviewer.phone && <p className="text-xs text-gray-400">{reviewer.phone}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {reviewer.status === 'pending' && (
                <>
                  <Button size="xs" variant="ghost" onClick={() => onEdit(reviewer)}><Edit3 size={12} />Edit</Button>
                  <Button size="xs" variant="danger" onClick={() => onReject(reviewer.id)}><X size={12} />Reject</Button>
                  <Button size="xs" variant="success" onClick={() => onApprove(reviewer.id)}><CheckCircle size={12} />Approve</Button>
                </>
              )}
              {reviewer.status === 'approved' && <Badge variant="success" size="sm"><CheckCircle size={11} className="mr-1" />Active</Badge>}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            <span>For: <strong>{reviewer.forEmployeeName}</strong></span>
            {reviewer.assignmentId && <span>Assignment linked</span>}
            <button onClick={() => setExpanded(!expanded)} className="text-indigo-600 flex items-center gap-1">
              Details {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
          {expanded && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {[['Role on Assignment', reviewer.role], ['Created', reviewer.createdAt?.substring(0, 10)],
                ['Approved', reviewer.approvedAt?.substring(0, 10)], ['Rejected', reviewer.rejectedAt?.substring(0, 10)],
                ['Reason', reviewer.rejectionReason]].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="bg-white rounded-xl p-2 border border-gray-200">
                  <div className="text-gray-400 font-medium">{k}</div>
                  <div className="text-gray-700 mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          )}
          {reviewer.status === 'approved' && reviewer.userId && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
              <Shield size={11} />Account active · Temp password: <code className="bg-emerald-100 px-1.5 py-0.5 rounded">{reviewer.name?.split(' ')[0]?.toLowerCase()}@360</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EditReviewerModal({ reviewer, onSave, onClose }) {
  const [form, setForm] = useState({ name: reviewer.name, designation: reviewer.designation, department: reviewer.department, email: reviewer.email, phone: reviewer.phone || '', role: reviewer.role || '' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div className="space-y-3">
      <Alert type="info">Correct any inaccurate details before approving this reviewer profile.</Alert>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Full Name" value={form.name} onChange={set('name')} required />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
        <Input label="Designation" value={form.designation} onChange={set('designation')} />
        <Input label="Department" value={form.department} onChange={set('department')} />
        <Input label="Phone" value={form.phone} onChange={set('phone')} />
        <Input label="Role on Assignment" value={form.role} onChange={set('role')} />
      </div>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(form)}>Save Changes</Button>
      </div>
    </div>
  );
}

export default function AdminProfiles() {
  const { refresh } = useApp();
  const [filter, setFilter] = useState('pending');
  const [editModal, setEditModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [notification, setNotification] = useState('');

  const allReviewers = useMemo(() => getAllReviewers(), [refresh]);
  const displayed = filter === 'all' ? allReviewers : allReviewers.filter(r => r.status === filter);

  const notify = msg => { setNotification(msg); setTimeout(() => setNotification(''), 3000); };

  const handleApprove = (id) => {
    approveReviewer(id);
    refresh();
    notify('Reviewer approved. Login credentials generated.');
  };

  const handleReject = (id) => {
    rejectReviewer(id, rejectReason);
    refresh();
    setRejectModal(null);
    setRejectReason('');
    notify('Reviewer rejected.');
  };

  const handleEdit = (reviewer) => setEditModal(reviewer);

  const handleSaveEdit = (updates) => {
    updateReviewer(editModal.id, updates);
    refresh();
    setEditModal(null);
    notify('Reviewer profile updated.');
  };

  const counts = { pending: allReviewers.filter(r => r.status === 'pending').length, approved: allReviewers.filter(r => r.status === 'approved').length, rejected: allReviewers.filter(r => r.status === 'rejected').length };

  return (
    <div>
      <PageHeader title="Manage Reviewer Profiles" subtitle="Review and approve nominated reviewer profiles before they can access the tool." />

      {notification && <Alert type="success" className="mb-4">{notification}</Alert>}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[['pending', 'Pending', counts.pending], ['approved', 'Approved', counts.approved], ['rejected', 'Rejected', counts.rejected], ['all', 'All', allReviewers.length]].map(([val, label, count]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-1.5
              ${filter === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'}`}>
            {label} <span className={`px-1.5 py-0.5 rounded-full text-xs ${filter === val ? 'bg-white/20' : 'bg-gray-100'}`}>{count}</span>
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-gray-500">No {filter === 'all' ? '' : filter} reviewer profiles found.</div></Card>
      ) : (
        <div className="space-y-3">
          {displayed.map(r => (
            <ReviewerCard key={r.id} reviewer={r}
              onApprove={handleApprove}
              onReject={(id) => { setRejectModal(id); setRejectReason(''); }}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Edit modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Reviewer Profile" size="lg">
        {editModal && <EditReviewerModal reviewer={editModal} onSave={handleSaveEdit} onClose={() => setEditModal(null)} />}
      </Modal>

      {/* Reject modal */}
      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Reviewer Profile?" size="sm">
        <Input label="Reason for rejection (optional)" placeholder="Incorrect details provided…" value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="mb-4" />
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setRejectModal(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => handleReject(rejectModal)}><X size={14} />Reject</Button>
        </div>
      </Modal>
    </div>
  );
}
