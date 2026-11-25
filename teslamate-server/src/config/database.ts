import pg from "pg";

export function createDatabase(connectionString: string | undefined) {
  if (!connectionString?.trim()) return null;
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
    options: "-c default_transaction_read_only=on -c timezone=UTC",
  });
  pool.on("error", () => console.error("Database idle connection failed"));
  return pool;
}
