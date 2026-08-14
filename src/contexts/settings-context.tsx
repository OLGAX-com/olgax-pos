"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { formatCurrency as formatCurrencyBase } from "@/lib/utils";

export interface BusinessSettingsData {
  name: string;
  logoUrl: string | null;
  currency: string;
  currencyDecimals: number;
  taxName: string;
  receiptFooter: string;
}

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettingsData = {
  name: "My Shop",
  logoUrl: null,
  currency: "$",
  currencyDecimals: 2,
  taxName: "Tax",
  receiptFooter: "Thank you for your business!",
};

interface SettingsContextValue {
  settings: BusinessSettingsData;
  refetch: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({
  initialSettings,
  children,
}: {
  initialSettings: BusinessSettingsData;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState(initialSettings);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const refetch = useCallback(async () => {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const data = await res.json();
    setSettings((prev) => ({ ...prev, ...data }));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, refetch }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

export function useFormatCurrency() {
  const { settings } = useSettings();
  return useCallback(
    (amount: number | string) =>
      formatCurrencyBase(amount, settings.currency, settings.currencyDecimals),
    [settings.currency, settings.currencyDecimals]
  );
}
