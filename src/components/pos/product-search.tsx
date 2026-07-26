"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Search, Plus, AlertTriangle } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import { getDeviceSettings, playErrorBeep } from "@/hooks/use-device-settings";

interface ProductResult {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode?: string | null;
  sku?: string | null;
  category?: string | null;
  imageUrl?: string | null;
}

export function ProductSearch() {
  const t = useTranslations("pos");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductResult[]>([]);
  const [allProducts, setAllProducts] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [gridLoading, setGridLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeypressRef = useRef<number>(0);

  // Load all products on mount for the quick-add grid
  useEffect(() => {
    async function loadGrid() {
      setGridLoading(true);
      try {
        const res = await fetch("/api/products/search?q=&limit=60");
        if (res.ok) {
          const data = await res.json();
          setAllProducts(data);
        }
      } catch {
        // ignore â€” grid is optional
      } finally {
        setGridLoading(false);
      }
    }
    loadGrid();
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const { searchProductsOffline } = await import("@/lib/pglite");
        const data = await searchProductsOffline(q);
        setResults(data);
      } else {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Show toast when barcode scan returns no result
  const prevResultsRef = useRef<ProductResult[]>([]);
  useEffect(() => {
    const isBarcodeLike = /^[A-Za-z0-9]{6,20}$/.test(query.trim()) && results.length === 0 && prevResultsRef.current !== results && !loading && query.trim().length > 0;
    if (isBarcodeLike) {
      toast.error(`Product not found: "${query.trim()}"`, { id: "barcode-not-found", duration: 3000 });
      const deviceSettings = getDeviceSettings();
      if (deviceSettings.scannerBeepEnabled) playErrorBeep();
    }
    prevResultsRef.current = results;
  }, [results, query, loading]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Barcode scanners type very fast (< 30ms between keystrokes).
    // Use a short debounce so the search fires immediately after the scanner finishes.
    const now = Date.now();
    const timeSinceLast = now - lastKeypressRef.current;
    lastKeypressRef.current = now;
    const delay = timeSinceLast < 30 ? 50 : 250;
    debounceRef.current = setTimeout(() => search(val), delay);
  }

  function handleSelect(product: ProductResult) {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
    });
    setQuery("");
    setResults([]);
  }

  const showSearchResults = Boolean(query.trim());

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Search bar */}
      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          id="pos-search-input"
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.length > 0) {
              e.preventDefault();
              handleSelect(results[0]);
            } else if (e.key === "Escape") {
              setQuery("");
              setResults([]);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder={t("search_placeholder")}
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-11 w-full rounded-md border pl-9 pr-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          autoFocus
        />
      </div>

      {/* Search results */}
      {showSearchResults && (
        <div className="shrink-0">
          {loading && (
            <p className="text-xs text-muted-foreground px-1 py-2">Searchingâ€¦</p>
          )}
          {!loading && results.length === 0 && (
            <p className="text-xs text-muted-foreground px-1 py-2">No products found</p>
          )}
          {results.length > 0 && (
            <div className="rounded-md border bg-card divide-y overflow-hidden">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    {p.sku && (
                      <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(p.price)}</p>
                    <p className="text-xs text-muted-foreground">Stock: {p.stock}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick-add product grid (when no active search) */}
      {!showSearchResults && (
        <div className="flex-1 overflow-y-auto">
          {gridLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-20 rounded-lg border bg-muted animate-pulse" />
              ))}
            </div>
          ) : allProducts.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
              No products yet — add products in the catalog
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {allProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  disabled={p.stock === 0}
                  className={cn(
                    "relative flex flex-col justify-between rounded-lg border p-3 text-left transition-all min-h-[4.5rem]",
                    p.stock === 0
                      ? "opacity-50 cursor-not-allowed bg-muted"
                      : "hover:bg-accent hover:border-primary/30 active:scale-[0.98] cursor-pointer bg-card"
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-1">
                    
                    <p className="text-xs font-semibold leading-tight line-clamp-2 flex-1">
                      {p.name}
                    </p>
                    <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                  </div>
                  {p.imageUrl ? (
                      <div className="flex w-full justify-center">
                     <img
                      src={p.imageUrl} 
                      alt="Product preview" 
                      className="rounded-md object-cover" 
                    />
                    </div>
                    ):("")}

                  <div className="flex w-full items-end justify-between mt-1.5">
                    <span className="text-sm font-bold text-primary">
                      {formatCurrency(p.price)}
                    </span>
                    {p.stock > 0 && p.stock <= 5 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {p.stock}
                      </span>
                    )}
                    {p.stock === 0 && (
                      <span className="text-[10px] text-destructive font-medium">Out</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
