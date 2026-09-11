/* Guía FIT. La autorización se aplica en la API de Render. Los datos persisten en Aiven. */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const C = window.FIT_CORE,
    seed = window.FIT_CATALOG,
    config = window.FIT_CONFIG;
  const paths = {
    bag: "M5 7h14l1 14H4L5 7zm4 0V5a3 3 0 016 0v2",
    store: "M3 10h18L19 3H5l-2 7zm1 0v11h16V10M8 21v-7h8v7",
    refresh: "M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0114 6M18 18A8 8 0 014 12",
    plus: "M12 4v16M4 12h16",
    food: "M4 3v7m3-7v7m3-7v7M4 7h6m-3 3v11M17 3c-3 4-3 9 1 9h2V3h-3zm3 9v9",
    calendar: "M4 5h16v16H4z M4 10h16M8 3v4m8-4v4M8 14h2m4 0h2m-8 3h2",
    bell: "M5 16h14l-2-3V8a5 5 0 00-10 0v5l-2 3zm5 4h4",
    chat: "M4 5h16v11H9l-5 4V5zm4 4h8M8 12h5",
    send: "M3 11l18-8-7 18-3-7-8-3zm8 3L21 3",
    map: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zm6-3v15m6-12v15",
    pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1116 0z M15 10a3 3 0 11-6 0 3 3 0 016 0",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    search: "M21 21l-5-5m2-6a8 8 0 11-16 0 8 8 0 0116 0",
    user: "M20 21v-2a7 7 0 00-14 0v2 M16 7a4 4 0 11-8 0 4 4 0 018 0",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    route:
      "M5 4v10a5 5 0 005 5h4a5 5 0 000-10h-1m-3-3 3 3-3 3 M8 4a3 3 0 11-6 0 3 3 0 016 0",
    lock: "M5 10h14v11H5z M8 10V6a4 4 0 018 0v4",
    eye: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z M15 12a3 3 0 11-6 0 3 3 0 016 0",
    photo: "M3 5h18v15H3z M3 17l6-6 5 5 3-3 4 4 M16 9h.01",
    close: "M6 6l12 12M18 6 6 18",
    check: "M4 12l5 5L20 6",
    exit: "M9 4H4v16h5 M10 12h11m-5-5 5 5-5 5",
    edit: "M14 4l6 6M3 21l5-1L21 7l-5-5L3 15v6",
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.pin}"/></svg>`;
  const brand = () =>
    '<div class="brand"><span class="logo-crop"><img src="assets/logos.png" alt="Universidad Autónoma de Tamaulipas"></span><span class="divider"></span><span class="logo-crop logo-fit"><img src="assets/logos.png" alt="70 aniversario Facultad de Ingeniería Tampico, 1956–2026"></span></div>';
  let client = null;
  const state = {
    mode: "login",
    user: null,
    demo: false,
    view: "directory",
    places: seed.places,
    edges: [],
    profile: null,
    verification: null,
    admin: false,
    query: "",
    category: "",
    building: "",
    notice: "",
    authError: false,
    busy: false,
    route: null,
    routeIndex: 0,
    routeDemo: false,
    origin: "",
    destination: "",
    accessible: false,
    arrived: false,
    dataError: "",
    pendingEventToken: new URLSearchParams(location.search).get("e"),
  };
  let toastTimer;
  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
  }
  const transientMessageTimers = new WeakMap();
  function armTransientMessage(el) {
    if (!el?.isConnected || !state.user || state.demo || !el.textContent.trim()) return;
    const prior = transientMessageTimers.get(el);
    if (prior) clearTimeout(prior);
    const timer = setTimeout(() => {
      if (!el.isConnected) return;
      if (el.matches(".field-error[role=alert]")) el.textContent = "";
      else el.remove();
      transientMessageTimers.delete(el);
    }, 3000);
    transientMessageTimers.set(el, timer);
  }
  function scanTransientMessages(root = document) {
    if (!state.user || state.demo) return;
    const selector = ".notice.error,.notice.success,.field-error[role=alert]";
    if (root.nodeType === 1 && root.matches?.(selector)) armTransientMessage(root);
    root.querySelectorAll?.(selector).forEach(armTransientMessage);
  }
  const transientMessageObserver = new MutationObserver((mutations) => {
    if (!state.user || state.demo) return;
    for (const mutation of mutations) {
      const target = mutation.type === "characterData" ? mutation.target.parentElement : mutation.target;
      if (target) scanTransientMessages(target);
      for (const node of mutation.addedNodes || []) if (node.nodeType === 1) scanTransientMessages(node);
    }
  });
  transientMessageObserver.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  function field(name, label, type = "text", auto = "", hint = "") {
    return `<div class="field"><label for="${name}">${label}</label>${type === "password" ? '<div class="password-wrap">' : ""}<input id="${name}" name="${name}" type="${type}" autocomplete="${auto}" ${name === "email" ? 'inputmode="email" maxlength="254"' : name === "full_name" ? 'maxlength="100"' : type === "password" ? 'maxlength="128"' : ""} aria-describedby="${name}-error${hint ? " " + name + "-hint" : ""}">${type === "password" ? `<button class="eye-button" type="button" data-eye="${name}" aria-label="Mostrar contraseña">${icon("eye")}</button></div>` : ""}<span class="field-error" id="${name}-error"></span>${hint ? `<p class="hint" id="${name}-hint">${hint}</p>` : ""}</div>`;
  }
  const badge = (verified) =>
    `<span class="badge ${verified ? "good" : "pending"}">${verified ? "Verificado" : "Por verificar"}</span>`;
  const photo = (place) =>
    C.photoUrl(place.photo_url)
      ? `<img src="${esc(C.photoUrl(place.photo_url))}" alt="Entrada de ${esc(place.name)}" loading="lazy" referrerpolicy="no-referrer">`
      : `${icon("photo")}<small>Fotografía pendiente</small>`;
  const options = (items, selected, empty = "Selecciona un espacio") =>
    `<option value="">${empty}</option>` +
    items
      .map(
        (p) =>
          `<option value="${esc(p.id)}" ${p.id === selected ? "selected" : ""}>${esc(p.name)}</option>`,
      )
      .join("");
  function render() {
    if (state.user || state.demo) shell();
    else authView();
  }
  function authView() {
    const mode = state.mode;
    const titles = {
      login: [
        "Bienvenido a Guía FIT",
        "Inicia sesión y encuentra tu próximo destino.",
      ],
      register: ["Crea tu cuenta", "Regístrate para comenzar a explorar."],
      recover: [
        "Recupera tu acceso",
        "Te enviaremos un enlace para cambiar tu contraseña.",
      ],
      reset: [
        "Nueva contraseña",
        "Elige una contraseña de al menos 8 caracteres, con letra, número y carácter especial.",
      ],
      verify: [
        "Revisa tu correo",
        "Confirma tu dirección con el enlace que recibiste.",
      ],
    };
    const [title, sub] = titles[mode];
    $("#app").innerHTML =
      `<header class="topbar">${brand()}<span class="top-label">GUÍA DEL CAMPUS</span></header><div class="auth-layout"><aside class="auth-aside"><div class="eyebrow">${icon("pin")} FACULTAD DE INGENIERÍA TAMPICO</div><h1>Tu campus.<br>Tu camino.<br><span class="accent">A un paso.</span></h1><p class="intro">Encuentra tu salón, organiza tus clases y descubre qué comer en la facultad.</p><div class="campus-teaser"><img src="assets/croquis.png" alt="Croquis de la Facultad de Ingeniería Tampico proporcionado como referencia"><span class="teaser-label">Explora los espacios de la FIT</span></div><div class="aside-bottom">Universidad Autónoma de Tamaulipas · Tampico</div></aside><main class="auth-main" id="main"><div class="auth-card"><div class="icon-circle">${icon(mode === "login" ? "lock" : "user")}</div><h2>${title}</h2><p class="muted">${sub}</p>${["login", "register"].includes(mode) ? `<div class="auth-tabs" aria-label="Opciones de acceso"><button class="${mode === "login" ? "active" : ""}" data-mode="login">Iniciar sesión</button><button class="${mode === "register" ? "active" : ""}" data-mode="register">Crear cuenta</button></div>` : ""}${!client ? '<div class="notice">El registro todavía no está habilitado. Puedes explorar la demostración.</div>' : ""}<div id="form-message" role="alert">${state.notice ? `<div class="notice ${state.authError ? "error" : "success"}">${esc(state.notice)}</div>` : ""}</div><form id="auth-form" novalidate>${mode === "register" ? field("full_name", "Nombre completo", "text", "name") : ""}${mode !== "reset" ? field("email", "Correo electrónico", "email", "email") : ""}${["login", "register", "reset"].includes(mode) ? field("password", mode === "reset" ? "Nueva contraseña" : "Contraseña", "password", mode === "login" ? "current-password" : "new-password", mode !== "login" ? "Usa 8 caracteres, con letra, número y carácter especial." : "") : ""}${["register", "reset"].includes(mode) ? field("confirm", "Confirmar contraseña", "password", "new-password") : ""}${mode === "register" ? '<label class="seller-option"><input type="checkbox" name="seller"><span><strong>Quiero vender comida</strong><small>Después podrás solicitar tu puesto en la facultad.</small></span></label>' : ""}${mode === "login" ? '<div class="auth-links"><button class="text-button" type="button" data-mode="recover">Olvidé mi contraseña</button></div>' : ""}<button class="btn full" type="submit">${{ login: "Iniciar sesión", register: "Crear cuenta", recover: "Enviar enlace", reset: "Guardar contraseña", verify: "Reenviar verificación" }[mode]} ${icon("arrow")}</button></form>${mode === "login" ? '<button class="text-button" data-mode="verify">Reenviar correo de verificación</button>' : ""}${!["login", "register"].includes(mode) ? '<button class="text-button" data-mode="login">Volver al inicio de sesión</button>' : ""}<div class="or">Explora el proyecto</div><button class="btn secondary full" id="demo-button">${icon("map")} Explorar demostración</button><p class="auth-foot">La verificación del correo y la validación institucional se realizan por separado.</p></div></main></div>`;
    $('[data-mode="' + mode + '"]')?.setAttribute("aria-current", "page");
    document.querySelectorAll("[data-mode]").forEach(
      (b) =>
        (b.onclick = () => {
          if (state.busy) return;
          state.mode = b.dataset.mode;
          state.notice = "";
          state.authError = false;
          render();
        }),
    );
    document.querySelectorAll("[data-eye]").forEach(
      (b) =>
        (b.onclick = () => {
          const input = $("#" + b.dataset.eye);
          input.type = input.type === "password" ? "text" : "password";
          b.setAttribute(
            "aria-label",
            input.type === "password"
              ? "Mostrar contraseña"
              : "Ocultar contraseña",
          );
        }),
    );
    $("#demo-button").onclick = () => {
      if (state.busy) return;
      state.demo = true;
      state.user = null;
      state.admin = false;
      state.view = "directory";
      state.places = seed.places;
      state.edges = [];
      state.dataError = "";
      render();
    };
    if (mode === "reset" && client?.recoveryToken) {
      const link = document.createElement("a");
      link.className = "text-button";
      link.textContent = "Abrir en la aplicación Flutter";
      link.href =
        "guiafit://auth-callback/?flow=recovery#token=" +
        encodeURIComponent(client.recoveryToken);
      $("#auth-form").after(link);
    }
    $("#auth-form").onsubmit = submitAuth;
  }
  function showMessage(message, error = false) {
    state.notice = message;
    state.authError = error;
    if (!$("#form-message")) {
      toast(message);
      return;
    }
    $("#form-message").innerHTML =
      `<div class="notice ${error ? "error" : "success"}">${esc(message)}</div>`;
  }
  const redirect = () => location.origin + location.pathname;
  async function submitAuth(event) {
    event.preventDefault();
    if (state.busy) return;
    const mode = state.mode;
    const form = event.currentTarget,
      values = Object.fromEntries(new FormData(form)),
      errors = C.validate(values, mode);
    for (const input of form.querySelectorAll("input")) {
      const msg = errors[input.name] || "";
      const errorEl = $("#" + input.name + "-error");
      if (errorEl) errorEl.textContent = msg;
      input.setAttribute("aria-invalid", String(!!msg));
    }
    if (Object.keys(errors).length) {
      $("#" + Object.keys(errors)[0]).focus();
      return;
    }
    if (!client) {
      showMessage(
        "El acceso aún no está habilitado. Por ahora puedes explorar la demostración.",
        true,
      );
      return;
    }
    state.busy = true;
    const button = $("button[type=submit]", form);
    button.disabled = true;
    const old = button.innerHTML;
    button.textContent = "Procesando…";
    try {
      const email = (values.email || "").trim();
      let result;
      if (mode === "login") {
        result = await client.auth.signInWithPassword({
          email,
          password: values.password,
        });
        if (result.error) throw result.error;
        await openSession();
        return;
      }
      if (mode === "register") {
        result = await client.auth.signUp({
          email,
          password: values.password,
          options: {
            data: {
              full_name: values.full_name.trim(),
              account_type: values.seller ? "seller" : "buyer",
            },
            emailRedirectTo: redirect("confirm"),
          },
        });
        if (result.error) throw result.error;
        state.mode = "verify";
        state.notice =
          "Si el correo puede registrarse, recibirás un enlace de confirmación. Revisa también la carpeta de correo no deseado.";
        state.authError = false;
        render();
        $("#email").value = email;
        return;
      }
      if (mode === "recover")
        result = await client.auth.resetPasswordForEmail(email, {
          redirectTo: redirect("recovery"),
        });
      if (mode === "verify")
        result = await client.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: redirect("confirm") },
        });
      if (mode === "reset")
        result = await client.auth.updateUser({ password: values.password });
      if (result?.error) throw result.error;
      if (mode === "reset") {
        await client.auth.signOut();
        state.user = null;
        state.mode = "login";
        state.notice =
          "Contraseña actualizada. Inicia sesión con tu nueva contraseña.";
        history.replaceState(null, "", location.pathname);
        render();
      } else
        showMessage(
          "Si corresponde a una cuenta válida, recibirás un correo con los siguientes pasos.",
        );
    } catch (error) {
      showMessage(C.authMessage(error), true);
    } finally {
      state.busy = false;
      if (button.isConnected) {
        button.disabled = false;
        button.innerHTML = old;
      }
    }
  }
  async function openSession() {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw error || new Error("Sesión no disponible");
    state.user = data.user;
    state.demo = false;
    state.view = state.pendingEventToken ? "events" : "directory";
    state.admin = false;
    await loadData();
    render();
  }
  async function loadData() {
    if (!client || !state.user) return;
    const owner = state.user.id;
    const responses = await Promise.all([
      client.from("profiles").select("*").eq("id", state.user.id).single(),
      client
        .from("institutional_verifications")
        .select("status,verified_at")
        .eq("user_id", state.user.id)
        .maybeSingle(),
      client
        .from("app_roles")
        .select("role")
        .eq("user_id", state.user.id)
        .maybeSingle(),
      client.from("places").select("*").order("name"),
      client.from("route_edges").select("*"),
    ]);
    if (state.user?.id !== owner) return;
    state.profile = responses[0].data;
    if (state.user && state.profile)
      state.user.food_seller_intent = state.profile.food_seller_intent;
    state.verification = responses[1].data;
    state.admin = responses[2].data?.role === "admin";
    state.dataError = responses.some((r) => r.error)
      ? "No pudimos cargar toda la información. Revisa tu conexión o contacta al administrador."
      : "";
    state.places = responses[3].error ? [] : responses[3].data || [];
    state.edges = responses[4].error ? [] : responses[4].data || [];
  }
  function shell() {
    const names = {
      food: [
        "Comidas",
        "Elige qué comer, sigue tus compras o atiende a tus clientes.",
      ],
      schedule: ["Mi horario", "Tu semana, tus materias y tu próximo salón."],
      events: ["Eventos", "Actividades, reuniones y asistencias verificadas de la facultad."],
      notifications: ["Mis avisos", "Novedades de tus pedidos y de tu puesto."],
      "food-admin": [
        "Revisar vendedores",
        "Valida los puestos de la comunidad FIT.",
      ],
      directory: [
        "Directorio de espacios",
        "Busca tu salón y consulta cómo identificarlo.",
      ],
      map: [
        "Mapa del campus",
        "Ubica los espacios en el croquis de referencia.",
      ],
      route: ["Cómo llegar", "Elige tu punto de partida y tu destino."],
      profile: ["Mi cuenta", "Consulta tus datos y el estado de verificación."],
      admin: [
        "Administrar espacios",
        "Actualiza el directorio y los recorridos comprobados.",
      ],
    };
    const menu = [
      ["directory", "grid", "Directorio"],
      ["map", "map", "Mapa del campus"],
      ["route", "route", "Cómo llegar"],
      ["food", "food", "Comidas"],
      ...(state.user ? [["events", "calendar", state.user.account_type === "teacher" ? "Eventos docentes" : "Eventos"]] : []),
      ["schedule", "calendar", "Mi horario"],
      ["profile", "user", "Mi cuenta"],
    ];
    if (state.admin)
      menu.push(
        ["admin", "edit", "Administrar"],
        ["food-admin", "store", "Revisar vendedores"],
      );
    const current = names[state.view],
      initial = (state.profile?.full_name || state.user?.email || "D")
        .charAt(0)
        .toUpperCase();
    $("#app").innerHTML =
      `<div class="shell"><header class="topbar app-top">${brand()}<div class="top-actions"><span class="app-title">Guía FIT</span>${state.user ? `<button class="notification-bell" data-view="notifications" aria-label="Mis avisos">${icon("bell")}<span id="notification-count" hidden></span></button>` : ""}${profileAvatar(initial)}<button class="btn ghost small" id="logout">${icon("exit")}${state.demo ? "Salir de demo" : "Cerrar sesión"}</button></div></header><div class="workspace"><nav class="sidebar" aria-label="Navegación principal"><div class="eyebrow">EXPLORA LA FIT</div>${menu.map(([id, i, label]) => `<button class="nav-item ${state.view === id ? "active" : ""}" data-view="${id}" ${state.view === id ? 'aria-current="page"' : ""}>${icon(i)}${label}</button>`).join("")}<p class="sidebar-note">Facultad de Ingeniería Tampico<br>Universidad Autónoma de Tamaulipas</p></nav><main class="content" id="main"><div class="page-head"><div><span class="eyebrow muted">GUÍA DEL CAMPUS</span><h1>${current[0]}</h1><p>${current[1]}</p></div>${state.demo ? '<span class="badge pending">Modo demostración</span>' : badge(state.verification?.status === "verified")}</div>${state.demo ? '<div class="notice">Demostración: no has iniciado sesión. Los lugares proceden del croquis; sus recorridos todavía deben verificarse.</div>' : ""}${state.dataError ? `<div class="notice error" role="alert">${esc(state.dataError)} <button id="retry-data" class="text-button">Reintentar</button></div>` : ""}<div id="view"></div></main></div></div>`;
    document.querySelectorAll("[data-view]").forEach(
      (b) =>
        (b.onclick = () => {
          if (state.view === "food" && b.dataset.view !== "food")
            window.FIT_FOOD?.disconnect?.();
          state.view = b.dataset.view;
          render();
        }),
    );
    $("#logout").onclick = signOut;
    pollNotifications();
    if ($("#retry-data"))
      $("#retry-data").onclick = async () => {
        await loadData();
        render();
      };
    ({
      directory: directoryView,
      map: mapView,
      route: routeView,
      profile: profileView,
      admin: adminView,
      food: () => window.FIT_FOOD.render(moduleContext()),
      "food-admin": () => window.FIT_FOOD.render(moduleContext()),
      notifications: () => window.FIT_FOOD.render(moduleContext()),
      schedule: () => window.FIT_SCHEDULE.render(moduleContext()),
      events: () => window.FIT_EVENTS.render(moduleContext()),
    })[state.view]();
    document.querySelectorAll(".place-image img").forEach(
      (img) =>
        (img.onerror = () => {
          img.parentElement.innerHTML =
            icon("photo") + "<small>Fotografía no disponible</small>";
        }),
    );
  }
  function moduleContext() {
    return {
      state,
      client,
      $,
      esc,
      icon,
      toast,
      dialog,
      render,
      signOut,
      poll: pollNotifications,
      navigate: (view, placeId) => {
        state.view = view;
        if (placeId) {
          state.destination = placeId;
          state.route = null;
          state.routeDemo = false;
        }
        render();
      },
    };
  }
  let polling = false;
  async function pollNotifications() {
    if (polling || !state.user || state.demo || document.hidden || !client)
      return;
    polling = true;
    const userId = state.user.id;
    try {
      const result = await client.request("/api/food/notifications");
      if (state.user?.id !== userId) return;
      const persistent = Number(result.data?.unread_count || 0),
        temporary = Number(result.data?.chat_unread_count || 0),
        count = persistent + temporary;
      const el = $("#notification-count");
      if (el && result.data) {
        el.textContent = count > 99 ? "99+" : String(count);
        el.hidden = count === 0;
      }
      if (result.data)
        await window.FIT_FOOD?.updateNotifications(
          moduleContext(),
          result.data,
        );
    } catch {
      // The last known counts remain visible; the next poll or manual refresh retries.
    } finally {
      polling = false;
    }
  }
  setInterval(pollNotifications, 30000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) pollNotifications();
  });
  async function signOut() {
    try {
      window.FIT_FOOD?.disconnect?.();
      if (client && !state.demo) {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      }
      state.user = null;
      state.demo = false;
      state.admin = false;
      state.profile = null;
      state.verification = null;
      state.route = null;
      state.notice = "";
      state.mode = "login";
      for (const key of [
        "foodSummary",
        "foodTab",
        "foodFocusOrder",
        "foodVendor",
        "foodQuery",
        "salesFilter",
        "ordersFilter",
        "eventsTab",
        "eventCheckinBusy",
      ])
        delete state[key];
      render();
    } catch {
      toast(
        "No pudimos cerrar la sesión. Revisa tu conexión e inténtalo de nuevo.",
      );
    }
  }
  function directoryView() {
    const categories = [...new Set(state.places.map((p) => p.category))].sort(),
      buildings = [
        ...new Set(state.places.map((p) => p.building).filter(Boolean)),
      ].sort();
    $("#view").innerHTML =
      `<div class="tools"><div class="search">${icon("search")}<label class="screen-reader" for="search">Buscar salón o espacio</label><input class="control" id="search" placeholder="Buscar salón, sala o edificio…" value="${esc(state.query)}"></div><label class="screen-reader" for="category">Tipo de espacio</label><select class="control" id="category"><option value="">Todos los tipos</option>${categories.map((x) => `<option ${x === state.category ? "selected" : ""}>${esc(x)}</option>`).join("")}</select><label class="screen-reader" for="building">Edificio</label><select class="control" id="building"><option value="">Todos los edificios</option>${buildings.map((x) => `<option ${x === state.building ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div><p class="hint" id="count" aria-live="polite"></p><div class="catalog-grid" id="cards" style="margin-top:16px"></div>`;
    const draw = () => {
      const places = C.filterPlaces(
        state.places,
        state.query,
        state.category,
        state.building,
      );
      $("#count").textContent =
        `${places.length} espacio${places.length === 1 ? "" : "s"}`;
      $("#cards").innerHTML = places.length
        ? places
            .map(
              (p) =>
                `<article class="place-card"><div class="place-image">${photo(p)}</div><div class="place-body"><div class="card-top"><span class="category">${esc(p.category)}</span>${badge(p.verified)}</div><h3>${esc(p.name)}</h3><p>${esc(p.building || "Edificio por confirmar")}${p.code ? " · " + esc(p.code) : ""}</p><div class="card-bottom"><button class="text-button" data-detail="${esc(p.id)}">Ver información</button><button class="btn secondary small" data-destination="${esc(p.id)}" aria-label="Cómo llegar a ${esc(p.name)}">${icon("route")}</button></div></div></article>`,
            )
            .join("")
        : '<div class="empty">No encontramos espacios con esos filtros.</div>';
      bindPlaceButtons();
    };
    $("#search").oninput = (e) => {
      state.query = e.target.value;
      draw();
    };
    $("#category").onchange = (e) => {
      state.category = e.target.value;
      draw();
    };
    $("#building").onchange = (e) => {
      state.building = e.target.value;
      draw();
    };
    draw();
  }
  function bindPlaceButtons() {
    document
      .querySelectorAll("[data-detail]")
      .forEach((b) => (b.onclick = () => detail(b.dataset.detail)));
    document.querySelectorAll("[data-destination]").forEach(
      (b) =>
        (b.onclick = () => {
          state.destination = b.dataset.destination;
          state.view = "route";
          state.route = null;
          state.routeDemo = false;
          render();
        }),
    );
    document.querySelectorAll(".place-image img").forEach(
      (img) =>
        (img.onerror = () => {
          img.parentElement.innerHTML =
            icon("photo") + "<small>Fotografía no disponible</small>";
        }),
    );
  }
  function dialog(html) {
    const el = document.createElement("dialog");
    el.innerHTML =
      (html.includes("data-close")
        ? ""
        : `<div class="module-dialog-close"><button class="close" data-close aria-label="Cerrar">${icon("close")}</button></div>`) +
      html;
    document.body.append(el);
    el.showModal();
    el.addEventListener("close", () => el.remove());
    el.querySelector("[data-close]")?.addEventListener("click", () =>
      el.close(),
    );
    return el;
  }
  function detail(id) {
    const p = state.places.find((x) => x.id === id);
    if (!p) return;
    const el = dialog(
      `<div class="dialog-head"><h2>${esc(p.name)}</h2><button class="close" data-close aria-label="Cerrar">${icon("close")}</button></div><div class="place-image detail-photo">${photo(p)}</div>${badge(p.verified)}<p style="margin-top:18px">${esc(p.description || "Descripción pendiente.")}</p><dl class="detail-meta"><div><dt>Edificio</dt><dd>${esc(p.building || "Por confirmar")}</dd></div><div><dt>Piso</dt><dd>${esc(p.floor || "Por confirmar")}</dd></div><div><dt>Identificación</dt><dd>${esc(p.code || "Por confirmar")}</dd></div><div><dt>Fuente</dt><dd>${esc(p.source || "Pendiente")}</dd></div></dl><p class="hint">Verificación en sitio: ${p.source_date ? esc(p.source_date) : "pendiente"}. Las posiciones del croquis son orientativas.</p><button class="btn full" id="detail-route" style="margin-top:22px">${icon("route")} Cómo llegar</button>`,
    );
    $("#detail-route", el).onclick = () => {
      el.close();
      state.destination = p.id;
      state.route = null;
      state.routeDemo = false;
      state.view = "route";
      render();
    };
    const im = $("img", el);
    if (im)
      im.onerror = () => {
        im.parentElement.innerHTML =
          icon("photo") + "<small>Fotografía no disponible</small>";
      };
  }
  function mapView() {
    $("#view").innerHTML =
      `<div class="map-layout"><div class="map-wrap"><div class="map-sheet"><img src="assets/croquis.png" alt="Croquis original: entradas López Mateos y Faja de Oro, campo de futbol, auditorio, salas A y B, aula interactiva, cafetería y sala de negocios.">${state.places
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
        .map(
          (p) =>
            `<button class="map-pin" style="left:${Math.min(100, Math.max(0, p.x))}%;top:${Math.min(100, Math.max(0, p.y))}%" data-detail="${esc(p.id)}" aria-label="${esc(p.name)}">${state.places.indexOf(p) + 1}</button>`,
        )
        .join(
          "",
        )}</div></div><aside><section class="panel"><h2>Espacios del croquis</h2><div class="map-list">${state.places.map((p, i) => `<button data-detail="${esc(p.id)}"><span>${i + 1}</span>${esc(p.name)}</button>`).join("")}</div></section><div class="notice">Este croquis es una referencia. No es un plano a escala ni indica tu posición actual.</div><a class="btn secondary full" href="assets/croquis.png" target="_blank" rel="noopener">Abrir croquis original</a></aside></div>`;
    bindPlaceButtons();
  }
  function routeView() {
    $("#view").innerHTML =
      `<div class="route-layout"><div><section class="panel"><form id="route-form"><div class="field"><label for="origin">¿Desde dónde sales?</label><select id="origin" required>${options(state.places, state.origin)}</select></div><div class="field"><label for="destination">¿A dónde quieres ir?</label><select id="destination" required>${options(state.places, state.destination)}</select></div><label class="check"><input type="checkbox" id="accessible" ${state.accessible ? "checked" : ""}> Usar únicamente tramos verificados como accesibles</label><button class="btn full" style="margin-top:22px">${icon("route")} Buscar recorrido</button></form><div id="route-message" role="status"></div></section><div id="route-steps"></div></div><aside><section class="panel"><h2>Una indicación a la vez</h2><p class="muted">Confirma cada paso cuando llegues al punto indicado. La guía no detecta tu posición dentro del edificio.</p><button class="btn secondary full" id="demo-route">Ver ejemplo de recorrido</button><p class="hint" style="margin-top:12px">El ejemplo utiliza salones ficticios y no corresponde a una ruta real.</p></section><section class="panel"><h2>Fotografías de referencia</h2><p class="hint">Consulta la entrada y el número del salón para identificar tu destino. Los espacios sin imagen se muestran como pendientes.</p></section></aside></div>`;
    $("#route-form").onsubmit = (e) => {
      e.preventDefault();
      state.origin = $("#origin").value;
      state.destination = $("#destination").value;
      state.accessible = $("#accessible").checked;
      state.routeDemo = false;
      state.routeIndex = 0;
      state.arrived = false;
      state.route = C.findRoute(
        state.places,
        state.edges,
        state.origin,
        state.destination,
        state.accessible,
      );
      $("#route-message").innerHTML =
        state.route === null
          ? '<div class="notice">Recorrido pendiente de verificación. Aún no hay una conexión comprobada entre estos espacios con las condiciones seleccionadas.</div>'
          : state.route.length === 0
            ? '<div class="notice success">El punto de partida y el destino son el mismo.</div>'
            : "";
      drawSteps();
    };
    $("#demo-route").onclick = () => {
      state.route = C.findRoute(
        seed.demoPlaces,
        seed.demoEdges,
        "demo-inicio",
        "demo-102",
        false,
        true,
      );
      state.routeIndex = 0;
      state.arrived = false;
      state.routeDemo = true;
      $("#route-message").innerHTML = "";
      drawSteps();
    };
    drawSteps();
  }
  function drawSteps() {
    const target = $("#route-steps");
    if (!state.route?.length) {
      target.innerHTML = "";
      return;
    }
    const steps = state.route,
      i = state.routeIndex;
    target.innerHTML = `<section class="panel">${state.routeDemo ? '<div class="notice">Ejemplo ficticio · No sigas estas indicaciones en el campus.</div>' : ""}<span class="step-label">${state.arrived ? "Recorrido finalizado" : `Paso ${i + 1} de ${steps.length}`}</span><div class="step-track">${steps.map((_, j) => `<span class="${j <= i ? "done" : ""}"></span>`).join("")}</div><p class="step-instruction" aria-live="polite">${state.arrived ? (state.routeDemo ? "Terminaste el recorrido de ejemplo." : "Has confirmado tu llegada al destino.") : esc(steps[i].instruction)}</p><div class="row"><button class="btn secondary" id="previous-step" ${i === 0 || state.arrived ? "disabled" : ""}>Anterior</button><button class="btn" id="next-step" ${state.arrived ? "disabled" : ""}>${i === steps.length - 1 ? "Llegué" : "Siguiente"} ${icon("arrow")}</button><button class="text-button" id="restart-route">Reiniciar</button></div></section><section class="panel"><h2>Tu recorrido</h2><ol class="steps">${steps.map((s, j) => `<li class="${j === i ? "current" : ""}"><span class="number">${j + 1}</span><span>${esc(s.instruction)}</span></li>`).join("")}</ol></section>`;
    $("#previous-step").onclick = () => {
      state.routeIndex--;
      drawSteps();
    };
    $("#next-step").onclick = () => {
      if (i === steps.length - 1) state.arrived = true;
      else state.routeIndex++;
      drawSteps();
    };
    $("#restart-route").onclick = () => {
      state.routeIndex = 0;
      state.arrived = false;
      drawSteps();
    };
  }
  function profileAvatar(initial = null, large = false) {
    const letter =
      initial ||
      (state.profile?.full_name || state.user?.email || "D")
        .slice(0, 1)
        .toUpperCase();
    const url = state.profile?.photo_updated_at
      ? `${client.base}/api/profile/photo?v=${encodeURIComponent(state.profile.photo_updated_at)}`
      : "";
    return `<span class="avatar profile-avatar ${large ? "large" : ""}" aria-hidden="true"><span>${esc(letter)}</span>${url ? `<img src="${esc(url)}" alt="">` : ""}</span>`;
  }
  function cropProfilePhoto(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const d = dialog(
          `<div class="photo-crop-dialog"><div class="dialog-head"><div><span class="eyebrow">FOTO DE PERFIL</span><h2>Ajusta tu foto</h2></div><button class="close" data-close type="button" aria-label="Cancelar">${icon("close")}</button></div><p class="hint">Arrastra la imagen para acomodarla y usa el control para acercar o alejar. El recorte final será cuadrado.</p><div class="photo-crop-stage"><canvas id="profile-crop-canvas" width="512" height="512" aria-label="Vista previa del recorte"></canvas><span class="photo-crop-guide" aria-hidden="true"></span></div><label class="field photo-zoom">Acercar imagen<input id="profile-crop-zoom" type="range" min="1" max="3" step="0.01" value="1"></label><div class="button-row photo-crop-actions"><button class="text-button" id="profile-crop-reset" type="button">Centrar</button><button class="btn" id="profile-crop-save" type="button">Usar esta foto</button></div></div>`,
        );
        const canvas = d.querySelector("#profile-crop-canvas");
        const ctx = canvas.getContext("2d");
        const zoomInput = d.querySelector("#profile-crop-zoom");
        const size = 512;
        const baseScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
        let zoom = 1;
        let offsetX = 0;
        let offsetY = 0;
        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        let settled = false;

        const clamp = () => {
          const width = img.naturalWidth * baseScale * zoom;
          const height = img.naturalHeight * baseScale * zoom;
          const maxX = Math.max(0, (width - size) / 2);
          const maxY = Math.max(0, (height - size) / 2);
          offsetX = Math.max(-maxX, Math.min(maxX, offsetX));
          offsetY = Math.max(-maxY, Math.min(maxY, offsetY));
          return { width, height };
        };
        const draw = () => {
          const { width, height } = clamp();
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(
            img,
            (size - width) / 2 + offsetX,
            (size - height) / 2 + offsetY,
            width,
            height,
          );
        };
        const point = (event) => {
          const r = canvas.getBoundingClientRect();
          return {
            x: (event.clientX - r.left) * (size / r.width),
            y: (event.clientY - r.top) * (size / r.height),
          };
        };
        const finish = (value) => {
          if (settled) return;
          settled = true;
          URL.revokeObjectURL(objectUrl);
          if (d.open) d.close();
          resolve(value);
        };

        canvas.addEventListener("pointerdown", (event) => {
          dragging = true;
          canvas.setPointerCapture(event.pointerId);
          const p = point(event);
          lastX = p.x;
          lastY = p.y;
          canvas.classList.add("dragging");
        });
        canvas.addEventListener("pointermove", (event) => {
          if (!dragging) return;
          const p = point(event);
          offsetX += p.x - lastX;
          offsetY += p.y - lastY;
          lastX = p.x;
          lastY = p.y;
          draw();
        });
        const stopDrag = () => {
          dragging = false;
          canvas.classList.remove("dragging");
        };
        canvas.addEventListener("pointerup", stopDrag);
        canvas.addEventListener("pointercancel", stopDrag);
        zoomInput.addEventListener("input", () => {
          zoom = Number(zoomInput.value) || 1;
          draw();
        });
        d.querySelector("#profile-crop-reset").onclick = () => {
          zoom = 1;
          offsetX = 0;
          offsetY = 0;
          zoomInput.value = "1";
          draw();
        };
        d.querySelector("#profile-crop-save").onclick = () => {
          draw();
          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error("No se pudo preparar la imagen."));
              finish(blob);
            },
            "image/webp",
            0.9,
          );
        };
        d.addEventListener("close", () => finish(null));
        draw();
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("No se pudo abrir la imagen seleccionada."));
      };
      img.src = objectUrl;
    });
  }
  function profileView() {
    if (state.demo) {
      $("#view").innerHTML =
        '<div class="panel"><h2>Estás explorando una demostración</h2><p class="muted">No se ha creado una cuenta ni se han guardado datos personales.</p><button class="btn" id="go-register">Ir al registro</button></div>';
      $("#go-register").onclick = () => {
        state.demo = false;
        state.mode = "register";
        render();
      };
      return;
    }
    const p = state.profile || {};
    $("#view").innerHTML =
      `<section class="profile-hero"><div>${profileAvatar(null, true)}<div><span class="eyebrow">TU ESPACIO EN LA FIT</span><h2>${esc(p.full_name || "Mi cuenta")}</h2><p>${state.user.account_type === "teacher" ? "Docente" : state.user.account_type === "admin" ? "Administrador" : state.user.account_type === "student" ? (p.food_seller_intent ? "Alumno vendedor" : "Alumno") : "Cuenta externa"}</p></div></div><form id="profile-photo-form"><label class="field">Foto de perfil<input type="file" id="profile-photo" accept="image/jpeg,image/png,image/webp" required></label><div class="button-row"><button class="btn small" type="submit">Ajustar y guardar foto</button>${p.photo_updated_at ? '<button class="text-button" type="button" id="delete-avatar">Quitar foto</button>' : ""}</div><p class="hint">Puedes mover, acercar y recortar la imagen antes de guardarla. JPG, PNG o WebP; hasta 5 MB.</p></form></section><div class="profile-grid"><section class="panel"><h2>Mis datos</h2><form id="profile-form">${field("full_name", "Nombre completo", "text", "name")}<div class="field"><label>Correo electrónico</label><p>${esc(state.user.email)}</p><span class="account-detected ${esc(state.user.account_type || "other")}">${state.user.account_type === "teacher" ? "Cuenta docente detectada por dominio institucional" : state.user.account_type === "student" ? "Cuenta de alumno detectada por matrícula institucional" : state.user.account_type === "admin" ? "Cuenta administradora" : "Dominio institucional no clasificado"}</span></div>${state.user.account_type === "student" ? field("student_id", "Matrícula (opcional)", "text", "off", "Se validará únicamente con una fuente institucional autorizada.") + field("career", "Carrera / programa académico", "text", "off", "Se usa para mostrarte eventos cerrados dirigidos a tu carrera.") : ""}<button class="btn">Guardar cambios</button><p class="hint" style="margin-top:16px">Los docentes se identifican por correos <b>@uat.edu.mx</b> o <b>@docentes.uat.edu.mx</b>. Los alumnos usan el formato <b>a…@alumnos.uat.edu.mx</b>.</p></form></section><section class="panel"><h2>Estado de tu cuenta</h2><p class="hint">Identificador para revisión institucional:<br><span style="overflow-wrap:anywhere">${esc(state.user.id)}</span></p><div class="status-item">${badge(!!state.user.email_confirmed_at)}<p>Correo electrónico</p></div><div class="status-item">${badge(state.verification?.status === "verified")}<p>Vinculación con la facultad</p><p class="hint">${state.verification?.status === "verified" ? "Confirmada por un administrador con una fuente autorizada." : "Pendiente de contrastar tus datos con una fuente institucional autorizada."}</p></div><p class="hint" style="margin-top:20px">La clasificación alumno/docente proviene del formato del correo institucional; la verificación institucional sigue siendo un proceso separado.</p></section></div>`;
    $("#view").insertAdjacentHTML(
      "beforeend",
      `${state.user.account_type === "student" ? `<section class="panel account-mode-panel"><div><span class="eyebrow">UNA CUENTA, MÁS POSIBILIDADES</span><h2>Mi tipo de cuenta</h2><p>Activa tu espacio de ventas cuando lo necesites. Conservas tu acceso de alumno y tus pedidos.</p></div><form id="account-mode-form"><label class="field">Usar mi cuenta como<select name="mode"><option value="student" ${!p.food_seller_intent ? "selected" : ""}>Alumno</option><option value="student_seller" ${p.food_seller_intent ? "selected" : ""}>Alumno vendedor</option></select></label><button class="btn" type="submit">Guardar tipo de cuenta</button><button class="text-button" id="go-my-shop" type="button">${p.food_seller_intent ? "Configurar mi puesto" : "Ver Comidas"} →</button><p class="hint">El puesto necesita aprobación antes de publicar. Si vuelves a Alumno, se oculta tu puesto y se pausan nuevos pedidos; puedes terminar los que ya recibiste.</p></form></section>` : `<section class="panel account-role-panel"><span class="eyebrow">ROL INSTITUCIONAL</span><h2>${state.user.account_type === "teacher" ? "Cuenta docente" : state.user.account_type === "admin" ? "Cuenta administradora" : "Cuenta sin clasificación institucional"}</h2><p>${state.user.account_type === "teacher" ? "Tu correo te habilita el horario simplificado para docentes y la creación de eventos exclusivos para docentes." : state.user.account_type === "admin" ? "Puedes administrar eventos para alumnos, generar códigos QR y descargar listas de asistencia verificadas." : "Las funciones de eventos se habilitan al reconocer un correo institucional de alumno o docente."}</p></section>`}<section class="panel storage-summary"><h2>¿Dónde se guardan mis datos?</h2><div><p><b>En tu cuenta</b><br>Perfil, foto, carrera, eventos, asistencias, puesto, productos, pedidos y avisos.</p><p><b>Chat de Comidas</b><br>Mensajes e imágenes son temporales y expiran a las 12 h; no se guardan en Aiven. Solo el pedido confirmado permanece.</p><p><b>Solo en este dispositivo</b><br>Los datos estructurados de tu horario. Otra cuenta no ve tu tabla local.</p><p><b>Archivo del horario</b><br>Se procesa y se descarta. No se guarda el PDF ni la imagen original.</p></div><p class="hint">El horario no se sincroniza entre dispositivos. Los eventos y asistencias verificadas sí quedan asociados a la cuenta.</p></section>`,
    );
    const refreshProfile = async () => {
      const owner = state.user?.id;
      const name = $("#full_name")?.value,
        student = $("#student_id")?.value,
        career = $("#career")?.value;
      await loadData();
      if (state.user?.id !== owner) return;
      render();
      if (state.view === "profile") {
        $("#full_name").value = name ?? "";
        if ($("#student_id")) $("#student_id").value = student ?? "";
        if ($("#career")) $("#career").value = career ?? "";
      }
    };
    const profileAction = async (b, path, method, body, notice) => {
      if (b.disabled) return;
      const owner = state.user?.id;
      b.disabled = true;
      try {
        const result = await client.request(path, method, body);
        if (state.user?.id !== owner) return;
        if (result.error) throw result.error;
        await refreshProfile();
        toast(notice);
      } catch (e) {
        toast(e.message || "No se pudo guardar el cambio.");
      } finally {
        b.disabled = false;
      }
    };
    $("#profile-photo-form").onsubmit = async (e) => {
      e.preventDefault();
      const file = $("#profile-photo").files[0];
      if (!file) return;
      if (
        file.size > 5242880 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      ) {
        toast("Usa una imagen JPG, PNG o WebP de hasta 5 MB.");
        return;
      }
      const button = e.currentTarget.querySelector("[type=submit]");
      try {
        const cropped = await cropProfilePhoto(file);
        if (!cropped) return;
        const body = new FormData();
        body.append("file", cropped, "perfil.webp");
        await profileAction(
          button,
          "/api/profile/photo",
          "POST",
          body,
          "Foto de perfil actualizada.",
        );
      } catch (error) {
        toast(error.message || "No se pudo preparar la foto.");
      }
    };
    if ($("#delete-avatar"))
      $("#delete-avatar").onclick = (e) =>
        profileAction(
          e.currentTarget,
          "/api/profile/photo",
          "DELETE",
          undefined,
          "Foto de perfil eliminada.",
        );
    if ($("#account-mode-form")) $("#account-mode-form").onsubmit = (e) => {
      e.preventDefault();
      profileAction(
        e.currentTarget.querySelector("[type=submit]"),
        "/api/profile/mode",
        "PATCH",
        { mode: e.currentTarget.elements.mode.value },
        "Tipo de cuenta actualizado.",
      );
    };
    if ($("#go-my-shop")) $("#go-my-shop").onclick = () => {
      state.foodTab = p.food_seller_intent ? "mine" : "products";
      state.view = "food";
      render();
    };
    $("#full_name").value = p.full_name || "";
    if ($("#student_id")) $("#student_id").value = p.student_id || "";
    if ($("#career")) $("#career").value = p.career || "";
    $("#profile-form").onsubmit = async (e) => {
      e.preventDefault();
      const form = e.currentTarget,
        b = $("button", form);
      if (b.disabled) return;
      const full_name = $("#full_name").value.trim(),
        student_id = $("#student_id")?.value.trim() || "",
        career = $("#career")?.value.trim() || "";
      if (
        full_name.length < 2 ||
        full_name.length > 100 ||
        student_id.length > 64 ||
        career.length > 160
      ) {
        toast("Revisa el nombre y la matrícula (máximo 64 caracteres).");
        return;
      }
      b.disabled = true;
      try {
        const { error } = await client
          .from("profiles")
          .update({ full_name, student_id: student_id || null, career: career || null })
          .eq("id", state.user.id);
        if (error) throw error;
        await loadData();
        render();
        toast("Datos actualizados.");
      } catch {
        toast("No se pudieron guardar los datos.");
      } finally {
        b.disabled = false;
      }
    };
  }
  function adminView() {
    if (!state.admin || state.demo) {
      state.view = "directory";
      render();
      return;
    }
    $("#view").innerHTML =
      `<div class="admin-grid"><section class="panel"><div class="row" style="justify-content:space-between"><h2>Directorio</h2><button class="btn small" id="add-place">Agregar espacio</button></div>${state.places.map((p) => `<div class="admin-list"><span>${esc(p.name)}<br>${badge(p.verified)}</span><button class="text-button" data-edit="${esc(p.id)}">Editar</button></div>`).join("")}</section><section class="panel"><h2>Tramos del recorrido</h2><p class="hint">Cada tramo tiene un sentido. Registra el regreso por separado con sus propias indicaciones.</p><form id="edge-form"><div class="field"><label for="edge-from">Desde</label><select id="edge-from" required>${options(state.places, "")}</select></div><div class="field"><label for="edge-to">Hasta</label><select id="edge-to" required>${options(state.places, "")}</select></div><div class="field"><label for="edge-instruction">Indicación para el recorrido</label><textarea id="edge-instruction" required maxlength="1000"></textarea></div>${field("edge-source", "Fuente de verificación")}${field("edge-date", "Fecha de revisión", "date")}<label class="check"><input id="edge-accessible" type="checkbox"> Accesibilidad comprobada</label><label class="check"><input id="edge-verified" type="checkbox"> Tramo comprobado en sitio</label><button class="btn full" style="margin-top:18px">Guardar tramo</button></form><p class="hint" style="margin-top:18px">${state.edges.length} tramos registrados.</p>${state.edges.map((e) => `<div class="admin-list"><span>${esc(state.places.find((p) => p.id === e.from_id)?.name || e.from_id)} → ${esc(state.places.find((p) => p.id === e.to_id)?.name || e.to_id)}<br>${badge(e.verified)}</span><button class="text-button" data-remove-edge="${esc(e.id)}">Retirar</button></div>`).join("")}</section></div>`;
    $("#add-place").onclick = () => editPlace();
    document
      .querySelectorAll("[data-edit]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            editPlace(state.places.find((p) => p.id === b.dataset.edit))),
      );
    $("#edge-form").onsubmit = async (e) => {
      e.preventDefault();
      const b = $("button", e.currentTarget);
      if (b.disabled) return;
      b.disabled = true;
      try {
        const record = {
          from_id: $("#edge-from").value,
          to_id: $("#edge-to").value,
          instruction: $("#edge-instruction").value.trim(),
          source: $("#edge-source").value.trim(),
          source_date: $("#edge-date").value || null,
          verified: $("#edge-verified").checked,
          accessible: $("#edge-accessible").checked,
        };
        if (record.from_id === record.to_id)
          throw new Error("Elige dos espacios distintos.");
        if (record.verified && (!record.source || !record.source_date))
          throw new Error("Agrega la fuente y la fecha de revisión.");
        const { error } = await client.from("route_edges").insert(record);
        if (error)
          throw new Error(
            "No se pudo guardar el tramo. Revisa sus datos y permisos.",
          );
        await loadData();
        render();
        toast("Tramo guardado.");
      } catch (err) {
        toast(err.message);
      } finally {
        b.disabled = false;
      }
    };
    document.querySelectorAll("[data-remove-edge]").forEach(
      (b) =>
        (b.onclick = async () => {
          if (!confirm("¿Retirar este tramo del directorio?")) return;
          b.disabled = true;
          const { error } = await client
            .from("route_edges")
            .delete()
            .eq("id", b.dataset.removeEdge);
          if (error) {
            toast("No se pudo retirar el tramo.");
            b.disabled = false;
          } else {
            await loadData();
            render();
          }
        }),
    );
    $("#view").insertAdjacentHTML(
      "beforeend",
      `<section class="panel"><h2>Verificación institucional de una cuenta</h2><p class="hint">Compara primero el nombre y la matrícula del perfil con una fuente institucional autorizada. El usuario puede compartir su identificador desde Mi cuenta.</p><form id="verify-user-form">${field("verify-user-id", "UUID de la cuenta")}<button type="button" class="btn secondary" id="lookup-user">Consultar perfil</button><div id="lookup-result" role="status" style="margin:16px 0"></div>${field("verify-source", "Referencia de la fuente institucional")}<label class="check"><input type="checkbox" id="verify-reviewed" required> He contrastado el perfil con una fuente autorizada de la facultad.</label><button class="btn" style="margin-top:18px">Confirmar vinculación institucional</button></form></section>`,
    );
    $("#lookup-user").onclick = async () => {
      const button = $("#lookup-user");
      button.disabled = true;
      const result = await client.request(
        "/api/admin/users/" +
          encodeURIComponent($("#verify-user-id").value.trim()),
      );
      $("#lookup-result").textContent = result.error
        ? result.error.message
        : `${result.data.full_name} · ${result.data.email} · Matrícula: ${result.data.student_id || "Sin registrar"}`;
      button.disabled = false;
    };
    $("#verify-user-id").required = true;
    $("#verify-source").required = true;
    $("#verify-source").minLength = 5;
    $("#verify-user-form").onsubmit = async (e) => {
      e.preventDefault();
      const b = $("button:not([type=button])", e.currentTarget);
      if (b.disabled) return;
      const id = $("#verify-user-id").value.trim(),
        source = $("#verify-source").value.trim();
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        ) ||
        source.length < 5
      ) {
        toast("Revisa el UUID y la referencia de la fuente.");
        return;
      }
      b.disabled = true;
      try {
        const { error } = await client.rpc("verify_institutional_user", {
          p_user_id: id,
          p_source: source,
        });
        if (error) throw error;
        toast("Vinculación institucional confirmada.");
        e.target.reset();
      } catch {
        toast(
          "No se pudo verificar la cuenta. Revisa el identificador, el correo confirmado y tus permisos.",
        );
      } finally {
        b.disabled = false;
      }
    };
  }
  function editPlace(existing) {
    const p = existing || {};
    const el = dialog(
      `<div class="dialog-head"><h2>${existing ? "Editar" : "Agregar"} espacio</h2><button class="close" data-close aria-label="Cerrar">${icon("close")}</button></div><form id="place-form">${field("place-name", "Nombre del espacio")}${field("place-code", "Número o identificación")}<div class="row"><div class="field"><label for="place-category">Tipo</label><select id="place-category">${["Aula", "Sala", "Auditorio", "Laboratorio", "Acceso", "Servicio", "Deportivo", "Otro"].map((c) => `<option ${c === p.category ? "selected" : ""}>${c}</option>`).join("")}</select></div>${field("place-building", "Edificio")}</div>${field("place-floor", "Piso")}<div class="field"><label for="place-description">Referencias para encontrarlo</label><textarea id="place-description" maxlength="1000">${esc(p.description || "")}</textarea></div><div class="row">${field("place-x", "Posición horizontal (%)", "number")}${field("place-y", "Posición vertical (%)", "number")}</div><p class="hint">Opcionales. Porcentaje de la imagen completa del croquis original.</p><div class="field"><label for="place-photo">Fotografía de la entrada (opcional)</label><input id="place-photo" type="file" accept="image/jpeg,image/png,image/webp"><p class="hint">JPG, PNG o WebP; máximo 5 MB.</p></div>${field("place-source", "Fuente de la información")}${field("place-date", "Fecha de verificación", "date")}<label class="check"><input id="place-verified" type="checkbox" ${p.verified ? "checked" : ""}> Información comprobada por la facultad</label><button class="btn full" style="margin-top:22px">Guardar espacio</button><div id="place-error" role="alert"></div></form>`,
    );
    for (const [name, v] of Object.entries({
      "place-name": p.name,
      "place-code": p.code,
      "place-building": p.building,
      "place-floor": p.floor,
      "place-x": p.x,
      "place-y": p.y,
      "place-source": p.source,
      "place-date": p.source_date,
    }))
      $("#" + name, el).value = v ?? "";
    $("#place-name", el).required = true;
    for (const n of ["place-x", "place-y"]) {
      const input = $("#" + n, el);
      input.min = 0;
      input.max = 100;
      input.step = "any";
    }
    $("#place-form", el).onsubmit = async (e) => {
      e.preventDefault();
      const b = $('button[type="submit"],button.btn', e.currentTarget);
      if (b.disabled) return;
      b.disabled = true;
      try {
        const record = {
          name: $("#place-name", el).value.trim(),
          code: $("#place-code", el).value.trim(),
          category: $("#place-category", el).value,
          building: $("#place-building", el).value.trim(),
          floor: $("#place-floor", el).value.trim(),
          description: $("#place-description", el).value.trim(),
          x:
            $("#place-x", el).value === ""
              ? null
              : Number($("#place-x", el).value),
          y:
            $("#place-y", el).value === ""
              ? null
              : Number($("#place-y", el).value),
          source: $("#place-source", el).value.trim(),
          source_date: $("#place-date", el).value || null,
          verified: $("#place-verified", el).checked,
          photo_url: p.photo_url || null,
        };
        if (record.verified && (!record.source || !record.source_date))
          throw new Error(
            "Agrega la fuente y la fecha para verificar el espacio.",
          );
        const file = $("#place-photo", el).files[0];
        if (file) {
          const ext = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
          }[file.type];
          if (!ext || file.size > 5 * 1024 * 1024)
            throw new Error("Elige una imagen JPG, PNG o WebP de hasta 5 MB.");
          const upload = await client.uploadPhoto(file);
          if (upload.error) throw new Error("No se pudo subir la fotografía.");
          record.photo_url = upload.data.url;
        }
        const result = existing
          ? await client.from("places").update(record).eq("id", p.id)
          : await client
              .from("places")
              .insert({ ...record, id: crypto.randomUUID() });
        if (result.error)
          throw new Error(
            "No se pudo guardar. Revisa los datos y tus permisos.",
          );
        el.close();
        await loadData();
        render();
        toast("Espacio guardado.");
      } catch (error) {
        $("#place-error", el).innerHTML =
          `<div class="notice error">${esc(error.message)}</div>`;
      } finally {
        b.disabled = false;
      }
    };
  }
  async function init() {
    authView();
    if (location.protocol === "file:") return;
    const api = new window.FIT_CLIENT(config.apiBaseUrl || "");
    const status = await api.request("/api/config");
    if (!status.data?.enabled) return;
    client = api;
    const link = await client.processLink();
    if (link?.flow === "recovery") {
      state.mode = "reset";
      authView();
      return;
    }
    if (link?.flow === "confirm") {
      state.notice = link.error
        ? link.error.message
        : "Correo confirmado. Ya puedes iniciar sesión.";
      state.authError = !!link.error;
    }
    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && state.user) {
        state.user = null;
        state.admin = false;
        state.mode = "login";
        render();
      }
    });
    const session = await client.auth.getSession();
    if (session.data?.session) {
      try {
        await openSession();
      } catch {
        state.notice = "No pudimos recuperar tu sesión.";
        state.authError = true;
        authView();
      }
    } else {
      authView();
    }
  }
  init();
})();
