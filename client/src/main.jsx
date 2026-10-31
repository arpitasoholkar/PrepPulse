import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import Loader from './components/Loader.jsx';
import './index.css';

// Splash: the animated logo covers the app while it boots. The app mounts underneath
// straight away (so data requests start immediately); the splash stays long enough for
// the logo intro to play, waits for the page to finish loading, then fades out.
const SPLASH_MS = 2600;
const SPLASH_MS_REDUCED = 600; // prefers-reduced-motion: static logo, short pause
const FADE_MS = 500;

function Boot() {
  const [phase, setPhase] = useState('show'); // show -> fade -> done

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const minMs = reduced ? SPLASH_MS_REDUCED : SPLASH_MS;
    const start = performance.now();
    let cancelled = false;
    let t1;
    let t2;

    const loaded =
      document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));

    loaded.then(() => {
      if (cancelled) return;
      t1 = setTimeout(() => {
        setPhase('fade');
        t2 = setTimeout(() => setPhase('done'), FADE_MS);
      }, Math.max(0, minMs - (performance.now() - start)));
    });

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <>
      <App />
      {phase !== 'done' && (
        <div
          className="fixed inset-0 z-[100] transition-opacity ease-out"
          style={{
            opacity: phase === 'fade' ? 0 : 1,
            transitionDuration: `${FADE_MS}ms`,
            pointerEvents: phase === 'fade' ? 'none' : 'auto',
          }}
        >
          <Loader fullPage label="" />
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Boot />
  </React.StrictMode>
);