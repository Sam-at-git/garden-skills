# make-samples.py — 生成积木目录（BLOCK-CATALOG.md）的样张章：每种积木 1~3 步，共 27 步。
# 用法：python3 make-samples.py <项目>/src/chapters/<某章目录>
#   写出该目录的 spec.json / narrations.ts，以及项目根目录的 keys.json（步序 → 截图文件名，shoot.mjs 用）。
#   Figure 步用的是 /paper/fig-02.png（C2C 论文 Fig 2），换别的项目要改 REG 和 src。
import json, sys
bg = lambda: {"type": "background", "locator": None}
S = []  # (key, narration, step)
def add(key, narr, comp, title, blocks, **kw):
    st = {"say": narr[:8], "composition": comp, "title": title, "blocks": blocks, "evidence": kw.pop("evidence", bg())}
    st.update(kw); S.append((key, narr, st))

add("prose", "Prose 示例：结论句用最大一档字号，一句话占满画面。", "centered-hero", "Prose · 结论句",
    [{"type": "Prose", "role": "primary", "size": "display", "text": "瓶颈在**识字**，不在理解"},
     {"type": "Prose", "role": "secondary", "delay": 200, "size": "body", "text": "OCR 14 秒 · LLM 解析 3 秒"}])
add("quote", "Quote 示例：论文原话加出处，让观众知道这是作者说的。", "centered-hero", "Quote · 原话 + 出处",
    [{"type": "Quote", "role": "primary", "text": "Operating this architecture in production revealed several practical lessons.", "by": "§7 · Lessons Learned"}],
    evidence={"type": "fact", "locator": "§7"})
add("callout", "Callout 示例：要点卡，小标签加标题加正文，强调程度用 tone 区分。", "split-screen", "Callout · 要点卡",
    [{"type": "Callout", "role": "primary", "tone": "accent", "kicker": "结论", "title": "OCR 才是瓶颈", "body": ["一份 8 页文档 OCR 要 14 秒", "LLM 解析只要 3 秒"]},
     {"type": "Callout", "role": "secondary", "delay": 150, "tone": "base", "kicker": "为什么", "title": "OCR 逐页跑", "body": "页数越多越慢；LLM 全文只调一次"}])
add("bignumber", "BigNumber 示例：一个大数字从零跳到目标值，旁边写单位和来源。", "rule-of-thirds", "BigNumber · 一个数字说话",
    [{"type": "BigNumber", "role": "primary", "value": 7140, "unit": "份/小时", "label": "理论上限", "sub": "25 个并发槽 × 每份 12.6 秒", "size": "d2", "countUp": True},
     {"type": "Callout", "role": "secondary", "delay": 200, "tone": "muted", "kicker": "实测", "title": "只有 75 份/小时", "body": "差了将近 100 倍"}])
add("stats", "Stats 示例：一排二到四个数字并列，适合把几项指标放在一起看。", "centered-hero", "Stats · 一排数字并列",
    [{"type": "Stats", "role": "primary", "items": [{"value": 96, "unit": "%", "label": "本地 CLIP-KNN 直接放行"}, {"value": 4, "unit": "%", "label": "拿不准，转给 VLM", "accent": True}, {"value": 0.7, "label": "置信度阈值"}]}])
add("bar", "BarChart 示例：柱子从零长起，高亮一根，柱顶标差值，再加一条参考线。", "asymmetric-60-40", "BarChart · 纵向柱图",
    [{"type": "BarChart", "id": "acc", "role": "primary", "title": "执行准确率 %", "unit": "%", "items": [{"label": "单次生成", "value": 61.2}, {"label": "加检索", "value": 70.4}, {"label": "本文方法", "value": 83.7, "accent": True, "delta": "+22.5"}], "reference": {"value": 75, "label": "人工基线"}, "intent": "多轮 + 工具，涨得最多"},
     {"type": "Callout", "role": "secondary", "delay": 200, "kicker": "看哪里", "title": "高亮那根 + 柱顶差值", "body": "基线永远在 0"}])
add("hbar", "BarChart 横向示例：项目名长或者条目多的时候用横向柱图。", "full-width-strip", "BarChart · 横向柱图",
    [{"type": "BarChart", "role": "primary", "orientation": "horizontal", "unit": "秒", "title": "一份 8 页文档的耗时", "items": [{"label": "OCR（逐页）", "value": 14, "accent": True}, {"label": "LLM 解析", "value": 3}, {"label": "下载图片", "value": 1}, {"label": "文本拼接", "value": 0.5}]}])
