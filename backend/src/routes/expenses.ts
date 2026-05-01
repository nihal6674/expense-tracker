import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { DB } from "../db.js";
import { paiseToRupees, rupeesToPaise } from "../lib/money.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const CreateBody = z.object({
  amount: z.union([z.string(), z.number()]),
  category: z.string().trim().min(1).max(64),
  description: z.string().trim().min(1).max(500),
  date: z.string().regex(ISO_DATE, "date must be YYYY-MM-DD"),
});

const ListQuery = z.object({
  category: z.string().trim().min(1).optional(),
  sort: z.enum(["date_desc", "date_asc"]).optional(),
});

type ExpenseRow = {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  created_at: string;
};

const serialize = (row: ExpenseRow) => ({
  id: row.id,
  amount: paiseToRupees(row.amount),
  category: row.category,
  description: row.description,
  date: row.date,
  created_at: row.created_at,
});

export function expensesRouter(db: DB): Router {
  const router = Router();

  const insertExpense = db.prepare(
    `INSERT INTO expenses (id, amount, category, description, date, created_at)
     VALUES (@id, @amount, @category, @description, @date, @created_at)`,
  );
  const selectById = db.prepare<[string], ExpenseRow>(
    `SELECT * FROM expenses WHERE id = ?`,
  );
  const selectIdem = db.prepare<[string], { status: number; response: string; method: string; path: string }>(
    `SELECT status, response, method, path FROM idempotency_keys WHERE key = ?`,
  );
  const insertIdem = db.prepare(
    `INSERT INTO idempotency_keys (key, method, path, status, response, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  router.post("/expenses", (req: Request, res: Response) => {
    const idemKey = req.header("Idempotency-Key");

    if (idemKey) {
      const cached = selectIdem.get(idemKey);
      if (cached) {
        if (cached.method !== "POST" || cached.path !== "/expenses") {
          return res.status(422).json({
            error: "idempotency key reused with a different request",
          });
        }
        res.setHeader("Idempotent-Replay", "true");
        return res.status(cached.status).json(JSON.parse(cached.response));
      }
    }

    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    let amountPaise: number;
    try {
      amountPaise = rupeesToPaise(parsed.data.amount);
    } catch (e) {
      return res
        .status(400)
        .json({ error: (e as Error).message, field: "amount" });
    }
    if (amountPaise <= 0) {
      return res
        .status(400)
        .json({ error: "amount must be greater than zero", field: "amount" });
    }

    const row: ExpenseRow = {
      id: randomUUID(),
      amount: amountPaise,
      category: parsed.data.category,
      description: parsed.data.description,
      date: parsed.data.date,
      created_at: new Date().toISOString(),
    };

    const body = serialize(row);
    const tx = db.transaction(() => {
      insertExpense.run(row);
      if (idemKey) {
        insertIdem.run(
          idemKey,
          "POST",
          "/expenses",
          201,
          JSON.stringify(body),
          row.created_at,
        );
      }
    });

    try {
      tx();
    } catch (e: unknown) {
      // A concurrent retry may have stored the idempotency key first; replay it.
      if (
        idemKey &&
        e instanceof Error &&
        e.message.includes("idempotency_keys")
      ) {
        const cached = selectIdem.get(idemKey);
        if (cached) {
          res.setHeader("Idempotent-Replay", "true");
          return res.status(cached.status).json(JSON.parse(cached.response));
        }
      }
      throw e;
    }

    return res.status(201).json(body);
  });

  router.get("/expenses", (req: Request, res: Response) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "invalid query",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { category, sort } = parsed.data;

    const where: string[] = [];
    const params: unknown[] = [];
    if (category) {
      where.push("category = ?");
      params.push(category);
    }

    // Default ordering matches the assignment's primary use case (newest first).
    // created_at is a tiebreaker so same-day expenses still sort deterministically.
    const order = sort === "date_asc" ? "ASC" : "DESC";
    const sql =
      `SELECT * FROM expenses` +
      (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
      ` ORDER BY date ${order}, created_at ${order}`;

    const rows = db.prepare<unknown[], ExpenseRow>(sql).all(...params);

    let totalPaise = 0;
    for (const r of rows) totalPaise += r.amount;

    return res.json({
      expenses: rows.map(serialize),
      total: paiseToRupees(totalPaise),
      count: rows.length,
    });
  });

  router.get("/expenses/categories", (_req, res) => {
    const rows = db
      .prepare<unknown[], { category: string }>(
        `SELECT DISTINCT category FROM expenses ORDER BY category ASC`,
      )
      .all();
    res.json({ categories: rows.map((r) => r.category) });
  });

  router.get("/expenses/:id", (req, res) => {
    const row = selectById.get(req.params.id);
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(serialize(row));
  });

  return router;
}
