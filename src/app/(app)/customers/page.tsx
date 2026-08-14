"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useFormatCurrency } from "@/contexts/settings-context";
import { Search, Plus, Loader2, Edit, Trash2, ChevronLeft, ChevronRight, GitMerge, Phone, AlertTriangle, Check } from "lucide-react";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  loyaltyPoints: number;
  totalSpend: number;
  lastVisit: string | null;
  visitCount: number;
  createdAt: string;
};

export default function CustomersPage() {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const formatCurrency = useFormatCurrency();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Merge Duplicates State
  type DuplicateGroup = { phone: string; customers: (Customer & { salesCount: number })[] };
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeGroups, setMergeGroups] = useState<DuplicateGroup[]>([]);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [keepSelections, setKeepSelections] = useState<Record<string, string>>({}); // phone → keepId
  const [mergingPhone, setMergingPhone] = useState<string | null>(null);

  async function loadDuplicates() {
    setMergeLoading(true);
    try {
      const res = await fetch("/api/customers/duplicates");
      const data = await res.json();
      const groups: DuplicateGroup[] = data.groups ?? [];
      setMergeGroups(groups);
      // Default keep = first (oldest) customer in each group
      const defaults: Record<string, string> = {};
      for (const g of groups) {
        if (g.customers.length > 0) defaults[g.phone] = g.customers[0].id;
      }
      setKeepSelections(defaults);
      setMergeOpen(true);
    } finally {
      setMergeLoading(false);
    }
  }

  async function executeMerge(phone: string) {
    const group = mergeGroups.find((g) => g.phone === phone);
    if (!group) return;
    const keepId = keepSelections[phone];
    if (!keepId) return;
    const mergeId = group.customers.find((c) => c.id !== keepId)?.id;
    if (!mergeId) return;

    setMergingPhone(phone);
    try {
      const res = await fetch("/api/customers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId, mergeId }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? "Merge failed");
        return;
      }
      // Remove the merged group from the list
      setMergeGroups((prev) => prev.filter((g) => g.phone !== phone));
      fetchCustomers();
    } finally {
      setMergingPhone(null);
    }
  }

  // Create/Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "", notes: "" });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1); // Reset page on query change
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch customers
  async function fetchCustomers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(debouncedQuery)}&page=${page}&limit=10`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCustomers(data.customers || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, [debouncedQuery, page]);

  // Handle Create/Edit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setFormLoading(true);
    setFormError("");
    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : "/api/customers";
      const method = editingCustomer ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setModalOpen(false);
      setEditingCustomer(null);
      setFormData({ name: "", phone: "", email: "", notes: "" });
      fetchCustomers();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  // Handle Delete
  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      fetchCustomers();
    } catch (err) {
      console.error(err);
      alert("Failed to delete customer");
    }
  }

  function openCreate() {
    setEditingCustomer(null);
    setFormData({ name: "", phone: "", email: "", notes: "" });
    setModalOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      notes: customer.notes || "",
    });
    setModalOpen(true);
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">Manage your customer database and view history.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDuplicates}
            disabled={mergeLoading}
            className="flex items-center gap-2 border border-border bg-background text-foreground px-4 py-2 rounded-md font-medium text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            {mergeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
            {t("find_duplicates")}
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t("add")}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background w-full sm:w-80">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          placeholder={t("search_placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm item">
            <thead className="bg-muted/50 border-b">
              <tr className="text-left text-xs text-muted-foreground uppercase font-medium">
                <th className="px-4 py-3">{t("name")}</th>
                <th className="px-4 py-3">{t("contact")}</th>
                <th className="px-4 py-3 text-right">{t("total_spent")}</th>
                <th className="px-4 py-3 text-right">{t("visits")}</th>
                <th className="px-4 py-3 text-right">{t("last_visit")}</th>
                <th className="px-4 py-3 text-right">{t("loyalty_points")}</th>
                <th className="px-4 py-3 text-center w-24">{tc("edit")}/{tc("delete")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("loading")}
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    {t("no_customers_found")}
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/50 transition-colors group">
                    <td className="px-4 py-3 font-medium">
                        <Link href={`/customers/${c.id}`} className="hover:underline text-primary">{c.name}</Link>
                        {c.notes && <div className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">{c.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col text-xs text-muted-foreground">
                        {c.phone && <span>{c.phone}</span>}
                        {c.email && <span>{c.email}</span>}
                        {!c.phone && !c.email && <span className="opacity-50">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(c.totalSpend)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {c.visitCount}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                      {c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                        {c.loyaltyPoints}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 hover:bg-muted rounded text-foreground/80 hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-t bg-muted/20 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:pointer-events-none px-2 py-1 rounded hover:bg-muted"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> {tc("back")}
          </button>
          <span className="text-xs text-muted-foreground">
            {page} {tc("of")} {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:pointer-events-none px-2 py-1 rounded hover:bg-muted"
          >
            → <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Merge Duplicates Modal */}
      {mergeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMergeOpen(false)} />
          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-background rounded-lg shadow-xl border overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <GitMerge className="h-5 w-5 text-primary" />
                  Merge Duplicate Customers
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customers with the same phone number are listed below. Choose which record to keep.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {mergeGroups.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="font-medium">No duplicate phone numbers found</p>
                  <p className="text-sm text-muted-foreground">Your customer database looks clean!</p>
                </div>
              ) : (
                mergeGroups.map((group) => (
                  <div key={group.phone} className="rounded-lg border border-amber-300/60 bg-amber-50/40 dark:bg-amber-900/10 dark:border-amber-800/40 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{group.phone}</span>
                      <span className="text-xs font-normal text-muted-foreground ml-auto">{group.customers.length} records share this number</span>
                    </div>

                    <div className="space-y-2">
                      {group.customers.map((c) => {
                        const isKeep = keepSelections[group.phone] === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setKeepSelections((prev) => ({ ...prev, [group.phone]: c.id }))}
                            className={`w-full flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                              isKeep
                                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                : "border-border bg-background hover:bg-muted/50"
                            }`}
                          >
                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                              isKeep ? "border-primary bg-primary" : "border-border"
                            }`}>
                              {isKeep && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {c.email && <span className="mr-2">{c.email}</span>}
                                <span>{c.salesCount} sale{c.salesCount !== 1 ? "s" : ""}</span>
                                <span className="mx-1">·</span>
                                <span>{c.loyaltyPoints} pts</span>
                              </p>
                            </div>
                            {isKeep && (
                              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded px-1.5 py-0.5">
                                Keep
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                      <span>
                        Sales history, loyalty points, and loyalty logs from the other record(s) will be merged into the kept customer. Duplicate records will be deleted.
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => executeMerge(group.phone)}
                        disabled={mergingPhone === group.phone}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {mergingPhone === group.phone ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <GitMerge className="h-3.5 w-3.5" />
                        )}
                        Merge into kept record
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t px-6 py-4 bg-muted/20 flex justify-end">
              <button
                onClick={() => setMergeOpen(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
              >
                {tc("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-md bg-background rounded-lg shadow-xl border overflow-hidden animate-in fade-in zoom-in-95">
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold">{editingCustomer ? t("edit_title") : t("new_title")}</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("name")} <span className="text-destructive">*</span></label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="John Doe"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("phone")}</label>
                    <input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="+1 (555)..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("email")}</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("notes")}</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                    placeholder="Customer preferences..."
                  />
                </div>

                {formError && <p className="text-sm text-destructive">{formError}</p>}
              </div>
              <div className="px-6 py-4 bg-muted/40 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                >
                  {tc("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
                >
                  {formLoading ? tc("loading") : tc("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
