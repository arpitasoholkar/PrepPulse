import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquareText, Code2, Brain, LogOut } from 'lucide-react';
import { useUser } from '../context/UserContext.jsx';

const NAV = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/mentor', label: 'Mentor', icon: MessageSquareText },
  { to: '/practice', label: 'Practice', icon: Code2 },
  { to: '/vault', label: 'Memory Vault', icon: Brain },
];

// Waveform mark, drawn as rounded bars.
function LogoMark() {
  const bars = [10, 18, 26, 36, 28, 40, 24, 32, 16, 8];
  return (
    <Link to="/" aria-label="IntelliPrep home" className="block">
      <svg width="48" height="44" viewBox="0 0 48 44" fill="none" aria-hidden="true">
        {bars.map((h, i) => (
          <rect key={i} x={2 + i * 4.6} y={22 - h / 2} width="2.4" height={h} rx="1.2" fill="#d9ccff" opacity={0.55 + (h / 40) * 0.45} />
        ))}
      </svg>
    </Link>
  );
}

export default function Navbar() {
  const { setUser } = useUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    setUser(null);
    navigate('/login');
  };

  return (
    <>
      {/* Desktop: floating pill with icon bubbles */}
      <aside className="hidden lg:flex flex-col items-center w-[88px] shrink-0 sticky top-5 h-[calc(100vh-2.5rem)] rounded-[36px] glass py-7">
        <LogoMark />

        <nav aria-label="Main" className="mt-12 flex flex-col items-center gap-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              className="group relative focus:outline-none"
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute -left-[22px] top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-violet-400" />
                  )}
                  <span
                    className={`bubble w-12 h-12 group-focus-visible:ring-2 group-focus-visible:ring-violet-300 ${
                      isActive ? 'bubble-active' : ''
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-4 whitespace-nowrap rounded-full glass-strong px-3 py-1.5 text-xs font-bold text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity z-50">
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
            className="bubble w-12 h-12 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Mobile: floating bubble bar */}
      <nav
        aria-label="Main"
        className="lg:hidden fixed bottom-3 inset-x-3 z-40 flex items-center justify-around rounded-full glass-strong px-3 py-2 shadow-2xl pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} aria-label={label} title={label}>
            {({ isActive }) => (
              <span className={`bubble w-12 h-12 ${isActive ? 'bubble-active' : ''}`}>
                <Icon className="w-5 h-5" />
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
