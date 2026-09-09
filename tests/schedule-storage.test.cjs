const test = require("node:test"),
  assert = require("node:assert/strict");
const { IDBFactory } = require("fake-indexeddb");
const { createStore } = require("../web/dist/js/schedule-store.js");
test("horario local: persiste PDF tras reabrir, aísla cuentas y borra solo el horario propio", async () => {
  const factory = new IDBFactory();
  let store = createStore(factory);
  const a = {
      userId: "alumno-a",
      studentId: "12345",
      career: "Ingeniería Civil",
      classes: [{ subject: "Cálculo" }],
      pdf: new Blob(["%PDF-1.4 contenido de prueba"], {
        type: "application/pdf",
      }),
    },
    b = { ...a, userId: "alumno-b", studentId: "67890" };
  await store.operation("put", a.userId, a);
  await store.operation("put", b.userId, b);
  await store.close();
  store = createStore(factory);
  const restored = await store.operation("get", "alumno-a");
  assert.equal(restored.career, a.career);
  assert.equal(await restored.pdf.text(), "%PDF-1.4 contenido de prueba");
  assert.equal((await store.operation("get", "alumno-b")).studentId, "67890");
  assert.equal(await store.operation("get", "desconocido"), undefined);
  await assert.rejects(store.operation("put", "alumno-a", b), /otra cuenta/);
  assert.equal((await store.operation("get", "alumno-a")).studentId, "12345");
  await store.operation("put", "alumno-a", { ...a, career: "Carrera editada" });
  await store.operation("delete", "alumno-a");
  assert.equal(await store.operation("get", "alumno-a"), undefined);
  assert.equal((await store.operation("get", "alumno-b")).studentId, "67890");
  await store.close();
});
test("una escritura inválida conserva la versión local anterior", async () => {
  const store = createStore(new IDBFactory());
  await store.operation("put", "a", { userId: "a", career: "Anterior" });
  await assert.rejects(
    store.operation("put", "a", { userId: "a", career: () => {} }),
  );
  assert.equal((await store.operation("get", "a")).career, "Anterior");
  await store.close();
});
