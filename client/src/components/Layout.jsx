import React from 'react';
import Navbar from './Navbar.jsx';
import Header from './Header.jsx';
import ColdStartBanner from './ColdStartBanner.jsx';
import BadgeToaster from './activity/BadgeToaster.jsx';
import { RequireUser } from '../context/UserContext.jsx';

// `bare` hides the navigation and skips the login guard (used by the login page).
export default function Layout({ children, bare = false }) {
  if (bare) {
    return (
      <div className="min-h-screen app-bg skin-light text-ink font-sans">
        <ColdStartBanner />
        {children}
      </div>
    );
  }

  return (
    <RequireUser>
        <div className="min-h-screen app-bg text-ink font-sans p-2 sm:p-3 lg:p-6">
          <ColdStartBanner />
          <div className="app-shell mx-auto max-w-[1800px] rounded-[28px] lg:rounded-[44px] p-3 sm:p-4 lg:p-6 lg:flex lg:gap-7 lg:items-start min-h-[calc(100vh-1rem)] lg:min-h-[calc(100vh-3rem)]">
            <Navbar />
            <div className="skin-light flex-1 min-w-0 flex flex-col gap-4 lg:gap-4 pt-1">
              <Header />
              <main className="flex-1 min-w-0 pb-24 lg:pb-0">{children}</main>
            </div>
          </div>
          <BadgeToaster />
        </div>
    </RequireUser>
  );
}
