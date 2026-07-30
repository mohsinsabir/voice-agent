import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ override: true });

const lines = fs.readFileSync(".env", "utf8").split(/\r?\n/);
for (const [i, line] of lines.entries()) {
  if (!line.startsWith("DATABASE")) continue;
  const eq = line.indexOf("=");
  const key = line.slice(0, eq);
  let val = line.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  console.log("line", i + 1, key);
  console.log("  len", val.length);
  console.log("  prefix", val.slice(0, 45));
  console.log("  suffix", val.slice(-35));
  console.log("  has_pooler", val.includes("pooler"));
  console.log("  has_direct_host", val.includes("db.xffzulhvfqcigbmbnhcv.supabase.co"));
  try {
    const u = new URL(val);
    console.log("  parsed_host", u.hostname || "(empty)");
    console.log("  parsed_user", u.username || "(empty)");
    console.log("  parsed_port", u.port || "(default)");
  } catch (e) {
    console.log("  parse_err", e.message);
  }
}

const envUrl = process.env.DATABASE_URL || "";
console.log("dotenv_len", envUrl.length);
console.log("dotenv_prefix", envUrl.slice(0, 45));
try {
  const u = new URL(envUrl);
  console.log("dotenv_host", JSON.stringify(u.hostname));
  console.log("dotenv_user", JSON.stringify(u.username));
} catch (e) {
  console.log("dotenv_parse_err", e.message);
}
