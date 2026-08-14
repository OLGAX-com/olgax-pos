import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db";
import { formatCurrency as formatCurrencyBase } from "@/lib/utils";
import { DbError } from "@/components/ui/db-error";

export async function ReportsSummary() {
  noStore();
  const businessSettings = await prisma.businessSettings.findUnique({ where: { id: "singleton" } }).catch(() => null);
  const formatCurrency = (amount: number | string) =>
    formatCurrencyBase(amount, businessSettings?.currency, businessSettings?.currencyDecimals);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let todaysSales!: Awaited<ReturnType<typeof prisma.sale.findMany>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let topProducts!: any[];

  try {
    [todaysSales, topProducts] = await Promise.all([
      prisma.sale.findMany({
        where: {
          createdAt: { gte: today },
          status: "COMPLETED",
        },
        include: { items: true },
      }),
      prisma.saleItem.groupBy({
        by: ["productId", "name"],
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: "desc" } },
        take: 10,
      }),
    ]);
  } catch {
    return <DbError page="reports" />;
  }

  const revenue = todaysSales.reduce(
    (sum: number, s: typeof todaysSales[number]) => sum + parseFloat(s.total.toString()),
    0
  );
  const cashRevenue = todaysSales
    .filter((s: typeof todaysSales[number]) => s.paymentMethod === "CASH")
    .reduce((sum: number, s: typeof todaysSales[number]) => sum + parseFloat(s.total.toString()), 0);
  const cardRevenue = todaysSales
    .filter((s: typeof todaysSales[number]) => s.paymentMethod === "CARD")
    .reduce((sum: number, s: typeof todaysSales[number]) => sum + parseFloat(s.total.toString()), 0);
  const tipTotal = todaysSales.reduce(
    (sum: number, s: typeof todaysSales[number]) => sum + parseFloat((s.tipAmount ?? 0).toString()),
    0
  );
  const avgTransaction = todaysSales.length > 0 ? revenue / todaysSales.length : 0;

  return (
    <div className="space-y-6">
      {/* Today summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Today's Revenue", value: formatCurrency(revenue) },
          { label: "Transactions", value: todaysSales.length.toString() },
          { label: "Cash", value: formatCurrency(cashRevenue) },
          { label: "Card", value: formatCurrency(cardRevenue) },
          { label: "Tips Collected", value: formatCurrency(tipTotal) },
          { label: "Avg. Transaction", value: formatCurrency(avgTransaction) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border p-4 space-y-1">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Top products */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Top Selling Products</h2>
        <div className="rounded-lg border overflow-hidden overflow-x-auto text-sm">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-right font-medium">Units Sold</th>
                <th className="px-4 py-3 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {topProducts.map((p: typeof topProducts[number]) => (
                <tr key={`${p.productId}-${p.name}`} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 text-right">{p._sum.quantity ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(parseFloat((p._sum.total ?? 0).toString()))}
                  </td>
                </tr>
              ))}
              {topProducts.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    No sales data yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
