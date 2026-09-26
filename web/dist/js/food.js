/* Comidas: catálogo, compras y atención de pedidos con permisos en la API. */
(function (root) {
  "use strict";
  const F = root.FIT_FOOD_FLOW;
  const labels = {
    pending: "En revisión",
    approved: "Aprobado",
    rejected: "Requiere correcciones",
    suspended: "Suspendido",
    ...F.names,
  };
  const money = (n) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(n / 100);
  const sale = (p) =>
    p.sale_unit === "lot" ? `lote de ${p.units_per_lot} piezas` : "unidad";
  let active = null,
    mutating = 0;
  async function call(c, path, method = "GET", body) {
    const owner = c.state.user?.id;
    const r = await c.client.request("/api/food" + path, method, body);
    if (c.state.user?.id !== owner)
      throw Error("La sesión cambió. Vuelve a abrir Comidas.");
    if (r.error) throw Error(r.error.message);
    return r.data;
  }
  function empty(c, title, body) {
    return `<div class="module-empty">${c.icon("food")}<h2>${c.esc(title)}</h2><p>${c.esc(body)}</p></div>`;
  }
  function input(c, name, label, value = "", attrs = "") {
    return `<label class="field">${label}<input name="${name}" value="${c.esc(value)}" ${attrs}></label>`;
  }
  function go(c, tab, orderId = null) {
    if(tab==='chats') {c.state.view='messages';if(c.state.foodFocusChat){c.state.messagesFocusChat='food:'+c.state.foodFocusChat;delete c.state.foodFocusChat;}c.render();return;}
    c.state.view = "food";
    c.state.foodTab = tab;
    c.state.foodFocusOrder = orderId;
    if (orderId)
      c.state[tab === "sales" ? "salesFilter" : "ordersFilter"] = "all";
    c.render();
  }
  function formTask(c, form, fn) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const b = form.querySelector("[type=submit]");
      if (b.disabled) return;
      b.disabled = true;
      mutating++;
      const error = form.querySelector("[role=alert]");
      try {
        error.textContent = "";
        await fn(Object.fromEntries(new FormData(form)));
      } catch (e) {
        error.textContent = e.message;
      } finally {
        b.disabled = false;
        mutating--;
      }
    };
  }
  function act(c, b, fn) {
    b.onclick = async () => {
      if (b.disabled) return;
      b.disabled = true;
      mutating++;
      try {
        await fn();
      } catch (e) {
        c.toast(e.message);
      } finally {
        b.disabled = false;
        mutating--;
      }
    };
  }
  function finish(c, d, message) {
    d.close();
    c.toast(message);
    c.render();
    c.poll();
  }
  function images(host) {
    host
      .querySelectorAll(".food-photo img,.menu-thumbnail img")
      .forEach((img) => {
        img.onerror = () => {
          img.parentElement.textContent = "Foto no disponible";
        };
      });
  }
  function summary(c) {
    return c.state.foodSummary || { buyer: {}, seller: {} };
  }
  function updateSummary(c, data) {
    if (data.order_summary) c.state.foodSummary = data.order_summary;
    const counts = summary(c),
      buyer = counts.buyer || {},
      seller = counts.seller || {};
    document.querySelectorAll("[data-food-count]").forEach((el) => {
      const key = el.dataset.foodCount;
      const count =
        key === "buyer" ? F.activeCount(buyer) : Number(seller.requested || 0);
      el.textContent = String(count);
      el.hidden = count === 0;
    });
    document.querySelectorAll("[data-food-metric]").forEach((el) => {
      el.textContent = String(seller[el.dataset.foodMetric] || 0);
    });
    const alert = c.$("#food-attention");
    if (alert) {
      const parts = [];
      if (seller.requested)
        parts.push(
          `<button class="food-attention-item seller" data-go="sales">${c.icon("bell")}<span><strong>${seller.requested} ${seller.requested === 1 ? "cliente espera" : "clientes esperan"} tu respuesta</strong><small>Revisa y confirma los pedidos nuevos.</small></span><b>Atender pedidos ${c.icon("arrow")}</b></button>`,
        );
      if (buyer.ready)
        parts.push(
          `<button class="food-attention-item ready" data-go="orders">${c.icon("check")}<span><strong>${buyer.ready} ${buyer.ready === 1 ? "compra lista" : "compras listas"} para recoger</strong><small>Consulta el punto de entrega de tu pedido.</small></span><b>Ver mis compras ${c.icon("arrow")}</b></button>`,
        );
      alert.innerHTML = parts.join("");
      alert.hidden = !parts.length;
      alert.querySelectorAll("[data-go]").forEach(
        (b) =>
          (b.onclick = () => {
            c.state[b.dataset.go === "sales" ? "salesFilter" : "ordersFilter"] =
              b.dataset.go === "sales" ? "requested" : "ready";
            go(c, b.dataset.go);
          }),
      );
    }
  }
  function updateChatCount(c, count) {
    const total = Number(count || 0);
    document.querySelectorAll("[data-chat-count]").forEach((el) => {
      el.textContent = total > 99 ? "99+" : String(total);
      el.hidden = total === 0;
    });
  }
  function disconnect() {
    if(active?.openChat?.dialog?.open)active.openChat.dialog.close();
    if(active?.detailTimer)clearInterval(active.detailTimer);
    if (active?.chatSource) active.chatSource.close();
    if (active?.chatGuard) clearInterval(active.chatGuard);
    active = null;
  }
  async function refreshChats(c, session) {
    if (!session || active !== session || !session.host.isConnected) return null;
    const data = await call(c, "/chats");
    if (active !== session || !session.host.isConnected) return null;
    session.chats = data;
    updateChatCount(c, data.unread_count);
    return data;
  }
  function connectChatEvents(c, session, current) {
    const base = c.client?.base || "";
    const source = new EventSource(base + "/api/food/chats/events", {
      withCredentials: true,
    });
    session.chatSource = source;
    const refreshFromEvent = async (event) => {
      if (!current()) {
        source.close();
        return;
      }
      let payload = {};
      try {
        payload = JSON.parse(event.data || "{}");
      } catch {
        return;
      }
      const previous = Number(session.chats?.unread_count || 0);
      try {
        const data = await refreshChats(c, session);
        if (!data || !current()) return;
        if (session.openChat?.id === payload.chat_id)
          await session.openChat.refresh();
        else if (!payload.from_self && data.unread_count > previous)
          c.toast("Tienes un nuevo mensaje en Mensajes.");
        if (c.state.view === "food" && c.state.foodTab === "chats" && !document.querySelector("dialog[open]"))
          chatsView(c, c.$("#food-body"), data, session);
        c.poll();
      } catch {
        // EventSource reconnects automatically; the next event or manual refresh retries.
      }
    };
    source.addEventListener("chat", refreshFromEvent);
    source.addEventListener("ping", async () => {
      if (!current()) return source.close();
      try { await refreshChats(c,session);if(session.openChat)await session.openChat.refresh(); } catch {}
    });
    session.chatGuard = setInterval(() => {
      if (!current()) {
        clearInterval(session.chatGuard);
        source.close();
      }
    }, 15000);
  }

  async function render(c) {
    if(c.state.view==='food'&&c.state.foodTab==='chats'){go(c,'chats');return;}
    disconnect();
    const host = c.$("#view"),
      view = c.state.view;
    const owner = c.state.user?.id;
    const session = {
      host,
      owner,
      refresh: null,
      revision: "",
      noteRevision: "",
      chats: { items: [], unread_count: 0 },
      chatSource: null,
      chatGuard: null,
      openChat: null,
    };
    active = session;
    const current = () =>
      active === session && host.isConnected && c.state.user?.id === owner;
    if (c.state.demo) {
      host.innerHTML = `<section class="food-hero"><div><span class="eyebrow">COMIDAS EN LA FIT</span><h2>¿Qué vas a comer?</h2><p>Consulta al vendedor por chat, confirma tu pedido y recoge en su puesto.</p><button class="btn" id="food-login">Iniciar sesión para pedir</button></div><figure><img src="assets/food-example.jpg" alt="Fotografía ilustrativa de tacos"><figcaption>Imagen de ejemplo · Larry Miller · <a href="https://creativecommons.org/licenses/by-sa/2.0/" target="_blank" rel="noopener">CC BY-SA 2.0</a></figcaption></figure></section>`;
      c.$("#food-login").onclick = c.signOut;
      return;
    }
    host.innerHTML = '<div class="panel" role="status">Cargando Comidas…</div>';
    try {
      if (view === "notifications") {
        const data = await call(c, "/notifications");
        if (current()) {
          updateSummary(c, data);
          notifications(c, host, data);
          session.noteRevision = JSON.stringify(data);
        }
        return;
      }
      if (view === "food-admin") {
        const rows = await call(c, "/admin/vendors");
        if (current()) admin(c, host, rows);
        return;
      }
      const [catalog, mine, notes, chats] = await Promise.all([
        call(c, "/catalog"),
        call(c, "/mine"),
        call(c, "/notifications"),
        call(c, "/chats"),
      ]);
      if (!current()) return;
      updateSummary(c, notes);
      session.chats = chats;
      session.revision = JSON.stringify(notes.order_summary);
      let tab = c.state.foodTab || "products";
      if (tab === "sales" && !mine.vendor) tab = c.state.foodTab = "mine";
      const nav = [
        ["products", "food", "Explorar", "Encuentra qué comer"],
        ["orders", "bag", "Mis compras", "Lo que tú pediste"],
        ["chats", "chat", "Mensajes", "Docentes, vendedores y compras"],
        ...(mine.vendor
          ? [
              [
                "sales",
                "bell",
                "Pedidos recibidos",
                "Lo que piden tus clientes",
              ],
            ]
          : []),
        [
          "mine",
          "store",
          mine.vendor ? "Mi puesto" : "Quiero vender",
          mine.vendor ? "Productos y datos del puesto" : "Da de alta tu puesto",
        ],
      ];
      host.innerHTML = `<nav class="food-navigation" aria-label="Secciones de Comidas">${nav.map(([id, icon, title, hint]) => `<button data-food-tab="${id}" class="food-nav-item ${tab === id || (tab === "vendors" && id === "products") ? "active" : ""}" ${tab === id || (tab === "vendors" && id === "products") ? 'aria-current="page"' : ""}>${c.icon(icon)}<span><strong>${title}${id === "orders" || id === "sales" ? ` <span class="food-count" data-food-count="${id === "orders" ? "buyer" : "seller"}" hidden></span>` : id === "chats" ? ' <span class="food-count" data-chat-count hidden></span>' : ""}</strong><small>${hint}</small></span></button>`).join("")}</nav><div id="food-attention" class="food-attention" aria-live="polite" hidden></div><div id="food-body"></div>`;
      host
        .querySelectorAll("[data-food-tab]")
        .forEach((b) => (b.onclick = () => go(c, b.dataset.foodTab)));
      updateSummary(c, notes);
      updateChatCount(c, chats.unread_count);
      connectChatEvents(c, session, current);
      const body = c.$("#food-body");
      if (tab === "products") products(c, body, catalog, mine);
      if (tab === "chats") chatsView(c, body, chats, session);
      // FIT push deep link
      if (tab === "chats" && c.state.foodFocusChat) {
        const focusedChat = c.state.foodFocusChat;
        delete c.state.foodFocusChat;
        await openChat(c, focusedChat, session);
      }
      if (tab === "vendors") vendors(c, body, catalog);
      if (tab === "mine") own(c, body, mine);
      if (tab === "orders" || tab === "sales") {
        body.innerHTML = '<p role="status">Cargando pedidos…</p>';
        const seller = tab === "sales";
        const openedOrderId = c.state.foodFocusOrder;
        let refreshing = false;
        session.refresh = async () => {
          if (refreshing || !current()) return;
          refreshing = true;
          try {
            let rows = await call(
              c,
              "/orders?role=" + (seller ? "seller" : "buyer"),
            );
            const focus = c.state.foodFocusOrder || openedOrderId;
            if (focus && !rows.some((o) => o.id === focus)) {
              const one = await call(c, "/orders/" + encodeURIComponent(focus));
              if (one.order_role === (seller ? "seller" : "buyer"))
                rows = [one, ...rows];
            }
            if (current() && body.isConnected)
              ordersView(c, body, rows, seller, session.refresh);
          } finally {
            refreshing = false;
          }
        };
        await session.refresh();
      }
    } catch (e) {
      if (current()) {
        host.innerHTML = `<div class="notice error" role="alert">${c.esc(e.message)}</div><button class="btn secondary" id="food-retry">Reintentar</button>`;
        c.$("#food-retry").onclick = c.render;
      }
    }
  }
  function products(c, body, catalog, mine) {
    body.innerHTML = `<div class="section-heading"><div><h2>¿Qué se te antoja?</h2><p class="hint">${catalog.products.length} productos · ${catalog.vendors.length} puestos aprobados</p></div><button class="btn secondary small" id="browse-vendors">Ver puestos ${c.icon("store")}</button></div><div class="buy-guide"><span><b>1</b> Consulta por chat</span><span><b>2</b> Confirma el pedido</span><span><b>3</b> Recoge en el puesto</span></div><div class="tools food-tools"><label class="search">${c.icon("search")}<input class="control" id="food-search" aria-label="Buscar producto o puesto" placeholder="Busca tacos, tortas, bebidas…" value="${c.esc(c.state.foodQuery || "")}"></label><label class="screen-reader" for="food-vendor">Filtrar por puesto</label><select class="control" id="food-vendor"><option value="">Todos los puestos</option>${catalog.vendors.map((v) => `<option value="${v.id}" ${c.state.foodVendor === v.id ? "selected" : ""}>${c.esc(v.business_name)}</option>`).join("")}</select></div><p class="hint" id="food-results" aria-live="polite"></p><div class="food-grid" id="food-cards"></div>`;
    body.querySelector("#browse-vendors").onclick = () => go(c, "vendors");
    const draw = () => {
      const q = body
          .querySelector("#food-search")
          .value.toLocaleLowerCase("es"),
        v = body.querySelector("#food-vendor").value;
      c.state.foodQuery = body.querySelector("#food-search").value;
      const list = catalog.products.filter(
        (p) =>
          (!v || v === p.vendor_id) &&
          `${p.name} ${p.business_name} ${p.description}`
            .toLocaleLowerCase("es")
            .includes(q),
      );
      body.querySelector("#food-results").textContent =
        `${list.length} ${list.length === 1 ? "producto" : "productos"}`;
      body.querySelector("#food-cards").innerHTML = list.length
        ? list
            .map(
              (p) =>
                `<article class="food-card"><div class="food-photo">${p.photo_url ? `<img src="${c.esc(p.photo_url)}" alt="${c.esc(p.name)}" loading="lazy">` : `${c.icon("food")}<span>Producto sin foto</span>`}<span class="food-sale-tag">${p.sale_unit === "lot" ? `Lote · ${p.units_per_lot} piezas` : "Por unidad"}</span></div><div class="food-card-body"><span class="eyebrow">${c.esc(p.business_name)}</span>${window.FIT_PRESENCE?.badge(p.seller_user_id)||''}<h3>${c.esc(p.name)}</h3><p>${c.esc(p.description)}</p><p class="pickup">${c.icon("pin")}${c.esc(p.pickup_location)}</p><div class="price-row"><div><strong>${money(p.price_cents)}</strong><small>MXN por ${sale(p)}</small></div><button class="btn small" data-order="${p.id}" ${mine.vendor?.id === p.vendor_id ? "disabled" : ""}>${mine.vendor?.id === p.vendor_id ? "Tu producto" : "Consultar / pedir"}</button></div></div></article>`,
            )
            .join("")
        : empty(
            c,
            catalog.products.length
              ? "No encontramos ese producto"
              : "El menú todavía está vacío",
            catalog.products.length
              ? "Cambia la búsqueda o consulta otro puesto."
              : "Aquí aparecerán los productos disponibles de los puestos aprobados.",
          );
      body.querySelectorAll("[data-order]").forEach((b) =>
        act(c, b, async () => {
          await orderDialog(
            c,
            catalog.products.find((p) => p.id === b.dataset.order),
          );
        }),
      );
      images(body);
    };
    body.querySelector("#food-search").oninput = draw;
    body.querySelector("#food-vendor").onchange = () => {
      c.state.foodVendor = body.querySelector("#food-vendor").value;
      draw();
    };
    draw();
  }
  function vendors(c, body, catalog) {
    body.innerHTML =
      `<div class="section-heading"><h2>Puestos de la facultad</h2><button class="btn secondary small" id="all-food">Ver todos los productos</button></div>` +
      (catalog.vendors.length
        ? `<div class="vendor-grid">${catalog.vendors.map((v) => `<article class="panel vendor-card"><div class="vendor-mark">${c.esc(v.business_name.charAt(0).toUpperCase())}</div><span class="badge good">Puesto aprobado</span><h2>${c.esc(v.business_name)}</h2>${window.FIT_PRESENCE?.badge(v.user_id)||''}<p>${c.esc(v.description)}</p><p class="pickup">${c.icon("pin")}${c.esc(v.pickup_location)}</p><p class="hint">${c.esc(v.hours_text || "Horario por consultar")} · ${v.product_count} productos</p><button class="btn secondary" data-vendor="${v.id}">Ver menú ${c.icon("arrow")}</button></article>`).join("")}</div>`
        : empty(
            c,
            "Aún no hay puestos aprobados",
            "Si vendes en la facultad, puedes iniciar tu solicitud en Quiero vender.",
          ));
    body.querySelector("#all-food").onclick = () => {
      c.state.foodVendor = "";
      go(c, "products");
    };
    body.querySelectorAll("[data-vendor]").forEach(
      (b) =>
        (b.onclick = () => {
          c.state.foodVendor = b.dataset.vendor;
          c.state.foodQuery = "";
          go(c, "products");
        }),
    );
  }
  function chatRemaining(expiresAt) {
    const ms = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    if (!ms) return "Finalizado";
    const hours = Math.floor(ms / 3600000),
      minutes = Math.max(1, Math.ceil((ms % 3600000) / 60000));
    return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
  }
  function chatsView(c, body, data, session) {
    if (!body) return;
    body.innerHTML = `<div class="section-heading"><div><span class="eyebrow">MENSAJES TEMPORALES</span><h2>Chats de Comidas</h2><p class="hint">Habla con el vendedor antes de confirmar. Cada conversación y sus imágenes desaparecen 12 horas después de iniciarse.</p></div><button class="btn secondary small" id="refresh-chats">${c.icon("refresh")} Actualizar</button></div><div class="chat-privacy-note">${c.icon("chat")}<div><strong>Conversaciones temporales</strong><span>El chat está disponible durante 12 horas.</span></div></div>${
      data.items.length
        ? `<div class="chat-list">${data.items
            .map(
              (chat) =>
                `<button class="panel chat-list-item ${chat.unread_count ? "unread" : ""}" data-open-chat="${chat.id}"><div class="chat-avatar">${c.esc((chat.counterpart_name || "C").charAt(0).toUpperCase())}</div><div class="chat-list-main"><div><strong>${c.esc(chat.counterpart_name)}</strong>${window.FIT_PRESENCE?.badge(chat.counterpart_id)||''}<time>${chatRemaining(chat.expires_at)}</time></div><span>${c.esc(chat.product_name)}</span><p>${chat.last_message ? `${chat.last_message.mine ? "Tú: " : ""}${c.esc(chat.last_message.preview)}` : "Conversación iniciada. Escribe tu primer mensaje."}</p></div>${chat.unread_count ? `<b class="chat-unread">${chat.unread_count > 99 ? "99+" : chat.unread_count}</b>` : ""}</button>`,
            )
            .join("")}</div>`
        : empty(
            c,
            "Aún no tienes chats activos",
            "Abre un producto y usa Consultar / pedir. Los chats terminados desaparecen automáticamente.",
          )
    }`;
    body.querySelector("#refresh-chats").onclick = async () => {
      const button = body.querySelector("#refresh-chats");
      button.disabled = true;
      try {
        const latest = await refreshChats(c, session);
        if (latest) chatsView(c, body, latest, session);
      } catch (e) {
        c.toast(e.message);
      } finally {
        if (button.isConnected) button.disabled = false;
      }
    };
    body.querySelectorAll("[data-open-chat]").forEach(
      (button) =>
        (button.onclick = () => openChat(c, button.dataset.openChat, session)),
    );
  }
  async function orderDialog(c, p) {
    const session = active;
    if (!session) return;
    const chat = await call(c, "/chats", "POST", { product_id: p.id });
    c.state.messagesFocusChat="food:"+chat.id;
    c.state.view="messages";c.render();
  }
  async function openChat(c, chatId, session = active) {
    if(c.state.view!=="messages"){c.state.messagesFocusChat="food:"+chatId;c.state.view="messages";c.render();return;}
    if (!session || active !== session) return;
    try {
      const chat = await call(c, "/chats/" + encodeURIComponent(chatId));
      chatDialog(c, chat, session);
    } catch (e) {
      c.toast(e.message);
      await refreshChats(c, session).catch(() => {});
      if (c.state.foodTab === "chats" && session.host.isConnected)
        chatsView(c, c.$("#food-body"), session.chats, session);
    }
  }
  async function openShared(c,id,host,isCurrent=()=>true) {
    disconnect();
    const session={host,owner:c.state.user.id,chats:{items:[],unread_count:0}};
    active=session;host.innerHTML='<p role="status">Cargando conversación…</p>';
    const current=()=>active===session&&host.isConnected&&c.state.view==='messages'&&c.state.user?.id===session.owner&&isCurrent();
    const chat=await call(c,'/chats/'+encodeURIComponent(id));
    if(!current())return;
    chatDialog(c,chat,session,host);
    connectChatEvents(c,session,current);
    session.detailTimer=setInterval(()=>{if(current()&&!document.hidden)session.openChat?.refresh();else if(!current())clearInterval(session.detailTimer);},5000);
  }
  function chatDialog(c, initialChat, session, inlineHost=null) {
    if (session.openChat?.dialog?.open) session.openChat.dialog.close();
    let chat = initialChat,
      refreshing = false,
      sending = false,
      countdown;
    const createChat=inlineHost?html=>{const el=document.createElement('div');el.className='shared-food-chat';el.innerHTML=html;el.open=true;el.close=()=>{if(!el.open)return;el.open=false;el.dispatchEvent(new Event('close'));el.remove();};inlineHost.replaceChildren(el);return el;}:c.dialog;
    const d = createChat(
      `<div class="dialog-content chat-dialog"><header class="chat-dialog-head"><div><span class="eyebrow">CHAT TEMPORAL · ${c.esc(chat.business_name)}</span><h2>${c.esc(chat.product_name)}</h2>${window.FIT_PRESENCE?.badge(chat.counterpart_id)||''}<p>${c.icon("pin")}${c.esc(chat.pickup_location)}</p></div><span class="chat-live-badge">12 h</span></header><div class="chat-expiry-banner">${c.icon("chat")}<div><strong>Esta conversación dura 12 horas</strong><span>Al terminar se retira el chat.</span></div><time id="chat-countdown"></time></div><div id="chat-order-state"></div><div class="chat-messages" id="chat-messages" role="log" aria-live="polite" aria-label="Mensajes del chat"></div><div id="chat-error" class="field-error" role="alert"></div><form class="chat-composer" id="chat-composer"><label class="chat-image-button" title="Enviar imagen">${c.icon("photo")}<span class="screen-reader">Enviar imagen</span><input id="chat-image" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><textarea id="chat-text" maxlength="1200" rows="1" placeholder="Escribe un mensaje…" aria-label="Mensaje"></textarea><button class="chat-send-button" type="submit" aria-label="Enviar mensaje">${c.icon("send")}</button></form><div class="chat-bottom"><small>Solo imágenes JPG, PNG o WebP de hasta 5 MB. No se permiten otros archivos.</small><div class="button-row" id="chat-actions"></div></div><div id="chat-order-panel" hidden></div></div>`,
    );
    const messages = d.querySelector("#chat-messages"),
      textBox = d.querySelector("#chat-text"),
      imageInput = d.querySelector("#chat-image"),
      composer = d.querySelector("#chat-composer"),
      errorBox = d.querySelector("#chat-error"),
      actions = d.querySelector("#chat-actions"),
      orderState = d.querySelector("#chat-order-state"),
      orderPanel = d.querySelector("#chat-order-panel");

    const renderMessages = () => {
      const wasNearBottom =
        messages.scrollHeight - messages.scrollTop - messages.clientHeight < 100;
      messages.innerHTML = chat.messages.length
        ? chat.messages
            .map(
              (message) =>
                `<div class="chat-message-row ${message.mine ? "mine" : "theirs"}"><div class="chat-bubble ${message.kind === "image" ? "image" : ""}">${
                  message.kind === "image"
                    ? `<a href="${c.esc(message.image_url)}" target="_blank" rel="noopener"><img src="${c.esc(message.image_url)}" alt="Imagen compartida en el chat" loading="lazy"></a>`
                    : `<p>${c.esc(message.text).replace(/\n/g, "<br>")}</p>`
                }<time>${new Date(message.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</time></div></div>`,
            )
            .join("")
        : `<div class="chat-empty"><div class="icon-circle">${c.icon("chat")}</div><strong>Inicia la conversación</strong><p>${chat.role === "buyer" ? "Pregunta si el vendedor está disponible, si tiene más productos o cualquier detalle antes de pedir." : "El comprador abrió este chat para consultar antes de hacer su pedido."}</p>${chat.role === "buyer" ? '<div class="chat-suggestions"><button type="button" data-chat-suggestion="¿Sigues vendiendo ahorita?">¿Sigues vendiendo ahorita?</button><button type="button" data-chat-suggestion="¿Qué otros productos tienes disponibles?">¿Qué otros productos tienes?</button></div>' : ""}</div>`;
      messages.querySelectorAll("[data-chat-suggestion]").forEach(
        (button) =>
          (button.onclick = () => {
            textBox.value = button.dataset.chatSuggestion;
            textBox.focus();
          }),
      );
      messages.querySelectorAll("img").forEach((img) => {
        img.onerror = () => {
          img.closest(".chat-bubble").innerHTML =
            '<p class="hint">Imagen temporal no disponible.</p>';
        };
      });
      if (wasNearBottom || chat.messages.length <= 1)
        messages.scrollTop = messages.scrollHeight;
    };
    let orderSignature='',orderLoading=false;
    const renderOrderState = async () => {
      if(!chat.order_id){
        actions.innerHTML=chat.role==='buyer'?'<button class="btn small" id="chat-order-action">Ordenar este producto</button>':'';
        actions.querySelector('button')?.addEventListener('click',openOrderComposer);return;
      }
      actions.innerHTML='';
      if(orderLoading)return;orderLoading=true;
      try {
        const o=await call(c,'/orders/'+encodeURIComponent(chat.order_id));
        if(!d.isConnected||!d.open)return;
        const signature=JSON.stringify([o.id,o.status,o.total_cents]);
        if(signature===orderSignature)return;orderSignature=signature;
        const seller=chat.role==='seller';
        orderState.innerHTML=`<section class="shared-order-card" aria-label="Pedido y seguimiento"><div class="section-heading"><strong>${c.esc(o.product_name)} · ${money(o.total_cents)}</strong><span class="order-status ${c.esc(o.status)}">${c.esc(F.names[o.status]||o.status)}</span></div>${progress(c,o)}<p class="order-next">${c.esc(F.hints[seller?'seller':'buyer'][o.status]||'')}</p><small>${c.esc(F.quantity(o))} · ${c.esc(o.pickup_location)}</small>${o.note?`<p class="hint">Nota: ${c.esc(o.note)}</p>`:''}<div class="button-row">${o.status==='ready'?'<button class="btn small" type="button" data-inline-qr>'+ (seller?'Mostrar QR de entrega':'Escanear entrega')+'</button>':''}${F.actions(o.status,seller).map(([status,title])=>`<button type="button" class="btn ${['rejected','cancelled'].includes(status)?'secondary':''} small" data-inline-status="${status}">${c.esc(title)}</button>`).join('')}${!seller&&o.status==='completed'?'<button class="btn small" type="button" data-inline-rate>⭐ Calificar compra</button><button class="btn small" type="button" data-inline-buy-again>🛒 Comprar nuevamente</button><button class="btn small secondary" type="button" data-inline-history>📋 Ver pedido</button>':''}</div></section>`;
        orderState.querySelector('[data-inline-qr]')?.addEventListener('click',()=>root.FIT_FOOD_DELIVERY.open(c,o,seller,async()=>{orderSignature='';await renderOrderState();}));
        orderState.querySelectorAll('[data-inline-status]').forEach(b=>b.onclick=async()=>{
          const status=b.dataset.inlineStatus;
          if(['completed','rejected','cancelled'].includes(status)&&!confirm(status==='completed'?'¿El cliente ya recibió su pedido?':'¿Confirmas cancelar este pedido?'))return;
          b.disabled=true;
          try{await call(c,'/orders/'+o.id,'PATCH',{status});orderSignature='';await renderOrderState();c.poll();}
          catch(e){errorBox.textContent=e.message;b.disabled=false;}
        });
        orderState.querySelector('[data-inline-rate]')?.addEventListener('click',()=>root.FIT_PURCHASE_RATING.open(c,o.id));
        orderState.querySelector('[data-inline-buy-again]')?.addEventListener('click',()=>{
          const item=document.querySelector(`[data-order-product="${o.product_id}"]`);
          item?.scrollIntoView({behavior:'smooth',block:'center'});
        });
        orderState.querySelector('[data-inline-history]')?.addEventListener('click',()=>{
          orderState.innerHTML += '<p class="hint">Pedido completado guardado en historial.</p>';
        });
      }catch(e){if(!orderSignature)orderState.innerHTML=`<p role="status">No se pudo actualizar el pedido. Reintentando…</p>`;}
      finally{orderLoading=false;}
    };
    const setExpired = () => {
      textBox.disabled = true;
      imageInput.disabled = true;
      composer.querySelector("button").disabled = true;
      d.querySelector(".chat-image-button").classList.add("disabled");
      actions.querySelectorAll("button").forEach((button) => (button.disabled = true));
      errorBox.textContent =
        "Este chat temporal terminó. Puedes iniciar uno nuevo desde el producto si continúa disponible.";
    };
    const updateCountdown = () => {
      const time = d.querySelector("#chat-countdown");
      if (!time) return;
      time.textContent = chatRemaining(chat.expires_at);
      if (new Date(chat.expires_at).getTime() <= Date.now()) setExpired();
    };
    const markRead = async () => {
      if (!chat.unread_count) return;
      await call(c, "/chats/" + chat.id + "/read", "POST", {});
      chat.unread_count = 0;
      c.poll();
      await refreshChats(c, session).catch(() => {});
    };
    const refresh = async () => {
      if (refreshing || !d.isConnected || !d.open) return;
      refreshing = true;
      try {
        chat = await call(c, "/chats/" + encodeURIComponent(chat.id));
        renderMessages();
        renderOrderState();
        updateCountdown();
        await markRead();
      } catch (e) {
        errorBox.textContent = e.message;
        if(new Date(chat.expires_at).getTime()<=Date.now()||/no encontrada|vencida/i.test(e.message))setExpired();
      } finally {
        refreshing = false;
      }
    };
    const draftKey = 'fit-order-draft:' + c.state.user.id + ':' + chat.id;
    const readDraft = () => { try { const x=JSON.parse(sessionStorage.getItem(draftKey));return x && x.expires>Date.now()?x:null; } catch { return null; } };
    const saveDraft = (draft) => { try { sessionStorage.setItem(draftKey,JSON.stringify({...draft,expires:new Date(chat.expires_at).getTime()})); } catch {} };
    const closeOrderComposer = () => { orderPanel.hidden=true; d.querySelector('.chat-dialog').classList.remove('ordering'); };
    const openOrderComposer = async () => {
      if (chat.role !== "buyer" || chat.order_id) return;
      if (!orderPanel.hidden) return;
      orderPanel.hidden = false;
      d.querySelector(".chat-dialog").classList.add("ordering");
      orderPanel.innerHTML = '<div class="chat-order-loading" role="status">Cargando datos del producto…</div>';
      try {
        const catalog = await call(c, "/catalog"),
          p = catalog.products.find((item) => item.id === chat.product_id);
        if (!p) throw Error("Este producto ya no está disponible para nuevos pedidos.");
        const draft = readDraft();
        const requestId = draft?.requestId || crypto.randomUUID();
        orderPanel.innerHTML = `<div class="chat-order-compose"><div class="section-heading"><div><span class="eyebrow">TU SOLICITUD AL VENDEDOR</span><h3>${c.esc(p.name)}</h3></div><button type="button" class="text-button" id="close-chat-order">Cerrar</button></div><form id="chat-order-form"><label class="field">${p.sale_unit === "lot" ? "¿Cuántos lotes quieres?" : "¿Cuántas unidades quieres?"}<div class="quantity-control"><button type="button" class="btn secondary" data-chat-quantity="-1" aria-label="Quitar uno">−</button><input name="quantity" type="number" value="1" min="1" max="50" step="1" required><button type="button" class="btn secondary" data-chat-quantity="1" aria-label="Agregar uno">+</button></div></label><p class="hint">${money(p.price_cents)} MXN por ${sale(p)}.</p><label class="field">Nota para el vendedor <span class="hint">(opcional)</span><textarea name="note" maxlength="500" placeholder="Por ejemplo: sin cebolla"></textarea></label><div class="checkout-total"><span>Total del pedido</span><strong id="chat-order-total"></strong><small id="chat-order-pieces"></small></div><p class="hint">Revisa la cantidad y el total. Al enviar, el vendedor recibirá tu solicitud para aceptarla.</p><p role="alert" class="field-error"></p><button class="btn full" type="submit">Enviar solicitud al vendedor</button></form></div>`;
        d.querySelector("#close-chat-order").onclick = () => {
          closeOrderComposer();
          orderPanel.innerHTML = "";
        };
        const form = d.querySelector("#chat-order-form"),
          quantity = form.elements.quantity;
        quantity.value = draft?.quantity || '1';
        form.elements.note.value = draft?.note || '';
        const persist = () => saveDraft({quantity:quantity.value,note:form.elements.note.value,requestId});
        form.elements.note.oninput = persist;
        const total = () => {
          persist();
          const count = Number(quantity.value),
            valid = Number.isInteger(count) && count >= 1 && count <= 50;
          d.querySelector("#chat-order-total").textContent = valid
            ? `${money(count * p.price_cents)} MXN`
            : "Revisa la cantidad";
          d.querySelector("#chat-order-pieces").textContent =
            valid && p.sale_unit === "lot"
              ? `${count * p.units_per_lot} piezas en total`
              : "";
          d.querySelector('[data-chat-quantity="-1"]').disabled =
            !valid || count <= 1;
          d.querySelector('[data-chat-quantity="1"]').disabled =
            !valid || count >= 50;
        };
        quantity.oninput = total;
        d.querySelectorAll("[data-chat-quantity]").forEach(
          (button) =>
            (button.onclick = () => {
              quantity.value = Math.max(
                1,
                Math.min(
                  50,
                  Number(quantity.value || 1) + Number(button.dataset.chatQuantity),
                ),
              );
              total();
            }),
        );
        total();
        formTask(c, form, async (values) => {
          const order = await call(c, "/orders", "POST", {
            product_id: p.id,
            quantity: Number(values.quantity),
            note: values.note,
            request_id: requestId,
            expected_price_cents: p.price_cents,
            chat_id: chat.id,
          });
          chat.order_id = order.id;
          try { sessionStorage.removeItem(draftKey); } catch {}
          closeOrderComposer();
          orderPanel.innerHTML = "";
          renderOrderState();
          c.toast("Solicitud enviada al vendedor. Consulta su estado aquí mismo.");
          c.poll();
          await refreshChats(c, session).catch(() => {});
        });
      } catch (e) {
        closeOrderComposer();
        errorBox.textContent = e.message;
      }
    };

    composer.onsubmit = async (event) => {
      event.preventDefault();
      const value = textBox.value.trim();
      if (!value || sending) return;
      sending = true;
      composer.querySelector("button").disabled = true;
      errorBox.textContent = "";
      try {
        await call(c, "/chats/" + chat.id + "/messages", "POST", {
          text: value,
        });
        textBox.value = "";
        await refresh();
      } catch (e) {
        errorBox.textContent = e.message;
      } finally {
        sending = false;
        if (composer.querySelector("button").isConnected)
          composer.querySelector("button").disabled = false;
      }
    };
    textBox.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        composer.requestSubmit();
      }
    });
    imageInput.onchange = async () => {
      const file = imageInput.files?.[0];
      imageInput.value = "";
      if (!file || sending) return;
      if (
        file.size > 5242880 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      ) {
        errorBox.textContent = "Usa una imagen JPG, PNG o WebP de hasta 5 MB.";
        return;
      }
      sending = true;
      imageInput.disabled = true;
      d.querySelector(".chat-image-button").classList.add("uploading");
      errorBox.textContent = "";
      try {
        const data = new FormData();
        data.append("file", file);
        await call(c, "/chats/" + chat.id + "/images", "POST", data);
        await refresh();
      } catch (e) {
        errorBox.textContent = e.message;
      } finally {
        sending = false;
        imageInput.disabled = false;
        d.querySelector(".chat-image-button").classList.remove("uploading");
      }
    };

    renderMessages();
    renderOrderState();
    updateCountdown();
    markRead().catch(() => {});
    countdown = setInterval(updateCountdown, 30000);
    session.openChat = { id: chat.id, refresh, dialog: d };
    d.addEventListener(
      "close",
      () => {
        clearInterval(countdown);
        if (session.openChat?.id === chat.id) session.openChat = null;
        refreshChats(c, session)
          .then((latest) => {
            if (
              latest &&
              c.state.view === "food" && c.state.foodTab === "chats" &&
              session.host.isConnected
            )
              chatsView(c, c.$("#food-body"), latest, session);
          })
          .catch(() => {});
      },
      { once: true },
    );
  }
  function progress(c, o) {
    const index = F.steps.indexOf(o.status);
    if (index < 0) return "";
    return `<ol class="order-progress" aria-label="Seguimiento del pedido">${["Enviado", "Confirmado", "Listo", "Entregado"].map((name, i) => `<li class="${i <= index ? "done" : ""} ${i === index ? "current" : ""}" ${i === index ? 'aria-current="step"' : ""}><span>${i < index ? c.icon("check") : i + 1}</span><small>${name}</small></li>`).join("")}</ol>`;
  }
  function ordersView(c, body, orders, seller, refresh) {
    const key = seller ? "salesFilter" : "ordersFilter",
      filter = c.state[key] || "active";
    const filters = seller
      ? [
          ["active", "En curso"],
          ["requested", "Nuevos"],
          ["accepted", "En preparación"],
          ["ready", "Por entregar"],
          ["history", "Historial"],
          
        ]
      : [
          ["active", "En curso"],
          ["ready", "Para recoger"],
          ["history", "Historial"],
          
        ];
    const rows = F.sortOrders(
      orders.filter((o) => F.matches(o.status, filter)),
      seller,
    );
    const focus = c.state.foodFocusOrder;
    body.innerHTML = `<div class="section-heading"><div><span class="eyebrow">${seller ? "TUS VENTAS" : "TUS COMPRAS"}</span><h2>${seller ? "Pedidos de tus clientes" : "Lo que has pedido"}</h2><p class="hint">${seller ? "Primero confirma, después prepara y finalmente entrega." : "Consulta la respuesta del puesto y cuándo puedes recoger."}</p></div><button class="btn secondary small" id="refresh-orders">${c.icon("refresh")} Actualizar</button></div><div class="order-filters" aria-label="Filtrar pedidos">${filters.map(([id, label]) => `<button data-filter="${id}" class="${filter === id ? "active" : ""}" aria-pressed="${filter === id}">${label}<span>${orders.filter((o) => F.matches(o.status, id)).length}</span></button>`).join("")}</div><div class="order-list">${
      rows.length
        ? rows
            .map(
              (o) =>
                `<article class="panel order-card flow-order status-${o.status} ${focus === o.id ? "focused-order" : ""}" data-order-card="${o.id}" tabindex="-1"><div class="section-heading"><div><span class="eyebrow">${seller ? "CLIENTE" : "PUESTO"}</span><strong class="order-person">${c.esc(seller ? o.buyer_name : o.business_name)}</strong></div><span class="order-status ${o.status}">${F.names[o.status] || c.esc(o.status)}</span></div><div class="order-line"><div><h3>${c.esc(o.product_name)}</h3><p>${c.esc(F.quantity(o))}</p></div><strong class="order-amount">${money(o.total_cents)}<small>MXN</small></strong></div>${progress(c, o)}<p class="order-next">${c.esc(F.hints[seller ? "seller" : "buyer"][o.status] || "Consulta el estado de tu pedido.")}</p><details class="order-extra"><summary>Entrega y detalles</summary><p class="pickup">${c.icon("pin")}<span><b>Punto de entrega:</b> ${c.esc(o.pickup_location)}</span></p>${o.note ? `<p class="order-note"><b>Nota del cliente:</b> ${c.esc(o.note)}</p>` : ""}</details><div class="order-footer"><small>Pedido #${o.id.slice(0, 8)} · ${new Date(o.created_at).toLocaleString("es-MX")}</small><div class="button-row">${o.status==='ready'?`<button class="btn small" type="button" data-delivery-order="${o.id}">${seller?"Mostrar QR de entrega":"Escanear entrega"}</button>`:""}${!seller && o.status==='completed' ? `<button class="btn secondary small" data-rate-order="${o.id}">Valorar compra ★</button>` : ""}${o.chat_id ? `<button class="btn secondary small" data-order-chat="${o.chat_id}">${c.icon("chat")} Abrir chat</button>` : ""}${F.actions(
                  o.status,
                  seller,
                )
                  .map(
                    ([status, title]) =>
                      `<button class="btn ${["cancelled", "rejected"].includes(status) ? "secondary" : ""} small" data-status="${status}" data-id="${o.id}">${title}</button>`,
                  )
                  .join("")}</div></div></article>`,
            )
            .join("")
        : `${empty(c, filter === "history" ? "Todavía no hay pedidos finalizados" : "Todo al día por aquí", seller ? "Los pedidos de tus clientes aparecerán en Nuevos. También recibirás un aviso en la campana." : "Aquí aparecerá el seguimiento cuando solicites un producto.")}<button class="btn secondary" id="orders-empty-action">${seller ? "Ver mi puesto" : "Explorar productos"}</button>`
    }</div><p class="hint food-sync-note">Tus pedidos se actualizan automáticamente. También puedes seguirlos desde Mensajes.</p>`;
    body.querySelectorAll("[data-filter]").forEach(
      (b) =>
        (b.onclick = () => {
          c.state[key] = b.dataset.filter;
          c.state.foodFocusOrder = null;
          ordersView(c, body, orders, seller, refresh);
        }),
    );
    body.querySelectorAll("[data-delivery-order]").forEach(b=>b.onclick=()=>root.FIT_FOOD_DELIVERY.open(c,orders.find(o=>o.id===b.dataset.deliveryOrder),seller,refresh));
    body.querySelectorAll("[data-rate-order]").forEach(b=>b.onclick=()=>root.FIT_PURCHASE_RATING.open(c,b.dataset.rateOrder));
    act(c, body.querySelector("#refresh-orders"), async () => {
      await refresh();
      await c.poll();
    });
    const emptyButton = body.querySelector("#orders-empty-action");
    if (emptyButton)
      emptyButton.onclick = () => go(c, seller ? "mine" : "products");
    body.querySelectorAll("[data-order-chat]").forEach(
      (button) =>
        (button.onclick = () => openChat(c, button.dataset.orderChat, active)),
    );
    body.querySelectorAll("[data-status]").forEach((b) =>
      act(c, b, async () => {
        const order = orders.find((o) => o.id === b.dataset.id),
          next = b.dataset.status;
        const question =
          next === "completed"
            ? `¿${order.buyer_name} ya recibió ${order.product_name}?`
            : next === "rejected"
              ? `¿Confirmas que no puedes atender ${order.product_name}? Se avisará al cliente.`
              : next === "cancelled"
                ? `¿Cancelar tu pedido de ${order.product_name}?`
                : null;
        if (question && !confirm(question)) return;
        await call(c, "/orders/" + order.id, "PATCH", { status: next });
        await refresh();
        c.toast(
          next === "completed"
            ? "Entrega confirmada."
            : "Pedido actualizado. Se envió el aviso.",
        );
        c.poll();
      }),
    );
    if (focus) {
      const card = [...body.querySelectorAll("[data-order-card]")].find(
        (el) => el.dataset.orderCard === focus,
      );
      if (card) {
        card.focus({ preventScroll: true });
        card.scrollIntoView({ block: "nearest", behavior: "smooth" });
        c.state.foodFocusOrder = null;
      }
    }
  }
  function own(c, body, mine) {
    const v = mine.vendor;
    if (!v) {
      body.innerHTML = `<section class="panel seller-intro"><div class="icon-circle">${c.icon("store")}</div><h2>Empieza con tu puesto</h2><p>Usa esta misma cuenta para vender en la facultad.</p><ol class="seller-checklist"><li><b>1. Cuéntanos qué vendes</b><span>Nombre del puesto, punto de entrega y horario.</span></li><li><b>2. Prepara tu menú</b><span>Agrega productos y precios mientras revisan tu solicitud.</span></li><li><b>3. Atiende tus pedidos</b><span>Cuando aprueben el puesto, tus productos disponibles podrán solicitarse.</span></li></ol><button class="btn" id="vendor-start">Registrar mi puesto ${c.icon("arrow")}</button></section>`;
      body.querySelector("#vendor-start").onclick = () => vendorDialog(c);
      return;
    }
    const approved = v.status === "approved",
      editable = ["pending", "approved"].includes(v.status),
      online = approved && v.is_active !== false;
    const statusTitle =
      v.is_active === false
        ? "Puesto pausado"
        : approved
          ? "Puesto aprobado"
          : v.status === "pending"
            ? "Solicitud en revisión"
            : v.status === "rejected"
              ? "Corrige tu solicitud"
              : "Puesto suspendido";
    const explanation =
      v.is_active === false
        ? "Activa Alumno vendedor en Mi cuenta para volver a recibir pedidos. Puedes terminar las entregas pendientes."
        : approved
          ? "Tus productos marcados como disponibles aparecen en Explorar."
          : v.status === "pending"
            ? "Puedes preparar productos. Se mostrarán cuando el administrador apruebe el puesto."
            : v.review_source || "Revisa tu solicitud con el administrador.";
    const counts = summary(c).seller || {};
    body.innerHTML = `<section class="seller-overview"><div><span class="eyebrow">MI PUESTO</span><h2>${c.esc(v.business_name)}</h2>${window.FIT_PRESENCE?.badge(v.user_id)||''}<p class="pickup">${c.icon("pin")}${c.esc(v.pickup_location)}</p><p>${c.esc(v.hours_text || "Horario de atención por completar")}</p></div><div class="button-row"><button class="btn" id="own-sales">Ver pedidos recibidos <span class="food-count" data-food-count="seller" hidden></span></button><button class="btn secondary" id="edit-vendor" ${v.status === "suspended" ? "disabled" : ""}>Editar puesto</button></div></section><div class="seller-status ${online ? "online" : ""}"><strong>${statusTitle}</strong><p>${c.esc(explanation)}</p>${v.is_active === false ? '<button class="text-button" id="resume-account">Ir a Mi cuenta</button>' : ""}</div><div class="seller-metrics"><button data-sales-filter="requested"><strong data-food-metric="requested">${counts.requested || 0}</strong><span>Nuevos por confirmar</span></button><button data-sales-filter="accepted"><strong data-food-metric="accepted">${counts.accepted || 0}</strong><span>En preparación</span></button><button data-sales-filter="ready"><strong data-food-metric="ready">${counts.ready || 0}</strong><span>Listos por entregar</span></button></div><div class="section-heading"><div><h2>Mi menú</h2><p class="hint">${mine.products.length} productos · ${mine.products.filter((p) => p.available).length} marcados como disponibles</p></div><button class="btn" id="add-product" ${editable ? "" : "disabled"}>${c.icon("plus")} Agregar producto</button></div><div class="product-manage">${mine.products.length ? mine.products.map((p) => `<article class="panel menu-product"><div class="menu-thumbnail">${p.photo_url ? `<img src="${c.esc(p.photo_url)}" alt="${c.esc(p.name)}" loading="lazy">` : c.icon("food")}</div><div class="menu-product-info"><h3>${c.esc(p.name)}</h3><p><strong>${money(p.price_cents)} MXN</strong> por ${sale(p)}</p><span class="order-status ${online && p.available ? "ready" : "cancelled"}">${!p.available ? "Pausado" : online ? "Visible para compradores" : "Preparado · puesto sin publicar"}</span></div><div class="menu-product-actions"><button class="btn secondary small" data-edit-product="${p.id}" ${editable ? "" : "disabled"}>Editar</button><button class="btn secondary small" data-availability="${p.id}" ${editable ? "" : "disabled"}>${p.available ? "Pausar producto" : "Activar producto"}</button><button class="text-button danger" data-delete-product="${p.id}">Eliminar</button></div></article>`).join("") : empty(c, "Agrega tu primer producto", "Sube una foto, indica el precio por unidad o por lote y elige si está disponible.")}</div>`;
    body.querySelector("#own-sales").onclick = () => go(c, "sales");
    body.querySelector("#edit-vendor").onclick = () => vendorDialog(c, v);
    body.querySelector("#add-product").onclick = () => productDialog(c);
    const resume = body.querySelector("#resume-account");
    if (resume) resume.onclick = () => c.navigate("profile");
    body.querySelectorAll("[data-sales-filter]").forEach(
      (b) =>
        (b.onclick = () => {
          c.state.salesFilter = b.dataset.salesFilter;
          go(c, "sales");
        }),
    );
    body.querySelectorAll("[data-edit-product]").forEach(
      (b) =>
        (b.onclick = () =>
          productDialog(
            c,
            mine.products.find((p) => p.id === b.dataset.editProduct),
          )),
    );
    body.querySelectorAll("[data-availability]").forEach((b) =>
      act(c, b, async () => {
        const p = mine.products.find((p) => p.id === b.dataset.availability);
        await call(c, "/products/" + p.id, "PATCH", {
          name: p.name,
          description: p.description,
          photo_id: p.photo_id,
          price_cents: p.price_cents,
          sale_unit: p.sale_unit,
          units_per_lot: p.units_per_lot,
          available: !p.available,
        });
        c.toast(
          p.available
            ? "Producto pausado. Los pedidos anteriores se conservan."
            : "Producto disponible. Se mostrará si tu puesto está aprobado y activo.",
        );
        c.render();
      }),
    );
    body.querySelectorAll("[data-delete-product]").forEach((b) =>
      act(c, b, async () => {
        const p = mine.products.find((p) => p.id === b.dataset.deleteProduct);
        if (
          !confirm(
            `¿Eliminar ${p.name} del menú? Los pedidos anteriores se conservarán.`,
          )
        )
          return;
        await call(c, "/products/" + p.id, "DELETE");
        c.render();
      }),
    );
    updateSummary(c, { order_summary: summary(c) });
    images(body);
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
      `<div class="dialog-content"><h2>${p.id ? "Editar producto" : "Nuevo producto"}</h2><form><h3 class="food-form-step">1. Presenta tu producto</h3>${input(c, "name", "Nombre del producto", p.name, 'required minlength="2" maxlength="120"')}<label class="field">Descripción<textarea name="description" maxlength="600">${c.esc(p.description)}</textarea></label><label class="field">Fotografía (JPG, PNG o WebP, hasta 5 MB)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label><img id="product-preview" class="product-preview" ${p.photo_url ? `src="${c.esc(p.photo_url)}"` : "hidden"} alt="Vista previa del producto"><label class="check"><input type="checkbox" name="remove_photo"> Quitar fotografía actual</label><h3 class="food-form-step">2. Precio y presentación</h3><div class="form-grid">${input(c, "price", "Precio en MXN", p.price_cents ? p.price_cents / 100 : "", 'required type="number" min="0.01" max="10000" step="0.01"')}<label class="field">Forma de venta<select name="sale_unit"><option value="unit">Por unidad</option><option value="lot" ${p.sale_unit === "lot" ? "selected" : ""}>Por lote</option></select></label>${input(c, "units_per_lot", "Piezas por lote", p.units_per_lot || 2, 'type="number" min="2" max="1000" step="1"')}</div><p class="product-price-guide" id="product-price-guide" aria-live="polite"></p><h3 class="food-form-step">3. Disponibilidad</h3><label class="check"><input name="available" type="checkbox" ${p.available === false ? "" : "checked"}> Permitir que los compradores lo pidan</label><p class="hint">Puedes pausar el producto después. Será visible cuando tu puesto esté aprobado y activo.</p><p role="alert" class="field-error"></p><button class="btn full" type="submit">Guardar producto</button></form></div>`,
    );
    const f = d.querySelector("form");
    let preview;
    const units = () => {
      f.units_per_lot.closest("label").hidden = f.sale_unit.value !== "lot";
      f.units_per_lot.disabled = f.sale_unit.value !== "lot";
      const price = Number(f.price.value);
      d.querySelector("#product-price-guide").textContent =
        f.sale_unit.value === "lot"
          ? `El precio corresponde al lote completo de ${f.units_per_lot.value || "…"} piezas${price > 0 ? `: ${money(Math.round(price * 100))} MXN` : "."}`
          : `El precio corresponde a una sola unidad${price > 0 ? `: ${money(Math.round(price * 100))} MXN` : "."}`;
    };
    f.price.oninput = units;
    f.units_per_lot.oninput = units;
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
    const chatUnread = Number(data.chat_unread_count || 0);
    host.innerHTML = `<div class="section-heading"><p>Abre un aviso para ir directamente a su pedido.</p><div class="button-row"><button class="btn secondary small" id="refresh-notes">Actualizar</button><button class="btn small" id="read-all" ${data.unread_count ? "" : "disabled"}>Marcar todos leídos</button></div></div>${chatUnread ? `<div class="chat-notification-banner">${c.icon("chat")}<div><strong>${chatUnread} ${chatUnread === 1 ? "mensaje temporal nuevo" : "mensajes temporales nuevos"}</strong><span>Los chats de Comidas desaparecen automáticamente después de 12 horas.</span></div><button class="btn small" id="open-chat-notes">Ver chats</button></div>` : ""}${data.items.length ? `<div class="notification-list">${data.items.map((n) => `<article class="panel notification ${n.read_at ? "" : "unread"}"><div><span class="eyebrow">${n.read_at ? "LEÍDO" : "NUEVO"}</span><h3>${c.esc(n.title)}</h3><p>${c.esc(n.body)}</p>${n.order_status ? `<p class="hint">Estado actual: ${F.names[n.order_status] || c.esc(n.order_status)}</p>` : ""}<small class="muted">${new Date(n.created_at).toLocaleString("es-MX")}</small></div><div class="button-row">${F.destination(n) ? `<button class="btn small" data-open-note="${n.id}">${n.order_id ? "Ver pedido" : "Ver mi puesto"} ${c.icon("arrow")}</button>` : ""}${!n.read_at ? `<button class="btn secondary small" data-read="${n.id}">Marcar leído</button>` : ""}</div></article>`).join("")}</div>` : empty(c, chatUnread ? "No hay más avisos pendientes" : "Todo al día", chatUnread ? "Tus novedades restantes están en los chats temporales de Comidas." : "Aquí verás los pedidos nuevos, sus cambios y la revisión de tu puesto.")}`;
    host.querySelector("#refresh-notes").onclick = c.render;
    host.querySelector("#open-chat-notes")?.addEventListener("click", () =>
      go(c, "chats"),
    );
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
    host.querySelectorAll("[data-open-note]").forEach((b) =>
      act(c, b, async () => {
        const n = data.items.find((n) => n.id === b.dataset.openNote),
          target = F.destination(n);
        if (!n.read_at)
          await call(c, "/notifications/read", "PATCH", { ids: [n.id] });
        go(c, target.tab, target.orderId);
      }),
    );
  }
  function admin(c, host, rows) {
    const pending = rows.filter((v) => v.status === "pending").length;
    host.innerHTML = `<section class="panel"><div class="section-heading"><div><span class="eyebrow">VERIFICACIÓN DE COMIDAS</span><h2>Puestos registrados</h2><p class="hint">${pending ? `${pending} ${pending === 1 ? "puesto espera" : "puestos esperan"} revisión.` : "No hay puestos pendientes de revisión."}</p></div></div><div class="notice">Comprueba la identidad y el vínculo del vendedor con la facultad mediante una fuente autorizada. El correo confirmado por sí solo no acredita permiso para vender.</div></section>${rows.length ? rows.map((v) => `<article class="panel vendor-review"><div class="section-heading"><div><span class="badge ${v.status === "approved" ? "good" : "pending"}">${v.status === "pending" ? "Por verificar" : labels[v.status]}</span><h2>${c.esc(v.business_name)}</h2>${window.FIT_PRESENCE?.badge(v.user_id)||''}</div><div class="button-row"><button class="btn ${v.status === "pending" ? "" : "secondary"} small" data-review="${v.id}">${v.status === "pending" ? "Verificar puesto" : "Cambiar resolución"}</button><button class="text-button danger" data-remove-vendor="${v.id}">Eliminar puesto</button></div></div><p>${c.esc(v.full_name)} · ${c.esc(v.email)}</p><p>${c.esc(v.pickup_location)} · ${c.esc(v.hours_text)}</p><p>${c.esc(v.description)}</p>${v.review_source ? `<p class="hint">Última revisión: ${c.esc(v.review_source)}</p>` : ""}</article>`).join("") : empty(c, "Sin solicitudes", "Las altas de vendedores aparecerán aquí.")}`;
    host.querySelectorAll('[data-remove-vendor]').forEach(b=>b.onclick=async()=>{
      const vendor=rows.find(v=>v.id===b.dataset.removeVendor);
      if(!window.confirm('¿Eliminar el puesto '+vendor.business_name+'? Se retirarán sus productos del catálogo. Los pedidos y registros anteriores se conservarán.'))return;
      b.disabled=true;
      try{await call(c,'/admin/vendors/'+vendor.id,'DELETE');c.toast('Puesto eliminado del catálogo.');c.render();}
      catch(e){c.toast(e.message);b.disabled=false;}
    });
    host.querySelectorAll("[data-review]").forEach(
      (b) =>
        (b.onclick = () => {
          const v = rows.find((r) => r.id === b.dataset.review);
          const d = c.dialog(
            `<div class="dialog-content"><h2>Revisar ${c.esc(v.business_name)}</h2>${window.FIT_PRESENCE?.badge(v.user_id)||''}<form><label class="field">Resolución<select name="status"><option value="approved" ${v.status === "approved" ? "selected" : ""}>Aprobar vendedor</option><option value="rejected" ${v.status === "rejected" ? "selected" : ""}>Solicitar correcciones / rechazar</option><option value="suspended" ${v.status === "suspended" ? "selected" : ""}>Suspender puesto</option></select></label><label class="field">Fuente verificada o motivo<textarea name="source" required minlength="5" maxlength="600" placeholder="Fuente, responsable y fecha de la comprobación">${c.esc(v.review_source || "")}</textarea></label><p class="hint">El motivo de rechazo o suspensión se mostrará al vendedor. Evita incluir datos personales de terceros.</p><p role="alert" class="field-error"></p><button class="btn" type="submit">Guardar resolución</button></form></div>`,
          );
          formTask(c, d.querySelector("form"), async (values) => {
            await call(c, "/admin/vendors/" + v.id, "PATCH", values);
            finish(c, d, "Revisión guardada y aviso enviado al vendedor.");
          });
        }),
    );
  }

  async function updateNotifications(c, data) {
    updateSummary(c, data);
    updateChatCount(c, data.chat_unread_count);
    const session = active;
    if (
      !session ||
      !session.host.isConnected ||
      session.owner !== c.state.user?.id ||
      mutating ||
      document.querySelector("dialog[open]")
    )
      return;
    if (session.refresh) {
      // Refresh only the order surface, preserving the selected filter and the rest of the app.
      const revision = JSON.stringify(data.order_summary);
      if (revision !== session.revision) {
        await session.refresh();
        if (active === session) session.revision = revision;
      }
    } else if (
      c.state.view === "notifications" &&
      session.noteRevision !== JSON.stringify(data)
    ) {
      notifications(c, session.host, data);
      session.noteRevision = JSON.stringify(data);
    }
  }
  root.FIT_FOOD = { render, updateNotifications, disconnect, openShared, refreshShared:()=>active?.openChat?.refresh() };
})(window);
