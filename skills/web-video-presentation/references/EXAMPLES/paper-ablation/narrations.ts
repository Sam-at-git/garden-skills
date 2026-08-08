// paper-ablation · narrations —— 长度 === step 数（5）。
const narrations: string[] = [
  // step 1 —— 基线
  "先看完整模型的成绩，86.2。这是基线，记住这个数。",
  // step 2 —— 移除 router
  "现在把 router 这个模块去掉。成绩掉到了 81.4，差了快 5 分。",
  // step 3 —— 移除 gate
  "换一个，把 gate 去掉。这次只掉 3 分出头。",
  // step 4 —— 方差（晚揭示）
  "先别急着下结论。这些数字都有正负 0.3 的方差——你得想清楚，这点下降是不是噪声。",
  // step 5 —— takeaway
  "去掉 router 掉得最多。所以真正起作用的，是它。",
];

export default narrations;
