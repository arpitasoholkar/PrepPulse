import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext.jsx';
import { resetDemo } from '../api/dashboard.js';

export default function Navbar() {
  const { user } = useUser();

  const handleReset = async () => {
    if (window.confirm('Reset demo data for this account?')) {
      try {
        await resetDemo();
        window.location.reload();
      } catch (err) {
        alert('Failed to reset demo');
      }
    }
  };

  return (
    <nav className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between border-b border-slate-800">
      <div className="flex items-center space-x-6">
        <Link to="/" className="text-xl font-bold tracking-tight text-indigo-400">IntelliPrep</Link>
        <Link to="/mentor" className="text-sm font-medium hover:text-indigo-300">Mentor</Link>
        <Link to="/practice" className="text-sm font-medium hover:text-indigo-300">Practice</Link>
        <Link to="/vault" className="text-sm font-medium hover:text-indigo-300">Vault</Link>
        <Link to="/dashboard" className="text-sm font-medium hover:text-indigo-300">Dashboard</Link>
      </div>
      <div className="flex items-center space-x-4">
        {user ? (
          <span className="text-xs bg-slate-800 border border-slate-700 px-2 py-1 rounded text-slate-300">
            {user.name} ({user.email})
          </span>
        ) : (
          <Link to="/login" className="text-sm text-indigo-400">Login</Link>
        )}
        <button
          onClick={handleReset}
          className="text-xs bg-rose-900/40 text-rose-300 border border-rose-800 px-2 py-1 rounded hover:bg-rose-800/60"
        >
          Reset Demo
        </button>
      </div>
    </nav>
  );
}