add("reveal1", "RevealList 示例：列表一项一项揭示，第一步先出两项。", "asymmetric-60-40", "RevealList · 逐项揭示",
    [{"type": "RevealList", "id": "lessons", "role": "primary", "shown": 2, "items": [{"title": "超时按 P99 设", "body": "30 秒太短，同一份文档被跑两遍"}, {"title": "OCR 是瓶颈", "body": "逐页跑，页数越多越慢"}, {"title": "准确率不等于稳定", "body": "98% 准，每天仍有 20 份错"}, {"title": "换模型先看算力画像", "body": "错峰比单看吞吐重要"}]},
     {"type": "Callout", "role": "secondary", "delay": 200, "tone": "muted", "title": "同一个 id 跨步", "body": "shown 每步加一"}])
add("reveal2", "RevealList 下一步：同一个列表，揭示到第四项，前面的项保持可读。", "asymmetric-60-40", "RevealList · 揭示到第 4 项",
    [{"type": "RevealList", "id": "lessons", "role": "primary", "shown": 4, "items": [{"title": "超时按 P99 设", "body": "30 秒太短，同一份文档被跑两遍"}, {"title": "OCR 是瓶颈", "body": "逐页跑，页数越多越慢"}, {"title": "准确率不等于稳定", "body": "98% 准，每天仍有 20 份错"}, {"title": "换模型先看算力画像", "body": "错峰比单看吞吐重要"}]},
     {"type": "Callout", "role": "secondary", "delay": 200, "tone": "muted", "title": "同一个 id 跨步", "body": "shown 每步加一"}], stable=True)
add("chips", "Chips 示例：一排药丸表示 token 序列，当前项点亮，处理过的变淡，中间画箭头。", "full-width-strip", "Chips · 序列逐个点亮",
    [{"type": "Chips", "role": "primary", "size": "lg", "arrows": True, "items": ["分类", "元数据", {"label": "OCR", "sub": "GPU"}, "拼接", {"label": "解析", "sub": "LLM"}], "active": 2, "done": [0, 1]},
     {"type": "Prose", "role": "secondary", "delay": 200, "text": "`active` 点亮当前 · `done` 变淡 · `arrows` 画箭头"}])
add("compare", "Compare 示例：两栏同尺度对照，底部一句结论。", "centered-hero", "Compare · 两栏对照 + 结论",
    [{"type": "Compare", "role": "primary", "columns": [{"title": "单体 worker", "body": ["分类、OCR、解析挤在一个进程", "OCR 一卡，后面全堵", "扩容只能整个复制"], "tone": "muted"}, {"title": "三个微服务", "body": ["Gateway / Worker / Inference 各管一摊", "OCR 慢只影响自己", "瓶颈那层单独加 GPU"], "tone": "accent"}], "verdict": "拆开之后，**瓶颈那层可以单独扩**"}])
add("table", "DataTable 示例：结果表圈出作者要你看的格子，其余格退后，下面一行写作者想证明什么。", "centered-hero", "DataTable · 圈格 + 作者意图",
    [{"type": "DataTable", "role": "primary", "columns": ["方案", "准确率 %", "每页成本 $", "延迟 s"], "rows": [["VLM-only", 97.1, 0.005, 2.1], ["CLIP-KNN", 92.0, 0.0001, 0.3], ["混合（本文）", 96.8, 0.0003, 0.4]], "marks": [{"row": 2}, {"row": 2, "col": 2, "note": "省 94%"}], "dimOthers": True, "intent": "准确率接近 VLM-only，成本接近 CLIP-KNN", "caption": "示例数据 · 仅演示写法"}])
add("pipeline", "Pipeline 示例：横向流程条，当前段点亮，之前完成，之后弱化。", "full-width-strip", "Pipeline · 流程推进到第 3 段",
    [{"type": "Pipeline", "role": "primary", "stages": [{"label": "Gateway", "sub": "收单 0.5s"}, {"label": "Worker", "sub": "调度 1s"}, {"label": "Inference", "sub": "OCR 14s"}, {"label": "解析", "sub": "LLM 3s"}], "active": 2}])
