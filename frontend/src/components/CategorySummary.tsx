import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Expense } from "@/types";

type Props = {
  expenses: Expense[];
  loading: boolean;
};

// Convert "123.45" rupee string to integer paise — same approach as the
// server, so totals here match what the server would compute.
const toPaise = (s: string) => Math.round(Number(s) * 100);
const toRupees = (p: number) =>
  (p / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function CategorySummary({ expenses, loading }: Props) {
  const breakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of expenses) {
      totals.set(e.category, (totals.get(e.category) ?? 0) + toPaise(e.amount));
    }
    const rows = Array.from(totals, ([category, paise]) => ({
      category,
      paise,
    }));
    rows.sort((a, b) => b.paise - a.paise);
    return rows;
  }, [expenses]);

  const grandTotal = useMemo(
    () => breakdown.reduce((sum, r) => sum + r.paise, 0),
    [breakdown],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>By category</CardTitle>
        <CardDescription>
          Where your money is going across all expenses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && breakdown.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Loading summary…
          </p>
        ) : breakdown.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Add an expense to see a breakdown here.
          </p>
        ) : (
          <ul className="space-y-3">
            {breakdown.map(({ category, paise }) => {
              const pct = grandTotal === 0 ? 0 : (paise / grandTotal) * 100;
              return (
                <li key={category}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{category}</span>
                    <span className="tabular-nums text-muted-foreground">
                      ₹{toRupees(paise)}
                      <span className="ml-2 text-xs">
                        ({pct.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={Math.round(pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
