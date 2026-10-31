import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import { useUser } from '../../context/UserContext.jsx';
import { login } from '../../api/auth.js';
import { getErrorMessage } from '../../api/client.js';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import { ArrowRight, UserCheck, Brain, Wand2, ShieldCheck } from 'lucide-react';

const POINTS = [
  { icon: Brain, title: 'Remembers why you get it wrong', text: 'Every mistake is stored with the evidence behind it.' },
  { icon: Wand2, title: 'Changes how it teaches', text: 'Explanations switch style based on what worked for you before.' },
  { icon: ShieldCheck, title: 'You control the memory', text: 'Edit or forget anything in the Memory Vault.' },
];

const inputClass =
  'w-full rounded-full border border-white/10 bg-[#3b1d6e]/60 px-5 py-3 text-sm text-white placeholder-violet-200/50 focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-300 transition';

export default function Login() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user, setUser } = useUser();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await login({ name: name.trim(), email: email.trim() });
      const userData = res.data.user;
      setUser(userData);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(getErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setName('Demo Student');
    setEmail('demo@intelliprep.dev');
    try {
      setLoading(true);
      setError(null);
      const res = await login({ name: 'Demo Student', email: 'demo@intelliprep.dev' });
      const userData = res.data.user;
      setUser(userData);
      navigate('/dashboard');
    } catch (err) {
      console.error('Demo login error:', err);
      setError(getErrorMessage(err, 'Demo login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <Layout bare>
      <div className="min-h-screen grid lg:grid-cols-2 items-center gap-10 px-6 py-10 lg:px-16 max-w-7xl mx-auto">
        <section className="max-w-lg">
          <div className="orb w-24 h-24 mb-8" aria-hidden="true" />
          <p className="text-5xl lg:text-6xl font-black tracking-tight text-white">
            IntelliPrep<span className="text-violet-300">.</span>
          </p>
          <h1 className="mt-5 text-xl lg:text-2xl font-bold leading-snug text-slate-200">
            The DSA mentor that remembers how you learn.
          </h1>
          <ul className="mt-9 space-y-5">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="bubble w-11 h-11 shrink-0">
                  <Icon className="w-5 h-5" />
                </span>
                <span>
                  <span className="block text-sm font-extrabold text-white">{title}</span>
                  <span className="block text-sm text-slate-400">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full max-w-md justify-self-center lg:justify-self-end glass rounded-[36px] p-8 lg:p-10 shadow-2xl">
          <h2 className="text-2xl font-black text-white">Log in</h2>
          <p className="text-sm text-slate-400 mt-1">No password needed. Your email is your account.</p>

          {error && <ErrorBanner error={error} onDismiss={() => setError(null)} className="mt-5" />}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-name" className="block text-xs font-bold text-slate-300 mb-1.5 ml-4">
                Name
              </label>
              <input
                id="login-name"
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="login-email" className="block text-xs font-bold text-slate-300 mb-1.5 ml-4">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-pill w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 text-sm shadow-lg shadow-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-60"
            >
              {loading ? 'Logging in…' : 'Log in'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={handleQuickDemoLogin}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-3.5 text-sm font-bold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-60 transition"
          >
            <span className="bubble w-7 h-7">
              <UserCheck className="w-4 h-4" />
            </span>
            Use the demo account
          </button>
          <p className="mt-2 text-center text-xs text-slate-500">demo@intelliprep.dev</p>
        </section>
      </div>
    </Layout>
  );
}
