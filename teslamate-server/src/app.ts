import { config } from "dotenv";
import { createDatabase } from "./config/database.js";
import { createApp } from "./server.js";

config({ path: new URL("../.env", import.meta.url), quiet: true });
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535");
const pool = createDatabase(process.env.DATABASE_URL);
const origins = (process.env.CORS_ORIGINS ?? "http://localhost:8081,http://127.0.0.1:8081")
  .split(",").map((origin) => origin.trim()).filter(Boolean);
const server = createApp(pool, origins);

server.listen(port, host, () => {
  console.log(`TeslaMate Server listening on http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    server.close(() => {
      void (pool?.end() ?? Promise.resolve()).finally(() => clearTimeout(deadline));
    });
  });
}
