import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { getEmployeeByUserId, updateEmployee } from '../lib/supabase';
import { Button, Input, Select, Alert, Card, PageHeader, Badge } from '../components/UI';
import { User, CheckCircle } from 'lucide-react';

const DEPARTMENTS = ['Engineering', 'Project Management', 'Operations', 'Finance', 'HR', 'Sales', 'Marketing', 'IT', 'Legal', 'Procurement', 'Other'];
const LEVELS = ['Junior', 'Mid-Level', 'Senior', 'Lead', 'Manager', 'Senior Manager', 'Director', 'VP', 'C-Suite'];

export default function EmpProfile() {
  const { currentUser, refresh } = useApp();
  const [employee, setEmployee] = useState(null);
  const [form, setForm] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    employeeCode: '',
    jobTitle: '',
    department: '',
    level: '',
    organization: '',
    phone: '',
    manager: '',
    location: '',
    bio: '',
  });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    getEmployeeByUserId(currentUser.id).then(emp => {
      if (emp) {
        setEmployee(emp);
        setForm({
          name: emp.name || currentUser?.name || '',
          email: emp.email || currentUser?.email || '',
          employeeCode: emp.employeeId || '',
          jobTitle: emp.jobTitle || '',
          department: emp.department || '',
          level: emp.level || '',
          organization: emp.organization || '',
          phone: emp.phone || '',
          manager: emp.manager || '',
          location: emp.location || '',
          bio: emp.bio || '',
        });
      }
    });
  }, [currentUser?.id]);

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: '' })); setSaved(false); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.jobTitle.trim()) e.jobTitle = 'Required';
    if (!form.department) e.department = 'Required';
    if (!form.organization.trim()) e.organization = 'Required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSave = async () => {
    if (!validate() || !employee) return;
    setSaving(true);
    await updateEmployee(employee.id, {
      name: form.name,
      jobTitle: form.jobTitle,
      department: form.department,
      level: form.level,
      organization: form.organization,
      phone: form.phone,
      manager: form.manager,
      location: form.location,
      profileComplete: true,
    });
    refresh();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Keep your professional details up to date." />

      {saved && <Alert type="success" className="mb-4"><div className="flex items-center gap-2"><CheckCircle size={14} />Profile saved successfully.</div></Alert>}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: avatar card */}
        <Card className="p-6 flex flex-col items-center text-center lg:col-span-1 h-fit">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center mb-3">
            <span className="text-3xl font-bold text-white">{form.name?.[0]?.toUpperCase()}</span>
          </div>
          <h3 className="font-semibold text-gray-800">{form.name || '—'}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{form.jobTitle || '—'}</p>
          {form.department && <Badge variant="primary" className="mt-2">{form.department}</Badge>}
          {form.level && <Badge variant="default" className="mt-1">{form.level}</Badge>}
          <div className="mt-4 w-full text-left space-y-1.5">
            {form.organization && <p className="text-xs text-gray-600"><span className="font-medium">Org:</span> {form.organization}</p>}
            {form.location && <p className="text-xs text-gray-600"><span className="font-medium">Location:</span> {form.location}</p>}
            {form.email && <p className="text-xs text-gray-600 truncate"><span className="font-medium">Email:</span> {form.email}</p>}
            {form.phone && <p className="text-xs text-gray-600"><span className="font-medium">Phone:</span> {form.phone}</p>}
            {form.manager && <p className="text-xs text-gray-600"><span className="font-medium">Reports to:</span> {form.manager}</p>}
          </div>
        </Card>

        {/* Right: form */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><User size={16} className="text-indigo-500" />Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Full Name" value={form.name} onChange={set('name')} error={errors.name} required />
              <Input label="Email Address" type="email" value={form.email} disabled hint="Email cannot be changed" />
              <Input label="Employee Code" placeholder="EMP001" value={form.employeeCode} disabled hint="Auto-assigned" />
              <Input label="Phone" type="tel" placeholder="+1 555 0000" value={form.phone} onChange={set('phone')} />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><User size={16} className="text-indigo-500" />Professional Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Job Title" placeholder="Project Manager" value={form.jobTitle} onChange={set('jobTitle')} error={errors.jobTitle} required />
              <Select label="Department" value={form.department} onChange={set('department')} error={errors.department} required>
                <option value="">Select department</option>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </Select>
              <Input label="Organization" placeholder="Acme Corp" value={form.organization} onChange={set('organization')} error={errors.organization} required />
              <Select label="Level / Grade" value={form.level} onChange={set('level')}>
                <option value="">Select level</option>
                {LEVELS.map(l => <option key={l}>{l}</option>)}
              </Select>
              <Input label="Reports To" placeholder="Manager Name" value={form.manager} onChange={set('manager')} />
              <Input label="Office / Location" placeholder="New York" value={form.location} onChange={set('location')} />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Short Bio <span className="text-gray-400 font-normal">(optional)</span></h3>
            <textarea value={form.bio} onChange={set('bio')} rows={3} placeholder="Brief professional background…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-indigo-400 focus:ring-indigo-100 bg-white resize-none" />
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} size="lg" disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
