export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f4f7f6',
          100: '#e6efec',
          200: '#c9ddd7',
          300: '#a0c4bc',
          400: '#6f9f95',
          500: '#4d7f76',
          600: '#36645d',
          700: '#2a504a',
          800: '#203b37',
          900: '#132622'
        },
        sun: {
          50: '#fff8e8',
          100: '#ffe9b8',
          200: '#ffd67a',
          300: '#ffc43b',
          400: '#f4ab00',
          500: '#cf8f00'
        },
        ember: {
          100: '#ffe6d6',
          200: '#ffc8ac',
          300: '#ff9f70',
          400: '#ff7441',
          500: '#e95726'
        }
      },
      boxShadow: {
        glow: '0 20px 60px rgba(19, 38, 34, 0.18)'
      },
      backgroundImage: {
        'hero-radial': 'radial-gradient(circle at top left, rgba(255, 196, 59, 0.18), transparent 35%), radial-gradient(circle at top right, rgba(54, 100, 93, 0.2), transparent 28%), linear-gradient(180deg, #f7f9f8 0%, #eef4f2 100%)'
      }
    }
  },
  plugins: []
};
