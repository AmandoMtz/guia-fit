/* Modo sin conexión para alumnos. No guarda contraseñas, cookies ni tokens. */
(function (root) {
  "use strict";
  const SESSION_KEY = "fit-offline-session-v1";
  const EVENTS_PREFIX = "fit-offline-events-v1:";
  const SCHEDULE_PREFIX = "fit-offline-schedule-v1:";
  const MAX_SESSION_AGE = Infinity; // Acceso local de consulta; nunca autoriza operaciones en servidor.

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const text = (value, max = 240) => String(value ?? "").slice(0, max);

  function safeParse(raw) {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function cleanUser(user) {
    if (!user || user.account_type !== "student" || !user.id) return null;
    return {
      id: text(user.id, 80),
      email: text(user.email, 254),
      account_type: "student",
      email_confirmed_at: user.email_confirmed_at || null,
      food_seller_intent: !!user.food_seller_intent,
    };
  }

  function cleanProfile(profile) {
    if (!profile) return null;
    return {
      full_name: text(profile.full_name, 160),
      student_id: text(profile.student_id, 40),
      career: text(profile.career, 180),
      food_seller_intent: !!profile.food_seller_intent,
    };
  }

  function cleanVerification(verification) {
    if (!verification) return null;
    return {
      status: text(verification.status, 40),
      verified_at: verification.verified_at || null,
    };
  }

  function cleanEvent(event) {
    if (!event?.id) return null;
    return {
      id: text(event.id, 100),
      title: text(event.title, 220),
      description: text(event.description, 1200),
      starts_at: event.starts_at || null,
      ends_at: event.ends_at || null,
      location: text(event.location, 220),
      audience: event.audience === "students" ? "students" : text(event.audience, 30),
      visibility: event.visibility === "closed" ? "closed" : "public",
      careers: Array.isArray(event.careers)
        ? event.careers.slice(0, 30).map((x) => text(x, 180))
        : [],
      creator_name: text(event.creator_name || "Guía FIT", 160),
      attended: !!event.attended,
      // Un estado de QR nunca debe reutilizarse sin confirmar con el servidor.
      checkin_open: false,
      can_manage: false,
      attendance_count: 0,
      invitees: [],
    };
  }


  function cleanSchedule(value) {
    if (!value?.userId || !Array.isArray(value.classes)) return null;
    const keys = ["userId", "career", "studentId", "studentName", "reviewedAt", "accountType"];
    const classKeys = [
      "id", "subject", "teacher", "classroom", "group", "day", "start", "end", "place_id",
    ];
    return {
      version: 1,
      ...Object.fromEntries(keys.map((k) => [k, value[k] ?? null])),
      classes: value.classes.map((row) =>
        Object.fromEntries(classKeys.map((k) => [k, row?.[k] ?? null])),
      ),
    };
  }

  function createStore(storage, now = () => Date.now()) {
    function saveSession({ user, profile, verification } = {}) {
      const clean = cleanUser(user);
      if (!storage || !clean) return false;
      const record = {
        version: 1,
        user: clean,
        profile: cleanProfile(profile),
        verification: cleanVerification(verification),
        syncedAt: new Date(now()).toISOString(),
      };
      try {
        storage.setItem(SESSION_KEY, JSON.stringify(record));
        return true;
      } catch {
        return false;
      }
    }

    function getSession() {
      if (!storage) return null;
      let record;
      try {
        record = safeParse(storage.getItem(SESSION_KEY));
      } catch {
        return null;
      }
      const synced = Date.parse(record?.syncedAt || "");
      if (
        !record?.user ||
        record.user.account_type !== "student" ||
        !Number.isFinite(synced) ||
        now() - synced > MAX_SESSION_AGE
      ) {
        clearSession();
        return null;
      }
      return clone(record);
    }

    function clearSession() {
      try {
        storage?.removeItem(SESSION_KEY);
      } catch {}
    }

    function saveEvents(userId, events) {
      if (!storage || !userId || !Array.isArray(events)) return false;
      const cleaned = events.map(cleanEvent).filter(Boolean);
      const record = {
        version: 1,
        userId: String(userId),
        syncedAt: new Date(now()).toISOString(),
        events: cleaned,
      };
      try {
        storage.setItem(EVENTS_PREFIX + userId, JSON.stringify(record));
        return true;
      } catch {
        return false;
      }
    }

    function getEvents(userId) {
      if (!storage || !userId) return null;
      try {
        const record = safeParse(storage.getItem(EVENTS_PREFIX + userId));
        if (!record || record.userId !== String(userId) || !Array.isArray(record.events))
          return null;
        return clone(record);
      } catch {
        return null;
      }
    }

    function saveSchedule(userId, schedule) {
      if (!storage || !userId) return false;
      const cleaned = cleanSchedule(schedule);
      if (!cleaned || String(cleaned.userId) !== String(userId)) return false;
      const record = {
        version: 1,
        userId: String(userId),
        syncedAt: new Date(now()).toISOString(),
        schedule: cleaned,
      };
      try {
        storage.setItem(SCHEDULE_PREFIX + userId, JSON.stringify(record));
        return true;
      } catch {
        return false;
      }
    }

    function getSchedule(userId) {
      if (!storage || !userId) return null;
      try {
        const record = safeParse(storage.getItem(SCHEDULE_PREFIX + userId));
        if (!record || record.userId !== String(userId) || !record.schedule) return null;
        return clone(record);
      } catch {
        return null;
      }
    }

    function clearSchedule(userId) {
      try {
        if (userId) storage?.removeItem(SCHEDULE_PREFIX + userId);
      } catch {}
    }

    function clearUser(userId) {
      clearSession();
      try {
        if (userId) {
          storage?.removeItem(EVENTS_PREFIX + userId);
          storage?.removeItem(SCHEDULE_PREFIX + userId);
        }
      } catch {}
    }

    return {
      saveSession,
      getSession,
      clearSession,
      saveEvents,
      getEvents,
      saveSchedule,
      getSchedule,
      clearSchedule,
      clearUser,
      MAX_SESSION_AGE,
    };
  }

  if (typeof module === "object" && module.exports)
    module.exports = { createStore, MAX_SESSION_AGE };
  else root.FIT_OFFLINE = createStore(root.localStorage);
})(typeof window !== "undefined" ? window : globalThis);
