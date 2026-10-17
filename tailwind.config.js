/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /**
         * 墨色。美式快餐的黑不是「暖黑」而是**纯黑**——麦当劳的字重和反差全靠这个。
         * 之前用 #241d1a 那种带红的暖黑，整页立刻变成日系茶饮。
         */
        ink: {
          DEFAULT: '#0d0d0d',
          soft: '#2f2f2f',
          mute: '#6a6a6a',
          faint: '#6e6e6e',
        },
        /** 页面底：麦当劳纸质物料的奶油白，不是纯白（纯白配纯黑太硬） */
        canvas: '#fdf6ec',
        /** 内容块：纯白卡片，压在奶油底上形成明确的「纸张」关系 */
        raised: '#ffffff',
        /** 描边。美式快餐用实线，不用渐变淡出发丝线 */
        line: 'rgba(13, 13, 13, 0.14)',
        hair: 'rgba(13, 13, 13, 0.09)',
        /** 行 hover 的那层淡黄——麦当劳的 hover 从来不是灰，是暖黄 */
        wash: '#fff4de',
        /** 语义淡底 */
        sage: '#eaf4ec',
        butter: '#fff2cf',
        /**
         * 品牌红。这是麦当劳的**主色块**，不是点缀色 ——
         * 顶栏、主按钮、选中态、价格数字都可以大面积铺开。
         */
        brand: {
          50: '#fdf0ef',
          100: '#fbdad7',
          200: '#f6b4ae',
          300: '#f1857a',
          400: '#e9574a',
          500: '#d62315',
          600: '#c31f13',
          700: '#a51810',
          800: '#6d120b',
          900: '#3d0c08',
          950: '#210706',
        },
        /**
         * 金拱黄。麦当劳视觉的另一半，缺了它就只是「一个红色 App」。
         * 只用在三处：价格高亮、拱门图形、少量强调条。
         */
        gold: {
          100: '#fff6dd',
          200: '#ffeab0',
          300: '#ffd75e',
          400: '#ffc72c',
          500: '#f5b000',
          600: '#c98d00',
          700: '#9a6a00',
          800: '#6b4a00',
        },
      },
      fontFamily: {
        /*
         * 全站换无衬线。麦当劳一个字衬线都不用。
         * 中文用 Noto Sans SC 的 900 字重来扛重量，700/800 做小标题。
         */
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        /** 等宽只给订单号这类真正像代码的字符串 */
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        micro: ['11px', { lineHeight: '1.5' }],
        tiny: ['12px', { lineHeight: '1.6' }],
        small: ['13.5px', { lineHeight: '1.7' }],
        body: ['14.5px', { lineHeight: '1.75' }],
      },
      /**
       * 圆角要**明显加大**。麦当劳的数字产品（大红鹰那套视觉）用的是厚实的
       * 胶囊和大圆角卡片，跟上一版刻意收窄的 8~12px 是两种气质。
       */
      borderRadius: {
        sm: '0.5rem',
        DEFAULT: '0.875rem',
        md: '1rem',
        lg: '1.25rem',
        xl: '1.5rem',
        '2xl': '1.75rem',
        '3xl': '2.25rem',
        '4xl': '2.75rem',
      },
      boxShadow: {
        /* 麦当劳的阴影是「贴着卡片下方」的一小团硬阴影，不是弥散柔化 */
        panel: '0 2px 0 rgba(13, 13, 13, 0.06)',
        float: '0 4px 0 rgba(13, 13, 13, 0.1), 0 10px 24px -12px rgba(13, 13, 13, 0.2)',
        pill: '0 2px 0 rgba(13, 13, 13, 0.08)',
        press: '0 2px 0 rgba(13, 13, 13, 0.06)',
        /* 品牌红按钮按下时「陷进去」的实心阴影 */
        'brand-press': '0 3px 0 rgba(109, 18, 11, 1)',
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
        /* 拱门落位：麦当劳 Logo 出现的方式 */
        'arch-in': {
          '0%': { opacity: '0', transform: 'translateY(-10px) scale(0.94)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 260ms cubic-bezier(0.2, 0.9, 0.3, 1) both',
        'fade-in': 'fade-in 200ms ease-out both',
        shimmer: 'shimmer 1.4s ease-in-out infinite',
        'spin-slow': 'spin-slow 900ms linear infinite',
        'arch-in': 'arch-in 420ms cubic-bezier(0.2, 0.9, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
