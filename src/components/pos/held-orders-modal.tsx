"use client";

import { useState, useEffect } from "react";
import { useCartStore } from "@/store/cart";
import { X, History, PackagePlus } from "lucide-react";
import { useFormatCurrency } from "@/contexts/settings-context";

interface HeldOrder {
  id: string;
  label: string | null;
  createdAt: string;
  cartSnapshot: {
    items: Array<{ productId: string; name: string; price: number; quantity: number; stock: number }>;
    discountAmount: number;
    discountType: "fixed" | "percent";
    paymentMethod: "CASH" | "CARD" | "OTHER";
  };
}

interface HeldOrdersModalProps {
  open: boolean;
  onClose: () => void;
}

export function HeldOrdersModal({ open, onClose }: HeldOrdersModalProps) {
  const formatCurrency = useFormatCurrency();
  const [orders, setOrders] = useState<HeldOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const { items, setDiscount, setPaymentMethod, addItem, clearCart } = useCartStore();

  async function fetchOrders() {
    setLoading(true);
    const res = await fetch("/api/held-orders");
    const data = await res.json();
    setOrders(data);
    setLoading(false);
  }

  // Fetch when modal opens; reset when it closes
  useEffect(() => {
    if (open) {
      fetchOrders();
    } else {
      setOrders([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function recallOrder(order: HeldOrder) {
    clearCart();
    const snap = order.cartSnapshot;
    snap.items.forEach((i) => addItem(i));
    setDiscount(snap.discountAmount, snap.discountType);
    setPaymentMethod(snap.paymentMethod);
    // Delete from server
    await fetch("/api/held-orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id }),
    });
    onClose();
  }

  async function deleteOrder(id: string) {
    await fetch("/api/held-orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-card border shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Held Orders</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {loading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          )}
          {!loading && orders.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <History className="h-6 w-6" />
              <p className="text-sm">No held orders</p>
            </div>
          )}
          {orders.map((order) => {
            const snap = order.cartSnapshot;
            const total = snap.items.reduce((s, i) => s + i.price * i.quantity, 0);
            return (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-lg border p-3 mb-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {order.label ?? new Date(order.createdAt).toLocaleTimeString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {snap.items.length} item(s) · {formatCurrency(total)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => recallOrder(order)}
                    className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Recall
                  </button>
                  <button
                    onClick={() => deleteOrder(order.id)}
                    className="rounded border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
