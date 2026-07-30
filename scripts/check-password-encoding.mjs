import dotenv from "dotenv";
dotenv.config({ override: true });

const u = new URL(process.env.DATABASE_URL);
const pw = decodeURIComponent(u.password);
console.log("password_len", pw.length);
console.log("has_unencoded_special_in_url", /[@#/?% ]/.test(u.password) && !u.password.includes("%"));
console.log("decoded_has_at", pw.includes("@"));
console.log("decoded_has_hash", pw.includes("#"));
console.log("decoded_has_slash", pw.includes("/"));
console.log("decoded_has_colon", pw.includes(":"));
console.log("url_password_equals_encoded", u.password === encodeURIComponent(pw));
