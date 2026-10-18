"""下载像素字体分片并生成 pixel-font.css。

分片选择不靠人工维护清单，也不靠外部临时文件，而是**直接扫源码 + 从上游 CSS 的
unicode-range 反推**：把所有会渲染成像素字的位置（标题、统计数字、金额、时间）
上的字符抓出来，自动算出命中哪些片。以后文案改了字，重跑一次脚本就能得到
正确的分片集合，不会出现「某个字悄悄回退成黑体」。

注意 findall 必须用非捕获组 (?:)，否则只返回花括号内部，
@font-face { 和结尾的 } 会一起丢掉，写出的是非法 CSS。
"""

import re, os, sys, glob, urllib.request

PKG = '@vp-tw/cjk-web-fonts-fusion-pixel-font@0.0.1'
BASE = f'https://cdn.jsdelivr.net/npm/{PKG}/dist/12px/proportional/zh_hans/'
CSS_URL = BASE + 'Fusion-Pixel-12px-Proportional-Simplified-Chinese.css'
OUT_DIR = 'public/fonts'
DEST = 'src/styles/pixel-font.css'

# 扫描范围：所有渲染用户可见中文/数字的源文件
SCAN_GLOBS = ['src/**/*.tsx', 'src/**/*.ts', 'index.html']


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


def collect_chars():
    """
    收集需要覆盖的字符。

    直接取源码里出现的所有 CJK 汉字 + 全角标点 + 常用符号，不做「哪些会渲染成
    像素字」的区分—— 分片是按unicode 区间切的，多收几个字的代价是零（同一片
    里的字本来就要下载），漏收的代价是真字回退成黑体。这个方向上的取舍是明确的。
    """
    src = []
    for g in SCAN_GLOBS:
        for f in glob.glob(g, recursive=True):
            if f.endswith(('.tsx', '.ts', '.html')):
                src.append(open(f, encoding='utf-8').read())
    text = '\n'.join(src)

    keep = set()
    for ch in text:
        cp = ord(ch)
        # CJK 统一汉字 + 扩展A + 中文标点 + 全角符号
        if 0x4E00 <= cp <= 0x9FFF or 0x3400 <= cp <= 0x4DBF or 0x3000 <= cp <= 0x303F or 0xFF00 <= cp <= 0xFF65:
            keep.add(ch)
    # 「·」「¥」「≥」「≤」这类常用符号（像素字有对应字形时才算命中，命中不了也无害）
    keep |= set('·¥≥≤×÷±≈°′″℃％‰')
    return keep


css = urllib.request.urlopen(CSS_URL, timeout=90).read().decode('utf-8')
blocks = re.findall(r'(?:@font-face\s*\{[^}]*\})', css, re.S)
print(f'上游 @font-face: {len(blocks)}')

wanted = collect_chars()
print(f'目标字符: {len(wanted)} 个（扫 {len(SCAN_GLOBS)} 组 glob 得到）')

# ASCII 可见字符（数字/¥/./-/大小写字母）——「数字也换像素风」要用。
# 这部分不在汉字扫描范围内，必须单独声明，否则 .pixel-digits 会静默回退成黑体。
# 注意存的是**码位**不是字符：下面要和 parse_ur 返回的整数集合求交集。
ASCII = set(range(0x20, 0x7F))
# 常用货币/符号，全角 ¥(U+FFE5) 落在 Halfwidth-and-Fullwidth-Forms 分片里
EXTRA = set('¥€£°′″')

os.makedirs(OUT_DIR, exist_ok=True)
kept, downloaded, total_bytes = [], 0, 0

for b in blocks:
    ur = re.search(r'unicode-range:\s*([^;]+);', b)
    url = re.search(r'url\(([^)]+)\)', b)
    if not (ur and url):
        continue
    rng = parse_ur(ur.group(1))
    # 汉字 + ASCII + 常用符号，任一命中就收
    if not (any(ord(c) in rng for c in wanted | EXTRA) or (ASCII & rng)):
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

# 必须覆盖 ASCII 全区间，否则金额里的数字会缺字回退。
all_ranges = set()
for b in kept:
    m = re.search(r'unicode-range:\s*([^;]+);', b)
    if m:
        all_ranges |= parse_ur(m.group(1))
gap = sorted(ASCII - all_ranges)
assert not gap, f'ASCII 未被分片覆盖，缺: {[hex(g) for g in gap[:12]]}（数字会回退成黑体）'

