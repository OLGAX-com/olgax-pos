import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsProvider, DEFAULT_BUSINESS_SETTINGS } from "@/contexts/settings-context";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  noStore();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const settings = await prisma.businessSettings
    .findUnique({ where: { id: "singleton" } })
    .catch(() => null);

  // Inject branding CSS vars from business settings.
  //
  // IMPORTANT: --primary must NOT be injected via inline style because inline
  // styles override CSS class rules (.dark), causing dark navy primary on dark
  // backgrounds. Instead we use a <style> tag with :root:not(.dark) so the
  // override only applies in light mode. Dark mode keeps its yellow primary
  // from globals.css automatically.
  const primary = settings?.primaryColor ?? "#0f2044";
  const accent = settings?.accentColor ?? "#f5c518";

  // brandingCSS injected as a <style> tag (server-rendered, no flash).
  const brandingCSS = `
    :root:not(.dark) {
      --primary: ${primary};
      --primary-foreground: oklch(0.985 0 0);
    }
    :root {
      --sidebar: ${primary};
      --sidebar-primary: ${accent};
      --sidebar-primary-foreground: oklch(0.13 0.05 253);
      --accent: ${accent};
      --ring: ${accent};
    }
  `;

  // Sidebar vars still applied inline so they apply to the specific subtree
  // (avoids any cascade issues from the global :root override above).
  const cssVars: React.CSSProperties = {
    "--sidebar": primary,
    "--sidebar-primary": accent,
  } as React.CSSProperties;

  const businessSettings = {
    name: settings?.name ?? DEFAULT_BUSINESS_SETTINGS.name,
    logoUrl: settings?.logoUrl ?? DEFAULT_BUSINESS_SETTINGS.logoUrl,
    currency: settings?.currency ?? DEFAULT_BUSINESS_SETTINGS.currency,
    currencyDecimals: settings?.currencyDecimals ?? DEFAULT_BUSINESS_SETTINGS.currencyDecimals,
    taxName: settings?.taxName ?? DEFAULT_BUSINESS_SETTINGS.taxName,
    receiptFooter: settings?.receiptFooter ?? DEFAULT_BUSINESS_SETTINGS.receiptFooter,
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: brandingCSS }} />
      <SettingsProvider initialSettings={businessSettings}>
        <AppShell user={session.user} cssVars={cssVars}>
          {children}
        </AppShell>
      </SettingsProvider>
    </>
  );
}
