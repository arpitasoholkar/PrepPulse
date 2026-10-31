import React from 'react';

// Four point sparkle used as decoration
export function Sparkle({ className = '', color = '#F28A52', outline = false }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 1 C12.8 7 17 11.2 23 12 C17 12.8 12.8 17 12 23 C11.2 17 7 12.8 1 12 C7 11.2 11.2 7 12 1Z"
        fill={outline ? 'none' : color}
        stroke={outline ? color : 'none'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Small sparkle and swoosh next to the page title (top of every page except the dashboard)
export function TitleDecor({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 150 70" fill="none" aria-hidden="true">
      <path d="M20 66 C45 55 70 40 95 28 C120 16 135 12 145 4" stroke="#7652C8" strokeOpacity="0.45" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12 12 C13 20 17 24 25 25 C17 26 13 30 12 38 C11 30 7 26 -1 25 C7 24 11 20 12 12Z" fill="#7652C8" fillOpacity="0.6" />
    </svg>
  );
}

// Friendly purple planet with a face, an orbit ring and sparkles
export function MentorOrb({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 240 190" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="orbFill" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#CDB9F6" />
          <stop offset="0.55" stopColor="#9C7CE6" />
          <stop offset="1" stopColor="#7652C8" />
        </radialGradient>
        <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#EAE1F7" stopOpacity="0.9" />
          <stop offset="1" stopColor="#EAE1F7" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="95" r="88" fill="url(#orbGlow)" />
      <ellipse cx="120" cy="100" rx="98" ry="30" transform="rotate(-18 120 100)" stroke="#F28A52" strokeOpacity="0.55" strokeWidth="2" />
      <circle cx="120" cy="92" r="58" fill="url(#orbFill)" />
      <ellipse cx="100" cy="68" rx="16" ry="9" transform="rotate(-30 100 68)" fill="#fff" fillOpacity="0.3" />
      <circle cx="102" cy="92" r="4.5" fill="#251D35" />
      <circle cx="138" cy="92" r="4.5" fill="#251D35" />
      <path d="M108 108 C114 115 126 115 132 108" stroke="#251D35" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M22 118 C50 138 92 140 130 124" stroke="#F28A52" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
      <g transform="translate(34 56)"><path d="M10 0 C10.6 6 14 9.4 20 10 C14 10.6 10.6 14 10 20 C9.4 14 6 10.6 0 10 C6 9.4 9.4 6 10 0Z" fill="none" stroke="#F28A52" strokeWidth="1.6" strokeLinejoin="round" /></g>
      <g transform="translate(24 108) scale(0.6)"><path d="M10 0 C10.6 6 14 9.4 20 10 C14 10.6 10.6 14 10 20 C9.4 14 6 10.6 0 10 C6 9.4 9.4 6 10 0Z" fill="#F28A52" /></g>
      <g transform="translate(198 66) scale(0.7)"><path d="M10 0 C10.6 6 14 9.4 20 10 C14 10.6 10.6 14 10 20 C9.4 14 6 10.6 0 10 C6 9.4 9.4 6 10 0Z" fill="#F28A52" /></g>
      <g transform="translate(176 14)"><path d="M10 0 C10.6 6 14 9.4 20 10 C14 10.6 10.6 14 10 20 C9.4 14 6 10.6 0 10 C6 9.4 9.4 6 10 0Z" fill="none" stroke="#7652C8" strokeOpacity="0.5" strokeWidth="1.6" strokeLinejoin="round" /></g>
    </svg>
  );
}

// Soft leaves in the corner of a panel
export function Leaves({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 200 260" fill="none" aria-hidden="true">
      <path d="M100 260 C100 190 105 120 130 30" stroke="#7652C8" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
      <path d="M130 30 C165 55 170 105 128 135 C100 100 105 60 130 30Z" fill="#EAE1F7" fillOpacity="0.9" />
      <path d="M108 140 C145 150 165 190 120 225 C85 200 85 165 108 140Z" fill="#EAE1F7" fillOpacity="0.9" />
      <path d="M104 170 C70 165 45 130 65 95 C100 100 115 135 104 170Z" fill="#EAE1F7" fillOpacity="0.75" />
      <path d="M118 90 C90 85 70 60 85 35 C112 40 125 65 118 90Z" fill="#EAE1F7" fillOpacity="0.75" />
    </svg>
  );
}
