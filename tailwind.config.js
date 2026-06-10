/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: '#8B1A2B',
          50: '#F9EAEC',
          100: '#EFC5CB',
          200: '#DC8A96',
          300: '#C95062',
          400: '#A82338',
          500: '#8B1A2B',
          600: '#6E1522',
          700: '#511019',
          800: '#340A10',
          900: '#170508',
        },
        accent: {
          DEFAULT: '#2C2C2C',
          50: '#F5F5F5',
          100: '#E0E0E0',
          200: '#BDBDBD',
          300: '#9E9E9E',
          400: '#757575',
          500: '#2C2C2C',
          600: '#212121',
          700: '#1A1A1A',
          800: '#121212',
          900: '#0A0A0A',
        },
        beige: {
          DEFAULT: '#F5EFE6',
          50: '#FDFAF6',
          100: '#F5EFE6',
          200: '#E8D5C0',
          300: '#D9BB9A',
          400: '#C9A074',
          500: '#B8854E',
          600: '#9A6D3E',
          700: '#7C562F',
          800: '#5E3F21',
          900: '#3F2813',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(139, 26, 43, 0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(139, 26, 43, 0.12), 0 2px 4px rgba(0,0,0,0.06)',
        modal: '0 20px 60px rgba(139, 26, 43, 0.18), 0 8px 16px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};