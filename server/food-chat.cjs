const { randomUUID } = require("node:crypto");
const sharp = require("sharp");

const CHAT_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_TEXT = 1200;
const MAX_MESSAGES = 300;
const MAX_IMAGES_PER_CHAT = 24;
const MAX_TOTAL_IMAGE_BYTES = 64 * 1024 * 1024;
const MAX_STORED_IMAGE_BYTES = 1536 * 1024;

function chatError(status, message, code = "validation_error") {
  return Object.assign(new Error(message), { status, code });
}

function validImage(buffer, mime) {
  return (
    buffer &&
    ((mime === "image/png" &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (mime === "image/jpeg" &&
        buffer[0] === 255 &&
        buffer[1] === 216 &&
        buffer[2] === 255) ||
      (mime === "image/webp" &&
        buffer.subarray(0, 4).toString() === "RIFF" &&
        buffer.subarray(8, 12).toString() === "WEBP"))
  );
}

function createTemporaryFoodChat({ db }) {
  const chats = new Map();
  const streams = new Map();
  let storedImageBytes = 0;

  function removeChat(chat) {
    if (chat.expiry_timer) {
      clearTimeout(chat.expiry_timer);
      chat.expiry_timer = null;
    }
    for (const message of chat.messages) {
      if (message.image?.bytes) storedImageBytes -= message.image.bytes.length;
    }
    chats.delete(chat.id);
    notify(chat, "chat_expired");
  }

  function purgeExpired(now = Date.now()) {
    for (const chat of chats.values()) {
      if (chat.expires_ms <= now) removeChat(chat);
    }
  }

  function participant(chat, userId) {
    return chat.buyer_id === userId || chat.seller_user_id === userId;
  }

  function getChat(chatId, userId) {
    purgeExpired();
    const chat = chats.get(chatId);
    if (!chat || !participant(chat, userId))
      throw chatError(404, "Conversación no encontrada.", "not_found");
    if (chat.expires_ms <= Date.now()) {
      removeChat(chat);
      throw chatError(410, "Este chat temporal ya terminó.", "chat_expired");
    }
    return chat;
  }

  function messageFor(message, userId, chatId) {
    return {
      id: message.id,
      kind: message.kind,
      text: message.kind === "text" ? message.text : undefined,
      image_url:
        message.kind === "image"
          ? `/api/food/chats/${chatId}/images/${message.id}`
          : undefined,
      mine: message.sender_id === userId,
      created_at: message.created_at,
    };
  }

  function unreadFor(chat, userId) {
    const since = chat.read_at.get(userId) || 0;
    return chat.messages.filter(
      (message) =>
        message.sender_id !== userId && new Date(message.created_at).getTime() > since,
    ).length;
  }

  function summaryFor(chat, userId) {
    const seller = userId === chat.seller_user_id;
    const last = chat.messages.at(-1);
    return {
      id: chat.id,
      role: seller ? "seller" : "buyer",
      counterpart_name: seller ? chat.buyer_name : chat.business_name,
      business_name: chat.business_name,
      buyer_name: chat.buyer_name,
      product_id: chat.product_id,
      product_name: chat.product_name,
      pickup_location: chat.pickup_location,
      created_at: chat.created_at,
      expires_at: chat.expires_at,
      order_id: chat.order_id,
      unread_count: unreadFor(chat, userId),
      last_message: last
        ? {
            kind: last.kind,
            preview:
              last.kind === "image"
                ? "Imagen"
                : last.text.length > 80
                  ? last.text.slice(0, 77) + "…"
                  : last.text,
            mine: last.sender_id === userId,
            created_at: last.created_at,
          }
        : null,
    };
  }

  function detailFor(chat, userId) {
    return {
      ...summaryFor(chat, userId),
      messages: chat.messages.map((message) =>
        messageFor(message, userId, chat.id),
      ),
    };
  }

  function sendEvent(userId, payload) {
    const userStreams = streams.get(userId);
    if (!userStreams) return;
    const data = `event: chat\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const stream of [...userStreams]) {
      if (stream.res.writableEnded || stream.res.destroyed) {
        userStreams.delete(stream);
        continue;
      }
      try {
        stream.res.write(data);
      } catch {
        userStreams.delete(stream);
      }
    }
    if (!userStreams.size) streams.delete(userId);
  }

  function notify(chat, type, senderId = null) {
    for (const userId of [chat.buyer_id, chat.seller_user_id])
      sendEvent(userId, {
        type,
        chat_id: chat.id,
        from_self: senderId ? senderId === userId : false,
        expires_at: chat.expires_at,
      });
  }

  async function create(userId, productId) {
    purgeExpired();
    const product = (
      await db.query(
        "select p.id,p.vendor_id,p.name as product_name,v.user_id as seller_user_id,v.business_name,v.pickup_location,pr.full_name as buyer_name from food_products p join food_vendors v on v.id=p.vendor_id join profiles pr on pr.id=$2 where p.id=$1 and p.deleted_at is null and p.available=true and v.status='approved' and v.is_active=true",
        [productId, userId],
      )
    ).rows[0];
    if (!product)
      throw chatError(
        409,
        "El producto ya no está disponible. Actualiza el catálogo.",
        "conflict",
      );
    if (product.seller_user_id === userId)
      throw chatError(400, "No puedes abrir un chat con tu propio puesto.");

    const prior = [...chats.values()].find(
      (chat) =>
        chat.buyer_id === userId &&
        chat.product_id === productId &&
        chat.seller_user_id === product.seller_user_id &&
        chat.expires_ms > Date.now(),
    );
    if (prior) return detailFor(prior, userId);

    const activeForUser = [...chats.values()].filter(
      (chat) => participant(chat, userId) && chat.expires_ms > Date.now(),
    ).length;
    if (activeForUser >= 40)
      throw chatError(
        429,
        "Tienes demasiadas conversaciones temporales activas. Espera a que alguna termine.",
        "rate_limited",
      );

    const now = Date.now();
    const chat = {
      id: randomUUID(),
      buyer_id: userId,
      seller_user_id: product.seller_user_id,
      vendor_id: product.vendor_id,
      product_id: product.id,
      product_name: product.product_name,
      business_name: product.business_name,
      buyer_name: product.buyer_name,
      pickup_location: product.pickup_location,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + CHAT_TTL_MS).toISOString(),
      expires_ms: now + CHAT_TTL_MS,
      messages: [],
      read_at: new Map([
        [userId, now],
        [product.seller_user_id, 0],
      ]),
      order_id: null,
      updated_ms: now,
      expiry_timer: null,
    };
    chats.set(chat.id, chat);
    chat.expiry_timer = setTimeout(() => removeChat(chat), CHAT_TTL_MS);
    chat.expiry_timer.unref?.();
    notify(chat, "chat_created", userId);
    return detailFor(chat, userId);
  }

  function list(userId) {
    purgeExpired();
    const items = [...chats.values()]
      .filter((chat) => participant(chat, userId))
      .sort((a, b) => b.updated_ms - a.updated_ms)
      .map((chat) => summaryFor(chat, userId));
    return {
      items,
      unread_count: items.reduce((sum, chat) => sum + chat.unread_count, 0),
    };
  }

  function detail(userId, chatId) {
    return detailFor(getChat(chatId, userId), userId);
  }

  function read(userId, chatId) {
    const chat = getChat(chatId, userId);
    chat.read_at.set(userId, Date.now());
    return summaryFor(chat, userId);
  }

  function addText(userId, chatId, value) {
    const chat = getChat(chatId, userId);
    if (typeof value !== "string")
      throw chatError(400, "Escribe un mensaje antes de enviarlo.");
    const messageText = value.trim();
    if (!messageText || messageText.length > MAX_TEXT || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(messageText))
      throw chatError(400, `El mensaje debe tener entre 1 y ${MAX_TEXT} caracteres.`);
    if (chat.messages.length >= MAX_MESSAGES)
      throw chatError(
        409,
        "Esta conversación alcanzó su límite de mensajes. Puedes crear el pedido o esperar a que termine.",
        "conflict",
      );
    const message = {
      id: randomUUID(),
      kind: "text",
      text: messageText,
      sender_id: userId,
      created_at: new Date().toISOString(),
    };
    chat.messages.push(message);
    chat.updated_ms = Date.now();
    chat.read_at.set(userId, chat.updated_ms);
    notify(chat, "message", userId);
    return messageFor(message, userId, chat.id);
  }

  async function addImage(userId, chatId, file) {
    const chat = getChat(chatId, userId);
    if (!validImage(file?.buffer, file?.mimetype))
      throw chatError(
        400,
        "Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.",
      );
    if (chat.messages.length >= MAX_MESSAGES)
      throw chatError(409, "Esta conversación alcanzó su límite de mensajes.", "conflict");
    if (chat.messages.filter((message) => message.kind === "image").length >= MAX_IMAGES_PER_CHAT)
      throw chatError(409, "Puedes compartir hasta 24 imágenes en un chat temporal.", "conflict");

    let optimized;
    try {
      // Normalizamos primero y solo redimensionamos cuando realmente hace falta.
      // Esto evita fallos de libvips/Sharp con PNG muy pequeños o con canales
      // gris+alfa, y mantiene el resultado en WebP para no guardar el original.
      const metadata = await sharp(file.buffer, { animated: false, failOn: "none" }).metadata();
      if (!metadata.width || !metadata.height) throw new Error("Imagen sin dimensiones válidas");
      let pipeline = sharp(file.buffer, { animated: false, failOn: "none" }).rotate();
      if (metadata.width > 1280 || metadata.height > 1280) {
        pipeline = pipeline.resize({
          width: 1280,
          height: 1280,
          fit: "inside",
          withoutEnlargement: true,
        });
      }
      optimized = await pipeline
        .toColourspace("srgb")
        .webp({ quality: 78 })
        .toBuffer();
    } catch {
      // Segundo intento conservador: sin rotación ni resize. Algunos builds de
      // Sharp son más estrictos al transformar imágenes PNG mínimas.
      try {
        optimized = await sharp(file.buffer, { animated: false, failOn: "none" })
          .toColourspace("srgb")
          .webp({ quality: 78 })
          .toBuffer();
      } catch {
        throw chatError(400, "No pudimos procesar esa imagen. Usa JPG, PNG o WebP.");
      }
    }
    if (!optimized.length || optimized.length > MAX_STORED_IMAGE_BYTES)
      throw chatError(
        413,
        "La imagen sigue siendo demasiado pesada después de optimizarla.",
        "image_too_large",
      );
    if (storedImageBytes + optimized.length > MAX_TOTAL_IMAGE_BYTES)
      throw chatError(
        503,
        "El almacenamiento temporal de imágenes está ocupado. Inténtalo de nuevo en unos minutos.",
        "chat_storage_full",
      );

    const message = {
      id: randomUUID(),
      kind: "image",
      sender_id: userId,
      created_at: new Date().toISOString(),
      image: { mime: "image/webp", bytes: optimized },
    };
    chat.messages.push(message);
    storedImageBytes += optimized.length;
    chat.updated_ms = Date.now();
    chat.read_at.set(userId, chat.updated_ms);
    notify(chat, "message", userId);
    return messageFor(message, userId, chat.id);
  }

  function image(userId, chatId, messageId) {
    const chat = getChat(chatId, userId);
    const message = chat.messages.find(
      (item) => item.id === messageId && item.kind === "image",
    );
    if (!message)
      throw chatError(404, "Imagen temporal no disponible.", "not_found");
    return message.image;
  }

  function validateOrderLink(userId, chatId, productId) {
    const chat = getChat(chatId, userId);
    if (chat.buyer_id !== userId || chat.product_id !== productId)
      throw chatError(403, "Ese chat no corresponde a este pedido.", "forbidden");
    return chat;
  }

  function linkOrder(userId, chatId, orderId) {
    purgeExpired();
    const chat = chats.get(chatId);
    if (!chat || chat.buyer_id !== userId || chat.expires_ms <= Date.now())
      return false;
    chat.order_id = orderId;
    chat.updated_ms = Date.now();
    notify(chat, "order_linked", userId);
    return true;
  }

  function chatIdForOrder(userId, orderId) {
    purgeExpired();
    const chat = [...chats.values()].find(
      (item) => item.order_id === orderId && participant(item, userId),
    );
    return chat?.id || null;
  }

  function unreadCount(userId) {
    return list(userId).unread_count;
  }

  function connect(userId, sessionHash, res) {
    purgeExpired();
    const stream = { res, sessionHash };
    if (!streams.has(userId)) streams.set(userId, new Set());
    streams.get(userId).add(stream);
    res.set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
    res.write(
      `retry: 3000\nevent: ready\ndata: ${JSON.stringify({ type: "ready" })}\n\n`,
    );

    const heartbeat = setInterval(async () => {
      if (res.writableEnded || res.destroyed) return;
      try {
        if (sessionHash) {
          const alive = (
            await db.query(
              "select 1 from sessions where token_hash=$1 and expires_at>now()",
              [sessionHash],
            )
          ).rows.length;
          if (!alive) return res.end();
        }
        purgeExpired();
        res.write(
          `event: ping\ndata: ${JSON.stringify({ type: "ping", now: new Date().toISOString() })}\n\n`,
        );
      } catch {
        res.end();
      }
    }, 25000);
    heartbeat.unref?.();

    const close = () => {
      clearInterval(heartbeat);
      const set = streams.get(userId);
      set?.delete(stream);
      if (set && !set.size) streams.delete(userId);
    };
    res.on("close", close);
    res.on("finish", close);
  }

  return {
    create,
    list,
    detail,
    read,
    addText,
    addImage,
    image,
    validateOrderLink,
    linkOrder,
    chatIdForOrder,
    unreadCount,
    connect,
    purgeExpired,
  };
}

module.exports = {
  CHAT_TTL_MS,
  MAX_TEXT,
  createTemporaryFoodChat,
};
