// paper-formula-reveal · narrations —— step 数 + 音频的唯一真相源。
// 长度 === step 数（5）；step 是 0-indexed，有效 step 为 0..4，
// 即 narrations[i] 就是 chapter.tsx 里 step === i 那一屏的口播。
export const narrations: string[] = [
  // step 0 —— 先演问题（无数学）
  "先别急着看公式。先想一个问题：模型怎么知道，输入里哪段信息，跟当下最相关？",
  // step 1 —— 整条公式弱化预览
  "作者给的答案，就这么一行：score 等于 Q 乘以 K 的转置。先看个大概，别慌。",
  // step 2 —— 点亮 Q
  "这个 Q，是 query，也就是你当下在问的东西。右边图里的 Q 同时亮起来。",
  // step 3 —— 点亮 K
  "这个 K，是 key，每段信息都带一个。两个一对，就算出了相关程度。",
  // step 4 —— 代入微数字
  "代个数进去：Q 是 0.8，K 是 0.5，算出来就是 0.40。这就是那段的注意力分数。",
];
