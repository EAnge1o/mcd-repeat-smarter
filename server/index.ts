import { existsSync } from 'node:fs';
import path from 'node:path';
import { config, createGateway } from './config.js';
import { createApp } from './app.js';

const gateway = createGateway();
const app = createApp(gateway);

const server = app.listen(config.port, () => {
  const modeText = gateway.mode === 'live' ? '真实 MCP（live）' : '演示数据（demo）';
  console.log(`\n  麦麦老样子 · 服务已启动`);
  console.log(`  接口地址   http://127.0.0.1:${config.port}/api`);
  console.log(`  运行模式   ${modeText}`);
  if (gateway.mode === 'demo') {
    console.log(`  提示       未检测到有效 MCP Token，界面会全程标注「演示数据」`);
  }
  if (config.nodeEnv !== 'production') {
    console.log(`  前端地址   http://127.0.0.1:5173 （由 vite 提供）\n`);
  } else {
    const distExists = existsSync(path.resolve(process.cwd(), 'dist', 'index.html'));
    if (distExists) {
      console.log(`  访问地址   http://127.0.0.1:${config.port}\n`);
    } else {
      console.log(`  注意       未找到 dist/index.html，当前只提供 /api，前端页面不可访问`);
      console.log(`            先执行 npm run build 生成前端产物，或改用 npm run dev\n`);
    }
  }
});

/**
 * 端口占用是启动阶段最常见、也最容易被误读成「代码有 bug」的失败。
 * 默认情况下 Node 会抛一个未捕获的 EADDRINUSE 事件把整段堆栈糊在终端上，
 * 这里改成一句人能读懂、并且能照着做的事。
 */
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      [
        ``,
        `  启动失败：端口 ${config.port} 已被占用。`,
        ``,
        `  常见原因：上一次的 dev / start 进程没退出干净，或同时开了两套服务。`,
        `  处理办法（任选一种）：`,
        `    1) 换端口重启：  PORT=8788 npm start`,
        `    2) 找到占用进程：netstat -ano | findstr :${config.port}`,
        `                     taskkill /PID <上面的PID> /F`,
        ``,
      ].join('\n'),
    );
    process.exit(1);
  }

  if (err.code === 'EACCES') {
    console.error(`\n  启动失败：没有权限监听端口 ${config.port}（低于 1024 的端口通常需要管理员权限）。\n`);
    process.exit(1);
  }

  console.error(`\n  启动失败：${err.message}\n`);
  process.exit(1);
});

/** 收到停止信号时先关连接，避免端口残留把下一次启动顶掉。 */
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    // 兜底：10 秒内还没关完就强退，避免卡住终端
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
