"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useCartStore, PaymentMethod } from "@/store/cart";
import { useFormatCurrency } from "@/contexts/settings-context";
import { useRouter } from "next/navigation";
import { PauseCircle, ClipboardList, SplitSquareHorizontal, X, Percent, RotateCcw, Star } from "lucide-react";

interface PaymentPanelProps {
  taxRate: number;
  onClear: () => void;
  /** Called with the new sale ID after a successful sale â€” triggers receipt */
  onSaleComplete?: (saleId: string) => void;
  /** Open the heldâ€‘orders modal */
  onHoldOrders?: () => void;
  /** Optional customer to attach to the sale */
  customerId?: string | null;
}

const TIP_PRESETS = [
  { label: "10%", value: 10 },
  { label: "15%", value: 15 },
  { label: "20%", value: 20 },
];

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD", "OTHER"];

export function PaymentPanel({ taxRate, onClear, onSaleComplete, onHoldOrders, customerId }: PaymentPanelProps) {
  const t = useTranslations("pos");
  const router = useRouter();
  const formatCurrency = useFormatCurrency();
  const {
    items,
    paymentMethod,
    setPaymentMethod,
    amountTendered,
    setAmountTendered,
    paymentLines,
    setPaymentLine,
    removePaymentLine,
    clearPaymentLines,
    clearCart,
    tipAmount,
    setTipAmount,
    isSplitMode,
    paymentLinesTotal,
    total,
    changeDue,
    subtotal,
    discountValue,
    taxAmount,
    taxRate: taxRateOverride,
    setTaxRate,
    loyaltyPointsUsed,
    setLoyaltyPointsUsed,
  } = useCartStore();

  const [loading, setLoading] = useState(false);
  const [holdLoading, setHoldLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customTip, setCustomTip] = useState("");
  const [showTaxEdit, setShowTaxEdit] = useState(false);
  const [splitInput, setSplitInput] = useState<Record<PaymentMethod, string>>({ CASH: "", CARD: "", OTHER: "" });

  // Loyalty state
  const [loyaltyInfo, setLoyaltyInfo] = useState<{
    points: number;
    enabled: boolean;
    earnRate: number;
    redeemValue: number;
    maxRedeemDiscount: number;
  } | null>(null);

  useEffect(() => {
    if (!customerId) { setLoyaltyInfo(null); setLoyaltyPointsUsed(0); return; }
    fetch(`/api/loyalty?customerId=${customerId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.enabled) setLoyaltyInfo(d);
        else { setLoyaltyInfo(null); setLoyaltyPointsUsed(0); }
      })
      .catch(() => { setLoyaltyInfo(null); });
  }, [customerId, setLoyaltyPointsUsed]);

  // Loyalty discount in dollars
  const loyaltyDiscount = loyaltyInfo && loyaltyPointsUsed > 0
    ? Math.min(loyaltyPointsUsed / loyaltyInfo.redeemValue, loyaltyInfo.maxRedeemDiscount)
    : 0;

  const tot = total(taxRate);
  const change = changeDue(taxRate);
  const isEmpty = items.length === 0;
  const splitMode = isSplitMode();
  const splitPaid = paymentLinesTotal();
  const splitRemaining = Math.max(0, tot - splitPaid);
  const effectiveTaxRate = taxRateOverride !== null ? taxRateOverride : taxRate;

  // Tip as percent of subtotal pre-tip
  const sub = subtotal() - discountValue();
  const activeTipPct = sub > 0 ? Math.round((tipAmount / sub) * 100) : 0;

  function handleTipPreset(pct: number) {
    if (activeTipPct === pct) {
      setTipAmount(0);
    } else {
      setTipAmount((sub * pct) / 100);
    }
    setCustomTip("");
  }

  function handleCustomTip(val: string) {
    setCustomTip(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 0) setTipAmount(n);
    else if (val === "") setTipAmount(0);
  }

  function handleSplitInput(method: PaymentMethod, val: string) {
    setSplitInput((prev) => ({ ...prev, [method]: val }));
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) setPaymentLine({ method, amount: n });
    else removePaymentLine(method);
  }

  async function handleCompleteSale() {
    if (isEmpty) return;
    setError(null);
    setLoading(true);

    const { items: cartItems, discountAmount, discountType, note } = useCartStore.getState();

    try {
      const body: Record<string, unknown> = {
        items: cartItems.map((i) => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          notes: i.notes || undefined,
        })),
        taxRate: effectiveTaxRate,
        discountAmount,
        discountType,
        tipAmount,
        note: note || undefined,
        customerId: customerId || undefined,
        loyaltyPointsUsed: loyaltyPointsUsed || 0,
      };

      if (splitMode && paymentLines.length > 0) {
        body.paymentLines = paymentLines;
      } else {
        body.paymentMethod = paymentMethod;
        if (paymentMethod === "CASH") body.amountTendered = amountTendered || tot;
      }

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const resp = await res.json();
        throw new Error(resp.error ?? "Failed to complete sale");
      }

      const resp = await res.json();
      const saleId: string = resp.sale?.id ?? "";

      if (onSaleComplete) {
        onSaleComplete(saleId);
      } else {
        onClear();
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleHoldOrder() {
    if (isEmpty) return;
    setHoldLoading(true);
    try {
      const res = await fetch("/api/held-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartSnapshot: { items, paymentMethod, amountTendered },
          label: `Hold ${new Date().toLocaleTimeString()}`,
        }),
      });
      if (res.ok) {
        clearCart();
      }
    } finally {
      setHoldLoading(false);
    }
  }

  return (
    <div className="border-t p-4 space-y-3">
      {/* Hold / Recall row */}
      <div className="flex gap-2">
        <button
          onClick={handleHoldOrder}
          disabled={isEmpty || holdLoading}
          className="flex-1 flex items-center justify-center gap-1 rounded-md border py-2 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          <PauseCircle className="h-3.5 w-3.5" />
          {holdLoading ? "..." : t("hold")}
        </button>
        <button
          onClick={onHoldOrders}
          className="flex-1 flex items-center justify-center gap-1 rounded-md border py-2 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Recall
        </button>
      </div>

      {/* Tip row */}
      {!isEmpty && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tip</span>
            {tipAmount > 0 && (
              <button
                onClick={() => { setTipAmount(0); setCustomTip(""); }}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            )}
          </div>
          <div className="flex gap-1.5">
            {TIP_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => handleTipPreset(p.value)}
                className={
                  activeTipPct === p.value && customTip === ""
                    ? "flex-1 rounded-md border-2 border-primary bg-primary/10 py-1.5 text-xs font-semibold text-primary"
                    : "flex-1 rounded-md border py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                }
              >
                {p.label}
              </button>
            ))}
            <input
              type="number"
              min={0}
              step={0.01}
              value={customTip}
              onChange={(e) => handleCustomTip(e.target.value)}
              placeholder="Custom"
              className="w-20 rounded-md border px-2 py-1.5 text-xs text-center bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {/* Tax override */}
      {!isEmpty && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tax</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={taxRateOverride === 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setTaxRate(0);
                      setShowTaxEdit(false);
                    } else {
                      setTaxRate(null);
                    }
                  }}
                  className="h-3 w-3 accent-primary"
                />
                Tax Exempt
              </label>
              <button
                onClick={() => setShowTaxEdit((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Percent className="h-3 w-3" />
                {taxRateOverride !== null
                  ? `${(taxRateOverride * 100).toFixed(0)}% (custom)`
                  : `${(taxRate * 100).toFixed(0)}% (default)`}
              </button>
              {taxRateOverride !== null && (
                <button
                  onClick={() => { setTaxRate(null); setShowTaxEdit(false); }}
                  className="text-muted-foreground hover:text-destructive"
                  title="Reset to default"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          {showTaxEdit && taxRateOverride !== 0 && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={taxRateOverride !== null ? (taxRateOverride * 100) : (taxRate * 100)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0 && val <= 100) setTaxRate(val / 100);
                }}
                className="flex-1 rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Rate %"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          )}
        </div>
      )}

      {/* Loyalty Points */}
      {!isEmpty && loyaltyInfo?.enabled && loyaltyInfo.points > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Star className="h-3 w-3 text-yellow-500" /> Loyalty Points
            </span>
            <span className="text-xs font-semibold">{loyaltyInfo.points} pts available</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={loyaltyInfo.points}
              step={loyaltyInfo.redeemValue}
              value={loyaltyPointsUsed || ""}
              onChange={(e) => setLoyaltyPointsUsed(parseInt(e.target.value) || 0)}
              placeholder="Points to redeem"
              className="flex-1 rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {loyaltyPointsUsed > 0 && (
              <span className="text-xs text-green-600 font-medium">
                -{formatCurrency(loyaltyDiscount)}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {loyaltyInfo.earnRate} pt per {formatCurrency(1)} · {loyaltyInfo.redeemValue} pts = {formatCurrency(1)} off
          </p>
        </div>
      )}

      {/* Payment method / split toggle */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Payment</span>
          <button
            onClick={() => {
              if (splitMode) {
                clearPaymentLines();
                setSplitInput({ CASH: "", CARD: "", OTHER: "" });
              } else {
                // seed the primary method with the remaining total
                setPaymentLine({ method: paymentMethod, amount: tot });
                setSplitInput((prev) => ({ ...prev, [paymentMethod]: String(tot.toFixed(2)) }));
              }
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <SplitSquareHorizontal className="h-3.5 w-3.5" />
            {splitMode ? "Single" : "Split"}
          </button>
        </div>

        {splitMode ? (
          /* ---- Split tender ---- */
          <div className="space-y-2">
            {PAYMENT_METHODS.map((method) => {
              const line = paymentLines.find((p) => p.method === method);
              return (
                <div key={method} className="flex items-center gap-2">
                  <span className={`w-14 rounded-md border text-center py-1.5 text-xs font-medium ${
                    line ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}>
                    {method}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={splitInput[method]}
                    onChange={(e) => handleSplitInput(method, e.target.value)}
                    placeholder="0.00"
                    className="flex-1 rounded-md border px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {line && (
                    <button
                      onClick={() => { removePaymentLine(method); setSplitInput((prev) => ({ ...prev, [method]: "" })); }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            <div className="flex justify-between text-xs pt-1">
              <span className="text-muted-foreground">
                Remaining: <span className={splitRemaining > 0 ? "text-destructive font-semibold" : "text-green-600 font-semibold"}>
                  {formatCurrency(splitRemaining)}
                </span>
              </span>
              {change > 0 && (
                <span className="text-green-600 font-medium">Change: {formatCurrency(change)}</span>
              )}
            </div>
          </div>
        ) : (
          /* ---- Single method ---- */
          <>
            <div className="flex gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={
                    paymentMethod === method
                      ? "flex-1 rounded-md border-2 border-primary bg-primary/10 py-2 text-xs font-semibold text-primary"
                      : "flex-1 rounded-md border py-2 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                  }
                >
                  {method}
                </button>
              ))}
            </div>

            {paymentMethod === "CASH" && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Amount Tendered</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={amountTendered || ""}
                  onChange={(e) => setAmountTendered(parseFloat(e.target.value) || 0)}
                  placeholder={formatCurrency(tot)}
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                />
                {change > 0 && (
                  <p className="text-sm text-green-600 font-medium">
                    Change: {formatCurrency(change)}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Totals breakdown */}
      {!isEmpty && (
        <div className="rounded-md bg-muted/40 px-3 py-2 space-y-1 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal())}</span>
          </div>
          {discountValue() > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span>âˆ’{formatCurrency(discountValue())}</span>
            </div>
          )}
          {sub > 0 && (
            <div className="relative flex justify-between text-muted-foreground">
              <button
                onClick={() => setShowTaxEdit(!showTaxEdit)}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors group"
                title="Edit tax rate"
              >
                <span>Tax</span>
                {taxRateOverride !== null ? (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded dark:bg-blue-900 dark:text-blue-100 font-medium">
                    {taxRateOverride === 0 ? "Exempt" : `${(taxRateOverride * 100).toFixed(2)}%`}
                  </span>
                ) : (
                  <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    <Percent className="h-3 w-3" />
                    {(taxRate * 100).toFixed(taxRate % 1 === 0 ? 0 : 1)}%
                  </span>
                )}
              </button>
              <span>{formatCurrency(taxAmount(taxRate))}</span>

              {showTaxEdit && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTaxEdit(false)} />
                  <div className="absolute left-0 bottom-full mb-2 w-52 rounded-lg border border-border bg-popover p-3 shadow-xl z-50 ring-1 ring-border/10 animate-in fade-in zoom-in-95">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground">Tax Rate Override</p>
                        <button onClick={() => setShowTaxEdit(false)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            placeholder={(taxRate * 100).toString()}
                            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs pr-6"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = parseFloat(e.currentTarget.value);
                                if (!isNaN(val)) {
                                  setTaxRate(val / 100);
                                  setShowTaxEdit(false);
                                }
                              }
                            }}
                          />
                          <span className="absolute right-2 top-1.5 text-xs text-muted-foreground">%</span>
                        </div>
                        <button 
                          onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling?.querySelector('input');
                            if (input) {
                               const val = parseFloat(input.value);
                               if (!isNaN(val)) {
                                 setTaxRate(val / 100);
                                 setShowTaxEdit(false);
                               }
                            }
                          }}
                          className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded-md"
                        >Set</button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => { setTaxRate(0); setShowTaxEdit(false); }}
                          className={`flex items-center justify-center gap-1 rounded border py-1.5 text-[10px] transition-colors ${
                            taxRateOverride === 0 
                              ? "bg-destructive/10 text-destructive border-destructive/20" 
                              : "bg-muted/50 hover:bg-destructive/10 hover:text-destructive"
                          }`}
                        >
                          <X className="h-3 w-3" /> Exempt
                        </button>
                        <button
                          onClick={() => { setTaxRate(null); setShowTaxEdit(false); }}
                          disabled={taxRateOverride === null}
                          className="flex items-center justify-center gap-1 rounded border bg-muted/50 py-1.5 text-[10px] hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className="h-3 w-3" /> Reset
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {tipAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tip</span>
              <span>{formatCurrency(tipAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-foreground border-t pt-1 mt-1">
            <span>Total</span>
            <span>{formatCurrency(tot)}</span>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Complete sale */}
      <button
        data-charge-btn
        onClick={handleCompleteSale}
        disabled={isEmpty || loading || (splitMode && splitRemaining > 0.005)}
        className="w-full rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        {loading ? "Processingâ€¦" : `${t("checkout")} ${formatCurrency(tot)}`}
      </button>

      {/* Void / Clear */}
      {!isEmpty && (
        <button
          onClick={onClear}
          className="w-full rounded-md border py-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          {t("void")}
        </button>
      )}
    </div>
  );
}
