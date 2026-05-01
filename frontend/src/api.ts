import type { Expense, ListResponse, Sort } from "@/types";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  { retries = 2, signal }: { retries?: number; signal?: AbortSignal } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        ...init,
        signal,
        headers: {
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });
      const text = await res.text();
      const body = text ? JSON.parse(text) : null;
      if (!res.ok) {
        // 4xx is the user's fault, not the network's; don't retry.
        if (res.status >= 400 && res.status < 500) {
          throw new ApiError(res.status, body?.error ?? res.statusText, body?.details);
        }
        throw new ApiError(res.status, body?.error ?? res.statusText);
      }
      return body as T;
    } catch (err) {
      lastErr = err;
      if (err instanceof ApiError && err.status < 500) throw err;
      if (signal?.aborted) throw err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}

export type CreateInput = {
  amount: string;
  category: string;
  description: string;
  date: string;
};

export const api = {
  list(opts: { category?: string; sort?: Sort } = {}, signal?: AbortSignal): Promise<ListResponse> {
    const q = new URLSearchParams();
    if (opts.category) q.set("category", opts.category);
    if (opts.sort) q.set("sort", opts.sort);
    const qs = q.toString();
    return request<ListResponse>(`/expenses${qs ? `?${qs}` : ""}`, {}, { signal });
  },

  create(input: CreateInput, idempotencyKey: string): Promise<Expense> {
    return request<Expense>("/expenses", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    });
  },

  categories(signal?: AbortSignal): Promise<{ categories: string[] }> {
    return request<{ categories: string[] }>("/expenses/categories", {}, { signal });
  },
};

export { ApiError };
