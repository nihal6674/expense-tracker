import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/api";
import { ExpenseForm } from "@/components/ExpenseForm";
import { ExpenseList } from "@/components/ExpenseList";
import { CategorySummary } from "@/components/CategorySummary";
import { Hero195 } from "@/components/ui/hero-195";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { Expense, ListResponse, Sort } from "@/types";

const ALL = "__all__";

export default function App() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(ALL);
  const [sort, setSort] = useState<Sort>("date_desc");
  // All categories that exist on the server, regardless of the current
  // filter — so picking one in the dropdown doesn't make the others vanish.
  const [allCategories, setAllCategories] = useState<string[]>([]);
  // Unfiltered list, used to compute the per-category summary so it doesn't
  // shrink when the user applies a filter to the table below.
  const [summary, setSummary] = useState<ListResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const refreshCategories = useCallback((signal?: AbortSignal) => {
    return api
      .categories(signal)
      .then((res) => setAllCategories(res.categories))
      .catch(() => { /* non-fatal: dropdown just stays as-is */ });
  }, []);

  const refreshSummary = useCallback((signal?: AbortSignal) => {
    return api
      .list({ sort: "date_desc" }, signal)
      .then((res) => setSummary(res))
      .catch(() => { /* non-fatal: summary card just keeps last value */ })
      .finally(() => {
        if (!signal?.aborted) setSummaryLoading(false);
      });
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void refreshCategories(ctrl.signal);
    void refreshSummary(ctrl.signal);
    return () => ctrl.abort();
  }, [refreshCategories, refreshSummary]);

  const reload = useCallback(
    (signal?: AbortSignal) => {
      setRefreshing(true);
      return api
        .list(
          { category: category === ALL ? undefined : category, sort },
          signal,
        )
        .then((res) => {
          setData(res);
          setError(null);
        })
        .catch((err) => {
          if (signal?.aborted) return;
          setError(
            err instanceof ApiError ? err.message : "Could not load expenses.",
          );
        })
        .finally(() => {
          if (!signal?.aborted) {
            setLoading(false);
            setRefreshing(false);
          }
        });
    },
    [category, sort],
  );

  // Re-fetch on filter / sort changes so the displayed total matches the
  // server's authoritative sum for the visible rows.
  useEffect(() => {
    const ctrl = new AbortController();
    api
      .list(
        { category: category === ALL ? undefined : category, sort },
        ctrl.signal,
      )
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(
          err instanceof ApiError ? err.message : "Could not load expenses.",
        );
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [category, sort]);

  const handleCreated = useCallback(
    (created: Expense) => {
      // Optimistically merge — server is source of truth, but this avoids
      // waiting on a round-trip before showing the new row.
      setData((prev) => {
        if (!prev) return prev;
        const include = category === ALL || created.category === category;
        const visible = include ? [created, ...prev.expenses] : prev.expenses;
        const sorted = [...visible].sort((a, b) =>
          sort === "date_desc"
            ? b.date.localeCompare(a.date) ||
              b.created_at.localeCompare(a.created_at)
            : a.date.localeCompare(b.date) ||
              a.created_at.localeCompare(b.created_at),
        );
        const totalPaise =
          Math.round(Number(prev.total) * 100) +
          (include ? Math.round(Number(created.amount) * 100) : 0);
        return {
          expenses: sorted,
          total: (totalPaise / 100).toFixed(2),
          count: sorted.length,
        };
      });
      void reload();
      void refreshCategories();
      void refreshSummary();
    },
    [category, sort, reload, refreshCategories, refreshSummary],
  );

  // Include the currently-selected filter even if the server hasn't
  // reported it yet (e.g. just-created category racing with the refresh).
  const allCategoriesForFilter = useMemo(() => {
    const set = new Set(allCategories);
    if (category !== ALL) set.add(category);
    return Array.from(set).sort();
  }, [allCategories, category]);

  const scrollToForm = () =>
    document.getElementById("add-expense")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Hero195 onPrimary={scrollToForm} />

        <div className="mt-10 space-y-8">
          <div id="add-expense">
            <ExpenseForm
              onCreated={handleCreated}
              knownCategories={allCategories}
            />
          </div>

          <CategorySummary
            expenses={summary?.expenses ?? []}
            loading={summaryLoading}
          />

          <Card id="expenses">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Expenses</CardTitle>
                  <CardDescription>
                    Filter and sort your recorded expenses.
                  </CardDescription>
                </div>
                {refreshing && (
                  <span className="text-xs text-muted-foreground">
                    Refreshing…
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="filter-category">Category</Label>
                  <select
                    id="filter-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex h-10 w-44 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value={ALL}>All categories</option>
                    {allCategoriesForFilter.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="filter-sort">Sort by date</Label>
                  <select
                    id="filter-sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                    className="flex h-10 w-44 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="date_desc">Newest first</option>
                    <option value="date_asc">Oldest first</option>
                  </select>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  <span>{error}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void reload()}
                  >
                    Retry
                  </Button>
                </div>
              )}

              <ExpenseList
                expenses={data?.expenses ?? []}
                loading={loading}
              />

              {data && (
                <div className="flex items-baseline justify-between border-t pt-4">
                  <span className="text-sm text-muted-foreground">
                    Total ({data.count}{" "}
                    {data.count === 1 ? "expense" : "expenses"}
                    {category !== ALL ? ` in ${category}` : ""})
                  </span>
                  <strong className="text-2xl tabular-nums">
                    ₹{data.total}
                  </strong>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
