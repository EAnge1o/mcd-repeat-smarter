import express, { type Express } from 'express';
import cors from 'cors';
import path from 'node:path';
import { existsSync } from 'node:fs';
import type { McdGateway } from './mcp/gateway.js';
import { createApiRouter, errorHandler } from './routes/api.js';

/**
 * 构建 Express 应用（不 listen）。
 * 拆出来是为了让集成测试能注入 DemoService，避免测试时打到真实 MCP。
 */
export function createApp(gateway: McdGateway): Express {
  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '256kb' }));

  app.use('/api', createApiRouter(gateway));

  const distDir = path.resolve(process.cwd(), 'dist');
  if (existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
