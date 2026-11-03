import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";

export async function GET() {
  const settings = await prisma.businessSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) return NextResponse.json({});
  const s = serialize(settings);
  return NextResponse.json({
    name: s.name,
    logoUrl: s.logoUrl,
    currency: s.currency,
    currencyDecimals: s.currencyDecimals,
    taxName: s.taxName,
    taxRate: Number(s.taxRate),
    receiptFooter: s.receiptFooter,
  });
}
