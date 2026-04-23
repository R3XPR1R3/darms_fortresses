#!/usr/bin/env node
import pg from "pg";

const [, , cmd, ...args] = process.argv;

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? "darms",
  user: process.env.POSTGRES_USER ?? "darms",
  password: process.env.POSTGRES_PASSWORD ?? "darms_secret",
});

async function main() {
  if (!cmd || ["help", "--help", "-h"].includes(cmd)) {
    console.log(`Usage:
  node tools/wallet-admin.mjs list
  node tools/wallet-admin.mjs get <user_id>
  node tools/wallet-admin.mjs set <user_id> <gold> <diamonds>
  node tools/wallet-admin.mjs add-gold <user_id> <amount>`);
    return;
  }

  if (cmd === "list") {
    const r = await pool.query("SELECT id, nickname, gold, diamonds FROM users ORDER BY id ASC");
    for (const row of r.rows) {
      console.log(`#${row.id}\t${row.nickname}\tgold=${row.gold}\tdiamonds=${row.diamonds}`);
    }
    return;
  }

  if (cmd === "get") {
    const userId = Number(args[0]);
    const r = await pool.query("SELECT id, nickname, gold, diamonds FROM users WHERE id = $1", [userId]);
    if (!r.rows[0]) throw new Error("User not found");
    console.log(r.rows[0]);
    return;
  }

  if (cmd === "set") {
    const userId = Number(args[0]);
    const gold = Math.max(0, Math.floor(Number(args[1] ?? 0)));
    const diamonds = Math.max(0, Math.floor(Number(args[2] ?? 0)));
    await pool.query(
      "UPDATE users SET gold = $1, diamonds = $2, updated_at = NOW() WHERE id = $3",
      [gold, diamonds, userId],
    );
    console.log(`Updated user #${userId}: gold=${gold}, diamonds=${diamonds}`);
    return;
  }

  if (cmd === "add-gold") {
    const userId = Number(args[0]);
    const amount = Math.floor(Number(args[1] ?? 0));
    await pool.query(
      "UPDATE users SET gold = GREATEST(0, gold + $1), updated_at = NOW() WHERE id = $2",
      [amount, userId],
    );
    const r = await pool.query("SELECT id, nickname, gold FROM users WHERE id = $1", [userId]);
    if (!r.rows[0]) throw new Error("User not found");
    console.log(`User #${userId} (${r.rows[0].nickname}) now has gold=${r.rows[0].gold}`);
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

main()
  .catch((err) => {
    console.error("wallet-admin error:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
