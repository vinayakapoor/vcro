/** Save text as a file from the browser. */
export function download(filename: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type Cell = string | number | null | undefined;
/** RFC 4180 CSV. Cells that start with a formula character are prefixed so spreadsheets do not run them. */
export function toCsv(rows: Cell[][]): string {
  const cell = (v: Cell) => {
    let t = v == null ? "" : String(v);
    if (/^[=+\-@]/.test(t) && typeof v !== "number") t = `'${t}`;
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
export const fileDate = () => new Date().toISOString().slice(0, 10);
