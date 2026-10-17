/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /**
         * 品牌红。侧栏取 950（很深，接近黑但带红），主操作取 600（DA291C 原色）。
         * 950 这一档是给「深色侧边栏」用的：不用 gray-900，因为整站的唯一中性色是暖灰，
         * 突然插一块冷灰会和品牌红打架。
         */
        brand: {
          50: '#fdf3f2',
          100: '#fbe3e0',
          200: '#f6c6c1',
          300: '#ee9a91',
          400: '#e2665a',
          500: '#da291c',
          600: '#c31f13',
          700: '#a31a0f',
          800: '#6d120b',
          900: '#3d0c08',
          950: '#210706',
        },
        /** 页面底与卡片描边，对应 stylekit 的 #f9fafb 体系 */
        canvas: '#f7f7f5',
        line: '#ebe9e5',
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        // stylekit 要求极轻阴影，数据面板靠描边分层
        card: '0 1px 2px 0 rgb(20 16 12 / 0.04)',
        lift: '0 4px 12px -2px rgb(20 16 12 / 0.08), 0 2px 4px -2px rgb(20 16 12 / 0.04)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 240ms cubic-bezier(0.16, 0.84, 0.44, 1) both',
        shimmer: 'shimmer 1.4s ease-in-out infinite',
        'spin-slow': 'spin-slow 900ms linear infinite',
      },
    },
  },
  plugins: [],
};
