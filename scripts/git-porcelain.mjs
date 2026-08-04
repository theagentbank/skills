export function parsePorcelainPath(record) {
  if (record.length < 4 || record[2] !== ' ') {
    throw new Error(`Invalid git status --porcelain record: ${record}`);
  }
  return record.slice(3);
}
