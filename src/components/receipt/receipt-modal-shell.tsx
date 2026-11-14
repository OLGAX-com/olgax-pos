"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer } from "lucide-react";

interface ReceiptModalShellProps {
  open: boolean;
  overlayId: string;
  title: string;
  titleClassName?: string;
  extraActions?: React.ReactNode;
  bodyClassName?: string;
  onPrint?: () => void;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Portals receipt modals directly to document.body so @media print can hide
 * sibling app containers without hiding the receipt itself.
 */
export function ReceiptModalShell({
  open,
  overlayId,
  title,
  titleClassName,
  extraActions,
  bodyClassName,
  onPrint,
  onClose,
  children,
}: ReceiptModalShellProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-receipt-print-portal=""
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{`
        @media print {
          body > *:not([data-receipt-print-portal]) {
            display: none !important;
          }
          [data-receipt-print-portal] {
            position: static !important;
            inset: auto !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          [data-receipt-print-portal] #${overlayId} {
            position: static !important;
            width: 100% !important;
            max-width: none !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
            background: white !important;
          }
          [data-receipt-print-portal] .no-print {
            display: none !important;
          }
          [data-receipt-print-portal] [data-receipt-print-body] {
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            background: white !important;
          }
        }
      `}</style>

      <div
        id={overlayId}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm overflow-hidden rounded-xl border bg-white shadow-2xl"
      >
        <div className="no-print bg-card flex items-center justify-between border-b px-4 py-3">
          <h2
            className={
              titleClassName ? `text-sm font-semibold ${titleClassName}` : "text-sm font-semibold"
            }
          >
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {extraActions}
            <button
              onClick={onPrint ?? (() => window.print())}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="hover:bg-accent rounded p-1 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          data-receipt-print-body=""
          className={
            bodyClassName
              ? `max-h-[70vh] overflow-y-auto bg-white p-4 ${bodyClassName}`
              : "max-h-[70vh] overflow-y-auto bg-white p-4"
          }
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
