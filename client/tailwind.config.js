/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
          600: '#475569',
        },
        telos: {
          // Telos Orange — brand primary accent (replaces emerald)
          orange: {
            50: '#FFF7ED',
            100: '#FFEDD5',
            200: '#FED7AA',
            300: '#FDBA74',
            400: '#FB923C',
            500: '#F37100',
            600: '#D96400',
            700: '#B45200',
            800: '#8B3E00',
            900: '#6B2F00',
          },
          // Telos Blue — brand secondary / actions (replaces blue)
          blue: {
            50: '#EFF6FF',
            100: '#DBEAFE',
            200: '#BAD5F5',
            300: '#7FB8E3',
            400: '#4A96CF',
            500: '#1D6FAD',
            600: '#004D80',
            700: '#003D66',
            800: '#002D4D',
            900: '#001D33',
          },
        },
      },
      fontSize: {
        /** 10px / 14px — fine-print labels, keyboard hints */
        xxs: ['0.625rem', { lineHeight: '0.875rem' }],
        /** 11px / 16px — secondary badges, metadata */
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      maxWidth: {
        wizard: '720px',
      },
    },
  },
  plugins: [],
};
