import { useState } from 'react';
import { Eye, EyeOff, AlertCircle, Mail, KeyRound, CheckCircle, ArrowLeft, Copy, Shield } from 'lucide-react';
import { authenticate, requestPasswordReset, changePassword } from '../lib/supabase';
import { useApp } from '../store/AppContext';
import { Button, Input, Alert, Divider } from '../components/UI';

// ─── Forgot Password Panel ────────────────────────────────────
function ForgotPassword({ onBack }) {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null); // { success, tempPassword, name, email, error }
  const [copied, setCopied]   = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const res = await requestPasswordReset(email.trim());
    setResult(res);
    setLoading(false);
  };

  const copyPassword = () => {
    navigator.clipboard?.writeText(result.tempPassword).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors hover:opacity-70" style={{color: '#1e2d4a'}}>
        <ArrowLeft size={15} /> Back to Sign In
      </button>

      <div className="bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <KeyRound size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Reset Password</h2>
            <p className="text-xs text-gray-500">Enter your registered email address to receive a reset link</p>
          </div>
        </div>

        {!result ? (
          <form onSubmit={handleRequest} className="space-y-4">
            <Alert type="info" className="mb-2">
              <div className="flex items-start gap-2">
                <Shield size={14} className="mt-0.5 flex-shrink-0" />
                <span className="text-xs">
                  A temporary password will be generated and sent to your email. In production, this would trigger an automated email delivery. Use the temporary password to sign in, then set a new password immediately.
                </span>
              </div>
            </Alert>
            <Input
              label="Registered Email Address"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" size="lg" disabled={loading || !email.trim()}>
              {loading ? 'Processing…' : <><Mail size={16} /> Send Reset Email</>}
            </Button>
          </form>
        ) : result.success ? (
          <div>
            {/* Success banner */}
            <Alert type="success" className="mb-5">
              <div className="flex items-center gap-2 font-medium mb-1">
                <CheckCircle size={15} /> Reset email sent to <strong>{result.email}</strong>
              </div>
              <p className="text-xs mt-1 text-emerald-700">
                In production, a secure reset link would be delivered to your inbox. Below is your temporary password for immediate access.
              </p>
            </Alert>

            {/* Simulated email preview */}
            <div className="border-2 border-dashed border-indigo-200 rounded-2xl p-5 mb-5 bg-indigo-50/30">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-indigo-100">
                <Mail size={14} className="text-indigo-400" />
                <div className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-600">To:</span> {result.email} &nbsp;·&nbsp;
                  <span className="font-semibold text-gray-600">Subject:</span> Your 360° Assessment — Password Reset
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-3">Dear <strong>{result.name}</strong>,</p>
              <p className="text-sm text-gray-600 mb-4">
                We received a request to reset your password for the <strong>360° Assessment Tool</strong>. Use the temporary password below to sign in:
              </p>
              <div className="flex items-center justify-between bg-white border-2 border-indigo-300 rounded-xl px-4 py-3 mb-4 shadow-sm">
                <code className="text-lg font-bold tracking-widest text-indigo-700">{result.tempPassword}</code>
                <button onClick={copyPassword}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-3 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50">
                  {copied ? <><CheckCircle size={13} className="text-emerald-600" /> Copied!</> : <><Copy size={13} /> Copy</>}
                </button>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                <p className="text-xs text-amber-800 font-medium">⚠ Important:</p>
                <ul className="text-xs text-amber-700 mt-1 space-y-0.5 list-disc list-inside">
                  <li>Use this temporary password to sign in immediately</li>
                  <li>You will be prompted to set a new password upon login</li>
                  <li>This temporary password expires in 24 hours</li>
                </ul>
              </div>
              <p className="text-xs text-gray-400 border-t border-indigo-100 pt-3">
                If you did not request this reset, please contact your System Administrator immediately.
              </p>
            </div>

            <Button className="w-full" onClick={onBack}>
              <ArrowLeft size={15} /> Back to Sign In
            </Button>
          </div>
        ) : (
          <div>
            <Alert type="error" className="mb-5">
              <div className="flex items-center gap-2"><AlertCircle size={14} />{result.error}</div>
            </Alert>
            <Button variant="secondary" className="w-full" onClick={() => setResult(null)}>Try Again</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Change Password Banner (shown after reset) ───────────────
function ChangePasswordBanner({ userId, onDone }) {
  const [form, setForm]   = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone]   = useState(false);
  const { refresh } = useApp();

  const handleChange = async () => {
    if (form.password.length < 6) { setError('Minimum 6 characters.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    await changePassword(userId, form.password);
    refresh();
    setDone(true);
    setTimeout(onDone, 1500);
  };

  if (done) return (
    <Alert type="success" className="mb-4">
      <div className="flex items-center gap-2"><CheckCircle size={14} />Password updated successfully!</div>
    </Alert>
  );

  return (
    <div className="mb-5 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl">
      <div className="flex items-center gap-2 mb-3">
        <KeyRound size={16} className="text-amber-600" />
        <span className="text-sm font-semibold text-amber-800">Please set a new password</span>
      </div>
      <p className="text-xs text-amber-700 mb-3">You signed in with a temporary password. Please choose a new password to continue.</p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Input type="password" placeholder="New password" value={form.password} onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError(''); }} />
        <Input type="password" placeholder="Confirm password" value={form.confirm} onChange={e => { setForm(f => ({ ...f, confirm: e.target.value })); setError(''); }} />
      </div>
      <Button size="sm" variant="warning" onClick={handleChange}>Update Password</Button>
    </div>
  );
}

// ─── Main Login Page ──────────────────────────────────────────
export default function LoginPage({ onRegister }) {
  const { login, currentUser, refresh } = useApp();
  const [mode, setMode]     = useState('login'); // 'login' | 'forgot'
  const [form, setForm]     = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    const user = await authenticate(form.email.trim(), form.password);
    if (!user) { setError('Invalid email or password. Please try again.'); setLoading(false); return; }
    // If password was reset, show change password prompt first
    if (user.passwordReset || user.password_reset) {
      setLoggedInUser(user);
      setLoading(false);
      return;
    }
    login(user);
  };

  const fillDemo = (email, pw) => { setForm({ email, password: pw }); setError(''); };

  // ── Change password flow after temp login ─────────────────
  if (loggedInUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #f8f6f0 0%, #eee8d8 40%, #e8e0cc 100%)'}}>
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <img src="/optem-logo.png" alt="Optem Consulting" className="h-24 mx-auto mb-3" />
            <p className="text-sm font-medium" style={{color: '#8a7340'}}>Power Skills Performance Platform</p>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <ChangePasswordBanner userId={loggedInUser.id} onDone={() => login(loggedInUser)} />
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot password mode ──────────────────────────────────
  if (mode === 'forgot') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #f8f6f0 0%, #eee8d8 40%, #e8e0cc 100%)'}}>
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <img src="/optem-logo.png" alt="Optem Consulting" className="h-24 mx-auto mb-3" />
            <p className="text-sm font-medium" style={{color: '#8a7340'}}>Power Skills Performance Platform</p>
          </div>
          <ForgotPassword onBack={() => setMode('login')} />
        </div>
      </div>
    );
  }

  // ── Normal login ──────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #f8f6f0 0%, #eee8d8 40%, #e8e0cc 100%)'}}>
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <img src="/optem-logo.png" alt="Optem Consulting" className="h-28 mx-auto mb-4" />
          <h1 className="text-2xl font-bold" style={{color: '#1e2d4a'}}>360° Assessment Tool</h1>
          <p className="text-sm mt-1 font-medium" style={{color: '#8a7340'}}>Power Skills Performance Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-6">Sign In</h2>

          {error && (
            <Alert type="error" className="mb-4">
              <div className="flex items-center gap-2"><AlertCircle size={14} />{error}</div>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email Address" type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} required />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Password <span className="text-red-500">*</span></label>
                <button type="button" onClick={() => setMode('forgot')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set('password')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-indigo-400 focus:ring-indigo-100 bg-white pr-10"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold text-gray-600 mb-2">Demo Account</p>
            <button onClick={() => fillDemo('admin@company.com', 'Admin@123')}
              className="w-full text-left px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all">
              <span className="text-xs font-medium text-indigo-600">Admin</span>
              <span className="text-xs text-gray-500 ml-2">admin@company.com</span>
              <span className="text-xs text-gray-400 ml-2">/ Admin@123</span>
            </button>
            <p className="text-xs text-gray-400 mt-2">Employee accounts are created by the administrator.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
