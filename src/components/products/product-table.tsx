"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Pencil, Trash2, AlertTriangle, PackagePlus } from "lucide-react";
import { useFormatCurrency } from "@/contexts/settings-context";
import { deleteProduct } from "@/app/actions/product-actions";
import { StockAdjustModal } from "./stock-adjust-modal";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: { toString(): string };
  stock: number;
  lowStockThreshold: number;
  category: string | null;
  active: boolean;
}

interface ProductTableProps {
  products: Product[];
}

export function ProductTable({ products }: ProductTableProps) {
  const t = useTranslations("products");
  const formatCurrency = useFormatCurrency();
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  if (products.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
        {t("no_products")}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">{t("name")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("sku")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("category")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("price")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("stock")}</th>
              <th className="px-4 py-3 text-center font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((product) => {
              const isLowStock = product.stock <= product.lowStockThreshold;
              return (
                <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <Link href={`/products/${product.id}`} className="hover:underline text-primary">{product.name}</Link>
                      {!product.active && (
                        <span className="text-xs text-muted-foreground">(inactive)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{product.sku ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{product.category ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(parseFloat(product.price.toString()))}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={isLowStock ? "flex items-center justify-end gap-1 text-yellow-600 font-medium" : ""}>
                      {isLowStock && <AlertTriangle className="h-3.5 w-3.5" />}
                      {product.stock}
                      {isLowStock && <span className="text-xs">(low stock)</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setAdjusting(product)}
                        className="rounded p-1.5 hover:bg-accent transition-colors"
                        title="Adjust Stock"
                      >
                        <PackagePlus className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <Link
                        href={`/products/${product.id}/edit`}
                        className="rounded p-1.5 hover:bg-accent transition-colors"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Link>
                      <form action={deleteProduct.bind(null, product.id)}>
                        <button
                          type="submit"
                          className="rounded p-1.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {adjusting && (
        <StockAdjustModal
          productId={adjusting.id}
          productName={adjusting.name}
          currentStock={adjusting.stock}
          onClose={() => setAdjusting(null)}
        />
      )}
    </>
  );
}
