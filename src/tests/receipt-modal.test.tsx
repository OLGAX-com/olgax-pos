import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReceiptModal } from "@/components/receipt/receipt-modal";
import { RefundReceiptModal } from "@/components/receipt/refund-receipt-modal";

const sampleSettings = {
  name: "Olga Coffee",
  logoUrl: null,
  currency: "USD",
  currencyDecimals: 2,
  taxName: "Tax",
  receiptFooter: "Thank you!",
};

const sampleSaleData = {
  saleId: "sale-123",
  items: [{ name: "Espresso", quantity: 2, price: 350, total: 700 }],
  subtotal: 700,
  discountAmount: 0,
  taxAmount: 70,
  total: 770,
  paymentMethod: "CASH",
  amountTendered: 1000,
  changeDue: 230,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ReceiptModal", () => {
  it("renders nothing when closed", () => {
    render(
      <ReceiptModal
        open={false}
        onClose={() => {}}
        data={sampleSaleData}
        settings={sampleSettings}
      />
    );

    expect(document.body.querySelector("[data-receipt-print-portal]")).toBeNull();
  });

  it("portals directly to document.body and exposes print isolation rules", () => {
    const appWrapper = document.createElement("div");
    appWrapper.id = "app-shell-root";
    document.body.appendChild(appWrapper);

    try {
      render(
        <ReceiptModal
          open={true}
          onClose={() => {}}
          data={sampleSaleData}
          settings={sampleSettings}
        />,
        { container: appWrapper }
      );

      const portalRoot = document.body.querySelector("[data-receipt-print-portal]");
      expect(portalRoot).not.toBeNull();
      expect(portalRoot?.parentElement).toBe(document.body);
      expect(appWrapper.querySelector("#receipt-print-overlay")).toBeNull();

      const overlay = portalRoot?.querySelector("#receipt-print-overlay");
      expect(overlay).not.toBeNull();
      expect(overlay?.querySelector("#receipt-print")?.textContent).toContain("Espresso");

      const styleTag = portalRoot?.querySelector("style");
      expect(styleTag?.textContent).toContain("body > *:not([data-receipt-print-portal])");
      expect(styleTag?.textContent).toContain("[data-receipt-print-body]");
    } finally {
      appWrapper.remove();
    }
  });

  it("triggers window.print and handles Close button and Escape key", () => {
    const onClose = vi.fn();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    render(
      <ReceiptModal open={true} onClose={onClose} data={sampleSaleData} settings={sampleSettings} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    expect(printSpy).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("RefundReceiptModal", () => {
  it("portals refund receipt directly to document.body with print isolation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleSettings,
    });
    vi.stubGlobal("fetch", fetchMock);

    const appWrapper = document.createElement("div");
    appWrapper.id = "app-shell-root";
    document.body.appendChild(appWrapper);

    try {
      render(
        <RefundReceiptModal
          open={true}
          onClose={() => {}}
          saleId="sale-456"
          items={[{ name: "Croissant", quantity: 1, price: 400, total: 400 }]}
          refundTotal={400}
          reason="Damaged item"
        />,
        { container: appWrapper }
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith("/api/settings");
      });

      const portalRoot = document.body.querySelector("[data-receipt-print-portal]");
      expect(portalRoot).not.toBeNull();
      expect(portalRoot?.parentElement).toBe(document.body);
      expect(appWrapper.querySelector("#refund-receipt-overlay")).toBeNull();

      const overlay = portalRoot?.querySelector("#refund-receipt-overlay");
      expect(overlay?.textContent).toContain("REFUND");
      expect(overlay?.querySelector("#receipt-print")?.textContent).toContain("Croissant");
      expect(overlay?.querySelector("#receipt-print")?.textContent).toContain("Damaged item");

      const styleTag = portalRoot?.querySelector("style");
      expect(styleTag?.textContent).toContain("body > *:not([data-receipt-print-portal])");
    } finally {
      vi.unstubAllGlobals();
      appWrapper.remove();
    }
  });
});