add("diagram", "Diagram 示例：节点和连线画架构，连线可以自绘入场，回环表示重试。", "diagram-canvas", "Diagram · 节点连线图",
    [{"type": "Diagram", "role": "primary", "draw": True, "nodes": [{"id": "gw", "label": "Gateway", "sub": "收单", "x": 12, "y": 50}, {"id": "q", "label": "队列", "x": 37, "y": 50, "kind": "pill"}, {"id": "wk", "label": "Worker", "sub": "编排", "x": 62, "y": 50, "state": "active"}, {"id": "inf", "label": "Inference", "sub": "GPU", "x": 88, "y": 25}, {"id": "db", "label": "数据库", "x": 88, "y": 78, "state": "dim"}], "edges": [{"from": "gw", "to": "q", "label": "文档 ID"}, {"from": "q", "to": "wk"}, {"from": "wk", "to": "inf", "label": "OCR"}, {"from": "wk", "to": "db", "dashed": True}, {"from": "inf", "to": "db", "label": "写结果"}, {"from": "wk", "to": "q", "kind": "loop", "label": "超时重投", "dashed": True}]}])
CODE = "def route(page):\n    v = clip.embed(page)\n    votes = knn(v, k=5)\n    conf = votes.top / 5\n    if conf >= 0.7:\n        return votes.label\n    return vlm.classify(page)"
NOTES = [{"lines": [2, 3], "title": "压成向量再投票", "text": "图像变 512 维向量，找最近 5 个邻居"}, {"lines": [4, 6], "title": "够把握就直接放行", "text": "5 票里 4 票一致 = 0.8，过了 0.7 的线"}, {"lines": [7, 7], "title": "拿不准才花钱", "text": "整页重新发给 VLM"}]
add("code1", "CodeBlock 示例：代码分段讲，当前讲的几行点亮，注释框贴在旁边。", "full-width-strip", "CodeBlock · 逐段讲解",
    [{"type": "CodeBlock", "id": "route", "role": "primary", "lang": "python", "title": "混合分类（示意）", "code": CODE, "notes": NOTES, "active": 0, "vars": [{"name": "conf", "value": "—"}]}])
add("code2", "CodeBlock 下一步：同一段代码讲到第二段，下面的变量快照跟着更新。", "full-width-strip", "CodeBlock · 讲到第 2 段 + 变量快照",
    [{"type": "CodeBlock", "id": "route", "role": "primary", "lang": "python", "title": "混合分类（示意）", "code": CODE, "notes": NOTES, "active": 1, "vars": [{"name": "votes.top", "value": 4}, {"name": "conf", "value": "0.8"}]}], stable=True)
TEX = "[[C]] = [[N]]^2 \\times [[h]] \\times [[b]]"
SYMS = [{"tex": "C", "name": "显存占用", "meaning": "注意力分数矩阵一共占多少字节"}, {"tex": "N", "name": "序列长度", "meaning": "token 数，矩阵是 N × N"}, {"tex": "h", "name": "头数", "meaning": "每个头各存一份，这里是 32"}, {"tex": "b", "name": "每个数的字节", "meaning": "fp16 是 2 字节"}]
add("formula1", "Formula 示例：整条式子出现，逐个符号点亮，下面的词表一行一行出。", "centered-hero", "Formula · 逐符号讲解",
    [{"type": "Formula", "id": "mem", "role": "primary", "tex": TEX, "symbols": SYMS, "active": 1}])
add("formula2", "Formula 下一步：讲完所有符号，再给一句话含义和为什么重要。", "centered-hero", "Formula · 含义与意义",
    [{"type": "Formula", "id": "mem", "role": "primary", "tex": TEX, "symbols": SYMS, "active": [2, 3], "idea": "序列长度翻倍，显存翻四倍", "significance": "长上下文先撞上的是显存墙，不是算力墙"}], stable=True)
REG = {"t2t": {"x": 40, "y": 0, "w": 38, "h": 50, "label": "T2T：传文字"}, "c2c": {"x": 40, "y": 50, "w": 38, "h": 50, "label": "C2C：传 cache"}}
add("fig1", "Figure 示例：论文原图整张上屏，聚光到其中一块，其余淡出。", "diagram-canvas", "Figure · 聚光一个区域",
    [{"type": "Figure", "id": "f2", "role": "primary", "src": "/paper/fig-02.png", "label": "Fig 2", "alt": "T2T 与 C2C 两种通信方式的对照", "regions": REG, "active": "t2t", "mode": "spotlight", "intent": "传文字时，接收方不知道 <p> 是什么"}],
    evidence={"type": "fact", "locator": "Fig 2"})
