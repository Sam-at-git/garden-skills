// paper-architecture-zoom · narrations —— step 数 + 音频的唯一真相源。
// 长度 === chapter.tsx 里 if (step === N) 用到的最大 N + 1（这里 6）。
// 文本与 script.md 对应段语义一致；可为 TTS 微调标点断句。
const narrations: string[] = [
  // step 1 —— 整张地图淡入
  "先别急着看细节。我们把整条流程画出来：输入进来，过一遍模型，输出结果。",
  // step 2 —— 镜头推进到 model 盒子
  "现在把镜头推进到中间这个模型盒子，看看里面到底干了什么。",
  // step 3 —— 子模块逐个揭示
  "模型内部，其实藏着三个小模块：Query、Key、Value。一个一个来。",
  // step 4 —— callout 指认
  "重点是 Query 这个模块——它决定了信息怎么被路由出去。",
  // step 5 —— 镜头退回总图
  "退回来再看整张图。这下你应该清楚，模型那一块到底在做什么了。",
  // step 6 —— takeaway
  "一句话：这篇的核心，就藏在这个 router 里。",
];

export default narrations;
