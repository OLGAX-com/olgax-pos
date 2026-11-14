"use client";

import { useEffect, useState } from "react";
import { Receipt } from "@/components/receipt/receipt";
import { ReceiptModalShell } from "@/components/receipt/receipt-modal-shell";

interface RefundItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface RefundReceiptModalProps {
  open: boolean;
  onClose: () => void;
  saleId?: string;
  items: RefundItem[];
  refundTotal: number;
  reason?: string;
}

interface ReceiptSettings {
  name: string;
  logoUrl: string | null;
  currency: string;
  currencyDecimals: number;
  taxName: string;
  receiptFooter: string;
}

const FALLBACK_SETTINGS: ReceiptSettings = {
  name: "My Store",
  logoUrl: null,
  currency: "$",
  currencyDecimals: 2,
  taxName: "Tax",
  receiptFooter: "",
};

export function RefundReceiptModal({
  open,
  onClose,
  saleId,
  items,
  refundTotal,
  reason,
}: RefundReceiptModalProps) {
  const [settings, setSettings] = useState<ReceiptSettings>(FALLBACK_SETTINGS);

  useEffect(() => {
    if (!open) return;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings({ ...FALLBACK_SETTINGS, ...d }))
      .catch(() => {});
  }, [open]);

  const receiptData = {
    saleId,
    items,
    subtotal: refundTotal,
    discountAmount: 0,
    taxAmount: 0,
    total: refundTotal,
    paymentMethod: "REFUND",
    customerName: reason ? `Reason: ${reason}` : undefined,
  };

  return (
    <ReceiptModalShell
      open={open}
      overlayId="refund-receipt-overlay"
      title="Refund Receipt"
      titleClassName="text-destructive"
      bodyClassName="relative"
      onClose={onClose}
    >
      {/* REFUND diagonal stamp */}
      <div
        className="no-print pointer-events-none absolute inset-0 flex items-center justify-center z-10 opacity-20 select-none"
        aria-hidden
      >
        <span className="text-5xl font-black text-destructive tracking-widest rotate-[-35deg]">
          REFUND
        </span>
      </div>
      <Receipt data={receiptData} settings={settings} />
    </ReceiptModalShell>
  );
}
