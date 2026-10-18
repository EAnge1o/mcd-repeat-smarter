"""下载像素字体分片并生成 pixel-font.css。

分片选择不靠人工维护清单，而是**从上游 CSS 的 unicode-range 反推**：
给定需要的汉字集合，自动算出命中哪些片。这样以后文案改了字，
重跑一次脚本就能得到正确的分片集合，不会出现「某个字悄悄回退成黑体」。

注意 findall 必须用非捕获组 (?:)，否则只返回花括号内部，
@font-face { 和结尾的 } 会一起丢掉，写出的是非法 CSS。
"""

import re, os, sys, json, urllib.request

PKG = '@vp-tw/cjk-web-fonts-fusion-pixel-font@0.0.1'
BASE = f'https://cdn.jsdelivr.net/npm/{PKG}/dist/12px/proportional/zh_hans/'
CSS_URL = BASE + 'Fusion-Pixel-12px-Proportional-Simplified-Chinese.css'
OUT_DIR = 'public/fonts'
DEST = 'src/styles/pixel-font.css'


def parse_ur(s):
    out = set()
    for part in s.split(','):
        part = part.strip().replace('U+', '').replace('u+', '')
        if not part:
            continue
        if '?' in part:
            a, b = part.split('?')
            out |= set(range(int(a, 16), int(a, 16) + int(b, 16)))
        elif '-' in part:
            a, b = part.split('-')
            out |= set(range(int(a, 16), int(b, 16) + 1))
        else:
            out.add(int(part, 16))
    return out


css = urllib.request.urlopen(CSS_URL, timeout=90).read().decode('utf-8')
blocks = re.findall(r'(?:@font-face\s*\{[^}]*\})', css, re.S)
print(f'上游 @font-face: {len(blocks)}')

# 需要覆盖的字符：源码里所有会渲染成像素字的位置
chars = json.load(open('.tmp-chars.json', encoding='utf-8'))
wanted = set(chars['display_chars'])
print(f'目标字符: {len(wanted)} 个')

os.makedirs(OUT_DIR, exist_ok=True)
kept, downloaded, total_bytes = [], 0, 0

for b in blocks:
    ur = re.search(r'unicode-range:\s*([^;]+);', b)
    url = re.search(r'url\(([^)]+)\)', b)
    if not (ur and url):
        continue
    if not any(ord(c) in parse_ur(ur.group(1)) for c in wanted):
        continue

    fname = url.group(1).split('/')[-1]
    dest_path = os.path.join(OUT_DIR, fname)
    if not os.path.exists(dest_path):
        urllib.request.urlretrieve(BASE + fname, dest_path)
        downloaded += 1
    total_bytes += os.path.getsize(dest_path)

    # 绝对路径：public/ 下的文件被映射到站点根；写成裸文件名会 404
    kept.append(b.replace(f'url({url.group(1)})', f'url(/fonts/{fname})'))

if not kept:
    sys.exit('未命中任何分片，检查字符集')

header = f"""/*
 * 融合像素字体（Fusion Pixel Font）12px 比例版 · 简体中文子集
 *
 * 为什么要像素字：麦当劳的视觉血缘是 8-bit 游戏机与街机柜台 —— 有限色、
 * 硬边、点阵字形。超粗黑体只有「粗」，点阵字才是那个年代真的东西。
 *
 * 分片选择由 scripts/build-pixel-font.py 从 unicode-range 反推得出，
 * 不是手写清单 —— 文案改了字重跑脚本即可，不会漏字静默回退。
 * 上游共 78 片，这里收录 {len(kept)} 片（约 {total_bytes / 1024:.0f} KB），
 * 只覆盖标题层实际出现的字符；正文仍用 Noto Sans SC，不额外付费。
 *
 * 本文件必须由 main.tsx 直接 import，不能 @import 合进 index.css：
 * Tailwind 的 PostCSS 管线会剥掉 @font-face 的外层 at-rule，留下裸露声明块。
 *
 * 上游：{PKG}
 * 原字体：fusion-pixel-font（缝合 ark-pixel-font / unifont），作者 TakWolf 等
 * 授权：SIL Open Font License 1.1
 */

"""

open(DEST, 'w', encoding='utf-8').write(header + '\n\n'.join(kept) + '\n')

out = open(DEST, encoding='utf-8').read()

# 回读校验：生成文件后必须确认关键词真的在，别只信脚本自己的成功输出。
# 注意只能数「开头的 @font-face {」——注释正文里也提到了 @font-face 这个词。
n_face = len(re.findall(r'@font-face\s*\{', out))
print(f'下载 {downloaded} 片 / 写入 {n_face} 条 @font-face / 合计 {total_bytes / 1024:.0f} KB')
assert n_face == len(kept), f'@font-face 计数不符: {n_face} != {len(kept)}'
assert out.count('url(/fonts/') == len(kept), '绝对路径数量不符'
print('回读校验通过')