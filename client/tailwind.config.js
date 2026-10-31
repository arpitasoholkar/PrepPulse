import colors from 'tailwindcss/colors';

/**
 * The app moved from a dark theme to the light Eduplex look. The existing pages
 * were written with dark-theme shades (text-slate-300, bg-rose-950/60 ...), so
 * those palettes are flipped here: light shades become dark and the other way
 * round. Solid button shades (500 to 700) stay as they are.
 * New code should prefer the `ink`, `lime` and `lav` colors below.
 */
const KEYS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const FULL = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 600, 500: 500, 600: 400, 700: 300, 800: 200, 900: 100, 950: 50 };
const SOFT = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 600, 500: 500, 600: 600, 700: 700, 800: 200, 900: 100, 950: 50 };

const flip = (palette, map) => Object.fromEntries(KEYS.map((k) => [k, palette[map[k]]]));

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#1f1f38', soft: '#6b6b85', line: '#ececf2' },
        lime: { DEFAULT: '#d9f26e', deep: '#c6e04a' },
        lav: { DEFAULT: '#c4a8f7', soft: '#e4e1fb' },
        peach: '#fde3d6',
        slate: flip(colors.slate, FULL),
        rose: flip(colors.rose, SOFT),
        amber: flip(colors.amber, SOFT),
        emerald: flip(colors.emerald, SOFT),
        indigo: flip(colors.indigo, SOFT),
        violet: flip(colors.violet, SOFT),
        cyan: flip(colors.cyan, SOFT),
        fuchsia: flip(colors.fuchsia, SOFT),
        sky: flip(colors.sky, SOFT),
        teal: flip(colors.teal, SOFT),
        blue: flip(colors.blue, SOFT),
      },
    },
  },
  plugins: [],
};
