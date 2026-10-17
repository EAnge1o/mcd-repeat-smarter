/**
 * 麦当劳 MCP Server 的最小 Streamable HTTP 客户端。
 *
 * 安全约定：
 * - Token 只在此文件的请求头里出现，任何日志、错误信息、响应体都不会回传 Token。
 * - 服务端对外只暴露归一化后的业务数据，不把原始 MCP 响应透传给浏览器。
 */

const MCP_ENDPOINT = process.env.MCD_MCP_URL || 'https://mcp.mcd.cn';
const PROTOCOL_VERSION = '2025-03-26';
const DEFAULT_TIMEOUT_MS = 20_000;

export class McpError extends Error {
  constructor(
    message: string,
    public readonly kind: 'auth' | 'rate' | 'network' | 'timeout' | 'tool' | 'protocol' | 'config',
    public readonly hint?: string,
  ) {
    super(message);
    this.name = 'McpError';
  }
}

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string;
  result?: unknown;
  error?: { code?: number; message?: string };
}

export class McpClient {
  private sessionId: string | null = null;
  private seq = 0;
  private initialized = false;

  constructor(
    private readonly token: string,
    private readonly endpoint: string = MCP_ENDPOINT,
  ) {
    if (!token) {
      throw new McpError('未配置麦当劳 MCP Token', 'config', '请在 .env 中设置 MCD_MCP_TOKEN，或改用演示模式。');
    }
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.token}`,
      'MCP-Protocol-Version': PROTOCOL_VERSION,
    };
    if (this.sessionId) h['Mcp-Session-Id'] = this.sessionId;
    return h;
  }

  /** 解析响应体：兼容纯 JSON 与 SSE 两种返回形式。 */
  private async parseResponse(res: Response): Promise<JsonRpcMessage> {
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const text = await res.text();

    if (contentType.includes('text/event-stream')) {
      const messages: JsonRpcMessage[] = [];
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          messages.push(JSON.parse(payload) as JsonRpcMessage);
        } catch {
          // 忽略无法解析的心跳/注释行
        }
      }
      if (messages.length === 0) {
        throw new McpError('MCP 服务返回了无法解析的事件流', 'protocol');
      }
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const m = messages[i];
        if (m.result !== undefined || m.error !== undefined) return m;
      }
      return messages[messages.length - 1];
    }

    if (!text.trim()) {
      throw new McpError('MCP 服务返回空响应', 'protocol');
    }
    try {
      return JSON.parse(text) as JsonRpcMessage;
    } catch {
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) continue;
        try {
          return JSON.parse(trimmed) as JsonRpcMessage;
        } catch {
          // 继续找下一行
        }
      }
      throw new McpError('MCP 服务返回了非 JSON 响应', 'protocol');
    }
  }

  private async post(body: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<JsonRpcMessage> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const sid = res.headers.get('mcp-session-id');
      if (sid) this.sessionId = sid;

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new McpError('MCP Token 无效、已过期或未授权', 'auth', '请到 open.mcd.cn/mcp 控制台重新激活并复制 Token。');
        }
        if (res.status === 429) {
          throw new McpError('MCP 调用过于频繁（超过 600 次/分钟）', 'rate', '请稍等几秒后重试。');
        }
        if (res.status >= 500) {
          throw new McpError(`MCP 服务暂时不可用（HTTP ${res.status}）`, 'network', '这通常是官方服务侧问题，稍后再试。');
        }
        throw new McpError(`MCP 请求失败（HTTP ${res.status}）`, 'protocol');
      }

      return await this.parseResponse(res);
    } catch (err) {
      if (err instanceof McpError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new McpError('MCP 调用超时', 'timeout', '网络较慢或服务繁忙，请重试。');
      }
      throw new McpError('无法连接到麦当劳 MCP 服务', 'network', '请检查本机网络是否能访问 mcp.mcd.cn。');
    } finally {
      clearTimeout(timer);
    }
  }

  private async rpc(method: string, params?: unknown): Promise<unknown> {
    this.seq += 1;
    const message = await this.post({ jsonrpc: '2.0', id: this.seq, method, ...(params === undefined ? {} : { params }) });
    if (message.error) {
      throw new McpError(message.error.message || 'MCP 工具调用失败', 'tool');
    }
    return message.result ?? message;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.rpc('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'mcd-repeat-smarter', version: '1.0.0' },
    });
    this.initialized = true;
    // 通知消息不等待结果，失败也不影响后续调用
    try {
      await this.post({ jsonrpc: '2.0', method: 'notifications/initialized' }, 8_000);
    } catch {
      // 忽略
    }
  }

  /**
   * 列出服务端当前真实暴露的 Tool（用于自检与文档核对，不在业务请求链路里使用）。
   * 只返回名称与描述，避免把完整 Schema 带到上层。
   */
  async listTools(): Promise<{ name: string; description: string }[]> {
    await this.initialize();
    const result = (await this.rpc('tools/list')) as { tools?: { name?: string; description?: string }[] } | undefined;
    return (result?.tools ?? []).map((t) => ({ name: t.name ?? '', description: t.description ?? '' }));
  }

  /**
   * 调用一个 MCP Tool，返回解析后的 JSON 业务数据。
   * MCP 的 content[0].text 通常是 JSON 字符串，这里统一解析。
   */
  async callTool<T = unknown>(name: string, args: Record<string, unknown> = {}, timeoutMs?: number): Promise<T> {
    await this.initialize();
    this.seq += 1;
    const message = await this.post(
      { jsonrpc: '2.0', id: this.seq, method: 'tools/call', params: { name, arguments: args } },
      timeoutMs,
    );

    if (message.error) {
      throw new McpError(message.error.message || `调用 ${name} 失败`, 'tool');
    }

    const result = message.result as
      | {
          isError?: boolean;
          structuredContent?: unknown;
          content?: { type: string; text?: string }[];
        }
      | undefined;

    if (!result) {
      throw new McpError(`${name} 没有返回结果`, 'protocol');
    }
    if (result.isError) {
      throw new McpError(`${name} 执行失败：${this.firstText(result) ?? '未知错误'}`, 'tool');
    }
    if (result.structuredContent !== undefined) {
      return result.structuredContent as T;
    }

    const text = this.firstText(result);
    if (text === undefined) {
      throw new McpError(`${name} 返回了空内容`, 'protocol');
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new McpError(`${name} 返回内容不是 JSON`, 'protocol');
    }
  }

  private firstText(result: { content?: { type: string; text?: string }[] }): string | undefined {
    const item = result.content?.find((c) => c.type === 'text' && typeof c.text === 'string');
    return item?.text;
  }
}
