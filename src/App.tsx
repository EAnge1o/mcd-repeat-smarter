import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BeType, HistoryOrder, Plan, PlanItem } from '../server/domain/types';
import { api, ApiRequestError, type AdjustResult, type ConfirmResult, type HealthInfo } from './api';
import { computeKpis, hourBuckets, spendSeries, topChoices, topItems } from './lib/metrics';
import { Sidebar, type ViewKey } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { ConfirmSheet } from './components/ConfirmSheet';
import { StorePicker } from './components/StorePicker';
import { Alert, Button, Toasts, type ToastItem } from './components/ui';
import { IconClose } from './components/Icons';
import { Overview } from './views/Overview';
import { OrderView } from './views/OrderView';
import { PlansView } from './views/PlansView';
import { OrdersView } from './views/OrdersView';
import { StoresView } from './views/StoresView';
import { AboutView } from './views/AboutView';

const TAGS = ['上班早餐', '日常午餐', '周末套餐', '加班夜宵'];

interface CurrentStore {
  storeCode: string;
  storeName: string;
}

/** zh-CN 默认输出「10月17日星期六」，不加空格会读成「十七日星期六」 */
function todayLabel(): string {
  return new Date()
    .toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
    .replace('星期', ' 星期');
}

export default function App() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [store, setStore] = useState<CurrentStore | null>(null);
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const [view, setView] = useState<ViewKey>('overview');
  const [mobileNav, setMobileNav] = useState(false);

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

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const r = await api.history();
      // 服务端不保证顺序，这里统一按时间倒序，KPI 和表格都依赖「第一行是最新」
      setOrders([...r.orders].sort((a, b) => b.createTime.localeCompare(a.createTime)));
      setLastSync(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const r = await api.plans();
      setPlans(r.plans);
    } catch {
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    void loadPlans();
  }, [loadOrders, loadPlans]);

  // 门店名回填：默认门店编码来自 .env，从历史订单里补全展示名
  useEffect(() => {
    if (!store || store.storeName) return;
    const hit = orders.find((o) => o.storeCode === store.storeCode);
    if (hit) setStore({ storeCode: hit.storeCode, storeName: hit.storeName });
  }, [orders, store]);

  // ---------- 派生数据 ----------
  const kpis = useMemo(() => computeKpis(orders, plans), [orders, plans]);
  const series = useMemo(() => spendSeries(orders, 10), [orders]);
  const buckets = useMemo(() => hourBuckets(orders), [orders]);
  const tops = useMemo(() => topItems(orders, 5), [orders]);
  const choices = useMemo(() => topChoices(orders, 2), [orders]);

  // ---------- 核心：调整 ----------
  const runAdjust = useCallback(
    async (payload: { message: string; basePlanId?: string }) => {
      setAdjusting(true);
      setAdjustError(null);
      setView('order');
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

  const handleSubmit = (text: string) => void runAdjust({ message: text });

  const handleUsePlan = (plan: Plan) => {
    setStore({ storeCode: plan.storeCode, storeName: plan.storeName });
    void runAdjust({ message: '还是老样子', basePlanId: plan.id });
  };

  const handleUseLatest = () => void runAdjust({ message: '还是老样子' });

  const handleUseOrder = (order: HistoryOrder) => {
    setStore({ storeCode: order.storeCode, storeName: order.storeName });
    void runAdjust({ message: '还是老样子' });
  };

  // ---------- 方案管理 ----------
  const handleDeletePlan = async (plan: Plan) => {
    if (!window.confirm(`删除「${plan.name}」？这个操作不可撤销。`)) return;
    try {
      await api.deletePlan(plan.id);
      await loadPlans();
      toast('已删除');
    } catch (err) {
      const e = err as ApiRequestError;
      toast(e.detail?.message ?? '删除失败', 'error');
    }
  };

  const handleDuplicatePlan = async (plan: Plan) => {
    try {
      await api.duplicatePlan(plan.id);
      await loadPlans();
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
      await loadPlans();
      toast('已重命名');
    } catch (err) {
      const e = err as ApiRequestError;
      toast(e.detail?.message ?? '重命名失败', 'error');
    }
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
      await loadPlans();
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
    if (r.mode === 'live') void loadOrders();
  };

  // ---------- 渲染 ----------
  if (healthError) {
    return (
      <div className="grid min-h-screen place-items-center px-5">
        <div className="w-full max-w-md">
          <p className="eyebrow mb-4 text-center">REPEAT SMARTER</p>
          <h1 className="display mb-5 text-center text-[28px] text-ink">服务没有起来</h1>
          <Alert kind="error" title="连不上本地服务" hint="请确认已执行 npm run dev，并且前端与 API 两个进程都正常启动。">
            {healthError}
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        view={view}
        onNavigate={setView}
        plansCount={plans.length}
        ordersCount={orders.length}
        storeName={store?.storeName || (store ? `门店 ${store.storeCode}` : '')}
        mode={mode}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
        onPickStore={() => setStorePickerOpen(true)}
        recentPlans={plans}
        onUsePlan={handleUsePlan}
      />

      <div className="lg:pl-[248px]">
        <Topbar
          view={view}
          plans={plans}
          orders={orders}
          storeName={store?.storeName || (store ? `门店 ${store.storeCode}` : '')}
          mode={mode}
          lastSync={lastSync}
          dateLabel={todayLabel()}
          onNavigate={setView}
          onOpenMobile={() => setMobileNav(true)}
          onPickStore={() => setStorePickerOpen(true)}
        />

        <main className="px-4 pb-32 pt-7 md:px-8 md:pt-10">
          <div className="mx-auto max-w-[1180px]">
            {view === 'overview' ? (
              <Overview
                dateLabel={todayLabel()}
                mode={mode}
                demoReason={health?.demoReason}
                storeName={store?.storeName || (store ? `门店 ${store.storeCode}` : '')}
                lastSync={lastSync}
                kpis={kpis}
                series={series}
                buckets={buckets}
                tops={tops}
                choices={choices}
                orders={orders}
                ordersLoading={ordersLoading}
                plans={plans}
                plansLoading={plansLoading}
                onNavigate={setView}
                onUsePlan={handleUsePlan}
                onUseOrder={handleUseOrder}
                onUseLatest={handleUseLatest}
                onSubmit={handleSubmit}
              />
            ) : null}

            {view === 'order' ? (
              <OrderView
                adjusting={adjusting}
                result={result}
                selectedId={selectedId}
                error={adjustError}
                mode={mode}
                storeName={store?.storeName || (store ? `门店 ${store.storeCode}` : '')}
                plans={plans}
                onSubmit={handleSubmit}
                onSelect={setSelectedId}
                onSave={() => {
                  setSaveName(`我的${saveTag}`);
                  setSaveOpen(true);
                }}
                onReset={() => {
                  setResult(null);
                  setAdjustError(null);
                }}
                onUsePlan={handleUsePlan}
                onPickStore={() => setStorePickerOpen(true)}
                onNavigate={setView}
              />
            ) : null}

            {view === 'plans' ? (
              <PlansView
                plans={plans}
                loading={plansLoading}
                mode={mode}
                onUse={handleUsePlan}
                onDelete={(p) => void handleDeletePlan(p)}
                onDuplicate={(p) => void handleDuplicatePlan(p)}
                onRename={(p) => void handleRenamePlan(p)}
                onNavigate={setView}
              />
            ) : null}

            {view === 'orders' ? (
              <OrdersView
                orders={orders}
                loading={ordersLoading}
                mode={mode}
                onUse={handleUseOrder}
                onUseLatest={handleUseLatest}
                onRefresh={() => void loadOrders()}
              />
            ) : null}

            {view === 'stores' ? (
              <StoresView
                defaultCity={health?.city ?? '上海市'}
                beType={beType}
                currentStoreCode={store?.storeCode}
                currentStoreName={store?.storeName || ''}
                onPick={(s) => {
                  setStore({ storeCode: s.storeCode, storeName: s.storeName });
                  setResult(null);
                  toast(`已切到 ${s.storeName}`);
                }}
              />
            ) : null}

            {view === 'about' ? <AboutView mode={mode} demoReason={health?.demoReason} onNavigate={setView} /> : null}
          </div>
        </main>
      </div>

      {/* 吸底操作栏：只在结果页出现，落到内容区右侧，不盖住侧边栏 */}
      {view === 'order' && result && selectedCandidate ? (
        <div
          data-region="actionbar"
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-hair bg-[#faf8f6]/80 backdrop-blur-xl lg:left-[248px]"
        >
          <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-3 md:px-8">
            <div className="min-w-0">
              <p className="eyebrow truncate">已选 · {selectedCandidate.items.reduce((n, i) => n + i.quantity, 0)} 件</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="tnum display text-[19px] leading-none text-ink">
                  {selectedCandidate.price ? `¥${(selectedCandidate.price.priceCents / 100).toFixed(2)}` : '核价失败'}
                </span>
                <span className="truncate text-[11px] text-ink-faint">{selectedCandidate.label}</span>
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              arrow
              onClick={() => setSheetOpen(true)}
              disabled={!selectedCandidate.price || selectedCandidate.price.priceCents === 0}
            >
              去确认下单
            </Button>
          </div>
        </div>
      ) : null}

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

      {result && selectedCandidate ? (
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
      ) : null}

      {/* 存成常用方案 */}
      {saveOpen && result && selectedCandidate ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#2b201b]/30 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
          onClick={() => setSaveOpen(false)}
          role="presentation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="存成常用方案"
            className="animate-fade-up w-full max-w-md overflow-hidden rounded-t-[28px] bg-white shadow-float sm:rounded-[28px]"
          >
            <div className="flex items-start gap-3 border-b border-hair px-6 py-5">
              <div className="min-w-0 flex-1">
                <p className="eyebrow">保存方案</p>
                <h2 className="display mt-2 text-[20px] text-ink">存成常用方案</h2>
                <p className="mt-1 text-[11.5px] text-ink-mute">下次说「还是老样子」就能整单调出来</p>
              </div>
              <button
                type="button"
                onClick={() => setSaveOpen(false)}
                aria-label="关闭"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint transition-colors duration-200 hover:bg-[#f6f1ec] hover:text-ink"
              >
                <IconClose size={15} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div>
                <label htmlFor="pname" className="eyebrow mb-2 block">
                  方案名称
                </label>
                <input
                  id="pname"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="例如 我的日常午餐"
                  className="h-10 w-full rounded-xl bg-[#f8f4f0] px-3.5 text-[13px] text-ink outline-none ring-1 ring-inset ring-transparent transition-all duration-200 placeholder:text-ink-faint focus:bg-white focus:ring-brand-300"
                />
              </div>

              <div>
                <p className="eyebrow mb-2">分类</p>
                <div className="flex flex-wrap gap-1.5">
                  {TAGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSaveTag(t)}
                      aria-pressed={saveTag === t}
                      className={
                        saveTag === t
                          ? 'rounded-full bg-ink px-3 py-1 text-[11px] font-medium text-white transition-colors duration-200'
                          : 'rounded-full bg-[#f6f1ec] px-3 py-1 text-[11px] text-ink-soft transition-colors duration-200 hover:bg-white hover:ring-1 hover:ring-line'
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="eyebrow mb-2">将保存 {selectedCandidate.items.length} 项（结构化编码，不是一句话）</p>
                <ul className="divide-y divide-hair overflow-hidden rounded-2xl bg-[#fbf7f3]">
                  {selectedCandidate.items.map((it, i) => (
                    <li key={i} className="flex items-baseline gap-2.5 px-3.5 py-2">
                      <span className="tnum shrink-0 font-mono text-[10px] text-ink-faint">{it.quantity}×</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{it.name}</span>
                      {it.children.length > 0 ? (
                        <span className="shrink-0 truncate text-[10px] text-ink-faint">{it.children.map((c) => c.name).join(' / ')}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t border-hair px-6 py-4">
              <Button variant="primary" size="lg" arrow className="w-full" onClick={() => void handleSavePlan()} disabled={saving}>
                {saving ? <span className="h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" /> : '保存'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Toasts items={toasts} />
    </div>
  );
}
