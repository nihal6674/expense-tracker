import { openDb } from "./db.js";
import { createApp } from "./server.js";

const port = Number(process.env.PORT ?? 4000);
const dbPath = process.env.DB_PATH ?? "data/expenses.db";

const db = openDb(dbPath);
const app = createApp(db);

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`expense-tracker api listening on http://localhost:${port}`);
});

const shutdown = (signal: string) => {
  // eslint-disable-next-line no-console
  console.log(`received ${signal}, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
