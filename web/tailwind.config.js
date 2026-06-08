/** Tailwind CSS 配置 */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        peach: { 50: '#FFF7F3', 100: '#FFECE5', 200: '#FFD9CC', 400: '#FFB48E' },
        brand: { orange: '#FF6A3D', purple: '#6C63FF', teal: '#2CD4D9', ink: '#1F2937' }
      },
      boxShadow: { soft: '0 8px 24px rgba(17,24,39,0.08)' },
      borderRadius: { '3xl': '1.75rem' }
    },
  },
  plugins: [],
}
