import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { formatCurrency as formatCurrencyBase } from "@/lib/utils";
import { Star } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer Profile" };

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const businessSettings = await prisma.businessSettings.findUnique({ where: { id: "singleton" } });
  const formatCurrency = (amount: number | string) =>
    formatCurrencyBase(amount, businessSettings?.currency, businessSettings?.currencyDecimals);
  const raw = await prisma.customer.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          items: { select: { id: true, name: true, quantity: true, price: true, total: true, notes: true } },
        },
      },
    },
  });

  if (!raw) notFound();

  const customer = serialize(raw);

  const totalSpend = customer.sales
    .filter((s: any) => s.status === "COMPLETED")
    .reduce((sum: number, s: any) => sum + parseFloat(s.total.toString()), 0);

  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <Breadcrumb items={[
        { label: "Customers", href: "/customers" },
        { label: customer.name },
      ]} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Profile */}
        <div className="md:col-span-1 rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">{customer.name}</h2>
              {customer.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
              {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
              {customer.notes && (
                <p className="text-xs italic text-muted-foreground mt-2">{customer.notes}</p>
              )}
            </div>
          </div>
          <div className="border-t pt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Total Spend</p>
              <p className="text-lg font-bold">{formatCurrency(totalSpend)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Visits</p>
              <p className="text-lg font-bold">{customer.sales.filter((s: any) => s.status === "COMPLETED").length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-500" /> Loyalty Points
              </p>
              <p className="text-lg font-bold">{customer.loyaltyPoints}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Member Since</p>
              <p className="text-sm font-medium">{new Date(customer.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Purchase history */}
        <div className="md:col-span-2 rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">Purchase History</h2>
          </div>
          {customer.sales.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
              No sales yet
            </div>
          ) : (
            <div className="divide-y overflow-y-auto max-h-[480px]">
              {customer.sales.map((sale: any) => (
                <details key={sale.id} className="group">
                  <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/40 list-none transition-colors">
                    <div>
                      <p className="text-sm font-medium">{formatter.format(new Date(sale.createdAt))}</p>
                      <p className="text-xs text-muted-foreground capitalize">{sale.paymentMethod}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-medium ${
                          sale.status === "VOIDED" ? "text-destructive" : "text-green-600"
                        }`}
                      >
                        {sale.status}
                      </span>
                      <span className="text-sm font-semibold">{formatCurrency(parseFloat(sale.total.toString()))}</span>
                    </div>
                  </summary>
                  <div className="px-4 pb-3 pt-1 space-y-1">
                    {sale.items.map((item: any, i: number) => (
                      <div key={`${item.id}-${i}`} className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {item.name} × {item.quantity}
                          {item.notes && <em className="ml-2 italic">({item.notes})</em>}
                        </span>
                        <span>{formatCurrency(parseFloat(item.total.toString()))}</span>
                      </div>
                    ))}
                    {sale.tipAmount > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground border-t pt-1">
                        <span>Tip</span>
                        <span>{formatCurrency(parseFloat(sale.tipAmount.toString()))}</span>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
