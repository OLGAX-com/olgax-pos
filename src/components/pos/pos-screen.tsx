"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { useCartStore } from "@/store/cart";
import { cn } from "@/lib/utils";
import { useSettings, useFormatCurrency } from "@/contexts/settings-context";
import { Minus, Plus, Trash2, ClipboardList, MessageSquarePlus } from "lucide-react";
import { ProductSearch } from "./product-search";
import { PaymentPanel } from "./payment-panel";
import { CustomerCapture, type CustomerSummary } from "./customer-capture";
import { HeldOrdersModal } from "./held-orders-modal";
import { VoidItemModal } from "./void-item-modal";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { NumericKeypad } from "@/components/ui/numeric-keypad";
import { ReceiptModal } from "@/components/receipt/receipt-modal";
import { KeyboardShortcutsModal } from "./keyboard-shortcuts-modal";
import { usePosKeyboardShortcuts } from "@/hooks/use-pos-keyboard-shortcuts";
import type { ReceiptData } from "@/components/receipt/receipt";

const DEFAULT_TAX_RATE = 0; // overridden via business settings

export function POSScreen() {
  const t = useTranslations("pos");
  const { settings: businessSettings } = useSettings();
  const formatCurrency = useFormatCurrency();
  const [taxRate] = useState(DEFAULT_TAX_RATE);
  const [showHeldOrders, setShowHeldOrders] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [voidTargetId, setVoidTargetId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"search" | "cart">("search");
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [keypad, setKeypad] = useState<{ open: boolean; itemId: string; value: string }>({
    open: false,
    itemId: "",
    value: "1",
  });
  const prevItemsLenRef = useRef(0);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  const focusSearch = useCallback(() => {
    const el = document.getElementById("pos-search-input") as HTMLInputElement | null;
    el?.focus();
    el?.select();
  }, []);

  usePosKeyboardShortcuts({
    onFocusSearch: focusSearch,
    onOpenPayment: () => {
      const btn = document.querySelector<HTMLButtonElement>("[data-charge-btn]");
      btn?.focus();
    },
    onHoldOrders: () => setShowHeldOrders(true),
    onShowHelp: () => setShowShortcuts((v) => !v),
    onEscape: () => {
      setShowShortcuts(false);
      setShowHeldOrders(false);
    },
  });

  const {
    items,
    removeItem,
    updateQuantity,
    updateItemNotes,
    subtotal,
    discountValue,
    taxAmount,
    total,
    clearCart,
    amountTendered,
    paymentMethod,
    paymentLines,
    tipAmount,
  } = useCartStore();

  const sub = subtotal();
  const disc = discountValue();
  const tax = taxAmount(taxRate);
  const tot = total(taxRate);
  const change = Math.max(0, (amountTendered ?? 0) - tot);

  // Auto-switch to cart tab on mobile whenever a new item is added
  useEffect(() => {
    if (items.length > prevItemsLenRef.current && items.length > 0) {
      setMobileTab("cart");
    }
    prevItemsLenRef.current = items.length;
  }, [items.length]);

  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);

  if (!isClient) {
    return (
      <div className="flex flex-col h-full bg-background rounded-lg border shadow-sm items-center justify-center space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted animate-pulse">
        </div>
        <div className="text-muted-foreground text-sm font-medium animate-pulse">Initializing POS...</div>
      </div>
    );
  }

  function handleSaleComplete(saleId: string) {
    const data: ReceiptData = {
      saleId,
      customerName: customer?.name || undefined,
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        total: i.price * i.quantity,
        notes: i.notes || undefined,
      })),
      subtotal: sub,
      discountAmount: disc,
      taxAmount: tax,
      tipAmount: tipAmount > 0 ? tipAmount : undefined,
      total: tot,
      paymentMethod,
      paymentLines: paymentLines.length > 0 ? paymentLines : undefined,
      amountTendered: amountTendered ?? 0,
      changeDue: change,
      createdAt: new Date(),
    };
    setReceiptData(data);
    clearCart();
    setCustomer(null);
  }

  function handleVoidItem(productId: string) {
    setVoidTargetId(productId);
  }

  function handleVoidConfirm(_reason?: string) {
    if (voidTargetId) removeItem(voidTargetId);
    setVoidTargetId(null);
  }

  const voidTargetItem = items.find((i) => i.productId === voidTargetId);

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Mobile tab bar */}
      <div className="flex shrink-0 border-b lg:hidden">
        <button
          onClick={() => setMobileTab("search")}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
            mobileTab === "search"
              ? "text-primary border-primary"
              : "text-muted-foreground border-transparent"
          )}
        >
          Products
        </button>
        <button
          onClick={() => setMobileTab("cart")}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
            mobileTab === "cart"
              ? "text-primary border-primary"
              : "text-muted-foreground border-transparent"
          )}
        >
          Cart
          {items.length > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {items.length}
            </span>
          )}
        </button>
      </div>

      {/* Left: product search */}
      <div className={cn("overflow-y-auto p-4 lg:flex-1 lg:border-r", mobileTab === "cart" ? "hidden lg:block" : "flex-1")}>
        <ProductSearch />
      </div>

      {/* Right: cart + payment */}
      <div className={cn("flex flex-col lg:w-[26rem] lg:flex-none lg:shrink-0", mobileTab === "search" ? "hidden lg:flex" : "flex flex-1")}>
        {/* Cart toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-sm font-semibold text-muted-foreground">
            Cart {items.length > 0 ? `(${items.length})` : ""}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowHeldOrders(true)}
              className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent transition-colors"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Held Orders
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              title="Keyboard shortcuts (?)"
              className="flex h-6 w-6 items-center justify-center rounded border text-xs hover:bg-accent transition-colors text-muted-foreground"
            >
              ?
            </button>
          </div>
        </div>

        {/* Customer capture */}
        <div className="relative z-10 border-b border-border bg-background px-4 py-2.5">
          <CustomerCapture value={customer} onChange={setCustomer} />
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {items.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
              {t("cart_empty")}
            </div>
          ) : (
            <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.div
                key={item.productId}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="rounded-lg border overflow-hidden"
              >
                <div className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.price)} each
                    </p>
                  </div>

                  {/* Qty controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="h-8 w-8 rounded border flex items-center justify-center hover:bg-accent transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    {isTouchDevice ? (
                      <button
                        onClick={() => setKeypad({ open: true, itemId: item.productId, value: String(item.quantity) })}
                        className="w-14 h-8 text-center text-sm font-medium border rounded px-1 bg-background hover:bg-accent active:scale-95 transition-all"
                        aria-label="Quantity — tap to edit"
                      >
                        {item.quantity}
                      </button>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > 0) updateQuantity(item.productId, val);
                        }}
                        onFocus={(e) => e.target.select()}
                        className="w-14 text-center text-sm font-medium border rounded px-1 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        aria-label="Quantity"
                      />
                    )}
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="h-8 w-8 rounded border flex items-center justify-center hover:bg-accent transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Line total */}
                  <span className="text-sm font-semibold w-16 text-right">
                    {formatCurrency(item.price * item.quantity)}
                  </span>

                  {/* Note toggle */}
                  <button
                    onClick={() => setNoteOpenFor(noteOpenFor === item.productId ? null : item.productId)}
                    className={`transition-colors ${
                      item.notes ? "text-primary" : "text-muted-foreground hover:text-primary"
                    }`}
                    aria-label="Add note"
                    title="Item note"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </button>

                  {/* Void item */}
                  <button
                    onClick={() => handleVoidItem(item.productId)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {/* Inline notes */}
                {noteOpenFor === item.productId && (
                  <div className="px-3 pb-2">
                    <input
                      autoFocus
                      type="text"
                      value={item.notes}
                      onChange={(e) => updateItemNotes(item.productId, e.target.value)}
                      placeholder="Add modifier or note…"
                      className="w-full rounded border px-2 py-1 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      onKeyDown={(e) => e.key === "Enter" && setNoteOpenFor(null)}
                    />
                  </div>
                )}
              </motion.div>
            ))}
            </AnimatePresence>
          )}
        </div>

        {/* Order summary */}
        <div className="border-t p-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("subtotal")}</span>
            <span>{formatCurrency(sub)}</span>
          </div>
          {disc > 0 && (
            <div className="flex justify-between text-green-600">
              <span>{t("discount")}</span>
              <span>−{formatCurrency(disc)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t("tax")}</span>
              <span>{formatCurrency(tax)}</span>
            </div>
          )}
          {tipAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t("tip")}</span>
              <span>{formatCurrency(tipAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>{t("total")}</span>
            <span>{formatCurrency(tot)}</span>
          </div>
        </div>

        {/* Payment */}
        <PaymentPanel
          taxRate={taxRate}
          onClear={() => {
            if (items.length > 0) setConfirmClear(true);
          }}
          onSaleComplete={handleSaleComplete}
          onHoldOrders={() => setShowHeldOrders(true)}
          customerId={customer?.id}
        />
      </div>

      {/* Held orders modal */}
      <HeldOrdersModal
        open={showHeldOrders}
        onClose={() => setShowHeldOrders(false)}
      />

      {/* Void item modal */}
      <VoidItemModal
        open={!!voidTargetId}
        itemName={voidTargetItem?.name ?? ""}
        onConfirm={handleVoidConfirm}
        onCancel={() => setVoidTargetId(null)}
      />

      {/* Receipt modal */}
      {receiptData && (
        <ReceiptModal
          open={true}
          onClose={() => setReceiptData(null)}
          data={receiptData}
          settings={businessSettings}
        />
      )}

      {/* Clear cart confirmation */}
      <AlertDialog
        open={confirmClear}
        title="Clear cart?"
        description="This will remove all items from the current order."
        confirmLabel="Clear"
        cancelLabel="Keep"
        variant="destructive"
        onConfirm={() => { clearCart(); setConfirmClear(false); }}
        onCancel={() => setConfirmClear(false)}
      />

      {/* Numeric keypad for touch devices */}
      <NumericKeypad
        open={keypad.open}
        value={keypad.value}
        label={items.find((i) => i.productId === keypad.itemId)?.name}
        onValueChange={(v) => setKeypad((k) => ({ ...k, value: v }))}
        onConfirm={() => {
          const val = parseFloat(keypad.value);
          if (!isNaN(val) && val > 0) updateQuantity(keypad.itemId, val);
          setKeypad({ open: false, itemId: "", value: "1" });
        }}
        onCancel={() => setKeypad({ open: false, itemId: "", value: "1" })}
      />

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}