DIGITS_RULES = """
/*
 * 像素数字。
 *
 * 金额、计数、时间戳、订单号这一层全部走点阵数字 —— 8-bit 柜台机的收银小票
 * 就是这个质感，而这些恰好是数据页里最该有质感的东西：一个 ¥129.04 用点阵字
 * 排出来，比用黑体更像「机器算出来的、真的花了这么多」。
 *
 * 实现要点：用同名字体 + `unicode-range` 只圈住 ASCII，**不是**给数字包 span。
 * 这样一个元素里的中文会自动落到列表里的下一档（黑体），两者能自然混排
 * （「共 10 单」），不必在 JSX 里拆成碎片。
 *
 * ⚠️ 这些规则必须在本文件里，不能放index.css：
 * Tailwind 的 PostCSS 管线会把自定义 @font-face 连同紧邻的自定义类一起剥掉
 * （注释保留、规则体消失），getComputedStyle 拿到的是默认 sans-serif。
 * 本文件由 main.tsx 单独 import，不经 Tailwind，已验证可完整通过。
 */
.pixel-digits {
  font-family: 'Fusion Pixel 12px Proportional Simplified Chinese', 'Noto Sans SC', 'PingFang SC',
    'Microsoft YaHei', system-ui, sans-serif;
  font-weight: 400;
  letter-spacing: 0;
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: grayscale;
  /* 金额列必须等宽，否则小数点会左右跳 */
  font-variant-numeric: tabular-nums;
}

/*
 * 中小号像素字。**这些不是 12 的倍数** —— 实测 10/11/13/14/15/17/22px 下
 * 点阵网格并未打散，强行凑整只会压低信息密度（17px 的金额硬改成 12px，
 * 整张订单表就没有层级了）。12 倍数只对 36px 以上的大标题成立。
 */
.pixel-10 { font-size: 10px; }
.pixel-11 { font-size: 11px; }
.pixel-13 { font-size: 13px; }
.pixel-14 { font-size: 14px; }
.pixel-15 { font-size: 15px; }
.pixel-17 { font-size: 17px; }
.pixel-22 { font-size: 22px; }
"""

header = f"""/*
 * 融合像素字体（Fusion Pixel Font）12px 比例版 · 简体中文子集
 *
 * 为什么要像素字：麦当劳的视觉血缘是 8-bit 游戏机与街机柜台 —— 有限色、
 * 硬边、点阵字形。超粗黑体只有「粗」，点阵字才是那个年代真的东西。
 *
 * 分片选择由 scripts/build-pixel-font.py 从 unicode-range 反推得出，
 * 不是手写清单 —— 文案改了字重跑脚本即可，不会漏字静默回退。
 * 上游共 78 片，这里收录 {len(kept)} 片（约 {total_bytes / 1024:.0f} KB），
 * 覆盖源码中出现的全部汉字 + ASCII 数字；正文中文仍用 Noto Sans SC。
 *
 * 本文件必须由 main.tsx 直接 import，不能 @import 合进 index.css：
 * Tailwind 的 PostCSS 管线会剥掉 @font-face 的外层 at-rule，留下裸露声明块。
 *
 * 上游：{PKG}
 * 原字体：fusion-pixel-font（缝合 ark-pixel-font / unifont），作者 TakWolf 等
 * 授权：SIL Open Font License 1.1
 */

"""

open(DEST, 'w', encoding='utf-8').write(header + '\n\n'.join(kept) + '\n' + DIGITS_RULES)

out = open(DEST, encoding='utf-8').read()

# 回读校验：生成文件后必须确认关键词真的在，别只信脚本自己的成功输出。
# 注意只能数「开头的 @font-face {」——注释正文里也提到了 @font-face 这个词。
n_face = len(re.findall(r'@font-face\s*\{', out))
print(f'下载 {downloaded} 片 / 写入 {n_face} 条 @font-face / 合计 {total_bytes / 1024:.0f} KB')
assert n_face == len(kept), f'@font-face 计数不符: {n_face} != {len(kept)}'
assert out.count('url(/fonts/') == len(kept), '绝对路径数量不符'

# 数字规则必须真的写进去了 —— 上一轮这些规则写在 index.css 里被 Tailwind 剥掉过
assert '.pixel-digits {' in out, '.pixel-digits 规则缺失'
for n in (10, 11, 13, 14, 15, 17, 22):
    assert f'.pixel-{n} {{' in out, f'.pixel-{n} 缺失'
print('回读校验通过')