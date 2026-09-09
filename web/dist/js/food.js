/* Comidas: todas las escrituras y permisos se resuelven en la API. */
(function (root) {
  "use strict";
  const labels = {
    pending: "En revisión",
    approved: "Verificado",
    rejected: "Revisar solicitud",
    suspended: "Suspendido",
    requested: "Solicitado",
    accepted: "Aceptado",
    ready: "Listo para recoger",
    completed: "Entregado",
    cancelled: "Cancelado",
  };
  const money = (n) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(n / 100);
  const sale = (p) =>
    p.sale_unit === "lot" ? `lote de ${p.units_per_lot}` : "unidad";
  async function call(c, path, method = "GET", body) {
    const r = await c.client.request("/api/food" + path, method, body);
    if (r.error) throw Error(r.error.message);
    return r.data;
  }
  function empty(c, title, body) {
    return `<div class="module-empty">${c.icon("food")}<h2>${c.esc(title)}</h2><p>${c.esc(body)}</p></div>`;
  }
  function input(c, name, label, value = "", attrs = "") {
    return `<label class="field">${label}<input name="${name}" value="${c.esc(value)}" ${attrs}></label>`;
  }
  function formTask(c, form, fn) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const b = form.querySelector("[type=submit]");
      if (b.disabled) return;
      b.disabled = true;
      const error = form.querySelector("[role=alert]");
      try {
        error.textContent = "";
        await fn(Object.fromEntries(new FormData(form)));
      } catch (e) {
        error.textContent = e.message;
      } finally {
        b.disabled = false;
      }
    };
  }
  function act(c, b, fn) {
    b.onclick = async () => {
      if (b.disabled) return;
      b.disabled = true;
      try {
        await fn();
      } catch (e) {
        c.toast(e.message);
      } finally {
        b.disabled = false;
      }
    };
  }
  function finish(c, d, message) {
    d.close();
    c.toast(message);
    c.render();
    c.poll();
  }
  async function render(c) {
    const host = c.$("#view"),
      view = c.state.view;
    if (c.state.demo) {
      host.innerHTML = `<section class="food-hero"><div><span class="eyebrow">UNA PAUSA ENTRE CLASES</span><h2>El sabor de<br>tu comunidad.</h2><p>Descubre puestos de la facultad, elige tu antojo y solicita tu pedido.</p><button class="btn" id="food-login">Iniciar sesión</button></div><figure><img src="assets/food-example.jpg" alt="Fotografía ilustrativa de tacos"><figcaption>Imagen de ejemplo · Larry Miller · <a href="https://creativecommons.org/licenses/by-sa/2.0/" target="_blank" rel="noopener">CC BY-SA 2.0</a></figcaption></figure></section>${empty(c, "Comidas te espera", "Inicia sesión para ver vendedores verificados, comprar o solicitar tu puesto. Esta imagen no representa un producto a la venta.")}`;
      c.$("#food-login").onclick = c.signOut;
      return;
    }
    host.innerHTML = '<div class="panel" role="status">Cargando…</div>';
    try {
      if (view === "notifications") {
        const data = await call(c, "/notifications");
        if (!host.isConnected) return;
        notifications(c, host, data);
        return;
      }
      if (view === "food-admin") {
        const data = await call(c, "/admin/vendors");
        if (!host.isConnected) return;
        admin(c, host, data);
        return;
      }
      const [catalog, mine] = await Promise.all([
        call(c, "/catalog"),
        call(c, "/mine"),
      ]);
      if (!host.isConnected) return;
      const tab = c.state.foodTab || "products";
      host.innerHTML = `<section class="food-banner"><div><span class="eyebrow">COMUNIDAD FIT</span><h2>Tu próxima pausa<br>sabe bien.</h2><p>Compra cerca. Recoge en la facultad.</p></div><div class="food-stats"><strong>${catalog.vendors.length}</strong><span>puestos verificados</span><strong>${catalog.products.length}</strong><span>productos disponibles</span></div></section><div class="module-tabs" aria-label="Comidas">${[
        ["products", "Productos"],
        ["vendors", "Vendedores"],
        ["orders", "Mis pedidos"],
        ["mine", mine.vendor ? "Mi puesto" : "Quiero vender"],
      ]
        .map(
          ([id, label]) =>
            `<button data-tab="${id}" class="${tab === id ? "active" : ""}" ${tab === id ? 'aria-current="page"' : ""}>${label}</button>`,
        )
        .join("")}</div><div id="food-body"></div>`;
      host.querySelectorAll("[data-tab]").forEach(
        (b) =>
          (b.onclick = () => {
            c.state.foodTab = b.dataset.tab;
            c.render();
          }),
      );
      const body = c.$("#food-body");
      if (tab === "products") products(c, body, catalog, mine);
      if (tab === "vendors") vendors(c, body, catalog);
      if (tab === "mine") own(c, body, mine);
      if (tab === "orders") {
        body.innerHTML = '<p role="status">Cargando pedidos…</p>';
        const orders = await call(c, "/orders");
        if (body.isConnected) ordersView(c, body, orders, false);
      }
    } catch (e) {
      if (host.isConnected) {
        host.innerHTML = `<div class="notice error" role="alert">${c.esc(e.message)}</div><button class="btn secondary" id="food-retry">Reintentar</button>`;
        c.$("#food-retry").onclick = c.render;
      }
    }
  }
  function products(c, body, catalog, mine) {
    body.innerHTML = `<div class="tools"><label class="search">${c.icon("search")}<input class="control" id="food-search" aria-label="Buscar comida o puesto" placeholder="¿Qué se te antoja?"></label><label class="screen-reader" for="food-vendor">Puesto</label><select class="control" id="food-vendor"><option value="">Todos los puestos</option>${catalog.vendors.map((v) => `<option value="${v.id}" ${c.state.foodVendor === v.id ? "selected" : ""}>${c.esc(v.business_name)}</option>`).join("")}</select></div><div class="food-grid" id="food-cards"></div>`;
    const draw = () => {
      const q = c.$("#food-search").value.toLocaleLowerCase("es"),
        v = c.$("#food-vendor").value;
      const list = catalog.products.filter(
        (p) =>
          (!v || v === p.vendor_id) &&
          `${p.name} ${p.business_name}`.toLocaleLowerCase("es").includes(q),
      );
      c.$("#food-cards").innerHTML = list.length
        ? list
            .map(
              (p) =>
                `<article class="food-card"><div class="food-photo">${p.photo_url ? `<img src="${c.esc(p.photo_url)}" alt="${c.esc(p.name)}" loading="lazy">` : `${c.icon("food")}<span>Fotografía pendiente</span>`}</div><div class="food-card-body"><span class="eyebrow">${c.esc(p.business_name)}</span><h3>${c.esc(p.name)}</h3><p>${c.esc(p.description)}</p><p class="pickup">${c.icon("pin")}${c.esc(p.pickup_location)}</p><div class="price-row"><div><strong>${money(p.price_cents)}</strong><small>MXN / ${sale(p)}</small></div><button class="btn small" data-order="${p.id}" ${mine.vendor?.id === p.vendor_id ? "disabled" : ""}>${mine.vendor?.id === p.vendor_id ? "Tu producto" : "Solicitar"}</button></div></div></article>`,
            )
            .join("")
        : empty(
            c,
            "Sin productos por ahora",
            "Prueba otro filtro o vuelve más tarde. Los vendedores aparecerán después de su revisión.",
          );
      body.querySelectorAll("[data-order]").forEach(
        (b) =>
          (b.onclick = () =>
            orderDialog(
              c,
              catalog.products.find((p) => p.id === b.dataset.order),
            )),
      );
      body.querySelectorAll(".food-photo img").forEach(
        (img) =>
          (img.onerror = () => {
            img.parentElement.textContent = "Fotografía no disponible";
          }),
      );
    };
    c.$("#food-search").oninput = draw;
    c.$("#food-vendor").onchange = () => {
      c.state.foodVendor = c.$("#food-vendor").value;
      draw();
    };
    draw();
  }
  function vendors(c, body, catalog) {
    body.innerHTML = catalog.vendors.length
      ? `<div class="vendor-grid">${catalog.vendors.map((v) => `<article class="panel vendor-card"><div class="vendor-mark">${c.esc(v.business_name.charAt(0).toUpperCase())}</div><span class="badge good">Vendedor verificado</span><h2>${c.esc(v.business_name)}</h2><p>${c.esc(v.description)}</p><p class="pickup">${c.icon("pin")}${c.esc(v.pickup_location)}</p><p class="hint">${c.esc(v.hours_text || "Horario por consultar")} · ${v.product_count} productos</p><button class="btn secondary" data-vendor="${v.id}">Ver productos ${c.icon("arrow")}</button></article>`).join("")}</div>`
      : empty(
          c,
          "La comunidad está creciendo",
          "Aún no hay vendedores aprobados. ¿Vendes en la facultad? Solicita tu puesto en Quiero vender.",
        );
    body.querySelectorAll("[data-vendor]").forEach(
      (b) =>
        (b.onclick = () => {
          c.state.foodVendor = b.dataset.vendor;
          c.state.foodTab = "products";
          c.render();
        }),
    );
  }
  function orderDialog(c, p) {
    const requestId = crypto.randomUUID();
    const d = c.dialog(
      `<div class="dialog-content"><span class="eyebrow">${c.esc(p.business_name)}</span><h2>Solicitar ${c.esc(p.name)}</h2><p>${money(p.price_cents)} MXN por ${sale(p)}. Recoge en: ${c.esc(p.pickup_location)}.</p><form id="order-form">${input(c, "quantity", p.sale_unit === "lot" ? "Cantidad de lotes" : "Cantidad de unidades", 1, 'type="number" min="1" max="50" step="1" required')}<label class="field">Nota para el vendedor<textarea name="note" maxlength="500" placeholder="Por ejemplo: sin cebolla"></textarea></label><p class="order-total" id="order-total"></p><p class="hint">El vendedor debe aceptar la solicitud. El pago se acuerda al recoger; no se realiza un cobro en la app.</p><p role="alert" class="field-error"></p><button class="btn full" type="submit">Enviar solicitud</button></form></div>`,
    );
    const f = d.querySelector("form");
    const total = () => {
      const q = Number(f.quantity.value);
      d.querySelector("#order-total").textContent =
        Number.isInteger(q) && q >= 1 && q <= 50
          ? `Total: ${money(q * p.price_cents)} MXN${p.sale_unit === "lot" ? ` · ${q * p.units_per_lot} piezas` : ""}`
          : "";
    };
    f.quantity.oninput = total;
    total();
    formTask(c, f, async (v) => {
      await call(c, "/orders", "POST", {
        product_id: p.id,
        quantity: Number(v.quantity),
        note: v.note,
        request_id: requestId,
        expected_price_cents: p.price_cents,
      });
      c.state.foodTab = "orders";
      finish(c, d, "Solicitud enviada. El vendedor recibió un aviso.");
    });
  }
  function ordersView(c, body, orders, seller) {
    body.innerHTML = `<div class="section-heading"><div><h2>${seller ? "Solicitudes de clientes" : "Tus pedidos"}</h2><p class="hint">${seller ? "Acepta, prepara y marca cuando esté listo para recoger." : "Consulta aquí la respuesta del vendedor."} Últimos 300 pedidos.</p></div><button class="btn secondary small" id="refresh-orders">Actualizar</button></div>${
      orders.length
        ? `<div class="order-list">${orders
            .map((o) => {
              const actions = seller
                ? {
                    requested: [
                      ["accepted", "Aceptar"],
                      ["rejected", "Rechazar"],
                    ],
                    accepted: [
                      ["ready", "Listo para recoger"],
                      ["rejected", "Rechazar"],
                    ],
                    ready: [["completed", "Marcar entregado"]],
                  }[o.status] || []
                : o.status === "requested"
                  ? [["cancelled", "Cancelar solicitud"]]
                  : [];
              return `<article class="panel order-card"><div class="section-heading"><span class="eyebrow">${c.esc(seller ? o.buyer_name : o.business_name)}</span><span class="badge ${["completed", "ready", "accepted"].includes(o.status) ? "good" : "pending"}">${o.status === "rejected" ? "Rechazado" : labels[o.status]}</span></div><h3>${c.esc(o.product_name)}</h3><p>${o.quantity} ${sale(o)}${o.quantity > 1 ? " (cada uno)" : ""} · <strong>${money(o.total_cents)} MXN</strong></p><p>${c.esc(o.pickup_location)}</p>${o.note ? `<p class="order-note">${c.esc(o.note)}</p>` : ""}<small class="muted">${new Date(o.created_at).toLocaleString("es-MX")} · #${o.id.slice(0, 8)}</small><div class="button-row">${actions.map(([s, l]) => `<button class="btn ${["rejected", "cancelled"].includes(s) ? "secondary" : ""} small" data-status="${s}" data-id="${o.id}">${l}</button>`).join("")}</div></article>`;
            })
            .join("")}</div>`
        : empty(
            c,
            seller ? "Aún no tienes solicitudes" : "Todavía no hay pedidos",
            seller
              ? "Los pedidos nuevos aparecerán aquí y en tus avisos."
              : "Explora los productos de la comunidad y solicita tu favorito.",
          )
    }`;
    const refresh = async () => {
      const rows = await call(
        c,
        "/orders?role=" + (seller ? "seller" : "buyer"),
      );
      if (body.isConnected) ordersView(c, body, rows, seller);
      c.poll();
    };
    act(c, body.querySelector("#refresh-orders"), refresh);
    body.querySelectorAll("[data-status]").forEach((b) =>
      act(c, b, async () => {
        if (
          ["rejected", "cancelled"].includes(b.dataset.status) &&
          !confirm("¿Confirmas esta acción para el pedido?")
        )
          return;
        await call(c, "/orders/" + b.dataset.id, "PATCH", {
          status: b.dataset.status,
        });
        await refresh();
      }),
    );
  }
  function own(c, body, mine) {
    const v = mine.vendor;
    if (!v) {
      body.innerHTML = `<section class="panel seller-intro"><div class="icon-circle">${c.icon("food")}</div><h2>Tu puesto, más cerca de la FIT.</h2><p>Publica tus productos, recibe solicitudes y organiza las entregas desde tu cuenta.</p><ol class="steps"><li>Completa los datos de tu puesto.</li><li>Un administrador verifica que vendas en la facultad.</li><li>Tus productos disponibles aparecen en Comidas.</li></ol><button class="btn" id="vendor-start">Solicitar mi puesto ${c.icon("arrow")}</button></section>`;
      body.querySelector("#vendor-start").onclick = () => vendorDialog(c);
      return;
    }
    body.innerHTML = `<section class="panel"><div class="section-heading"><div><span class="badge ${v.status === "approved" ? "good" : "pending"}">${labels[v.status]}</span><h2>${c.esc(v.business_name)}</h2><p>${c.esc(v.pickup_location)} · ${c.esc(v.hours_text)}</p></div><button class="btn secondary small" id="edit-vendor" ${v.status === "suspended" ? "disabled" : ""}>Editar puesto</button></div>${v.status !== "approved" ? `<div class="notice">${v.status === "pending" ? "Puedes preparar productos mientras revisan tu solicitud. Se mostrarán al público cuando el administrador apruebe tu puesto." : c.esc(v.review_source || "Contacta al administrador para revisar tu solicitud.")}</div>` : ""}</section><div class="module-tabs"><button id="own-products" class="active">Mis productos</button><button id="own-orders">Pedidos recibidos</button></div><div id="own-body"></div>`;
    body.querySelector("#edit-vendor").onclick = () => vendorDialog(c, v);
    const target = body.querySelector("#own-body");
    const draw = () => {
      body.querySelector("#own-products").classList.add("active");
      body.querySelector("#own-orders").classList.remove("active");
      target.innerHTML = `<div class="section-heading"><h2>${mine.products.length} productos</h2><button class="btn small" id="add-product" ${["pending", "approved"].includes(v.status) ? "" : "disabled"}>+ Agregar producto</button></div>${mine.products.length ? `<div class="product-manage">${mine.products.map((p) => `<article class="panel"><div class="section-heading"><div><h3>${c.esc(p.name)}</h3><p>${money(p.price_cents)} MXN / ${sale(p)}</p><span class="badge ${p.available ? "good" : "pending"}">${p.available ? "Disponible" : "Pausado"}</span></div><div class="button-row"><button class="btn secondary small" data-edit-product="${p.id}" ${["pending", "approved"].includes(v.status) ? "" : "disabled"}>Editar</button><button class="text-button danger" data-delete-product="${p.id}">Eliminar</button></div></div></article>`).join("")}</div>` : empty(c, "Prepara tu menú", "Agrega una foto, el precio y la forma de venta de tu primer producto.")}`;
      target.querySelector("#add-product").onclick = () => productDialog(c);
      target.querySelectorAll("[data-edit-product]").forEach(
        (b) =>
          (b.onclick = () =>
            productDialog(
              c,
              mine.products.find((p) => p.id === b.dataset.editProduct),
            )),
      );
      target.querySelectorAll("[data-delete-product]").forEach((b) =>
        act(c, b, async () => {
          if (
            !confirm(
              "¿Eliminar este producto del catálogo? Los pedidos anteriores se conservarán.",
            )
          )
            return;
          await call(c, "/products/" + b.dataset.deleteProduct, "DELETE");
          c.render();
        }),
      );
    };
    body.querySelector("#own-products").onclick = draw;
    act(c, body.querySelector("#own-orders"), async () => {
      body.querySelector("#own-products").classList.remove("active");
      body.querySelector("#own-orders").classList.add("active");
      const rows = await call(c, "/orders?role=seller");
      if (target.isConnected) ordersView(c, target, rows, true);
    });
    draw();
  }
  function vendorDialog(c, v = {}) {
    const d = c.dialog(
      `<div class="dialog-content"><h2>${v.id ? "Editar puesto" : "Quiero vender en la FIT"}</h2><p>Usa los datos reales de tu puesto. El administrador revisará tu vínculo con la facultad antes de publicarlo.</p><form>${input(c, "business_name", "Nombre del puesto", v.business_name, 'required minlength="2" maxlength="100"')}${input(c, "pickup_location", "Punto de entrega en la facultad", v.pickup_location, 'required minlength="3" maxlength="180"')}${input(c, "hours_text", "Horario de atención", v.hours_text, 'maxlength="160" placeholder="Lunes a viernes, 9:00–14:00"')}<label class="field">Sobre tu puesto<textarea name="description" maxlength="600">${c.esc(v.description)}</textarea></label>${v.id ? '<p class="hint">Cambiar el nombre o el punto de entrega requiere una nueva revisión.</p>' : ""}<p role="alert" class="field-error"></p><button class="btn full" type="submit">${v.id ? "Guardar cambios" : "Enviar solicitud de alta"}</button></form></div>`,
    );
    formTask(c, d.querySelector("form"), async (values) => {
      await call(c, "/vendor", "POST", values);
      finish(c, d, "Datos del puesto guardados.");
    });
  }
  function productDialog(c, p = {}) {
    let photoId = p.photo_id || null;
    const d = c.dialog(
      `<div class="dialog-content"><h2>${p.id ? "Editar producto" : "Nuevo producto"}</h2><form>${input(c, "name", "Nombre del producto", p.name, 'required minlength="2" maxlength="120"')}<label class="field">Descripción<textarea name="description" maxlength="600">${c.esc(p.description)}</textarea></label><label class="field">Fotografía (JPG, PNG o WebP, hasta 5 MB)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label><img id="product-preview" class="product-preview" ${p.photo_url ? `src="${c.esc(p.photo_url)}"` : "hidden"} alt="Vista previa del producto"><label class="check"><input type="checkbox" name="remove_photo"> Quitar fotografía actual</label><div class="form-grid">${input(c, "price", "Precio en MXN", p.price_cents ? p.price_cents / 100 : "", 'required type="number" min="0.01" max="10000" step="0.01"')}<label class="field">Forma de venta<select name="sale_unit"><option value="unit">Por unidad</option><option value="lot" ${p.sale_unit === "lot" ? "selected" : ""}>Por lote</option></select></label>${input(c, "units_per_lot", "Piezas por lote", p.units_per_lot || 2, 'type="number" min="2" max="1000" step="1"')}</div><label class="check"><input name="available" type="checkbox" ${p.available === false ? "" : "checked"}> Disponible para solicitar</label><p role="alert" class="field-error"></p><button class="btn full" type="submit">Guardar producto</button></form></div>`,
    );
    const f = d.querySelector("form");
    let preview;
    const units = () => {
      f.units_per_lot.closest("label").hidden = f.sale_unit.value !== "lot";
      f.units_per_lot.disabled = f.sale_unit.value !== "lot";
    };
    f.sale_unit.onchange = units;
    units();
    f.photo.onchange = () => {
      if (preview) URL.revokeObjectURL(preview);
      const file = f.photo.files[0];
      if (!file) return;
      preview = URL.createObjectURL(file);
      const img = d.querySelector("#product-preview");
      img.src = preview;
      img.hidden = false;
      f.remove_photo.checked = false;
    };
    d.addEventListener(
      "close",
      () => {
        if (preview) URL.revokeObjectURL(preview);
      },
      { once: true },
    );
    formTask(c, f, async (values) => {
      const file = f.photo.files[0];
      if (file) {
        if (
          file.size > 5242880 ||
          !["image/jpeg", "image/png", "image/webp"].includes(file.type)
        )
          throw Error(
            "Selecciona una fotografía JPG, PNG o WebP de hasta 5 MB.",
          );
        const data = new FormData();
        data.append("file", file);
        photoId = (await call(c, "/photos", "POST", data)).id;
        f.photo.value = "";
      }
      if (f.remove_photo.checked) photoId = null;
      await call(
        c,
        "/products" + (p.id ? "/" + p.id : ""),
        p.id ? "PATCH" : "POST",
        {
          name: values.name,
          description: values.description,
          photo_id: photoId,
          price_cents: Math.round(Number(values.price) * 100),
          sale_unit: values.sale_unit,
          units_per_lot:
            values.sale_unit === "lot" ? Number(values.units_per_lot) : 1,
          available: f.available.checked,
        },
      );
      finish(c, d, "Producto guardado.");
    });
  }
  function notifications(c, host, data) {
    host.innerHTML = `<div class="section-heading"><p>Los avisos se actualizan mientras tienes abierta la aplicación.</p><div class="button-row"><button class="btn secondary small" id="refresh-notes">Actualizar</button><button class="btn small" id="read-all" ${data.unread_count ? "" : "disabled"}>Marcar todos leídos</button></div></div>${data.items.length ? `<div class="notification-list">${data.items.map((n) => `<article class="panel notification ${n.read_at ? "" : "unread"}"><div><span class="eyebrow">${n.read_at ? "LEÍDO" : "NUEVO"}</span><h3>${c.esc(n.title)}</h3><p>${c.esc(n.body)}</p><small class="muted">${new Date(n.created_at).toLocaleString("es-MX")}</small></div>${!n.read_at ? `<button class="btn secondary small" data-read="${n.id}">Marcar leído</button>` : ""}</article>`).join("")}</div>` : empty(c, "Todo al día", "Los cambios de tus pedidos y las revisiones de tu puesto aparecerán aquí.")}`;
    host.querySelector("#refresh-notes").onclick = c.render;
    act(c, host.querySelector("#read-all"), async () => {
      await call(c, "/notifications/read", "PATCH", { all: true });
      c.render();
      c.poll();
    });
    host.querySelectorAll("[data-read]").forEach((b) =>
      act(c, b, async () => {
        await call(c, "/notifications/read", "PATCH", {
          ids: [b.dataset.read],
        });
        c.render();
        c.poll();
      }),
    );
  }
  function admin(c, host, rows) {
    host.innerHTML = `<div class="notice">Comprueba la identidad y el vínculo del vendedor con la facultad mediante una fuente autorizada. El correo confirmado por sí solo no acredita permiso para vender.</div>${rows.length ? rows.map((v) => `<article class="panel vendor-review"><div class="section-heading"><div><span class="badge ${v.status === "approved" ? "good" : "pending"}">${labels[v.status]}</span><h2>${c.esc(v.business_name)}</h2></div><button class="btn secondary small" data-review="${v.id}">Revisar</button></div><p>${c.esc(v.full_name)} · ${c.esc(v.email)}</p><p>${c.esc(v.pickup_location)} · ${c.esc(v.hours_text)}</p><p>${c.esc(v.description)}</p>${v.review_source ? `<p class="hint">Última revisión: ${c.esc(v.review_source)}</p>` : ""}</article>`).join("") : empty(c, "Sin solicitudes", "Las altas de vendedores aparecerán aquí.")}`;
    host.querySelectorAll("[data-review]").forEach(
      (b) =>
        (b.onclick = () => {
          const v = rows.find((r) => r.id === b.dataset.review);
          const d = c.dialog(
            `<div class="dialog-content"><h2>Revisar ${c.esc(v.business_name)}</h2><form><label class="field">Resolución<select name="status"><option value="approved">Aprobar vendedor</option><option value="rejected">Solicitar correcciones / rechazar</option><option value="suspended">Suspender puesto</option></select></label><label class="field">Fuente verificada o motivo<textarea name="source" required minlength="5" maxlength="600" placeholder="Fuente, responsable y fecha de la comprobación"></textarea></label><p class="hint">El motivo de rechazo o suspensión se mostrará al vendedor. Evita incluir datos personales de terceros.</p><p role="alert" class="field-error"></p><button class="btn" type="submit">Guardar resolución</button></form></div>`,
          );
          formTask(c, d.querySelector("form"), async (values) => {
            await call(c, "/admin/vendors/" + v.id, "PATCH", values);
            finish(c, d, "Revisión guardada y aviso enviado al vendedor.");
          });
        }),
    );
  }
  root.FIT_FOOD = { render };
})(window);
