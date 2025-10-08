/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        cream: '#f7efe3',
        cappuccino: '#fdf7ef',
        latte: '#efe1d1',
        mocha: '#6b4a33',
        coffee: '#4a2d1a',
        espresso: '#2f1608',
        caramel: '#f4c15e',
        'caramel-dark': '#d99a2f',
        pistachio: '#2ecc71',
        clay: '#d04b3b',
        sand: '#e7d7c6',
        almond: '#f0e4d6',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '3xl': '1.75rem',
        '4xl': '2.5rem',
      },
      boxShadow: {
        panel: '0 24px 60px -32px rgba(37, 20, 5, 0.35)',
        insetSoft: 'inset 0 1px 0 rgba(255, 255, 255, 0.6), inset 0 6px 16px rgba(0, 0, 0, 0.08)',
      },
      fontFamily: {
        rounded: ['"Nunito Sans"', 'ui-rounded', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
}
