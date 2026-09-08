const { Pool, types } = require("pg");
types.setTypeParser(1082, (value) => value);
const fs = require("node:fs");
function createPool(env = process.env) {
  if (!env.DATABASE_URL) return null;
  const url = new URL(env.DATABASE_URL);
  // Se pasan las opciones TLS explícitamente para que sslmode en la URI no sustituya la validación del certificado.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(key);
  const local =
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
    env.NODE_ENV !== "production";
  let ca = env.AIVEN_CA_CERT?.replace(/\\n/g, "\n");
  if (env.AIVEN_CA_PATH) ca = fs.readFileSync(env.AIVEN_CA_PATH, "utf8");
  if (!local && !ca)
    throw new Error(
      "Configura AIVEN_CA_CERT o AIVEN_CA_PATH para validar la conexión TLS.",
    );
  return new Pool({
    connectionString: url.href,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    ssl: local ? false : { rejectUnauthorized: true, ca },
  });
}
async function transaction(db, fn) {
  const client = await db.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
module.exports = { createPool, transaction };
