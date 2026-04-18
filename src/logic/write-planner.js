export function planContiguousRanges(resultMap) {
  const rowIndexes = Object.keys(resultMap)
    .map(Number)
    .sort((a, b) => a - b);
  const ranges = [];
  if (rowIndexes.length === 0) return ranges;

  let rangeStart = rowIndexes[0];
  let values = [[resultMap[rowIndexes[0]]]];
  for (let i = 1; i < rowIndexes.length; i++) {
    if (rowIndexes[i] === rowIndexes[i - 1] + 1) {
      values.push([resultMap[rowIndexes[i]]]);
    } else {
      ranges.push({ startRowIndex: rangeStart, values });
      rangeStart = rowIndexes[i];
      values = [[resultMap[rowIndexes[i]]]];
    }
  }
  ranges.push({ startRowIndex: rangeStart, values });
  return ranges;
}
