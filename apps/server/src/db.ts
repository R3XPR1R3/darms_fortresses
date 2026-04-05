import pg from "pg";

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? "darms",
  user: process.env.POSTGRES_USER ?? "darms",
  password: process.env.POSTGRES_PASSWORD ?? "darms_secret",
  max: 10,
});

/** Run on startup — create tables if they don't exist */
export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      google_id     TEXT UNIQUE NOT NULL,
      email         TEXT,
      name          TEXT,
      avatar_url    TEXT,
      nickname      TEXT NOT NULL,
      settings      JSONB NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS gold INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS diamonds INTEGER NOT NULL DEFAULT 0;
  `);
  console.log("[db] Tables initialized");
}

export interface UserRow {
  id: number;
  google_id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  nickname: string;
  settings: Record<string, unknown>;
  gold: number;
  diamonds: number;
  created_at: Date;
  updated_at: Date;
}

/** Find or create user by Google ID */
export async function upsertUser(
  googleId: string,
  email: string | null,
  name: string | null,
  avatarUrl: string | null,
): Promise<UserRow> {
  const existing = await pool.query<UserRow>(
    "SELECT * FROM users WHERE google_id = $1",
    [googleId],
  );
  if (existing.rows[0]) {
    // Update name/avatar from Google (may change)
    await pool.query(
      "UPDATE users SET name = $1, avatar_url = $2, email = $3, updated_at = NOW() WHERE google_id = $4",
      [name, avatarUrl, email, googleId],
    );
    return { ...existing.rows[0], name, avatar_url: avatarUrl, email };
  }

  // Create new user — nickname defaults to Google name or email prefix
  const nickname = name ?? email?.split("@")[0] ?? `Player${Date.now() % 10000}`;
  const result = await pool.query<UserRow>(
    `INSERT INTO users (google_id, email, name, avatar_url, nickname)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [googleId, email, name, avatarUrl, nickname],
  );
  return result.rows[0];
}

/** Get user by ID */
export async function getUserById(id: number): Promise<UserRow | null> {
  const result = await pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

/** Update nickname */
export async function updateNickname(userId: number, nickname: string): Promise<void> {
  await pool.query(
    "UPDATE users SET nickname = $1, updated_at = NOW() WHERE id = $2",
    [nickname, userId],
  );
}

/** Update settings */
export async function updateSettings(userId: number, settings: Record<string, unknown>): Promise<void> {
  await pool.query(
    "UPDATE users SET settings = $1, updated_at = NOW() WHERE id = $2",
    [JSON.stringify(settings), userId],
  );
}

/** Get user wallet */
export async function getWallet(userId: number): Promise<{ gold: number; diamonds: number } | null> {
  const result = await pool.query<{ gold: number; diamonds: number }>(
    "SELECT gold, diamonds FROM users WHERE id = $1",
    [userId],
  );
  return result.rows[0] ?? null;
}

/** Update wallet absolute values */
export async function updateWallet(userId: number, gold: number, diamonds: number): Promise<void> {
  await pool.query(
    "UPDATE users SET gold = $1, diamonds = $2, updated_at = NOW() WHERE id = $3",
    [gold, diamonds, userId],
  );
}

/** Increment gold balance (can be negative if needed) */
export async function addGold(userId: number, goldDelta: number): Promise<void> {
  await pool.query(
    "UPDATE users SET gold = GREATEST(0, gold + $1), updated_at = NOW() WHERE id = $2",
    [goldDelta, userId],
  );
}

export { pool };
