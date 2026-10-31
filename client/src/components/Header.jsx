import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import UserMenu from './UserMenu.jsx';
import { useUser } from '../context/UserContext.jsx';

const PAGES = {
  '/mentor': { title: 'Mentor', subtitle: 'Ask anything. It remembers how you learn.' },
  '/practice': { title: 'Practice', subtitle: 'Solve a question and the mentor learns from your mistakes' },
  '/vault': { title: 'Memory Vault', subtitle: 'Everything the mentor remembers about you' },
  '/profile': { title: 'Profile', subtitle: 'Your streak, hours and badges' },
};

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useUser() || {};
  const [query, setQuery] = useState('');

  const firstName = (user?.name || '').trim().split(' ')[0] || 'there';
  const isHome = pathname === '/dashboard';
  const page = PAGES[pathname] || { title: 'IntelliPrep', subtitle: '' };

  // Enter sends the text to the mentor as a ready to send question
  const submit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate('/mentor', { state: { prefill: q, at: Date.now() } });
    setQuery('');
  };

  return (
    <header className="flex items-center gap-4 min-h-[48px]">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl lg:text-[34px] leading-tight font-extrabold tracking-tight text-ink truncate">
          {isHome ? <>Welcome back {firstName} <span aria-hidden="true">👋</span></> : page.title}
        </h1>
        {!isHome && page.subtitle && <p className="hidden lg:block text-sm text-ink-soft truncate">{page.subtitle}</p>}
      </div>

      <form onSubmit={submit} role="search" className="hidden md:flex items-center gap-3 w-[300px] xl:w-[330px] rounded-full bg-white border border-[#ececf2] px-5 h-[46px] shadow-sm focus-within:ring-2 focus-within:ring-violet-400">
        <Search className="w-5 h-5 text-ink-soft shrink-0" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask the mentor a question"
          aria-label="Ask the mentor a question"
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-soft focus:outline-none"
        />
      </form>

      <UserMenu compact />
    </header>
  );
}
