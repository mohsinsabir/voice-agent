require("dotenv/config");

module.exports = {
  databaseUrl: process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL,
  dir: "migrations",
  migrationsTable: "pgmigrations",
  verbose: true,
};
