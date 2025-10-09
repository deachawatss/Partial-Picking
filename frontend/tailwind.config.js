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
        // Newly Weds Foods Brand Theme - Warm Elegant Industrial
        'brand-primary': '#3A2920',      // NWF Primary Brown for panels/headers
        'accent-green': '#3F7D3E',       // NWF Forest Green for actions
        'accent-gold': '#E0AA2F',        // NWF Accent Gold (use sparingly)
        'bg-main': '#FAF8F4',            // NWF Warm off-white background
        'surface': '#FFFFFF',            // Pure white surface
        'text-primary': '#2B1C14',       // NWF Dark brown text (high contrast)
        'text-secondary': '#5B4A3F',     // NWF Muted brown text
        'border-main': '#E2DAD2',        // NWF Soft warm border
        'danger': '#C62828',             // NWF Red for logout/errors
        'highlight': '#E0AA2F',          // NWF Gold highlight (same as accent-gold)

        // Legacy Brown Theme - Coffee to Cream (kept for compatibility)
        'coffee-dark': '#3d2817',
        coffee: '#4a2d1a',
        espresso: '#2f1608',
        mocha: '#6b4a33',
        'mocha-light': '#8b6a53',
        caramel: '#f4c15e',
        'caramel-dark': '#d99a2f',
        gold: '#e6b888',
        cream: '#f7efe3',
        cappuccino: '#fdf7ef',
        latte: '#efe1d1',
        sand: '#e7d7c6',
        'sand-light': '#ede8e0',
        almond: '#f0e4d6',

        // Professional Accent Colors
        success: '#4caf50',
        error: '#c62828',
        warning: '#f57c00',

        // Legacy compatibility
        pistachio: '#2ecc71',
        clay: '#d04b3b',
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
        rounded: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
      },
      animation: {
        'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
