const test = require("node:test");
const assert = require("node:assert/strict");
const { createStore, MAX_SESSION_AGE } = require("../web/dist/js/offline.js");

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("offline: solo conserva una sesión de alumno y nunca permisos administrativos", () => {
  const storage = memoryStorage();
  const store = createStore(storage, () => Date.parse("2026-09-11T12:00:00Z"));
  assert.equal(
    store.saveSession({
      user: { id: "u1", email: "a123@alumnos.uat.edu.mx", account_type: "student", role: "admin", secret: "x" },
      profile: { full_name: "Alumno Uno", career: "ISC", student_id: "123", photo_updated_at: "private" },
      verification: { status: "verified" },
    }),
    true,
  );
  const saved = store.getSession();
  assert.equal(saved.user.id, "u1");
  assert.equal(saved.user.account_type, "student");
  assert.equal(saved.user.role, undefined);
  assert.equal(saved.user.secret, undefined);
  assert.equal(saved.profile.photo_updated_at, undefined);

  assert.equal(
    store.saveSession({ user: { id: "admin", email: "admin@uat.edu.mx", account_type: "admin" } }),
    false,
  );
});

test("offline: el acceso local al horario permanece después de varias semanas", () => {
  const storage = memoryStorage();
  let now = Date.parse("2026-09-11T12:00:00Z");
  const store = createStore(storage, () => now);
  store.saveSession({ user: { id: "u1", email: "a123@alumnos.uat.edu.mx", account_type: "student" } });
  now += 60 * 24 * 60 * 60 * 1000;
  assert.equal(store.getSession().user.id, "u1");
});

test("offline: los eventos se aíslan por alumno y el QR nunca se considera activo", () => {
  const storage = memoryStorage();
  const store = createStore(storage, () => Date.parse("2026-09-11T12:00:00Z"));
  store.saveEvents("u1", [
    {
      id: "e1",
      title: "Evento FIT",
      audience: "students",
      visibility: "closed",
      careers: ["ISC"],
      checkin_open: true,
      can_manage: true,
      attended: true,
      token: "NO-GUARDAR",
      qr: "NO-GUARDAR",
    },
  ]);
  const saved = store.getEvents("u1");
  assert.equal(saved.events.length, 1);
  assert.equal(saved.events[0].checkin_open, false);
  assert.equal(saved.events[0].can_manage, false);
  assert.equal(saved.events[0].attended, true);
  assert.equal(saved.events[0].token, undefined);
  assert.equal(saved.events[0].qr, undefined);
  assert.equal(store.getEvents("u2"), null);
});

test("offline: conserva una copia de respaldo del horario por alumno", () => {
  const storage = memoryStorage();
  const store = createStore(storage, () => Date.parse("2026-09-11T12:00:00Z"));
  assert.equal(
    store.saveSchedule("u1", {
      userId: "u1",
      accountType: "student",
      career: "Ingeniería en Sistemas",
      studentId: "12345",
      studentName: "Alumno Uno",
      reviewedAt: "2026-09-11T11:00:00Z",
      classes: [
        { id: "c1", subject: "Cálculo", teacher: "Docente", classroom: "A-101", group: "2A", day: 1, start: "08:00", end: "09:00" },
      ],
    }),
    true,
  );
  const saved = store.getSchedule("u1");
  assert.equal(saved.schedule.classes.length, 1);
  assert.equal(saved.schedule.classes[0].subject, "Cálculo");
  assert.equal(store.getSchedule("u2"), null);
});