add("fig2", "Figure 下一步：同一张图，镜头推到另一个区域放大。", "diagram-canvas", "Figure · 推镜到另一个区域",
    [{"type": "Figure", "id": "f2", "role": "primary", "src": "/paper/fig-02.png", "label": "Fig 2", "alt": "T2T 与 C2C 两种通信方式的对照", "regions": REG, "active": "c2c", "mode": "zoom", "minimap": "br", "intent": "传 cache 时，<p> 的含义直接带过去"}],
    evidence={"type": "fact", "locator": "Fig 2"}, stable=True)
G = {"type": "Grid", "id": "thr", "role": "primary", "groups": 8, "groupCols": 4, "rows": 8, "cols": 32}
add("grid1", "Grid 示例：同一张网格，先点亮一排三十二格，这是一个 warp。", "centered-hero", "Grid · 点亮一个 warp",
    [dict(G, lit=32, done=1, label="32 个线程 = 1 个 warp")])
add("grid2", "Grid 下一步：扩到整张网格，两千零四十八个线程就是一次 kernel 启动。", "centered-hero", "Grid · 扩到整张网格",
    [dict(G, lit=2048, done=256, label="8 个 block = 1 个 grid", sub="共 `2,048` 个线程")], stable=True)
add("flow1", "Flow 示例：两个 kernel 要跑五趟显存，融合以后只剩三趟。", "full-width-strip", "Flow · 往返计数",
    [{"type": "Flow", "role": "primary", "lanes": [
        {"from": "显存", "to": "片上", "label": "两个 kernel：`t = a + b`，`y = relu(t)`", "trips": ["a", "b", {"label": "t", "back": True}, "t", {"label": "y", "back": True}]},
        {"from": "显存", "to": "片上", "label": "融合成一个：`y = relu(a + b)`", "trips": ["a", "b", {"label": "y", "back": True}], "count": "3 趟 · 少 40%"}]}])
add("flow2", "Flow 另一种用法：两条管道速度一样，只有每趟送的宽度不同。", "diagram-canvas", "Flow · 延迟 vs 带宽",
    [{"type": "Flow", "role": "primary", "lanes": [
        {"from": "HBM", "to": "SM", "label": "窄管道：每趟送一格", "width": 1, "trips": ["", "", ""], "count": "3 × 1 格"},
        {"from": "HBM", "to": "SM", "label": "宽管道：同样的延迟，每趟送三格", "width": 3, "trips": ["", "", ""], "count": "3 × 3 格"}]}])
GA = {"type": "Gauge", "id": "attn", "role": "primary", "factors": "× 32 头 × 2 B", "capacity": 80, "unit": "GB", "label": "HBM"}
add("gauge1", "Gauge 示例：序列长度九千二百，正方形边长按比例画，显存用了五点一个 G。", "asymmetric-60-40", "Gauge · 扫参到上限",
    [dict(GA, input={"value": 9216, "max": 49152, "label": "N = `9,216`", "caption": "一个头：N × N"}, value=5.1),
     {"type": "Callout", "role": "secondary", "delay": 200, "kicker": "算一下", "title": "`32 × 9216² × 2 B ≈ 5.1 GB`"}])
add("gauge2", "Gauge 下一步：长到四万九千，超出八十 G 的上限，容器标出超出。", "asymmetric-60-40", "Gauge · 超出上限",
    [dict(GA, input={"value": 49152, "max": 49152, "label": "N = `49,152`", "caption": "一个头：N × N"}, value=144),
     {"type": "Callout", "role": "secondary", "delay": 200, "kicker": "算一下", "title": "`32 × 49152² × 2 B = 144 GB`"}], stable=True)
add("placeholder", "Placeholder 示例：素材拿不到时，用占位卡写清楚缺什么，不编图。", "centered-hero", "Placeholder · 缺素材就承认缺",
    [{"type": "Placeholder", "role": "primary", "label": "Fig 5 原图未取得", "note": "arXiv 只有 PDF，整页渲染后再补", "width": 900, "ratio": 2.2}])

keys = [k for k, _, _ in S]
json.dump({"version": 1, "steps": [s for _, _, s in S]}, open(sys.argv[1] + "/spec.json", "w"), ensure_ascii=False, indent=1)
open(sys.argv[1] + "/narrations.ts", "w").write('import type { Narration } from "../../registry/types";\n\nexport const narrations: Narration[] = [\n' + "".join(f"  {json.dumps(n, ensure_ascii=False)},\n" for _, n, _ in S) + "];\n")
json.dump(keys, open(sys.argv[1] + "/../../../keys.json", "w"))
print(len(S), "steps")
