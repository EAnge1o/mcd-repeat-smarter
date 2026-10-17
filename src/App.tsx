import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BeType, HistoryOrder, Plan, PlanItem } from '../server/domain/types';
import { buildHabitProfile } from '../server/domain/habits';
import { api, ApiRequestError, type AdjustResult, type ConfirmResult, type HealthInfo } from './api';
import { Composer } from './components/Composer';
import { HabitBar } from './components/HabitBar';
import { PlanCard } from './components/PlanCard';
import { AdjustResultView } from './components/AdjustResultView';
import { ConfirmSheet } from './components/ConfirmSheet';
import { StorePicker } from './components/StorePicker';
import { Alert, EmptyState, LoadingBlock, SourceBadge, SkeletonRows, Toasts, type ToastItem } from './components/Common';
import { IconBag, IconClose, IconHistory, IconPlus, IconStore } from './components/Icons';
import { usePointerGlow } from './hooks/usePointerGlow';

const QUICK_PROMPTS = ['还是老样子', '不要薯条，换个别的，不超过 20 元', '饮料换成无糖的', '加一份麦乐鸡'];

const TAGS = ['上班早餐', '日常午餐', '周末套餐', '加班夜宵'];

interface CurrentStore {
  storeCode: string;
  storeName: string;
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

