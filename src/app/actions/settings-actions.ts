"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function updateSettings(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const taxRatePercent = Number(raw.taxRate ?? 0);
  if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100) {
    throw new Error("Invalid tax rate");
  }

  const shared = {
    name: (raw.name as string) || "My Store",
    logoUrl: (raw.logoUrl as string) || null,
    primaryColor: (raw.primaryColor as string) || "#18181b",
    accentColor: (raw.accentColor as string) || "#6366f1",
    currency: (raw.currency as string) || "$",
    currencyDecimals: parseInt(raw.currencyDecimals as string, 10) || 2,
    taxRate: taxRatePercent / 100,
    taxName: (raw.taxName as string) || "Tax",
    receiptFooter: (raw.receiptFooter as string) || "",
    language: (raw.language as string) || "en",
    loyaltyEnabled: raw.loyaltyEnabled === "true",
    loyaltyEarnRate: parseFloat(raw.loyaltyEarnRate as string) || 1,
    loyaltyRedeemValue: parseFloat(raw.loyaltyRedeemValue as string) || 100,
    lowStockThreshold: parseInt(raw.lowStockThreshold as string, 10) || 5,
    // Storage
    storageProvider: (raw.storageProvider as string) || "local",
    storageRegion: (raw.storageRegion as string) || null,
    storageBucket: (raw.storageBucket as string) || null,
    storageEndpoint: (raw.storageEndpoint as string) || null,
    storageAccessKey: (raw.storageAccessKey as string) || null,
    storagePublicUrl: (raw.storagePublicUrl as string) || null,
  };

  // storageSecretKey is never sent back to the client, so only update it when
  // the user explicitly provides a new value (non-empty string).
  const newSecretKey = (raw.storageSecretKey as string) || "";
  const updatePayload = newSecretKey
    ? { ...shared, storageSecretKey: newSecretKey }
    : shared;

  await prisma.businessSettings.upsert({
    where: { id: "singleton" },
    create: { ...shared, storageSecretKey: newSecretKey || null },
    update: updatePayload,
  });

  revalidatePath("/settings");
  revalidatePath("/pos");
}
