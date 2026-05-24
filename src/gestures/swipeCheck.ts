function checkProgress(dx: number, cardWidth: number, completeRatio: number): number {
  if (dx <= 0 || cardWidth <= 0) return 0;
  const threshold = cardWidth * completeRatio;
  return Math.min(1, dx / threshold);
}

function shouldCompleteCheck(progress: number): boolean {
  return progress >= 1;
}

export { checkProgress, shouldCompleteCheck };
