import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import {
  getAllEmployees, updateEmployee, getAssessment, getAssignmentsByEmployee,
  getNominations, getAllReviewers
} from '../lib/supabase';
import {
  Button, Card, Input, Select, Alert, Badge, PageHeader,
  Modal, EmptyState
} from '../components/UI';
import {
  Users, Edit3, Eye, UserCheck, UserX, Search,
  CheckCircle, Clock, AlertCircle, Briefcase, Star, Mail, Phone, Building2
} from 'lucide-react';

const DEPARTMENTS = ['Engineering', 'Project Management', 'Operations', 'Finance', 'HR', 'Sales', 'Marketing', 'IT', 'Legal', 'Procurement', 'Other'];
const LEVELS = ['Junior', 'Mid-Level', 'Senior', 'Lead', 'Manager', 'Senior Manager', 'Director', 'VP', 'C-Suite'];
const STATUS_OPTIONS = ['active', 'inactive', 'suspended'];

const STATUS_CONFIG = {
  active:    { label: 'Active',    variant: 'success', icon: UserCheck },
  inactive:  { label: 'Inactive',  variant: 'default', icon: Clock },
  suspended: { label: 'Suspended', variant: 'danger',  icon: UserX },
};

function EmployeeModal({ employee, onSave, onClose }) {
  const [tab,         setTab]         = useState('details');
  const [form,        setForm]        = useState({ ...employee });
  const [saved,       setSaved]       = useState(false);
  const [assessment,  setAssessment]  = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [nominations, setNominations] = useState(null);
  const [reviewers,   setReviewers]   = useState([]);

  useEffect(() => {
    Promise.all([
      getAssessment(employee.id),
      getAssignmentsByEmployee(employee.id),
      getNominations(employee.id),
      getAllReviewers(),
    ]).then(([a, asgns, noms, revs]) => {
      setAssessment(a);
      setAssignments(asgns || []);
      setNominations(noms);
      setReviewers((revs || []).filter(r => r.employeeId === employee.id));
    });
  }, [employee.id]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    await onSave(employee.id, form);
    setSaved(true);
    setTimeout(() => { setSaved(false); setTab('details'); }, 1500);
  };

  const approvedRevs = reviewers.filter(r => r.approvalStatus === 'approved');
  const pendingRevs  = reviewers.filter(r => r.approvalStatus === 'pending');

  return (
    <div>
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl">
        {[['details', 'Profile Details'], ['assessment', 'Assessment Status'], ['edit', 'Edit Profile']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${tab === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-50 to-white rounded-2xl border border-indigo-100">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl font-bold">{employee.name?.[0]?.toUpperCase()}</span>
            </div>
            <div>
              <h3 className="font-bold text-gray-800">{employee.name}</h3>
              <p className="text-sm text-gray-500">{employee.jobTitle} · {employee.department}</p>
              <div className="flex gap-2 mt-1">
                <Badge variant={STATUS_CONFIG[employee.status || 'active']?.variant || 'success'}>
                  {STATUS_CONFIG[employee.status || 'active']?.label || 'Active'}
                </Badge>
                {employee.level && <Badge variant="default">{employee.level}</Badge>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Mail,      label: 'Email',        val: employee.email },
              { icon: Phone,     label: 'Phone',        val: employee.phone || '—' },
              { icon: Building2, label: 'Organization', val: employee.organization },
              { icon: Users,     label: 'Reports To',   val: employee.manager || '—' },
              { icon: Star,      label: 'Employee ID',  val: employee.employeeId || '—' },
              { icon: Briefcase, label: 'Location',     val: employee.location || '—' },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-0.5">
                  <Icon size={11} />{label}
                </div>
                <div className="text-sm text-gray-700 font-medium truncate">{val}</div>
              </div>
            ))}
          </div>

          <div className="p-4 border border-gray-200 rounded-2xl">
            <p className="text-xs font-semibold text-gray-600 mb-2">Account Status</p>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(s => {
                const cfg = STATUS_CONFIG[s];
                const isActive = (employee.status || 'active') === s;
                return (
                  <button key={s} onClick={() => onSave(employee.id, { status: s })}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border-2 transition-all flex items-center justify-center gap-1
                      ${isActive ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    <cfg.icon size={12} />{cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'assessment' && (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-indigo-800">Self-Assessment</span>
              <Badge variant={assessment?.status === 'submitted' ? 'success' : assessment ? 'warning' : 'default'}>
                {assessment?.status === 'submitted' ? 'Submitted' : assessment ? 'In Progress' : 'Not Started'}
              </Badge>
            </div>
            {assessment?.updatedAt && <div className="text-xs text-indigo-600">Last updated: {assessment.updatedAt?.substring(0, 10)}</div>}
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-amber-800">Assignments</span>
              <Badge variant={assignments.length > 0 ? 'success' : 'default'}>{assignments.length} / 3</Badge>
            </div>
            {assignments.map(a => (
              <div key={a.id} className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                <Briefcase size={10} />{a.title} · {a.role} · <span className="text-amber-500">{a.status}</span>
              </div>
            ))}
          </div>

          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-emerald-800">Nominations</span>
              <Badge variant={nominations?.submitted ? 'success' : 'warning'}>
                {nominations?.submitted ? 'Submitted' : nominations ? 'In Progress' : 'Not Started'}
              </Badge>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-blue-800">Reviewers</span>
              <div className="flex gap-2">
                <Badge variant="success">{approvedRevs.length} approved</Badge>
                {pendingRevs.length > 0 && <Badge variant="warning">{pendingRevs.length} pending</Badge>}
              </div>
            </div>
            {reviewers.length > 0 ? (
              <div className="space-y-1.5">
                {reviewers.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-2.5 py-1.5 border border-blue-100">
                    <div>
                      <span className="font-medium text-gray-700">{r.name}</span>
                      <span className="text-gray-400 ml-1">· {r.designation}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Badge variant="info" size="xs">{r.category}</Badge>
                      <Badge variant={STATUS_CONFIG[r.approvalStatus]?.variant || 'default'} size="xs">{r.approvalStatus}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-blue-600">No reviewers nominated yet.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'edit' && (
        <div className="space-y-4">
          {saved && <Alert type="success"><div className="flex items-center gap-2"><CheckCircle size={14} />Profile updated successfully.</div></Alert>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Name" value={form.name || ''} onChange={set('name')} required />
            <Input label="Job Title" value={form.jobTitle || ''} onChange={set('jobTitle')} required />
            <Select label="Department" value={form.department || ''} onChange={set('department')}>
              <option value="">Select</option>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </Select>
            <Input label="Organization" value={form.organization || ''} onChange={set('organization')} />
            <Select label="Level" value={form.level || ''} onChange={set('level')}>
              <option value="">Select</option>
              {LEVELS.map(l => <option key={l}>{l}</option>)}
            </Select>
            <Input label="Phone" value={form.phone || ''} onChange={set('phone')} />
            <Input label="Location" value={form.location || ''} onChange={set('location')} />
            <Input label="Reports To" value={form.manager || ''} onChange={set('manager')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Status</label>
            <Select value={form.status || 'active'} onChange={set('status')}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminEmployees() {
  const { refresh, tick } = useApp();
  const [employees,    setEmployees]    = useState([]);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter,   setDeptFilter]   = useState('all');
  const [viewModal,    setViewModal]    = useState(null);
  const [notification, setNotification] = useState('');
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    setLoading(true);
    getAllEmployees().then(emps => {
      setEmployees(emps || []);
      setLoading(false);
    });
  }, [tick]);

  const notify = msg => { setNotification(msg); setTimeout(() => setNotification(''), 3000); refresh(); };

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase()) ||
      e.jobTitle?.toLowerCase().includes(search.toLowerCase()) ||
      e.department?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || (e.status || 'active') === statusFilter;
    const matchDept   = deptFilter === 'all' || e.department === deptFilter;
    return matchSearch && matchStatus && matchDept;
  });

  const handleSave = async (empId, updates) => {
    await updateEmployee(empId, updates);
    notify('Employee profile updated.');
    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, ...updates } : e));
    if (viewModal?.id === empId) setViewModal(prev => ({ ...prev, ...updates }));
  };

  const depts = [...new Set(employees.map(e => e.department).filter(Boolean))];
  const counts = {
    active:    employees.filter(e => (e.status || 'active') === 'active').length,
    inactive:  employees.filter(e => e.status === 'inactive').length,
    suspended: employees.filter(e => e.status === 'suspended').length,
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading employees…</div>;

  return (
    <div>
      <PageHeader
        title="Employee Management"
        subtitle="View, edit, and manage registered employee profiles. Employees self-register via the portal."
      />

      {notification && (
        <Alert type="success" className="mb-4"><div className="flex items-center gap-2"><CheckCircle size={14} />{notification}</div></Alert>
      )}

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total', value: employees.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Active', value: counts.active, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Inactive / Suspended', value: counts.inactive + counts.suspended, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center border border-white`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search by name, email, title, department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 bg-white"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white">
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white">
          <option value="all">All Departments</option>
          {depts.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No employees found"
            description={employees.length === 0 ? "No employees have registered yet." : "No employees match your search/filter criteria."} />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(emp => {
            const statusCfg = STATUS_CONFIG[emp.status || 'active'];
            return (
              <div key={emp.id}
                className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4 hover:border-indigo-200 hover:shadow-sm transition-all">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">{emp.name?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-800">{emp.name}</span>
                    <Badge variant={statusCfg.variant} size="xs">{statusCfg.label}</Badge>
                    {emp.level && <Badge variant="default" size="xs">{emp.level}</Badge>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{emp.jobTitle} · {emp.department} · {emp.organization}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{emp.email}</div>
                </div>
                <div className="hidden md:flex items-center gap-3 flex-shrink-0 text-xs text-gray-400">
                  Joined {emp.createdAt?.substring(0, 10)}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="xs" variant="secondary" onClick={() => setViewModal(emp)}>
                    <Eye size={13} />View
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setViewModal(emp)}>
                    <Edit3 size={13} />Edit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-400 text-right">
        Showing {filtered.length} of {employees.length} employees
      </div>

      {viewModal && (
        <Modal open={!!viewModal} onClose={() => setViewModal(null)}
          title={`${viewModal.name} — Employee Profile`} size="lg">
          <EmployeeModal
            employee={viewModal}
            onSave={handleSave}
            onClose={() => setViewModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
