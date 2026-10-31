import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, RotateCcw, UserRound } from 'lucide-react';
import { useUser } from '../context/UserContext.jsx';
import { resetDemo } from '../api/dashboard.js';

export function Avatar({ name, size = 'w-12 h-12 text-base' }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span className={`grid place-items-center shrink-0 rounded-full bg-gradient-to-br from-[#EAE1F7] to-[#7652C8] font-extrabold text-white ${size}`}>
      {initial}
    </span>
  );
}

// Name, role and avatar bubble. Opens a small menu with reset and log out.
export default function UserMenu({ compact = false }) {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleReset = async () => {
    setOpen(false);
    if (window.confirm('Reset this account to the seeded demo data?')) {
      try {
        await resetDemo();
        window.location.reload();
      } catch (err) {
        alert('Could not reset the demo. Check that the server is running.');
      }
    }
  };

  const handleLogout = () => {
    setOpen(false);
    setUser(null);
    navigate('/login');
  };

  if (!user) {
    return (
      <Link to="/login" className="btn-pill px-5 py-2.5 text-sm">
        Log in
      </Link>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-3 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
      >
        {!compact && (
          <span className="hidden sm:block text-right leading-tight">
            <span className="block text-sm font-extrabold text-white">{user.name || 'Student'}</span>
            <span className="block text-xs text-slate-400">{user.targetRole || 'Student'}</span>
          </span>
        )}
        <Avatar name={user.name} size={compact ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-base'} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-3 z-50 w-60 rounded-3xl glass-strong p-2 shadow-2xl">
          <div className="px-3 pt-2 pb-2 border-b border-white/10 mb-1">
            <p className="text-sm font-bold text-white truncate">{user.name || 'Student'}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); navigate('/profile'); }}
            className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <UserRound className="w-4 h-4 text-violet-400" />
            View profile
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleReset}
            className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <RotateCcw className="w-4 h-4 text-rose-300" />
            Reset demo data
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
