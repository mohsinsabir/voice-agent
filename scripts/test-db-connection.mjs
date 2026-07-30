import dotenv from "dotenv";
dotenv.config({ override: true });
import pg from "pg";

const url = process.env.DATABASE_URL || "";
if (!url) {
  console.log("NO_DATABASE_URL");
  process.exit(1);
}

const u = new URL(url);
console.log("host", u.hostname);
console.log("user", u.username);
console.log("port", u.port || "5432");
console.log("is_pooler", u.hostname.includes("pooler.supabase.com"));
console.log("is_direct", u.hostname.startsWith("db.") && u.hostname.includes("supabase.co"));

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

try {
  await client.connect();
  const result = await client.query(
    "select current_database() as db, (select name from businesses limit 1) as biz",
  );
  console.log("DB_OK", result.rows[0].db, result.rows[0].biz);
  await client.end();
} catch (err) {
  console.log("DB_FAIL", err.code || "", String(err.message || err).split("\n")[0]);
  process.exit(1);
}
