// paper-formula-reveal · narrations —— 长度 === step 数（5）。
const narrations: string[] = [
  // step 1 —— 先演问题（无数学）
  "先别急着看公式。先想一个问题：模型怎么知道，输入里哪段信息，跟当下最相关？",
  // step 2 —— 整条公式弱化预览
  "作者给的答案，就这么一行：score 等于 Q 乘以 K 的转置。先看个大概，别慌。",
  // step 3 —— 点亮 Q
  "这个 Q，是 query，也就是你当下在问的东西。它用强调色标出来。",
  // step 4 —— 点亮 K
  "这个 K，是 key，每段信息都带一个。两个一对，就算出了相关程度。",
  // step 5 —— 代入微数字
  "代个数进去：Q 是 0.8，K 是 0.5，算出来就是 0.40。这就是那段的注意力分数。",
];

export default narrations;
