import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const range = searchParams.get("range") ?? "today";

  const now = new Date();
  let start: Date;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (range) {
    case "week":
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      break;
    case "custom": {
      const from = searchParams.get("from");
      const to = searchParams.get("to");
      start = from ? new Date(from) : new Date(now.setDate(now.getDate() - 30));
      const customEnd = to ? new Date(to) : new Date();
      customEnd.setHours(23, 59, 59, 999);
      end.setTime(customEnd.getTime());
      break;
    }
    default: // today
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
  }

  const [sales, topProducts, voidedCount, refundSummary, lowStockProducts] = await Promise.all([
    prisma.sale.findMany({
      where: { createdAt: { gte: start, lte: end }, status: "COMPLETED" },
      select: {
        id: true,
        total: true,
        subtotal: true,
        taxAmount: true,
        discountAmount: true,
        tipAmount: true,
        paymentMethod: true,
        paymentLines: true,
        createdAt: true,
        items: {
          select: {
            price: true,
            quantity: true,
            total: true,
            productId: true,
            product: { select: { cost: true } },
          },
        },
        customer: { select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.saleItem.groupBy({
      by: ["productId", "name"],
      where: { sale: { createdAt: { gte: start, lte: end }, status: "COMPLETED" } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 10,
    }),
    prisma.sale.count({ where: { createdAt: { gte: start, lte: end }, status: "VOIDED" } }),
    prisma.refund.aggregate({
      where: { createdAt: { gte: start, lte: end } },
      _count: { id: true },
      _sum: { amount: true, taxAmount: true },
    }),
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, stock: true, lowStockThreshold: true, sku: true, category: true },
      orderBy: { stock: "asc" },
      take: 100,
    }),
  ]);

  const lowStock = lowStockProducts.filter((p) => p.stock <= p.lowStockThreshold);

  const byDay: Record<string, { revenue: number; tax: number; transactions: number }> = {};
  let totalRevenue = 0;
  let totalTax = 0;
  let totalTips = 0;
  let totalGrossProfit = 0;
  const paymentBreakdown: Record<string, number> = { CASH: 0, CARD: 0, OTHER: 0 };
  const uniqueCustomers = new Set<string>();

  for (const sale of sales) {
    const day = sale.createdAt.toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = { revenue: 0, tax: 0, transactions: 0 };
    const rev = parseFloat(sale.total.toString());
    const tax = parseFloat(sale.taxAmount.toString());
    byDay[day].revenue += rev;
    byDay[day].tax += tax;
    byDay[day].transactions += 1;
    totalRevenue += rev;
    totalTax += tax;
    totalTips += parseFloat((sale.tipAmount ?? 0).toString());
    if (sale.customer?.id) uniqueCustomers.add(sale.customer.id);

    for (const item of sale.items) {
      const itemRevenue = parseFloat(item.total.toString());
      const unitCost = item.product?.cost ? parseFloat(item.product.cost.toString()) : 0;
      totalGrossProfit += itemRevenue - unitCost * item.quantity;
    }

    const lines = sale.paymentLines as Array<{ method: string; amount: number }> | null;
    if (lines && lines.length > 0) {
      for (const line of lines) {
        paymentBreakdown[line.method] = (paymentBreakdown[line.method] ?? 0) + line.amount;
      }
    } else {
      paymentBreakdown[sale.paymentMethod] = (paymentBreakdown[sale.paymentMethod] ?? 0) + rev;
    }
  }

  const revenueByDay = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  const pieData = Object.entries(paymentBreakdown)
    .filter(([, v]) => v > 0)
    .map(([method, value]) => ({ method, value: Math.round(value * 100) / 100 }));

  return NextResponse.json({
    summary: {
      revenue: totalRevenue,
      grossProfit: totalGrossProfit,
      transactions: sales.length,
      tips: totalTips,
      avgTransaction: sales.length > 0 ? totalRevenue / sales.length : 0,
      voidedCount,
      refundCount: refundSummary._count.id,
      refundTotal: parseFloat((refundSummary._sum.amount ?? 0).toString()),
      tax: totalTax,
      refundTax: parseFloat((refundSummary._sum.taxAmount ?? 0).toString()),
      customerVisits: uniqueCustomers.size,
    },
    revenueByDay,
    pieData,
    topProducts: topProducts.map((p) => ({
      name: p.name,
      qty: p._sum.quantity ?? 0,
      revenue: parseFloat((p._sum.total ?? 0).toString()),
    })),
    lowStock,
  });
}