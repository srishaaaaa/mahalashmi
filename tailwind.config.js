/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain:    '#FBFAF6', // Warm luxury linen surface
        cardBg:    '#FFFFFF',
        brand: {
          black:      '#0A0A0A',
          dark:       '#141414',
          gold:       '#D4AF37',
          goldHover:  '#B8952E',
          goldLight:  '#FBF3DC',
          goldBorder: '#E8D9A0',
        },
        gold: {
          DEFAULT: '#D4AF37',
          dark:    '#8A6D1E',
          light:   '#FBF3DC',
          border:  '#E8D9A0',
        },
        maroon: {
          DEFAULT: '#D4AF37', // Remapped to store Green
          dark:    '#0A0A0A', // Remapped to Black
          light:   '#FBF3DC',
        },
        forestDark: '#123524',
        sage:       '#8FBF9F',
        sageDark:   '#2F6B44',
        textMain:  '#111111',
        textMuted: '#6B7280',
        borderLight: '#E5E7EB', // Neutral clean border
      },
      fontFamily: {
        sans:      ['"DM Sans"', '"Outfit"', '"Noto Sans Tamil"', 'system-ui', '-apple-system', 'sans-serif'],
        dmsans:    ['"DM Sans"', 'sans-serif'],
        'dm-sans': ['"DM Sans"', 'sans-serif'],
        outfit:    ['"Outfit"', 'sans-serif'],
        brand:     ['"Cinzel"', '"DM Sans"', '"Outfit"', '"Noto Sans Tamil"', 'serif'],
        headline:  ['"DM Sans"', '"Outfit"', '"Noto Sans Tamil"', 'sans-serif'],
      },
      boxShadow: {
        soft:   '0 1px 3px rgba(0,0,0,0.05)',
        gold:   '0 4px 20px -2px rgba(212, 175, 55, 0.25)',
      },
      borderRadius: {
        'card': '12px',
        'btn': '10px',
        'input': '10px',
        'table': '12px',
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'floatDelay': 'float 4s ease-in-out 1.5s infinite',
        'slideUp': 'slideUp 0.6s ease forwards',
        'fadeIn': 'fadeIn 0.5s ease forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
