import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});

export default sql;
