import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BeType, HistoryOrder, Plan, PlanItem } from '../server/domain/types';
import { buildHabitProfile } from '../server/domain/habits';
import { api, ApiRequestError, type AdjustResult, type ConfirmResult, type HealthInfo } from './api';
import { Composer } from './components/Composer';
import { HabitBar } from './components/HabitBar';
import { PlanCard } from './components/PlanCard';
import { OrderHistory } from './components/OrderHistory';
import { AdjustResultView } from './components/AdjustResultView';
import { ConfirmSheet } from './components/ConfirmSheet';
import { StorePicker } from './components/StorePicker';
import { Thinking } from './components/Thinking';
import { Alert, SectionHead, SourceBadge, Toasts, type ToastItem } from './components/Common';
import { IconArches, IconBack, IconClose, IconPlus, IconStore } from './components/Icons';

const QUICK_PROMPTS = ['还是老样子', '不要薯条，换个别的', '饮料换成无糖的', '不超过 20 元'];

const TAGS = ['上班早餐', '日常午餐', '周末套餐', '加班夜宵'];

const HERO_IMAGE = '/media/meal-hero.jpg';

interface CurrentStore {
  storeCode: string;
  storeName: string;
}

/** 抬头上的日期：真实当天，不是编的期号。
 *  zh-CN 默认输出「10月17日星期六」，中间不加空格会读成「十七日星期六」。 */
function todayLabel(): string {
  const d = new Date();
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).replace('星期', ' 星期');
}

