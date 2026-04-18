export function editDistance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (a.length > b.length) [a, b] = [b, a];
  let prev = Array.from({ length: a.length + 1 }, (_, i) => i);
  let curr = new Array(a.length + 1);
  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      curr[i] = a[i - 1] === b[j - 1] ? prev[i - 1] : 1 + Math.min(prev[i - 1], prev[i], curr[i - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[a.length];
}

export function fuzzyThreshold(len) {
  if (len < 5) return 0;
  if (len <= 7) return 1;
  return 2;
}
