import { useState } from 'react';
import type { HistoryOrder } from '../../server/domain/types';
import { SkeletonRows } from './Common';
import { IconArrow, IconChevronDown } from './Icons';

/**
 * 最近订单列表。
 *
 * 三条硬规则：
 * 1. 每一行都来自 MCP 的真实历史订单，标题区必须写明来源，
 *    不能和用户自己保存的常用方案混为一谈。
 * 2. 只有「最近一单」提供「以这一单为起点」—— 后端「还是老样子」取的就是最近一单，
 *    老订单上不放这个按钮，避免说了做不到。
 * 3. 金额缺失就留空位，不显示一排「—」装作有数据；¥0.00 单独标注为券/积分抵扣。
 */
export function OrderHistory({
  orders,
  loading,
  mode,
  onUseLatest,
}: {
  orders: HistoryOrder[];
  loading: boolean;
  mode: 'live' | 'demo';
  onUseLatest?: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="orders">
      <div className="orders__head">
        <span>{mode === 'live' ? '麦当劳 MCP · 实时历史' : '内置示例数据'}</span>
        <span className="sep">/</span>
        <span>{orders.length > 0 ? `${orders.length} 单可达` : '暂无'}</span>
      </div>

      {loading ? (
        <div style={{ padding: '18px 18px 20px' }}>
          <SkeletonRows rows={4} />
        </div>
      ) : orders.length === 0 ? (
        <div style={{ padding: '4px 18px 18px' }}>
          <div className="empty">
            <div className="empty__title">还没有历史订单</div>
            <div className="empty__desc">
              {mode === 'demo'
                ? '演示模式下只有内置示例订单，不代表你的真实账号。'
                : '这个账号还没有可读取的麦当劳订单。你可以先手动挑一份存成常用方案。'}
            </div>
          </div>
        </div>
      ) : (
        <>
          {orders.slice(0, 6).map((o, idx) => {
            const open = openId === o.orderId;
            // paidYuan 为 null = 接口没返回金额；"0" = 券/积分全额抵扣，两者必须区分
            const rawPaid = o.paidYuan === null ? null : Number(o.paidYuan);
            const paid = rawPaid !== null && Number.isFinite(rawPaid) ? rawPaid : null;
            const count = o.items.reduce((n, it) => n + it.quantity, 0);

            return (
              <div key={o.orderId} className="order">
                <button
                  type="button"
                  className="order__row"
                  onClick={() => setOpenId(open ? null : o.orderId)}
                  aria-expanded={open}
                  aria-label={`${o.createTime.slice(5, 16)} 的订单，共 ${count} 件${
                    paid ? `，实付 ${paid.toFixed(2)} 元` : ''
                  }`}
                >
                  <span className="order__date">{o.createTime.slice(5, 10)}</span>
                  <span className="order__items">{o.items.map((i) => i.name).join('、')}</span>
                  <span
                    className={`order__amt${
                      paid === null ? ' order__amt--void' : paid === 0 ? ' order__amt--zero' : ''
                    }`}
                  >
                    {paid === null ? '' : `¥${paid.toFixed(2)}`}
                  </span>
                  <span className="order__chev">
                    <IconChevronDown size={12} />
                  </span>
                </button>

                {open && (
                  <div className="order__body">
                    {o.items.map((item, i) => (
                      <div key={`${item.productCode}-${i}`}>
                        <div className="order__line">
                          <span>
                            {item.quantity}× {item.name}
                          </span>
                          {item.unitPriceCents ? (
                            <small>¥{((item.unitPriceCents * item.quantity) / 100).toFixed(2)}</small>
                          ) : null}
                        </div>
                        {item.children.length > 0 && (
                          <div className="order__child">{item.children.map((c) => c.name).join(' / ')}</div>
                        )}
                      </div>
                    ))}

                    <div className="order__meta">
                      <span>{o.createTime.slice(0, 16)}</span>
                      <span>共 {count} 件</span>
                      <span>{o.storeName || `门店 ${o.storeCode}`}</span>
                      <span>单号 ···{o.orderId.slice(-8)}</span>
                      {paid === 0 && <span>实付 ¥0.00，券或积分全额抵扣</span>}
                    </div>

                    {idx === 0 && onUseLatest && (
                      <button
                        type="button"
                        className="order__use"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUseLatest();
                        }}
                      >
                        以这一单为起点
                        <IconArrow size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {orders.some((o) => o.paidYuan !== null && Number(o.paidYuan) === 0) && (
            <p className="orders__note">实付 ¥0.00 的单通常是券或积分全额抵扣，不是数据缺失。</p>
          )}
        </>
      )}
    </div>
  );
}
