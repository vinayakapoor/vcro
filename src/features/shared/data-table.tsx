import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, Download,
  MoreHorizontal, Rows3, Search, Settings2, SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type Column<T> = { id: string; header: string; cell: (r: T) => ReactNode; sort?: (r: T) => number | string; className?: string };
export type Filter<T> = { id: string; label: string; options: string[]; match: (r: T, v: string) => boolean };

export function DataTable<T>({
  rows, columns, getId, filters = [], search, searchPlaceholder = "Search", onRowClick, rowMenu, toolbarExtra, initialFilters = {},
  emptyText = "No results", emptyAction, defaultSort, pageSizeDefault = 25,
}: {
  rows: T[];
  columns: Column<T>[];
  getId: (r: T) => string;
  filters?: Filter<T>[];
  search?: (r: T) => string;
  searchPlaceholder?: string;
  onRowClick?: (r: T) => void;
  rowMenu?: (r: T) => ReactNode;
  toolbarExtra?: ReactNode;
  initialFilters?: Record<string, string | undefined>;
  emptyText?: string;
  emptyAction?: ReactNode;
  defaultSort?: { id: string; dir: "asc" | "desc" };
  pageSizeDefault?: number;
}) {
  const [q, setQ] = useState("");
  const [vals, setVals] = useState<Record<string, string | undefined>>(initialFilters);
  const [sort, setSort] = useState(defaultSort ?? null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSizeDefault);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [dense, setDense] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [advanced, setAdvanced] = useState(true);

  const filtered = useMemo(() => {
    let out = rows.filter((r) => filters.every((f) => !vals[f.id] || f.match(r, vals[f.id]!)));
    if (q.trim() && search) out = out.filter((r) => search(r).toLowerCase().includes(q.trim().toLowerCase()));
    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col?.sort) {
        const k = col.sort;
        out = [...out].sort((a, b) => {
          const x = k(a), y = k(b);
          const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
          return sort.dir === "asc" ? c : -c;
        });
      }
    }
    return out;
  }, [rows, filters, vals, q, search, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const p = Math.min(page, pages - 1);
  const view = filtered.slice(p * size, p * size + size);
  const cols = columns.filter((c) => !hidden.has(c.id));
  const allSel = view.length > 0 && view.every((r) => sel.has(getId(r)));
  const cellPad = dense ? "py-1.5" : "py-2.5";

  const toggleSort = (id: string) =>
    setSort((s) => (s?.id === id ? (s.dir === "desc" ? { id, dir: "asc" } : null) : { id, dir: "desc" }));

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {search && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="h-8 w-56 pl-8" />
          </div>
        )}
        {filters.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setAdvanced((a) => !a)} aria-pressed={advanced}>
            <SlidersHorizontal className="size-4" />Advanced
          </Button>
        )}
        {advanced && filters.map((f) => (
          <DropdownMenu key={f.id}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={cn("border-dashed", vals[f.id] && "border-solid bg-muted")}>
                {f.label}{vals[f.id] ? `: ${vals[f.id]}` : ""}<ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
              <DropdownMenuRadioGroup value={vals[f.id] ?? ""} onValueChange={(v) => { setVals((s) => ({ ...s, [f.id]: v || undefined })); setPage(0); }}>
                <DropdownMenuRadioItem value="">All</DropdownMenuRadioItem>
                {f.options.map((o) => <DropdownMenuRadioItem key={o} value={o}>{o}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
        {toolbarExtra}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => toast("Export started")}><Download className="size-4" />Export</Button>
          <IconBtn label={dense ? "Comfortable rows" : "Compact rows"} onClick={() => setDense((d) => !d)}><Rows3 className="size-4" /></IconBtn>
          <DropdownMenu>
            <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="size-8" aria-label="Columns"><Columns3 className="size-4" /></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent>Columns</TooltipContent></Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              {columns.map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={!hidden.has(c.id)} onCheckedChange={(on) => setHidden((h) => { const n = new Set(h); on ? n.delete(c.id) : n.add(c.id); return n; })}>{c.header}</DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="size-8" aria-label="Table settings"><Settings2 className="size-4" /></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent>Table settings</TooltipContent></Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => { setVals({}); setQ(""); setSort(defaultSort ?? null); setHidden(new Set()); setDense(false); }}>Reset table</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10">
                <Checkbox checked={allSel} onCheckedChange={(on) => setSel((s) => { const n = new Set(s); view.forEach((r) => (on ? n.add(getId(r)) : n.delete(getId(r)))); return n; })} aria-label="Select all rows" />
              </TableHead>
              {cols.map((c) => (
                <TableHead key={c.id} className={cn("whitespace-nowrap", c.className)}>
                  {c.sort ? (
                    <button type="button" onClick={() => toggleSort(c.id)} className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {c.header}
                      {sort?.id === c.id ? (sort.dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />) : <ArrowUpDown className="size-3.5 opacity-50" />}
                    </button>
                  ) : c.header}
                </TableHead>
              ))}
              {rowMenu && <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.length === 0 ? (
              <TableRow><TableCell colSpan={cols.length + 2} className="py-8 text-center text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-2">{emptyText}{emptyAction ?? <Button variant="outline" size="sm" onClick={() => { setVals({}); setQ(""); }}>Clear filters</Button>}</div>
              </TableCell></TableRow>
            ) : view.map((r) => {
              const id = getId(r);
              return (
                <TableRow key={id} data-state={sel.has(id) ? "selected" : undefined} className={onRowClick ? "cursor-pointer" : undefined} onClick={() => onRowClick?.(r)}>
                  <TableCell className={cellPad} onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={sel.has(id)} onCheckedChange={(on) => setSel((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; })} aria-label="Select row" />
                  </TableCell>
                  {cols.map((c) => <TableCell key={c.id} className={cn(cellPad, c.className)}>{c.cell(r)}</TableCell>)}
                  {rowMenu && (
                    <TableCell className={cellPad} onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-7" aria-label="Row actions"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">{rowMenu(r)}</DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="tabular-nums">{filtered.length ? `${p * size + 1}-${Math.min(filtered.length, (p + 1) * size)} of ${filtered.length}` : "0 of 0"}</span>
        <div className="flex items-center gap-2">
          <span>Rows</span>
          <Select value={String(size)} onValueChange={(v) => { setSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="h-8 w-[70px]" aria-label="Rows per page"><SelectValue /></SelectTrigger>
            <SelectContent>{[10, 25, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
          <span className="tabular-nums">{p + 1} / {pages}</span>
          <IconBtn label="First page" onClick={() => setPage(0)} disabled={p === 0}><ChevronsLeft className="size-4" /></IconBtn>
          <IconBtn label="Previous page" onClick={() => setPage(p - 1)} disabled={p === 0}><ChevronLeft className="size-4" /></IconBtn>
          <IconBtn label="Next page" onClick={() => setPage(p + 1)} disabled={p >= pages - 1}><ChevronRight className="size-4" /></IconBtn>
          <IconBtn label="Last page" onClick={() => setPage(pages - 1)} disabled={p >= pages - 1}><ChevronsRight className="size-4" /></IconBtn>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ label, children, ...rest }: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" className="size-8" aria-label={label} {...rest}>{children}</Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
