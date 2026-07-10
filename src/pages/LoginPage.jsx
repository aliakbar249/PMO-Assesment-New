import { useState } from 'react';
import { Eye, EyeOff, AlertCircle, Mail, KeyRound, CheckCircle, ArrowLeft, Copy, Shield } from 'lucide-react';
import { authenticate, requestPasswordReset, changePassword } from '../lib/supabase';
import { useApp } from '../store/AppContext';
import { Button, Input, Alert } from '../components/UI';

// ─── Shared card shell — teal header + white body ─────────────
function LoginCard({ headerContent, children, footerContent }) {
  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Card */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl border border-gray-100">

        {/* Teal header */}
        <div className="relative text-center px-8 pt-8 pb-7" style={{ background: '#01A2B1' }}>
          {headerContent}
          {/* Curved bottom edge */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-white"
            style={{ height: 20, borderRadius: '50% 50% 0 0 / 100% 100% 0 0' }}
          />
        </div>

        {/* White body */}
        <div className="px-8 pt-5 pb-6">
          {children}
        </div>

        {/* Footer */}
        {footerContent && (
          <div className="px-8 pt-3 pb-5 border-t border-gray-100 text-center">
            {footerContent}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Logo block (used in every card header) ───────────────────
function LogoBlock() {
  return (
    <div className="inline-flex flex-col items-center gap-2.5 mb-1">
      {/* Optem Consulting logo — falls back to OA hex monogram if image missing */}
      <img
        src="/optem-logo.png"
        alt="Optem Consulting"
        className="h-16 w-auto object-contain"
        onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }}
      />
      {/* Hex monogram fallback — hidden by default, shown via onError above */}
      <svg style={{ display: 'none' }} width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="32,4 58,18 58,46 32,60 6,46 6,18" fill="rgba(255,255,255,0.12)" />
        <polygon points="32,10 54,22 54,44 32,56 10,44 10,22" fill="rgba(255,255,255,0.10)" />
        <polygon points="20,22 32,15 44,22 44,36 32,43 20,36" fill="rgba(255,255,255,0.22)" />
        <text x="32" y="38" textAnchor="middle" fontSize="16" fontWeight="700" fill="#FFFFFF" fontFamily="sans-serif">OA</text>
      </svg>
      <div className="text-white font-bold tracking-widest" style={{ fontSize: 19, letterSpacing: '0.06em' }}>OPTEM ACUITY</div>
      <div className="text-white uppercase tracking-widest" style={{ fontSize: 10, opacity: 0.75, letterSpacing: '0.08em' }}>
        Field Force Effectiveness Platform
      </div>
    </div>
  );
}

// ─── Footer content (shared across all card flows) ────────────
function CardFooter() {
  return (
    <>
      <p className="text-xs text-gray-400">
        Powered by <span className="font-medium" style={{ color: '#1675D5' }}>Optem Consulting</span>
      </p>
      <div className="flex justify-center gap-1.5 mt-2 flex-wrap">
        {['360° Assessments', 'KPI Tracking', 'Training'].map(b => (
          <span key={b} className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-gray-200">{b}</span>
        ))}
      </div>
    </>
  );
}

// ─── Forgot Password Panel ────────────────────────────────────
function ForgotPassword({ onBack }) {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
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
    <LoginCard
      headerContent={<LogoBlock />}
      footerContent={<CardFooter />}
    >
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-medium mb-4 transition-opacity hover:opacity-70"
        style={{ color: '#01A2B1' }}
      >
        <ArrowLeft size={13} /> Back to Sign In
      </button>

      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#e6f7f9' }}>
          <KeyRound size={16} style={{ color: '#01A2B1' }} />
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-800">Reset Password</div>
          <div className="text-xs text-gray-400">Enter your registered email</div>
        </div>
      </div>

      {!result ? (
        <form onSubmit={handleRequest} className="space-y-4">
          <Alert type="info">
            <div className="flex items-start gap-2">
              <Shield size={13} className="mt-0.5 flex-shrink-0" />
              <span className="text-xs">A temporary password will be generated. Use it to sign in, then set a new password immediately.</span>
            </div>
          </Alert>
          <Input
            label="Email Address"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ background: '#01A2B1' }}
          >
            {loading ? 'Processing…' : 'Send Reset Email'}
          </button>
        </form>
      ) : result.success ? (
        <div>
          <Alert type="success" className="mb-4">
            <div className="flex items-center gap-2 font-medium mb-1">
              <CheckCircle size={13} /> Sent to <strong>{result.email}</strong>
            </div>
            <p className="text-xs mt-1 text-emerald-700">Use the temporary password below to sign in immediately.</p>
          </Alert>

          <div className="border-2 border-dashed border-blue-200 rounded-xl p-4 mb-4 bg-blue-50/30">
            <p className="text-xs text-gray-500 mb-1">Dear <strong>{result.name}</strong>, your temporary password:</p>
            <div className="flex items-center justify-between bg-white border-2 border-blue-300 rounded-xl px-4 py-2.5 mb-3 shadow-sm">
              <code className="text-base font-bold tracking-widest text-blue-700">{result.tempPassword}</code>
              <button onClick={copyPassword}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium ml-3 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50">
                {copied ? <><CheckCircle size={12} className="text-emerald-600" /> Copied!</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              <p className="text-xs text-amber-800 font-medium mb-1">⚠ Important:</p>
              <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                <li>Sign in with this temporary password</li>
                <li>You will be prompted to set a new one</li>
                <li>Expires in 24 hours</li>
              </ul>
            </div>
          </div>

          <button
            onClick={onBack}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ background: '#01A2B1' }}
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <div>
          <Alert type="error" className="mb-4">
            <div className="flex items-center gap-2"><AlertCircle size={13} />{result.error}</div>
          </Alert>
          <Button variant="secondary" className="w-full" onClick={() => setResult(null)}>Try Again</Button>
        </div>
      )}
    </LoginCard>
  );
}

