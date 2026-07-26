import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";

  if (!q.trim()) {
    const products = await prisma.product.findMany({
      where: {
        active: true
      },
      orderBy: {name: "asc"}

    });
    return NextResponse.json(
      products.map((p: typeof products[number]) => ({ ...p, price: parseFloat(p.price.toString()) }))
    );
  }

  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { barcode: { equals: q } },
      ],
    },
    select: {
      id: true,
      name: true,
      price: true,
      stock: true,
      sku: true,
      barcode: true,
    },
    take: 20,
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    products.map((p: typeof products[number]) => ({ ...p, price: parseFloat(p.price.toString()) }))
  );
}
