/* Un registro por cuenta. Solo datos estructurados; nunca archivos ni texto OCR. */
(function (root) {
  function clean(value) {
    const keys = ["userId", "career", "studentId", "studentName", "reviewedAt", "accountType"];
    const classKeys = [
      "id",
      "subject",
      "teacher",
      "classroom",
      "group",
      "day",
      "start",
      "end",
      "place_id",
    ];
    return {
      version: 2,
      ...Object.fromEntries(keys.map((k) => [k, value[k]])),
      classes: (value.classes || []).map((c) =>
        Object.fromEntries(classKeys.map((k) => [k, c[k]])),
      ),
    };
  }
  function createStore(factory) {
    let connection;
    async function database() {
      if (!factory)
        throw Error(
          "Este navegador no admite almacenamiento local de horarios.",
        );
      if (connection) return connection;
      connection = new Promise((resolve, reject) => {
        const req = factory.open("fit-schedules-v2", 2);
        req.onupgradeneeded = () => {
          const records = req.result.objectStoreNames.contains("schedules")
            ? req.transaction.objectStore("schedules")
            : req.result.createObjectStore("schedules", { keyPath: "userId" });
          const cursor = records.openCursor();
          cursor.onsuccess = () => {
            const row = cursor.result;
            if (row) {
              row.update(clean(row.value));
              row.continue();
            }
          };
        };
        req.onsuccess = () => {
          const db = req.result;
          db.onversionchange = () => {
            db.close();
            connection = null;
          };
          resolve(db);
        };
        req.onerror = () => {
          connection = null;
          reject(
            Error(
              "No se pudo abrir el almacenamiento local. Revisa los permisos del navegador.",
            ),
          );
        };
        req.onblocked = () => {
          connection = null;
          reject(
            Error("Cierra otras pestañas de Guía FIT e intenta de nuevo."),
          );
        };
      });
      return connection;
    }
    async function operation(method, key, value) {
      if (typeof key !== "string" || !key)
        throw Error("Inicia sesión con tu cuenta para usar el horario.");
      if (method === "put" && value?.userId !== key)
        throw Error("El horario pertenece a otra cuenta.");
      const db = await database();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(
            "schedules",
            method === "get" ? "readonly" : "readwrite",
          ),
          store = tx.objectStore("schedules");
        const req =
          method === "get"
            ? store.get(key)
            : method === "put"
              ? store.put(clean(value))
              : store.delete(key);
        let result;
        req.onsuccess = () => {
          result = req.result;
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = tx.onabort = () =>
          reject(
            Error(
              "No se pudo guardar el horario. Revisa el espacio y los permisos de almacenamiento. El horario anterior se conserva.",
            ),
          );
      });
    }
    return {
      operation,
      close: async () => {
        if (connection) {
          (await connection).close();
          connection = null;
        }
      },
    };
  }
  if (typeof module === "object" && module.exports)
    module.exports = { createStore };
  else root.FIT_SCHEDULE_STORE = createStore(root.indexedDB);
})(typeof window !== "undefined" ? window : globalThis);