  const heroRef = usePointerGlow<HTMLElement>();

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
        if (h.defaultStoreCode) {
          setStore({ storeCode: h.defaultStoreCode, storeName: '' });
        }
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
      // 刷新历史订单，让「老样子」立刻反映最新一单
      void api.history().then((x) => setOrders(x.orders)).catch(() => undefined);
    }
  };

  // ---------- 渲染 ----------
  if (healthError) {
    return (
      <div className="app">
        <main className="main" style={{ maxWidth: 720 }}>
          <div className="stack" style={{ marginTop: 40 }}>
            <Alert kind="error" title="连不上本地服务" hint="请确认已执行 npm run dev，并且两个进程都正常启动。">
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
      <header className="topbar">
        <div className="brand">
          <div className="brand__mark">麦</div>
          <div className="brand__text">
            <div className="brand__name">麦麦老样子</div>
            <div className="brand__sub">Repeat Smarter</div>
          </div>
        </div>

        <div className="topbar__spacer" />

        <div className="topbar__actions">
          <SourceBadge mode={mode} />
          <button type="button" className="btn btn--ghost btn--sm store-btn" onClick={() => setStorePickerOpen(true)}>
            <IconStore size={15} />
            <span className="store-btn__label">
              {store?.storeName || (store ? `门店 ${store.storeCode}` : '选择门店')}
            </span>
          </button>
        </div>
      </header>

      <main className="main">
        <div className="layout">
          {/* ================= 主区 ================= */}
          <div className="stack">
            {health && mode === 'demo' && (
              <Alert kind="warn" title="当前是演示数据">
                {health.demoReason ?? '未连接真实 MCP'}。页面上的门店、餐品、价格均为内置示例，用于体验完整流程，不代表真实供应情况。
              </Alert>
            )}

            {!result && (
              <section className="hero" ref={heroRef}>
                <div className="hero__glow" aria-hidden="true" />

                <div className="hero__eyebrow reveal">
                  <IconBag size={13} />
                  基于麦当劳官方 MCP 的真实菜单与核价
                </div>

                <h1 className="hero__title reveal d1">
                  今天还是<em>老样子</em>？
                </h1>

                <p className="hero__lead reveal d2">
                  记住你常点的，听懂你这次改的，确认好再帮你点。
                  <br />
                  不用重新翻菜单，<b>一句话说清「哪里不变、哪里要改」</b>就够了。
                </p>

                <div className="reveal d3">
                  {ordersLoading ? (
                    <div className="habit">
                      <div className="skeleton" style={{ height: 34, width: 112, borderRadius: 999 }} />
                      <div className="skeleton" style={{ height: 34, width: 156, borderRadius: 999 }} />
                      <div className="skeleton" style={{ height: 34, width: 128, borderRadius: 999 }} />
                    </div>
                  ) : (
                    <HabitBar habit={habit} />
                  )}
                </div>

                <div className="reveal d4">
                  <Composer onSubmit={handleSubmit} loading={adjusting} quickPrompts={QUICK_PROMPTS} />
                </div>

                {orders.length > 0 && (
                  <div className="hero__cta reveal d5">
                    <button type="button" className="btn btn--primary btn--lg" onClick={handleUseLatest} disabled={adjusting}>
                      <IconHistory size={16} />
                      用最近一单开个头
                    </button>
                    <span className="hero__cta-note">
                      <span>最近一单：{orders[0]?.items.map((i) => i.name).join(' + ')}</span>
                    </span>
                  </div>
                )}

                <div className="steps reveal d6">
                  <div className="step">
                    <div className="step__n">01</div>
                    <div className="step__t">一句话说清</div>
                    <div className="step__d">「还是上次那份，今天不要香芋派」——不用从头翻菜单。</div>
                  </div>
                  <div className="step">
                    <div className="step__n">02</div>
                    <div className="step__t">看清改了什么</div>
                    <div className="step__d">原方案与调整后并排对比，金额全部来自官方核价。</div>
                  </div>
                  <div className="step">
                    <div className="step__n">03</div>
                    <div className="step__t">确认后再下单</div>
                    <div className="step__d">核对门店、餐品与金额，勾选确认才会真正提交。</div>
                  </div>
                </div>

                {adjustError && (
                  <div style={{ marginTop: 18 }}>
                    <Alert kind="error" title="没能完成调整" hint={adjustError.hint}>
                      {adjustError.message}
                    </Alert>
                  </div>
                )}

                {adjusting && (
                  <div className="card card--pad" style={{ marginTop: 18 }}>
                    <LoadingBlock text="正在解析你的说法，并查询门店真实菜单…" />
                  </div>
                )}
              </section>
            )}

            {result && (
              <div className="stack reveal">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn--quiet"
                    onClick={() => {
                      setResult(null);
                      setAdjustError(null);
                    }}
                  >
                    <IconClose size={14} />
                    重新开始
                  </button>
                  <span className="tiny muted">
                    {result.store.storeName || result.store.storeCode} · 基于
                    {result.baseFrom.kind === 'plan' ? '常用方案' : '最近一单'}
                  </span>
                </div>

                <Composer onSubmit={handleSubmit} loading={adjusting} placeholder="接着说：把饮料换成无糖的" />

                {adjusting && (
                  <div className="card card--pad">
                    <LoadingBlock text="正在重新核价…" />
                  </div>
                )}

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
              </div>
            )}
          </div>

          {/* ================= 侧栏 ================= */}
          <aside className="sidebar">
            {/* 最近的单：当成一张真实小票，是全页的视觉锚点 */}
            <div className="receipt reveal d1">
              <div className="receipt__head">
                <div>
                  <div className="receipt__label">Recent · 小票存根</div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 5, letterSpacing: '-0.01em' }}>最近的单</div>
                </div>
                {mode === 'live' && <span className="badge badge--muted">MCP</span>}
              </div>

              <div className="dotted" />

              {ordersLoading ? (
                <SkeletonRows rows={4} />
              ) : orders.length === 0 ? (
                <EmptyState
                  title="暂无历史订单"
                  desc={mode === 'demo' ? '演示模式下只有内置的示例订单。' : '这个账号还没有可读取的麦当劳订单。'}
                />
              ) : (
                <>
                  {orders.slice(0, 5).map((o) => (
                    <div key={o.orderId} className="receipt__row">
                      <span className="receipt__when">{o.createTime.slice(5, 16)}</span>
                      <span className="receipt__what">{o.items.map((i) => i.name).join('、')}</span>
                      <span className="receipt__amt">
                        {o.paidYuan && Number(o.paidYuan) > 0 ? `¥${Number(o.paidYuan).toFixed(2)}` : '—'}
                      </span>
                    </div>
                  ))}
                  <div className="dotted" />
                  <div className="tiny" style={{ color: 'var(--ink-400)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span>共 {orders.length} 单可读</span>
                    <span className="num">MCD · CN</span>
                  </div>
                </>
              )}
            </div>

            <div className="card card--pad reveal d2">
              <div className="section-title">
                <h2>我的常用方案</h2>
                <span className="section-title__hint">{plans.length > 0 ? `${plans.length} 个` : ''}</span>
              </div>

              {plansLoading ? (
                <SkeletonRows rows={2} />
              ) : plans.length === 0 ? (
                <EmptyState
                  icon={<IconPlus size={18} />}
                  title="还没有保存的方案"
                  desc="调好一单后点「存成常用方案」，以后一句话就能调出来。"
                />
              ) : (
                <div className="plan-list">
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
                </div>
              )}
            </div>

            <div className="card store-card reveal d3">
              <div className="kicker" style={{ marginBottom: 10 }}>
                <span className="kicker__dot" />
                Store
              </div>
              <div className="store-card__row">
                <span>门店</span>
                <span>{store?.storeName || (store ? `编码 ${store.storeCode}` : '未选择')}</span>
              </div>
              <div className="store-card__row">
                <span>方式</span>
                <span>到店自取</span>
              </div>
              <div className="store-card__row">
                <span>数据</span>
                <span>{mode === 'live' ? '麦当劳 MCP 实时' : '内置演示数据'}</span>
              </div>
              <button type="button" className="btn btn--quiet" style={{ marginTop: 10, marginLeft: -13 }} onClick={() => setStorePickerOpen(true)}>
                <IconStore size={14} />
                切换门店
              </button>
            </div>
          </aside>
        </div>
      </main>

      {/* ================= 收尾品牌区 ================= */}
      <footer className="brandstrip">
        <div className="brandstrip__inner">
          <div style={{ minWidth: 0 }}>
            <div className="brandstrip__title">
              记住你常点的，
              <br />
              听懂你这次<em>改的</em>。
            </div>
            <p className="brandstrip__line">
              麦麦老样子不是又一个推荐机器人。它从你真实的订单里认出习惯，把你这一句「不要薯饼，换个别的，不超过 25 元」翻译成具体的餐品和金额，等你确认。
            </p>
          </div>

          <dl className="brandstrip__facts">
            <div className="brandstrip__fact">
              <dt>Data</dt>
              <dd>{mode === 'live' ? '麦当劳中国 MCP' : '内置演示数据'}</dd>
            </div>
            <div className="brandstrip__fact">
              <dt>Pricing</dt>
              <dd>官方核价</dd>
            </div>
            <div className="brandstrip__fact">
              <dt>Notice</dt>
              <dd>非官方参赛作品</dd>
            </div>
          </dl>
        </div>

        <div className="brandstrip__line" style={{ marginTop: 26, fontSize: 11.5, opacity: 0.55 }}>
          餐品、价格与优惠以麦当劳官方渠道实时结果为准 · McD Repeat Smarter
        </div>
      </footer>

      {/* ---------- 吸底操作栏 ---------- */}
      {result && selectedCandidate && (
        <div className="actionbar">
          <div className="actionbar__inner">
            <div className="actionbar__info">
              <div className="actionbar__name">
                {selectedCandidate.label}
                {selectedCandidate.price ? ` · 共 ${selectedCandidate.price.lines.reduce((n, l) => n + l.quantity, 0)} 件` : ''}
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

      {saveOpen && result && selectedCandidate && (
        <div className="modal" onClick={() => setSaveOpen(false)} role="presentation">
          <div className="modal__box" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal__head">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>存成常用方案</div>
                <div className="tiny muted">下次说「还是老样子」就能调出来</div>
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
                <label>场景</label>
                <div className="tag-picker">
                  {TAGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`tag-opt${saveTag === t ? ' tag-opt--active' : ''}`}
                      onClick={() => setSaveTag(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card" style={{ padding: 14, background: 'var(--paper)' }}>
                <div className="tiny muted" style={{ marginBottom: 7 }}>
                  将保存以下 {selectedCandidate.items.length} 项（结构化编码，不是一句话）
                </div>
                {selectedCandidate.items.map((it, i) => (
                  <div key={i} className="tiny" style={{ color: 'var(--ink-700)' }}>
                    {it.quantity}× {it.name}
                    {it.children.length > 0 ? `（${it.children.map((c) => c.name).join(' / ')}）` : ''}
                  </div>
                ))}
              </div>
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
