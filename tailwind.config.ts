import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        auron: {
          primary: '#9CB080',
          secondary: '#6C91B3',
          dark: {
            bg: '#0A0A0F',
            card: '#1A1A24',
            border: 'rgba(255,255,255,0.06)',
            text: '#FFFFFF',
            textMuted: '#A0A0B0',
          },
          light: {
            bg: '#F8F9FC',
            card: '#FFFFFF',
            border: 'rgba(0,0,0,0.06)',
            text: '#1F2A3A',
            textMuted: '#6B7280',
          },
        },
      },
      fontFamily: {
        sans: ['Vazirmatn', 'Space Grotesk', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
