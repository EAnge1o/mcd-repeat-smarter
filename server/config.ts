import 'dotenv/config';
import { McpClient } from './mcp/client.js';
import { McdService } from './mcp/mcdService.js';
import { DemoService } from './mcp/demoService.js';
import type { McdGateway } from './mcp/gateway.js';

const rawToken = (process.env.MCD_MCP_TOKEN ?? '').trim();
const hasToken = rawToken.length > 0 && rawToken !== 'your_mcd_mcp_token_here';

export const config = {
  port: Number(process.env.PORT ?? 8787),
  city: process.env.MCD_DEFAULT_CITY?.trim() || '上海市',
  defaultStoreCode: process.env.MCD_DEFAULT_STORE_CODE?.trim() || '',
  /** 强制演示模式 */
  forceDemo: process.env.DEMO_MODE === 'true',
  hasToken,
  nodeEnv: process.env.NODE_ENV ?? 'development',
};

/**
 * 网关工厂。
 *
 * 只有在「有 Token 且没有强制演示」时才连真实 MCP。
 * 否则降级为演示实现，但会在 /api/health 里明确告知前端当前是演示数据，
 * 前端必须把这个状态展示给用户，不能静默假装一切正常。
 */
export function createGateway(): McdGateway {
  if (config.forceDemo || !config.hasToken) {
    return new DemoService();
  }
  return new McdService(new McpClient(rawToken));
}

/** 给前端的状态说明（不含任何敏感信息） */
export function gatewayStatus(gateway: McdGateway) {
  return {
    mode: gateway.mode,
    demoReason: gateway.mode === 'demo'
      ? config.forceDemo
        ? 'DEMO_MODE=true，当前为演示数据'
        : '未配置 MCD_MCP_TOKEN，当前为演示数据'
      : undefined,
    city: config.city,
    defaultStoreCode: config.defaultStoreCode,
  };
}
