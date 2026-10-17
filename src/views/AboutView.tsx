import { Alert, Badge, Button, Card, CardHead } from '../components/ui';
import { IconArches, IconSparkle } from '../components/Icons';
import type { ViewKey } from '../components/Sidebar';

const FLOW = [
  { step: '01', title: '读习惯', body: '从你的历史订单里算出常点的门店、餐品和时段，不用你填任何偏好表单。' },
  { step: '02', title: '听懂改动', body: '「不要薯条」「饮料换无糖」「不超过 20 元」会被解析成结构化修改，不是猜一句话去搜商品。' },
  { step: '03', title: '按门店核价', body: '每一次调整都调官方接口重新算钱，价格、优惠、库存状态都拿实时结果。' },
  { step: '04', title: '你确认才下单', body: '弹层里核对门店、餐品、金额，勾选后才提交。系统不会在你确认前下单。' },
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
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500 text-[#ffc72c]" aria-hidden="true">
            <IconArches size={22} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#111827] md:text-2xl">麦麦老样子</h1>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#6b6862]">
              记住你常点的，听懂你这次改的，确认好再帮你点。基于麦当劳官方 MCP 的个性化点单助手。
            </p>
          </div>
        </div>
        <Badge tone={mode === 'live' ? 'ok' : 'warn'}>{mode === 'live' ? '已连接真实 MCP' : '演示数据'}</Badge>
      </div>

      {mode === 'demo' ? (
        <Alert kind="warn" title="当前运行在演示模式" hint="配置 MCD_MCP_TOKEN 并把 MCD_MODE 设为 live 即可接入真实接口。">
          {demoReason ?? '未连接真实 MCP'}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead title="它到底做了什么" desc="四步，每一步都可以被你打断和纠正" />
          <ol className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:p-5">
            {FLOW.map((f) => (
              <li key={f.step} className="rounded-lg border border-line p-3">
                <span className="tnum text-[11px] text-[#c0bcb4]">{f.step}</span>
                <p className="mt-1 text-[13px] font-medium text-[#111827]">{f.title}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[#6b6862]">{f.body}</p>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardHead title="数据从哪里来" desc="每个数字都能追到源头" />
          <dl className="divide-y divide-line text-[12px]">
            {[
              ['门店与餐品', '麦当劳 MCP query-stores / query-meals'],
              ['价格与优惠', '麦当劳 MCP calculate-price'],
              ['历史订单', '麦当劳 MCP order-list'],
              ['常用方案', '本机 data/plans.json，不上传'],
              ['访问 Token', '只存在服务端 .env，浏览器拿不到'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 px-4 py-2.5 md:px-5">
                <dt className="shrink-0 text-[#8a877f]">{k}</dt>
                <dd className="min-w-0 text-right text-[#3d3a35]">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card>
        <CardHead title="关于这个作品" desc="参赛说明与免责" />
        <div className="space-y-2 px-4 py-4 text-[12px] leading-relaxed text-[#4b4945] md:px-5">
          <p>
            这是麦当劳中国程序员节开发者创新挑战赛的参赛作品，<strong className="font-medium text-[#111827]">非官方产品</strong>
            ，与麦当劳中国没有隶属关系。界面中的金拱门标记仅用于标明所对接的服务，不代表官方授权。
          </p>
          <p>餐品、价格与优惠以麦当劳官方渠道实时结果为准；演示模式下页面内容为内置示例，不代表真实供应情况。</p>
          <p>所有下单动作都需要你在确认弹层里主动勾选后才会提交，系统不会替你下单。</p>
          <div className="pt-1">
            <Button variant="primary" size="sm" onClick={() => onNavigate('order')}>
              <IconSparkle size={13} />
              去试一单
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
