import { Alert, Badge, Button, Panel } from '../components/ui';
import { IconArches, IconSparkle } from '../components/Icons';
import type { ViewKey } from '../components/Sidebar';

const FLOW = [
  { step: '01', title: '读习惯', body: '从历史订单算出常点的门店、餐品和时段。' },
  { step: '02', title: '听懂改动', body: '「不要薯条」「换无糖」「不超 20 元」拆成具体修改。' },
  { step: '03', title: '按门店核价', body: '每次调整都重新调官方接口算价。' },
  { step: '04', title: '你确认才下单', body: '核对门店、餐品、金额，勾选后才提交。' },
];

const SOURCES = [
  ['门店与餐品', '麦当劳 MCP query-stores / query-meals'],
  ['价格与优惠', '麦当劳 MCP calculate-price'],
  ['历史订单', '麦当劳 MCP order-list'],
  ['常用方案', '本机 data/plans.json，不上传'],
  ['访问 Token', '只存在服务端 .env，浏览器拿不到'],
];

export function AboutView({
  mode,
  demoReason,
  onNavigate,
}: {
  mode: 'live' | 'demo';
  demoReason?: string;
  onNavigate: (v: ViewKey) => void;
}) {
  return (
    <div>
      <header className="max-w-[620px]">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-500" aria-hidden="true">
            <IconArches size={17} />
          </span>
          <p className="eyebrow">参赛作品 · 非官方产品</p>
        </div>
        <h1 className="display display-24 mt-4 text-ink md:display-36">
          记住你常点的，
          <br />
          听懂你这次改的
        </h1>
        <p className="mt-3 max-w-[34rem] text-pretty text-[13px] leading-[1.95] text-ink-mute">
          基于麦当劳官方 MCP 的个性化点单助手。所有判断都落在「你的历史订单 + 门店实时菜单」之上。
        </p>
      </header>

      {mode === 'demo' ? (
        <Alert kind="warn" className="mt-7 max-w-[640px]" title="当前运行在演示模式" hint="配置 MCD_MCP_TOKEN 并把 MCD_MODE 设为 live 即可接入真实接口。">
          {demoReason ?? '未连接真实 MCP'}
        </Alert>
      ) : null}

      <div className="mt-9 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Panel className="px-5 py-6 md:px-8 md:py-8">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="eyebrow">它到底做了什么</p>
              <h2 className="display display-24 mt-2 text-ink">四步，每步可打断</h2>
            </div>
          </div>

          <ol className="mt-6 space-y-0">
            {FLOW.map((f, i) => (
              <li key={f.step} className={i === 0 ? 'pb-5' : 'border-t border-hair py-5'}>
                <div className="flex gap-4">
                  <span className="tnum shrink-0 pt-0.5 text-[11.5px] tracking-[0.1em] text-brand-600">{f.step}</span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] text-ink">{f.title}</p>
                    <p className="mt-1.5 text-[11.5px] leading-[1.85] text-ink-mute">{f.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel className="px-5 py-6 md:px-7">
          <p className="eyebrow">数据从哪里来</p>
          <h2 className="display display-24 mt-2 text-ink">每个数字都能追到源头</h2>
          <dl className="mt-5">
            {SOURCES.map(([k, v], i) => (
              <div key={k} className={i === 0 ? 'py-2.5' : 'border-t border-hair py-2.5'}>
                <dt className="text-[11.5px] text-ink-mute">{k}</dt>
                <dd className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel className="mt-5 px-5 py-6 md:px-8 md:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[42rem] text-pretty">
            <p className="eyebrow">关于这个作品</p>
            <div className="mt-3 space-y-2 text-[13px] leading-[1.9] text-ink-soft">
              <p>
                麦当劳中国程序员节开发者创新挑战赛参赛作品，
                <strong className="font-medium text-ink">非官方产品</strong>
                。界面中的金拱门标记仅用于标明所对接的服务，不代表官方授权。
              </p>
              <p>餐品、价格与优惠以官方渠道实时结果为准；所有下单都需要你在确认弹层里勾选后才会提交。</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3">
            <Badge tone={mode === 'live' ? 'ok' : 'warn'}>{mode === 'live' ? '已连接真实 MCP' : '演示数据'}</Badge>
            <Button variant="primary" onClick={() => onNavigate('order')}>
              <IconSparkle size={13} />
              去试一单
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
