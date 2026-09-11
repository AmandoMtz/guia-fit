const test = require("node:test"),
  assert = require("node:assert/strict");
const { IDBFactory } = require("fake-indexeddb");
const { createStore } = require("../web/dist/js/schedule-store.js");
test("horario local: descarta archivos y persiste clases tras reabrir, aísla cuentas y borra solo el horario propio", async () => {
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
  assert.equal(restored.pdf, undefined);
  assert.equal(restored.classes[0].subject, "Cálculo");
  assert.equal(restored.version, 2);
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

test("migración local elimina archivos antiguos de todas las cuentas y conserva las clases", async () => {
  const factory = new IDBFactory();
  await new Promise((resolve, reject) => {
    const r = factory.open("fit-schedules-v2", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("schedules", { keyPath: "userId" });
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const tx = r.result.transaction("schedules", "readwrite");
      for (const userId of ["a", "b"])
        tx.objectStore("schedules").put({
          userId,
          career: "Civil",
          studentId: "123",
          pdf: new Blob(["original"]),
          pdfName: "horario.pdf",
          text: "Texto original",
          classes: [{ id: "c", subject: "Física", group: "2A" }],
        });
      tx.oncomplete = () => {
        r.result.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
  const store = createStore(factory);
  for (const userId of ["a", "b"]) {
    const saved = await store.operation("get", userId);
    assert.equal(saved.classes[0].group, "2A");
    for (const key of ["pdf", "pdfName", "text", "pdfBase64", "sourceMime"])
      assert.equal(key in saved, false);
  }
  await store.close();
});
