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
        /** 暖白页面底，带一点点暖，像纸不像屏幕 */
        canvas: '#faf8f6',
        /** 内容块底：比页面底亮半档，用来划界，不是用来「装东西」 */
        raised: '#fffdfc',
        /** 发丝线。两条：line 是结构线（栏与栏之间），hair 是行文里的呼吸 */
        line: 'rgba(40, 32, 28, 0.11)',
        hair: 'rgba(40, 32, 28, 0.07)',
        /** 行 hover 的那层极淡底。不用灰，用暖，避免在暖白上显脏 */
        wash: '#f7f3ef',
        /** 三块极淡的彩色底，只在真的需要区分语义时用（成功、提醒、错误） */
        sage: '#eef4ef',
        butter: '#fbf3e2',
        /**
         * 品牌红。全站只在四个地方出现：主操作、当前选中、重要金额、异常状态。
         * 其余位置一律用墨色 —— 红一旦铺开就不再是强调。
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
        /** 衬线只用于标题与金额。中文走 Noto Serif SC，拉丁走等宽衬线的节奏感 */
        serif: ['"Noto Serif SC"', '"Songti SC"', '"STSong"', 'Georgia', 'serif'],
        /** 等宽只给订单号这类真正像代码的字符串 */
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        /** 全站字号的语义档位，避免每个组件自己写 clamp */
        micro: ['10.5px', { lineHeight: '1.5' }],
        tiny: ['11.5px', { lineHeight: '1.6' }],
        small: ['13px', { lineHeight: '1.7' }],
        body: ['13.5px', { lineHeight: '1.8' }],
      },
      /**
       * 圆角刻意收窄。消费品牌的「贵气」来自细边和留白，不来自大圆角 ——
       * 20px 以上的圆角会让界面回到 2015 年的 SaaS 卡片风。
       */
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.625rem',
        md: '0.75rem',
        lg: '0.875rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        '4xl': '1.75rem',
      },
      boxShadow: {
        /* 阴影只给「浮起来的层」。平铺内容一律靠发丝线，投影一多整页就脏了 */
        panel: '0 1px 2px rgba(56, 38, 32, 0.04)',
        float: '0 18px 40px -28px rgba(56, 38, 32, 0.35), 0 1px 2px rgba(56, 38, 32, 0.04)',
        pill: '0 1px 2px rgba(40, 32, 28, 0.05)',
        press: '0 1px 2px rgba(40, 32, 28, 0.04)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
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
        'fade-up': 'fade-up 320ms cubic-bezier(0.22, 0.8, 0.3, 1) both',
        'fade-in': 'fade-in 400ms ease-out both',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'spin-slow': 'spin-slow 900ms linear infinite',
      },
    },
  },
  plugins: [],
};
