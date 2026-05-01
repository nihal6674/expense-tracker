import { useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError, type CreateInput } from "@/api";
import type { Expense } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_CATEGORIES = ["Food", "Travel", "Shopping", "Bills", "Health", "Other"];

type Props = {
  onCreated: (e: Expense) => void;
  knownCategories: string[];
};

const today = () => new Date().toISOString().slice(0, 10);

// A fresh idempotency key per pending submission — survives re-renders, so a
// double-click submits the same request twice and the server dedupes it.
const makeKey = () =>
  crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function ExpenseForm({ onCreated, knownCategories }: Props) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idemKeyRef = useRef<string>(makeKey());
  const ids = {
    amount: useId(),
    category: useId(),
    description: useId(),
    date: useId(),
  };

  const categories = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...knownCategories]),
  ).sort();

  function clientValidate(): string | null {
    if (!amount.trim()) return "Amount is required.";
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      return "Amount must be a positive number with up to 2 decimals.";
    }
    if (Number(amount) <= 0) return "Amount must be greater than zero.";
    if (!category.trim()) return "Category is required.";
    if (!description.trim()) return "Description is required.";
    if (!date) return "Date is required.";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const v = clientValidate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSubmitting(true);

    const input: CreateInput = {
      amount: amount.trim(),
      category: category.trim(),
      description: description.trim(),
      date,
    };
    try {
      const created = await api.create(input, idemKeyRef.current);
      onCreated(created);
      setAmount("");
      setDescription("");
      idemKeyRef.current = makeKey();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Could not save the expense.");
      } else {
        setError("Network error — please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add expense</CardTitle>
        <CardDescription>
          Record a new expense. Submissions are safe to retry.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={ids.amount}>Amount (₹)</Label>
              <Input
                id={ids.amount}
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === "" || /^\d*(\.\d{0,2})?$/.test(next)) {
                    setAmount(next);
                  }
                }}
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={ids.category}>Category</Label>
              <Input
                id={ids.category}
                list="known-categories"
                placeholder="e.g. Food"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={submitting}
              />
              <datalist id="known-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={ids.date}>Date</Label>
              <Input
                id={ids.date}
                type="date"
                value={date}
                max={today()}
                onChange={(e) => setDate(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={ids.description}>Description</Label>
              <Input
                id={ids.description}
                placeholder="What was it for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? "Saving…" : "Add expense"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
