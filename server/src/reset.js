import { migrate, pool, query } from "./db.js";

await migrate();

await query("DELETE FROM apartments");
await query("DELETE FROM preference_profiles");
await query("DELETE FROM user_preferences");
await query(
  `INSERT INTO user_settings (id, match_alerts)
   VALUES ('default', false)
   ON CONFLICT (id) DO UPDATE SET match_alerts = false, updated_at = now()`,
);

console.log("Database cleared.");
await pool.end();
