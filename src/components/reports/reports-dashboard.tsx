"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useFormatCurrency } from "@/contexts/settings-context";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Loader2, AlertTriangle, Download, Printer, ChevronDown } from "lucide-react";

type Range = "today" | "week" | "month" | "custom";
type Tab = "overview" | "lowStock";

interface Summary {
  revenue: number;
  grossProfit: number;
  transactions: number;
  tips: number;
  avgTransaction: number;
  voidedCount: number;
  refundCount: number;
  refundTotal: number;
  customerVisits: number;
}

interface RevenueDay { date: string; revenue: number; transactions: number }
interface PieSlice { method: string; value: number }
interface TopProduct { name: string; qty: number; revenue: number }
interface LowStockProduct { id: string; name: string; sku: string | null; stock: number; lowStockThreshold: number; category: string | null }

const PIE_COLORS = ["#0f2044", "#f5c518", "#4fb8a5", "#e26c1a", "#9b5cc9"];

export function ReportsDashboard() {
  const t = useTranslations("reports");
  const tp = useTranslations("products");
  const formatCurrency = useFormatCurrency();
  const [range, setRange] = useState<Range>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [excludeRefunds, setExcludeRefunds] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [revenueByDay, setRevenueByDay] = useState<RevenueDay[]>([]);
  const [pieData, setPieData] = useState<PieSlice[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [exportOpen, setExportOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/reports?range=${range}`;
      if (range === "custom" && from && to) url += `&from=${from}&to=${to}`;
      const res = await fetch(url);
      const data = await res.json();
      setSummary(data.summary);
      setRevenueByDay(data.revenueByDay || []);
      setPieData(data.pieData || []);
      setTopProducts(data.topProducts || []);
      setLowStock(data.lowStock || []);
    } finally {
      setLoading(false);
    }
  }, [range, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handlePrint() {
    setExportOpen(false);
    setTimeout(() => window.print(), 100);
  }

  function handleExportCSV() {
    setExportOpen(false);
    if (!summary) return;
    const rangeLabel = range === "today" ? "Today" : range === "week" ? "This Week" : range === "month" ? "This Month" : `${from} to ${to}`;
    const rows: string[][] = [];

    rows.push(["Olgax POS — Report Export"]);
    rows.push(["Period", rangeLabel]);
    rows.push(["Generated", new Date().toLocaleString()]);
    rows.push([]);

    rows.push(["SUMMARY"]);
    rows.push(["Metric", "Value"]);
    stats.forEach(s => rows.push([s.label, s.value]));
    rows.push([]);

    rows.push(["TOP SELLING PRODUCTS"]);
    rows.push(["Product", "Units Sold", "Revenue"]);
    topProducts.forEach(p => rows.push([p.name, String(p.qty), formatCurrency(p.revenue)]));
    rows.push([]);

    rows.push(["REVENUE BY DAY"]);
    rows.push(["Date", "Revenue", "Transactions"]);
    revenueByDay.forEach(d => rows.push([d.date, formatCurrency(d.revenue), String(d.transactions)]));
    rows.push([]);

    rows.push(["PAYMENT METHODS"]);
    rows.push(["Method", "Amount"]);
    pieData.forEach(d => rows.push([d.method, formatCurrency(d.value)]));

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `olgax-report-${rangeLabel.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stats = summary
    ? [
        {
          label: excludeRefunds ? t("net_revenue") : t("revenue"),
          value: formatCurrency(excludeRefunds
            ? Math.max(0, summary.revenue - (summary.refundTotal ?? 0))
            : summary.revenue),
        },
        { label: t("gross_profit"), value: formatCurrency(summary.grossProfit ?? 0) },
        { label: t("transactions"), value: summary.transactions.toString() },
        { label: t("avg_transaction"), value: formatCurrency(summary.avgTransaction) },
        { label: t("tips"), value: formatCurrency(summary.tips) },
        { label: t("voided"), value: summary.voidedCount.toString() },
        { label: t("refunds"), value: `${summary.refundCount ?? 0} / ${formatCurrency(summary.refundTotal ?? 0)}` },
        { label: t("customer_visits"), value: summary.customerVisits.toString() },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Olgax POS — {t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {range === "today" ? t("today") : range === "week" ? t("this_week") : range === "month" ? t("this_month") : `${from} – ${to}`}
          {" · "}
          {t(excludeRefunds ? "net_revenue" : "revenue")}
          {" · "}
          {new Date().toLocaleDateString()}
        </p>
        <hr className="mt-3 border-gray-300" />
      </div>
      {/* Tab selector */}
      <div className="flex gap-1 border-b print:hidden">
        {(["overview", "lowStock"] as Tab[]).map((tabId) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === tabId
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tabId === "overview" ? t("overview") : (
              <span className="flex items-center gap-1.5">
                {t("low_stock")}
                {lowStock.length > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                    {lowStock.length}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Range controls */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {(["today", "week", "month", "custom"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors capitalize ${
              range === r
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {r === "today" ? t("today") : r === "week" ? t("this_week") : r === "month" ? t("this_month") : t("custom")}
          </button>
        ))}
        {range === "custom" && (
          <>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={fetchData}
              disabled={!from || !to}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
            >
              Apply
            </button>
          </>
        )}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
        <label className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={excludeRefunds}
            onChange={(e) => setExcludeRefunds(e.target.checked)}
            className="accent-primary"
          />
          {t("exclude_refunds")}
        </label>
      </div>

      {/* ===== LOW STOCK TAB ===== */}
      {tab === "lowStock" && (
        <div className="rounded-lg border bg-card overflow-hidden overflow-x-auto">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold">{t("low_stock_products")}</h2>
            <span className="text-xs text-muted-foreground">({lowStock.length} items at or below threshold)</span>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr className="text-xs text-muted-foreground uppercase font-medium">
                <th className="px-4 py-3 text-left">{t("product")}</th>
                <th className="px-4 py-3 text-left">{tp("sku")}</th>
                <th className="px-4 py-3 text-left">{tp("category")}</th>
                <th className="px-4 py-3 text-right">{tp("stock")}</th>
                <th className="px-4 py-3 text-right">{t("threshold")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lowStock.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {t("all_stocked")}
                  </td>
                </tr>
              ) : (
                lowStock.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.sku ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.category ?? "—"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${p.stock === 0 ? "text-destructive" : "text-yellow-600 dark:text-yellow-400"}` }>
                      {p.stock}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{p.lowStockThreshold}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== OVERVIEW TAB ===== */}
      {tab === "overview" && <>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">{t("revenue_trend")}</h2>
          {revenueByDay.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">{t("no_data")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={220} minWidth={300}>
              <BarChart data={revenueByDay} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => {
                    const d = new Date(v + "T00:00:00");
                    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
                  }}
                />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v)} width={48} />
                <Tooltip
                  formatter={(v: number | undefined) => [formatCurrency(v ?? 0), "Revenue"]}
                  labelFormatter={(l) => new Date(l + "T00:00:00").toLocaleDateString()}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="revenue" fill="#1e3a5f" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment Breakdown Pie */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">{t("payment_methods")}</h2>
          {pieData.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">{t("no_data")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={220} minWidth={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="method"
                  cx="50%"
                  cy="45%"
                  outerRadius={72}
                  label={({ method, percent }) => `${method} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                  isAnimationActive={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number | undefined) => formatCurrency(v ?? 0)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top products */}
      <div className="rounded-lg border bg-card overflow-hidden overflow-x-auto">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">{t("top_selling_products")}</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr className="text-xs text-muted-foreground uppercase font-medium">
              <th className="px-4 py-3 text-left">{t("product")}</th>
              <th className="px-4 py-3 text-right">{t("units_sold")}</th>
              <th className="px-4 py-3 text-right">{t("revenue")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {topProducts.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  {t("no_sales_data")}
                </td>
              </tr>
            ) : (
              topProducts.map((p, i) => (
                <tr key={`${p.name}-${i}`} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 text-right">{p.qty}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(p.revenue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Export */}
      <div className="flex justify-end print:hidden">
        <div className="relative">
          <div className="flex rounded-md border overflow-hidden shadow-sm">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors border-r"
            >
              <Download className="h-4 w-4" />
              {t("export_csv")}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              <Printer className="h-4 w-4" />
              {t("print")}
            </button>
          </div>
        </div>
      </div>

      </> /* end overview tab */}
    </div>
  );
}
