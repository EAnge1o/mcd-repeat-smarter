import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// 像素字体单独导入：@font-face 不能被 Tailwind 的 PostCSS 管线处理，
// 放在 index.css 里用 @import 会被 Vite 内联时丢掉 @font-face 的外层花括号
import './styles/pixel-font.css';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('未找到 #root 挂载点');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
