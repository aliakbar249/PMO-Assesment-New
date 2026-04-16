import { useState } from 'react';
import { Star, ArrowLeft, CheckCircle } from 'lucide-react';
import { registerEmployee } from '../lib/supabase';
import { useApp } from '../store/AppContext';
import { Button, Input, Select, Alert } from '../components/UI';

const DEPARTMENTS = ['Engineering', 'Project Management', 'Operations', 'Finance', 'HR', 'Sales', 'Marketing', 'IT', 'Legal', 'Procurement', 'Other'];
const LEVELS = ['Junior', 'Mid-Level', 'Senior', 'Lead', 'Manager', 'Senior Manager', 'Director', 'VP', 'C-Suite'];

export default function RegisterPage({ onBack }) {
  const { login } = useApp();
  const [step, setStep] = useState(1); // 1=account, 2=professional, 3=done
  const [form, setForm] = useState({
    // Account
    email: '', password: '', confirmPassword: '', name: '',
    // Professional
    employeeCode: '', jobTitle: '', department: '', level: '', organization: '',
    phone: '', reportsTo: '', location: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: '' })); };

  const validateStep1 = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Minimum 6 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (!form.jobTitle.trim()) e.jobTitle = 'Job title is required';
    if (!form.department) e.department = 'Department is required';
    if (!form.organization.trim()) e.organization = 'Organization is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;
    setLoading(true);
    setServerError('');
    const result = await registerEmployee(form);
    if (!result.success) { setServerError(result.error); setLoading(false); return; }
    setStep(3);
    setLoading(false);
    // Auto-login after 1.5s
    setTimeout(() => login(result.user), 1500);
  };

  if (step === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Account Created!</h2>
          <p className="text-sm text-gray-500">Welcome, <strong>{form.name}</strong>. Redirecting you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Star size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Create Employee Account</h1>
          <p className="text-indigo-300 text-sm mt-1">360° Power Skills Assessment</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Steps */}
          <div className="flex items-center mb-6">
            {['Account Details', 'Professional Info'].map((s, i) => (
              <div key={i} className="flex items-center">
                <div className={`flex items-center gap-2 text-sm font-medium ${step === i+1 ? 'text-indigo-600' : step > i+1 ? 'text-emerald-600' : 'text-gray-400'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === i+1 ? 'bg-indigo-600 text-white' : step > i+1 ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {step > i+1 ? '✓' : i+1}
                  </div>
                  <span className="hidden sm:block">{s}</span>
                </div>
                {i === 0 && <div className={`h-0.5 w-8 mx-2 ${step > 1 ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {serverError && <Alert type="error" className="mb-4">{serverError}</Alert>}

          {step === 1 && (
            <div className="space-y-4">
              <Input label="Full Name" placeholder="John Smith" value={form.name} onChange={set('name')} error={errors.name} required />
              <Input label="Work Email" type="email" placeholder="john@company.com" value={form.email} onChange={set('email')} error={errors.email} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Password" type="password" placeholder="Min. 6 chars" value={form.password} onChange={set('password')} error={errors.password} required />
                <Input label="Confirm Password" type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} required />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={onBack} className="flex-shrink-0"><ArrowLeft size={16} />Back</Button>
                <Button onClick={handleNext} className="flex-1">Continue →</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Employee Code" placeholder="EMP001" value={form.employeeCode} onChange={set('employeeCode')} hint="Optional" />
                <Input label="Job Title" placeholder="Project Manager" value={form.jobTitle} onChange={set('jobTitle')} error={errors.jobTitle} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Department" value={form.department} onChange={set('department')} error={errors.department} required>
                  <option value="">Select department</option>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </Select>
                <Select label="Level / Grade" value={form.level} onChange={set('level')}>
                  <option value="">Select level</option>
                  {LEVELS.map(l => <option key={l}>{l}</option>)}
                </Select>
              </div>
              <Input label="Organization / Company" placeholder="Acme Corp" value={form.organization} onChange={set('organization')} error={errors.organization} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Phone" type="tel" placeholder="+1 555 0000" value={form.phone} onChange={set('phone')} />
                <Input label="Location / Office" placeholder="New York" value={form.location} onChange={set('location')} />
              </div>
              <Input label="Reports To (Manager Name)" placeholder="Jane Doe" value={form.reportsTo} onChange={set('reportsTo')} />
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setStep(1)} className="flex-shrink-0"><ArrowLeft size={16} />Back</Button>
                <Button onClick={handleSubmit} className="flex-1" disabled={loading}>{loading ? 'Creating…' : 'Create Account'}</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
