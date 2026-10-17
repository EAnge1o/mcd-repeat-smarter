/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /** 正文墨色。暖黑，不用 #111827：整站底色偏暖，冷灰掺进去会显脏 */
        ink: {
          DEFAULT: '#241d1a',
          soft: '#3b332e',
          mute: '#6b625b',
          faint: '#736a61',
        },
        /** 近白页面底，带一点点暖，像纸不像屏幕 */
        canvas: '#faf8f6',
        /** 发丝线。用 rgba 而不是实色，叠在淡彩底上才不会出现一条硬边 */
        line: 'rgba(40, 32, 28, 0.10)',
        hair: 'rgba(40, 32, 28, 0.07)',
        /** 四块极淡的彩色底，用于方案分类、状态与强调块 */
        cream: '#fbf6ee',
        blush: '#fdf1ee',
        sage: '#eff5f0',
        butter: '#fbf3e2',
        /**
         * 品牌红。500 是麦当劳红原色，只用于「标记」与「关键数字」：
         * 金拱门、选中态、需要被一眼看到的那一个数。整块背景不用它，
         * 大面积红会把页面拉回促销海报。
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
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        /** 衬线只用于标题与大数字。中文走 Noto Serif SC，拉丁走 Playfair 的等宽衬线感 */
        serif: ['"Noto Serif SC"', '"Songti SC"', '"STSong"', 'Georgia', 'serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        /** 全站字号的语义档位，避免每个组件自己写 clamp */
        micro: ['10px', { lineHeight: '1.5' }],
        tiny: ['11px', { lineHeight: '1.55' }],
        small: ['12.5px', { lineHeight: '1.7' }],
        body: ['13.5px', { lineHeight: '1.8' }],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },
      boxShadow: {
        /* 阴影只给「浮起来的层」，平铺内容靠发丝线 */
        panel: '0 20px 50px -38px rgba(56, 38, 32, 0.32)',
        float: '0 32px 80px -44px rgba(56, 38, 32, 0.38)',
        pill: '0 2px 8px rgba(40, 32, 28, 0.06)',
        press: '0 1px 2px rgba(40, 32, 28, 0.05)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'draw-line': {
          from: { strokeDashoffset: '1' },
          to: { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 420ms cubic-bezier(0.22, 0.8, 0.3, 1) both',
        'fade-in': 'fade-in 500ms ease-out both',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'spin-slow': 'spin-slow 900ms linear infinite',
      },
    },
  },
  plugins: [],
};
