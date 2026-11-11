"use client";

import { Printer } from "lucide-react";
import { Receipt } from "./receipt";
import { ReceiptModalShell } from "./receipt-modal-shell";
import { printReceipt } from "@/lib/thermal-print";

interface ReceiptSettings {
  name: string;
  logoUrl: string | null;
  currency: string;
  currencyDecimals: number;
  taxName: string;
  receiptFooter: string;
}

interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  data: {
    saleId?: string;
    items: ReceiptItem[];
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    total: number;
    paymentMethod: string;
    amountTendered?: number;
    changeDue?: number;
  };
  settings: ReceiptSettings;
}

export function ReceiptModal({ open, onClose, data, settings }: ReceiptModalProps) {
  function handleBrowserPrint() {
    window.print();
  }

  async function handleThermalPrint() {
    await printReceipt({ data, settings });
  }

  return (
    <ReceiptModalShell
      open={open}
      overlayId="receipt-print-overlay"
      title="Receipt Preview"
      onPrint={handleBrowserPrint}
      onClose={onClose}
      extraActions={
        <button
          onClick={handleThermalPrint}
          title="Thermal print (Web Serial)"
          className="rounded border px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 hover:bg-accent transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          Thermal
        </button>
      }
    >
      <Receipt data={data} settings={settings} />
    </ReceiptModalShell>
  );
}
