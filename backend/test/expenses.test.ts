import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { openDb, type DB } from "../src/db.js";
import { createApp } from "../src/server.js";
import { paiseToRupees, rupeesToPaise } from "../src/lib/money.js";

describe("money conversion", () => {
  it("round-trips common values", () => {
    for (const v of ["0.00", "1.00", "12.34", "1000.05", "9999999.99"]) {
      expect(paiseToRupees(rupeesToPaise(v))).toBe(v);
    }
  });
  it("rejects more than 2 fractional digits", () => {
    expect(() => rupeesToPaise("1.234")).toThrow();
  });
  it("rejects non-numeric", () => {
    expect(() => rupeesToPaise("abc")).toThrow();
  });
});

describe("expenses api", () => {
  let db: DB;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = openDb(":memory:");
    app = createApp(db);
  });
  afterEach(() => db.close());

  const sample = {
    amount: "123.45",
    category: "Food",
    description: "Lunch",
    date: "2026-04-01",
  };

  it("creates and lists expenses", async () => {
    const create = await request(app).post("/expenses").send(sample);
    expect(create.status).toBe(201);
    expect(create.body.amount).toBe("123.45");
    expect(create.body.id).toBeTruthy();

    const list = await request(app).get("/expenses");
    expect(list.status).toBe(200);
    expect(list.body.expenses).toHaveLength(1);
    expect(list.body.total).toBe("123.45");
    expect(list.body.count).toBe(1);
  });

  it("rejects negative and zero amounts", async () => {
    const a = await request(app)
      .post("/expenses")
      .send({ ...sample, amount: "-5.00" });
    expect(a.status).toBe(400);
    const b = await request(app)
      .post("/expenses")
      .send({ ...sample, amount: "0" });
    expect(b.status).toBe(400);
  });

  it("rejects malformed dates", async () => {
    const r = await request(app)
      .post("/expenses")
      .send({ ...sample, date: "01/04/2026" });
    expect(r.status).toBe(400);
  });

  it("idempotency-key replays the same response", async () => {
    const first = await request(app)
      .post("/expenses")
      .set("Idempotency-Key", "abc-123")
      .send(sample);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/expenses")
      .set("Idempotency-Key", "abc-123")
      .send(sample);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.headers["idempotent-replay"]).toBe("true");

    const list = await request(app).get("/expenses");
    expect(list.body.expenses).toHaveLength(1);
  });

  it("filters by category and sums totals over the filtered set", async () => {
    await request(app).post("/expenses").send({ ...sample, amount: "10.00", category: "Food" });
    await request(app).post("/expenses").send({ ...sample, amount: "20.00", category: "Food" });
    await request(app).post("/expenses").send({ ...sample, amount: "99.99", category: "Travel" });

    const food = await request(app).get("/expenses?category=Food");
    expect(food.body.expenses).toHaveLength(2);
    expect(food.body.total).toBe("30.00");

    const all = await request(app).get("/expenses");
    expect(all.body.total).toBe("129.99");
  });

  it("sorts by date desc by default", async () => {
    await request(app).post("/expenses").send({ ...sample, date: "2026-01-01" });
    await request(app).post("/expenses").send({ ...sample, date: "2026-03-01" });
    await request(app).post("/expenses").send({ ...sample, date: "2026-02-01" });

    const r = await request(app).get("/expenses?sort=date_desc");
    expect(r.body.expenses.map((e: { date: string }) => e.date)).toEqual([
      "2026-03-01",
      "2026-02-01",
      "2026-01-01",
    ]);
  });
});