export default function App() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [store, setStore] = useState<CurrentStore | null>(null);
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const [adjusting, setAdjusting] = useState(false);
  const [result, setResult] = useState<AdjustResult | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [adjustError, setAdjustError] = useState<{ message: string; hint?: string } | null>(null);

  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveTag, setSaveTag] = useState(TAGS[1]);
  const [saving, setSaving] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const beType: BeType = 1;

  // ---------- 初始化 ----------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const h = await api.health();
        if (!alive) return;
        setHealth(h);
        if (h.defaultStoreCode) setStore({ storeCode: h.defaultStoreCode, storeName: '' });
      } catch (err) {
        if (!alive) return;
        const e = err as ApiRequestError;
        setHealthError(e.detail?.message ?? '无法连接本地服务');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setOrdersLoading(true);
      try {
        const r = await api.history();
        if (alive) setOrders(r.orders);
      } catch {
        if (alive) setOrders([]);
      } finally {
        if (alive) setOrdersLoading(false);
      }
    })();
    (async () => {
      setPlansLoading(true);
      try {
        const r = await api.plans();
        if (alive) setPlans(r.plans);
      } catch {
        if (alive) setPlans([]);
      } finally {
        if (alive) setPlansLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 门店名回填：默认门店编码来自 .env，从历史订单里补全展示名
  useEffect(() => {
    if (!store || store.storeName) return;
    const hit = orders.find((o) => o.storeCode === store.storeCode);
    if (hit) setStore({ storeCode: hit.storeCode, storeName: hit.storeName });
  }, [orders, store]);

  const habit = useMemo(() => buildHabitProfile(orders), [orders]);

  const refreshPlans = useCallback(async () => {
    try {
      const r = await api.plans();
      setPlans(r.plans);
    } catch {
      /* 忽略：不影响主流程 */
    }
  }, []);

  // ---------- 核心：调整 ----------
  const runAdjust = useCallback(
    async (payload: { message: string; basePlanId?: string }) => {
      setAdjusting(true);
      setAdjustError(null);
      try {
        const r = await api.adjust({
          message: payload.message,
          basePlanId: payload.basePlanId,
          storeCode: store?.storeCode,
          storeName: store?.storeName,
          beType,
        });
        setResult(r);
        setSelectedId(r.candidates[0]?.id ?? '');
        if (!r.store.storeName && r.store.storeCode) {
          setStore({ storeCode: r.store.storeCode, storeName: r.store.storeName });
        }
      } catch (err) {
        const e = err as ApiRequestError;
        setAdjustError({ message: e.detail?.message ?? '调整失败', hint: e.detail?.hint });
      } finally {
        setAdjusting(false);
      }
    },
    [store, beType],
  );

  const handleSubmit = (text: string) => {
    void runAdjust({ message: text });
  };

  const handleUsePlan = (plan: Plan) => {
    setStore({ storeCode: plan.storeCode, storeName: plan.storeName });
    void runAdjust({ message: '还是老样子', basePlanId: plan.id });
  };

  const handleUseLatest = () => {
    void runAdjust({ message: '还是老样子' });
  };

  const backToJournal = () => {
    setResult(null);
    setAdjustError(null);
  };

  // ---------- 方案管理 ----------
  const handleDeletePlan = async (plan: Plan) => {
    if (!window.confirm(`删除「${plan.name}」？这个操作不可撤销。`)) return;
    try {
      await api.deletePlan(plan.id);
      await refreshPlans();
      toast('已删除');
    } catch (err) {
      const e = err as ApiRequestError;
      toast(e.detail?.message ?? '删除失败', 'error');
    }
  };

  const handleDuplicatePlan = async (plan: Plan) => {
    try {
      await api.duplicatePlan(plan.id);
      await refreshPlans();
      toast('已复制一份');
    } catch (err) {
      const e = err as ApiRequestError;
      toast(e.detail?.message ?? '复制失败', 'error');
    }
  };

  const handleRenamePlan = async (plan: Plan) => {
    const name = window.prompt('给这个方案起个名字', plan.name);
    if (!name || name.trim() === plan.name) return;
    try {
      await api.updatePlan(plan.id, { name: name.trim() });
      await refreshPlans();
      toast('已重命名');
    } catch (err) {
      const e = err as ApiRequestError;
      toast(e.detail?.message ?? '重命名失败', 'error');
    }
  };

  const openSaveDialog = () => {
    setSaveName(`我的${saveTag}`);
    setSaveOpen(true);
  };

  const handleSavePlan = async () => {
    const sel = result?.candidates.find((c) => c.id === selectedId);
    if (!sel || !result) return;
    setSaving(true);
    try {
      await api.createPlan({
        name: saveName.trim() || `我的${saveTag}`,
        items: sel.items as PlanItem[],
        storeCode: result.store.storeCode,
        storeName: result.store.storeName,
        beType: result.beType,
        tag: saveTag,
      });
      await refreshPlans();
      setSaveOpen(false);
      toast('已存为常用方案');
    } catch (err) {
      const e = err as ApiRequestError;
      toast(e.detail?.message ?? '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedCandidate = result?.candidates.find((c) => c.id === selectedId) ?? result?.candidates[0];
  const changeNotes = selectedCandidate ? selectedCandidate.changes.filter((c) => c.type !== 'kept').map((c) => c.detail) : [];
  const mode = health?.mode ?? 'demo';

  const handleOrdered = (r: ConfirmResult) => {
    toast(r.mode === 'demo' ? '演示下单完成，未产生真实订单' : `订单已提交${r.orderId ? ` · ${r.orderId.slice(-6)}` : ''}`);
    if (r.mode === 'live') {
      void api.history().then((x) => setOrders(x.orders)).catch(() => undefined);
    }
  };

  // ---------- 渲染 ----------
  if (healthError) {
    return (
      <div className="app">
        <main className="main">
          <div className="shell" style={{ maxWidth: 620, paddingTop: 72 }}>
            <Alert kind="error" title="连不上本地服务" hint="请确认已执行 npm run dev，并且前端与 API 两个进程都正常启动。">
              {healthError}
            </Alert>
          </div>
        </main>
      </div>
    );
  }

  const hasActionbar = Boolean(result && selectedCandidate);

  return (
    <div className={hasActionbar ? 'app app--has-actionbar' : 'app'}>
      {/* ================= 顶栏 ================= */}
      <header className="topbar">
        <div className="shell topbar__inner">
          <div className="brand">
            <span className="brand__mark" aria-hidden="true">
              <IconArches />
            </span>
            <span className="brand__text">
              <span className="brand__name">麦麦老样子</span>
              <span className="brand__sub">Repeat Smarter</span>
            </span>
          </div>

          <span className="topbar__spacer" />

          <div className="topbar__tools">
            <SourceBadge mode={mode} />
            <button type="button" className="store-btn" onClick={() => setStorePickerOpen(true)}>
              <IconStore size={13} />
              <span className="store-btn__label">
                {store?.storeName || (store ? `门店 ${store.storeCode}` : '选择门店')}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {/* ================= 首页 ================= */}
        {!result && (
          <div className="shell">
            <section className="hero">
              <div className="hero__copy">
                <div className="hero__eyebrow">
                  <span className="bar" />
                  <span className="label-cn">{todayLabel()}</span>
                </div>

                <h1 className="hero__title">
                  <span className="hero__line">
                    今天<span className="punct">，</span>还是
                  </span>
                  <span className="hero__line">
                    <em>老样子</em>吗？
                  </span>
                </h1>

                <p className="hero__lead">记得你的习惯，也听得懂你今天的小变化。</p>

                {health && mode === 'demo' && (
                  <div style={{ marginTop: 20 }}>
                    <Alert kind="warn" title="当前是演示数据">
                      {health.demoReason ?? '未连接真实 MCP'}。页面上的门店、餐品、价格均为内置示例，用于体验完整流程，不代表真实供应情况。
                    </Alert>
                  </div>
                )}

                {ordersLoading ? (
                  <div className="facts">
                    <div className="skeleton" style={{ height: 12, width: 220 }} />
                  </div>
                ) : (
                  <HabitBar habit={habit} />
                )}
              </div>

              <div className="hero__action">
                <Composer onSubmit={handleSubmit} loading={adjusting} quickPrompts={QUICK_PROMPTS} />

                {adjustError && (
                  <div style={{ marginTop: 14 }}>
                    <Alert kind="error" title="没能完成调整" hint={adjustError.hint}>
                      {adjustError.message}
                    </Alert>
                  </div>
                )}

                {adjusting && (
                  <div style={{ marginTop: 14 }}>
                    <Thinking title="正在解析你的说法，并查询门店真实菜单…" />
                  </div>
                )}
              </div>

              <figure className="hero__media">
                <img src={HERO_IMAGE} alt="汉堡、薯条与饮料的组合示意图" loading="eager" />
                <figcaption>示意图 · 非门店实际餐品</figcaption>
              </figure>
            </section>

            <div className="shelf">
              <section className="shelf__col">
                <SectionHead
                  title="常用方案"
                  desc="整单复用，也可以当作下一次修改的起点"
                  meta={plansLoading ? '' : plans.length > 0 ? `${plans.length} 个` : '还没有'}
                />

                {plansLoading ? (
                  <div className="plans">
                    <div className="skeleton" style={{ height: 172, borderRadius: 16 }} />
                    <div className="skeleton" style={{ height: 172, borderRadius: 16 }} />
                  </div>
                ) : plans.length === 0 ? (
                  <div className="plans">
                    <div className="plan plan--ghost">
                      <div className="plan__ghost-title">还没有保存的常用方案</div>
                      <div className="plan__ghost-desc">
                        调好一单后点「存成常用方案」，它会出现在这里。下次说一句「还是老样子」，就能把它整单调出来。
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="plans">
                    {plans.map((p) => (
                      <PlanCard
                        key={p.id}
                        plan={p}
                        onUse={() => handleUsePlan(p)}
                        onDuplicate={() => void handleDuplicatePlan(p)}
                        onDelete={() => void handleDeletePlan(p)}
                        onRename={() => void handleRenamePlan(p)}
                      />
                    ))}

                    {/* 空位卡：告诉用户这里还能再放一个，比留一个空洞更清楚 */}
                    {plans.length % 2 === 1 && (
                      <div className="plan plan--ghost">
                        <div className="plan__ghost-title">
                          <IconPlus size={12} /> 还能再存一个
                        </div>
                        <div className="plan__ghost-desc">下次调好之后点「存成常用方案」，就会放到这个位置。</div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="shelf__col">
                <SectionHead
                  title="最近订单"
                  desc={mode === 'live' ? '读取自你的麦当劳账号' : '内置示例，非真实账号'}
                  meta={mode === 'live' ? 'MCP' : '演示'}
                />
                <OrderHistory
                  orders={orders}
                  loading={ordersLoading}
                  mode={mode}
                  onUseLatest={orders.length > 0 ? handleUseLatest : undefined}
                />
              </section>
            </div>
          </div>
        )}

        {/* ================= 结果页 ================= */}
        {result && (
          <div className="shell">
            <div className="result rise">
              <div className="result__bar">
                <button type="button" className="btn btn--quiet" onClick={backToJournal}>
                  <IconBack size={14} />
                  返回
                </button>
                <span className="result__context">
                  {result.store.storeName || result.store.storeCode} · 基于
                  {result.baseFrom.kind === 'plan' ? '常用方案' : '最近一单'}
                </span>
              </div>

              {!adjusting && (
                <>
                  {adjustError && (
                    <Alert kind="error" title="这次的修改没成功" hint={adjustError.hint}>
                      {adjustError.message}
                    </Alert>
                  )}
                  <AdjustResultView result={result} selectedId={selectedId} onSelect={setSelectedId} onSave={openSaveDialog} />
                </>
              )}

              {/* 接着说：补充指令放在结论之后，不打断阅读顺序 */}
              <Composer onSubmit={handleSubmit} loading={adjusting} compact placeholder="还想改？接着说，比如「饮料换成无糖的」" />

              {adjusting && <Thinking title="正在按新的说法重新核价…" />}
            </div>
          </div>
        )}
      </main>

      {/* ================= 页脚 ================= */}
      <footer className="foot">
        <div className="shell foot__inner">
          <div className="foot__brand">记住你常点的，听懂你这次改的。</div>
          <div className="foot__meta">
            餐品、价格与优惠以麦当劳官方渠道实时结果为准
            <br />
            非官方参赛作品 · McD Repeat Smarter
          </div>
        </div>
      </footer>

      {/* ---------- 吸底操作栏 ---------- */}
      {result && selectedCandidate && (
        <div className="actionbar">
          <div className="actionbar__inner">
            <div className="actionbar__info">
              <div className="actionbar__name">
                {selectedCandidate.label}
                {selectedCandidate.price
                  ? ` · 共 ${selectedCandidate.price.lines.reduce((n, l) => n + l.quantity, 0)} 件`
                  : ''}
              </div>
              <div className="actionbar__amount">
                {selectedCandidate.price ? `¥${(selectedCandidate.price.priceCents / 100).toFixed(2)}` : '核价失败'}
              </div>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--lg"
              onClick={() => setSheetOpen(true)}
              disabled={!selectedCandidate.price || selectedCandidate.price.priceCents === 0}
            >
              去确认下单
            </button>
          </div>
        </div>
      )}

      {/* ---------- 弹层 ---------- */}
      <StorePicker
        open={storePickerOpen}
        onClose={() => setStorePickerOpen(false)}
        onPick={(s) => {
          setStore({ storeCode: s.storeCode, storeName: s.storeName });
          setResult(null);
          toast(`已切到 ${s.storeName}`);
        }}
        currentStoreCode={store?.storeCode}
        defaultCity={health?.city ?? '上海市'}
        beType={beType}
      />

      {result && selectedCandidate && (
        <ConfirmSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          storeCode={result.store.storeCode}
          storeName={result.store.storeName}
          beType={result.beType}
          items={selectedCandidate.items}
          changeNotes={changeNotes}
          mode={mode}
          onOrdered={handleOrdered}
        />
      )}

      {/* 存成常用方案 */}
      {saveOpen && result && selectedCandidate && (
        <div className="modal" onClick={() => setSaveOpen(false)} role="presentation">
          <div className="modal__box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal__head">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="modal__title">存成常用方案</div>
                <div className="tiny">下次说「还是老样子」就能整单调出来</div>
              </div>
              <button type="button" className="icon-btn" onClick={() => setSaveOpen(false)} aria-label="关闭">
                <IconClose />
              </button>
            </div>

            <div className="modal__body">
              <div className="field">
                <label htmlFor="pname">方案名称</label>
                <input
                  id="pname"
                  className="input"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="例如 我的日常午餐"
                />
              </div>

              <div className="field">
                <label>分类</label>
                <div className="tag-picker">
                  {TAGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`chip${saveTag === t ? ' chip--active' : ''}`}
                      onClick={() => setSaveTag(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="tiny" style={{ marginBottom: 6 }}>
                  将保存以下 {selectedCandidate.items.length} 项（结构化编码，不是一句话）
                </div>
                <div className="items">
                  {selectedCandidate.items.map((it, i) => (
                    <div key={i} className="item-row">
                      <span className="item-row__qty">{it.quantity}×</span>
                      <span className="item-row__nm">{it.name}</span>
                      {it.children.length > 0 && (
                        <span className="item-row__kids">{it.children.map((c) => c.name).join(' / ')}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal__foot">
              <button type="button" className="btn btn--primary btn--block" onClick={() => void handleSavePlan()} disabled={saving}>
                {saving ? <div className="spinner" /> : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toasts items={toasts} />
    </div>
  );
}
