const { createPool } = require("./db.cjs");
(async () => {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email)
    throw new Error(
      "Indica el correo de una cuenta confirmada: npm run admin -- correo",
    );
  const pool = createPool();
  if (!pool) throw new Error("Configura DATABASE_URL.");
  try {
    const result = await pool.query(
      "update users set role='admin' where email=$1 and email_confirmed_at is not null returning id",
      [email],
    );
    if (!result.rowCount)
      throw new Error("No existe una cuenta confirmada con ese correo.");
    console.log("Permisos de administrador asignados.");
  } finally {
    await pool.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
