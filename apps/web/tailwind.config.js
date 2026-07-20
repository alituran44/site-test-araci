/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./apps/web/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./apps/web/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./apps/web/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        heading: ["Outfit", "sans-serif"],
      },
      colors: {
        emerald: {
          50: '#ecfdf5',
          500: '#10b981',
          600: '#059669',
        },
        slate: {
          900: '#0f172a',
          950: '#020617',
        }
      }
    },
  },
  plugins: [],
}
