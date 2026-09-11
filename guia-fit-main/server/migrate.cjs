const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createPool } = require("./db.cjs");
async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(746201)");
    await client.query(
      "create table if not exists schema_migrations(name text primary key,checksum text not null,applied_at timestamptz default now())",
    );
    const folder = path.join(__dirname, "../backend/migrations");
    for (const name of fs
      .readdirSync(folder)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const sql = fs.readFileSync(path.join(folder, name), "utf8"),
        checksum = createHash("sha256").update(sql).digest("hex");
      const prior = await client.query(
        "select checksum from schema_migrations where name=$1",
        [name],
      );
      if (prior.rows.length) {
        if (prior.rows[0].checksum !== checksum)
          throw new Error(
            "Una migración aplicada fue modificada. Crea otra migración.",
          );
        continue;
      }
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into schema_migrations(name,checksum) values($1,$2)",
          [name, checksum],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
    await client.query(
      fs.readFileSync(
        path.join(__dirname, "../backend/02_catalog.sql"),
        "utf8",
      ),
    );
  } finally {
    await client.query("select pg_advisory_unlock(746201)");
    client.release();
  }
}
if (require.main === module)
  (async () => {
    const pool = createPool();
    if (!pool) throw new Error("Configura DATABASE_URL.");
    try {
      await migrate(pool);
      console.log("Migraciones y catálogo listos.");
    } finally {
      await pool.end();
    }
  })().catch(() => {
    console.error(
      "No se pudo preparar la base. Revisa conexión, certificado y migraciones.",
    );
    process.exitCode = 1;
  });
module.exports = { migrate };
