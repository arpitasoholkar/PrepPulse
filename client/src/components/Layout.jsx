import React from 'react';
import Navbar from './Navbar.jsx';
import Header from './Header.jsx';
import ColdStartBanner from './ColdStartBanner.jsx';
import { RequireUser } from '../context/UserContext.jsx';

// `bare` hides the navigation and skips the login guard (used by the login page).
export default function Layout({ children, bare = false }) {
  if (bare) {
    return (
      <div className="min-h-screen app-bg text-slate-100 font-sans">
        <ColdStartBanner />
        {children}
      </div>
    );
  }

  return (
    <RequireUser>
      <div className="min-h-screen app-bg text-slate-100 font-sans p-3 lg:p-5 lg:flex lg:gap-5">
        <ColdStartBanner />
        <Navbar />
        <div className="flex-1 min-w-0 flex flex-col gap-4 lg:gap-5">
          <Header />
          <main className="flex-1 min-w-0 pb-24 lg:pb-0">{children}</main>
        </div>
      </div>
    </RequireUser>
  );
}
