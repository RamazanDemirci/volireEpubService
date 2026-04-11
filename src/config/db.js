import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString, {
  ssl: "require", // Supabase güvenli bağlantı için şarttır
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});

export default sql;