// ─── Change Password Flow (after temp-password login) ────────
function ChangePasswordFlow({ userId, onDone }) {
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

  return (
    <LoginCard
      headerContent={<LogoBlock />}
      footerContent={<CardFooter />}
    >
      {done ? (
        <Alert type="success">
          <div className="flex items-center gap-2"><CheckCircle size={14} />Password updated successfully!</div>
        </Alert>
      ) : (
        <>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#fef9ec' }}>
              <KeyRound size={16} className="text-amber-500" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">Set a new password</div>
              <div className="text-xs text-gray-400">You signed in with a temporary password</div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 mb-3">{error}</p>
          )}

          <div className="space-y-3 mb-4">
            <Input
              type="password"
              placeholder="New password (min 6 chars)"
              value={form.password}
              onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError(''); }}
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={form.confirm}
              onChange={e => { setForm(f => ({ ...f, confirm: e.target.value })); setError(''); }}
            />
          </div>

          <button
            onClick={handleChange}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ background: '#01A2B1' }}
          >
            Update Password
          </button>
        </>
      )}
    </LoginCard>
  );
}

// ─── Main Login Page ──────────────────────────────────────────
export default function LoginPage({ onRegister }) {
  const { login } = useApp();
  const [mode, setMode]       = useState('login'); // 'login' | 'forgot'
  const [form, setForm]       = useState({ email: '', password: '' });
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');
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
    if (user.passwordReset || user.password_reset) {
      setLoggedInUser(user);
      setLoading(false);
      return;
    }
    login(user);
  };

  const pageClass = "min-h-screen bg-white flex flex-col items-center justify-center p-4";

  // ── Change password flow ──────────────────────────────────
  if (loggedInUser) {
    return (
      <div className={pageClass}>
        <ChangePasswordFlow
          userId={loggedInUser.id}
          onDone={() => login(loggedInUser)}
        />
      </div>
    );
  }

  // ── Forgot password ───────────────────────────────────────
  if (mode === 'forgot') {
    return (
      <div className={pageClass}>
        <ForgotPassword onBack={() => setMode('login')} />
      </div>
    );
  }

  // ── Normal login ──────────────────────────────────────────
  return (
    <div className={pageClass}>
      <LoginCard
        headerContent={<LogoBlock />}
        footerContent={<CardFooter />}
      >
        {/* Heading */}
        <div className="mb-5">
          <div className="text-base font-semibold text-gray-800">Sign in to continue</div>
          <div className="text-xs text-gray-400 mt-0.5">Enter your credentials below</div>
        </div>

        {/* Error */}
        {error && (
          <Alert type="error" className="mb-4">
            <div className="flex items-center gap-2"><AlertCircle size={13} />{error}</div>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Email address</label>
            <input
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={set('email')}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-teal-400 focus:ring-teal-100 bg-gray-50 placeholder-gray-300"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-500">Password</label>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: '#01A2B1' }}
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={set('password')}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-teal-400 focus:ring-teal-100 bg-gray-50 placeholder-gray-300 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ background: '#01A2B1' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </LoginCard>
    </div>
  );
}
