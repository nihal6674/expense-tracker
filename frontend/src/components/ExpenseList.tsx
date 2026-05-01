import type { Expense } from "@/types";

type Props = {
  expenses: Expense[];
  loading: boolean;
};

const formatDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export function ExpenseList({ expenses, loading }: Props) {
  if (loading && expenses.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading expenses…
      </p>
    );
  }
  if (expenses.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No expenses yet. Add your first one above.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Date</th>
            <th className="px-4 py-2 text-left font-medium">Category</th>
            <th className="px-4 py-2 text-left font-medium">Description</th>
            <th className="px-4 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr
              key={e.id}
              className="border-t transition-colors hover:bg-muted/30"
            >
              <td className="whitespace-nowrap px-4 py-2.5">
                {formatDate(e.date)}
              </td>
              <td className="px-4 py-2.5">
                <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                  {e.category}
                </span>
              </td>
              <td className="px-4 py-2.5">{e.description}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                ₹{e.amount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
