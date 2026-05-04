/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--tw-color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--tw-color-secondary) / <alpha-value>)',
        tertiary: 'rgb(var(--tw-color-tertiary) / <alpha-value>)',
        neutral: 'rgb(var(--tw-color-neutral) / <alpha-value>)',
        surface: 'rgb(var(--tw-color-surface) / <alpha-value>)',
        border: 'rgb(var(--tw-color-border) / <alpha-value>)',
        success: 'rgb(var(--tw-color-success) / <alpha-value>)',
        warning: 'rgb(var(--tw-color-warning) / <alpha-value>)',
        danger: 'rgb(var(--tw-color-danger) / <alpha-value>)',
        'on-accent': 'rgb(var(--tw-color-on-accent) / <alpha-value>)',
        'on-primary': 'rgb(var(--tw-color-on-primary) / <alpha-value>)',
        'header-bg': 'var(--color-header-bg)',
        'hairline': 'var(--color-hairline)',
        'card-border': 'var(--color-card-border)',
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
      },
      boxShadow: {
        'soft': 'var(--shadow-soft)',
        'hover': 'var(--shadow-hover)',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'Inter', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        display: ['"Playfair Display"', 'Lora', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'monospace'],
        poppins: ['"DM Sans"', 'Inter', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      transitionDuration: {
        'fast': '180ms',
        'medium': '360ms',
      },
      transitionTimingFunction: {
        'medium': 'var(--motion-spring)',
      },
      spacing: {
        'header': 'var(--header-height)',
        'inline': 'var(--page-inline)',
        'block': 'var(--section-block)',
        'grid-gap': 'var(--grid-gap)',
      }
    },
  },
  plugins: [],
}
