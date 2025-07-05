/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}", // Procura em todos os arquivos na raiz
  ],
  theme: {
    extend: {
        colors: {
            'primary': '#1a1a1a',
            'secondary': '#f4f4f4',
            'accent': '#ff4500',
            'accent-hover': '#e03e00',
        },
    },
  },
  plugins: [],
}