import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import { useUser } from '../../context/UserContext.jsx';
import { login } from '../../api/auth.js';
import { Brain, Sparkles, ArrowRight, UserCheck } from 'lucide-react';

export default function Login() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { setUser } = useUser();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setError('Please provide an email address.');
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
      setError(err.response?.data?.error?.message || 'Login failed. Please verify the server is running.');
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
      setError(err.response?.data?.error?.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-indigo-950/70 border border-indigo-800/80 rounded-2xl text-indigo-400 mb-3 shadow-inner">
              <Brain className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Welcome to IntelliPrep
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              AI-Powered SDE Interview Mentor & Cognitive Memory Vault
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Your Name
              </label>
              <input
                type="text"
                placeholder="e.g. Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="e.g. jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition flex items-center justify-center space-x-1.5"
            >
              <span>{loading ? 'Signing in...' : 'Sign In / Register'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-slate-900 text-slate-500 uppercase tracking-wider text-[10px]">
                Or jump in instantly
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleQuickDemoLogin}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition flex items-center justify-center space-x-2"
          >
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Continue as Demo Student (demo@intelliprep.dev)</span>
          </button>
        </div>
      </div>
    </Layout>
  );
}
