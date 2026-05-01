import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { DB } from "./db.js";
import { expensesRouter } from "./routes/expenses.js";

export function createApp(db: DB): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use(expensesRouter(db));

  app.use((_req, res) => res.status(404).json({ error: "not found" }));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error("unhandled error:", err);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}
