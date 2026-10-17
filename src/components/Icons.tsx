/** 内联图标：统一 1.7 描边、圆角端点，避免引入图标库依赖。 */

interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const IconSend = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.5 12h13M11.5 5.5 18 12l-6.5 6.5" />
  </svg>
);

export const IconCheck = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const IconClose = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconStore = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 9.5 5.6 4h12.8L20 9.5M4 9.5h16M4 9.5v9.2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5M9.5 19.7v-5.2h5v5.2" />
  </svg>
);

export const IconClock = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M12 7.6V12l3 1.9" />
  </svg>
);

export const IconSparkle = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.6l1.9 5.1 5.1 1.9-5.1 1.9L12 17.6l-1.9-5.1L5 10.6l5.1-1.9z" />
    <path d="M18.5 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
  </svg>
);

export const IconTrash = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.8 6.8h14.4M9.5 6.8V4.9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.9M6.6 6.8l.8 12.1a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9l.8-12.1" />
  </svg>
);

export const IconCopy = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="8.6" y="8.6" width="11" height="11" rx="2.2" />
    <path d="M15.4 5.4H6.6a2 2 0 0 0-2 2v8.8" />
  </svg>
);

export const IconEdit = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M15.7 4.6a2 2 0 0 1 2.8 2.8L8.3 17.6l-3.6 1 1-3.6z" />
  </svg>
);

export const IconAlert = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 8v4.6M12 15.7v.1" />
  </svg>
);

export const IconInfo = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 11v4.6M12 8.1v.1" />
  </svg>
);

export const IconPlus = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconArrow = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5 12h12M12.5 6.5 18 12l-5.5 5.5" />
  </svg>
);

export const IconBack = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M19 12H5M11 5.5 4.5 12l6.5 6.5" />
  </svg>
);

export const IconReceipt = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 3.8h12v16.4l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 20.2z" />
    <path d="M9.4 8.4h5.2M9.4 12.2h5.2" />
  </svg>
);

export const IconRefresh = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 11.5a8 8 0 1 0-2.6 6.1" />
    <path d="M20 5.5v5h-5" />
  </svg>
);

export const IconHistory = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3.6 12a8.4 8.4 0 1 0 2.7-6.2" />
    <path d="M3.6 4.6v4.6h4.6M12 7.8V12l3.2 1.9" />
  </svg>
);

export const IconChevronDown = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m6 9.5 6 6 6-6" />
  </svg>
);

export const IconBag = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5.4 8.4h13.2l-1 11.2a1 1 0 0 1-1 .9H7.4a1 1 0 0 1-1-.9z" />
    <path d="M8.8 8.4V6.6a3.2 3.2 0 0 1 6.4 0v1.8" />
  </svg>
);

/**
 * 金拱门。两座拱共用中间一条腿，三个底端齐平。
 *
 * 用一条粗描边画骨架，不填实心剪影——拱内留白，17px 下仍读得出「两个拱」。
 * 三个比例要点（改之前先看这里，别凭感觉调）：
 * 1. 腿在下半段保持竖直（到 y=66 才开始起拱）。全程用贝塞尔会让腿从底端就外扩，形状软成一把扇子。
 * 2. 拱顶收窄成尖圆，不是宽穹顶。宽穹顶会读成小写字母 m。
 * 3. 描边 14/104 ≈ 0.135，是拱间距的 0.36——再细就散，再粗两个拱会粘住。
 */
export const IconArches = ({ size = 19, className }: IconProps) => (
  <svg
    width={(size * 104) / 100}
    height={size}
    viewBox="0 0 104 100"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M13 92V66C13 37 23.9 8 32.5 8S52 37 52 66V92C52 37 60.6 8 71.5 8S91 37 91 66V92"
      stroke="currentColor"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
