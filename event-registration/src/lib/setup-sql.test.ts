import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// db/supabase-setup.sql is what non-technical organizers paste into Supabase.
// It must contain every migration, unchanged, and mark each one as applied.
describe("db/supabase-setup.sql", () => {
  const root = path.resolve(__dirname, "../..");
  const setup = fs.readFileSync(path.join(root, "db/supabase-setup.sql"), "utf8");
  const migrations = fs.readdirSync(path.join(root, "db/migrations")).filter((f) => f.endsWith(".sql")).sort();

  it.each(migrations)("contains %s verbatim and records it", (file) => {
    const body = fs.readFileSync(path.join(root, "db/migrations", file), "utf8");
    expect(setup).toContain(body);
    expect(setup).toContain(`insert into schema_migrations (name) values ('${file}') on conflict do nothing;`);
  });
});
