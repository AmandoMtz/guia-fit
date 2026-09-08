/* Cliente de la API propia alojada en Render. Las sesiones web usan cookies HttpOnly. */
(function (root) {
  class Query {
    constructor(client, table) {
      this.client = client;
      this.table = table;
      this.method = "GET";
      this.params = new URLSearchParams();
      this.body = undefined;
      this.one = false;
    }
    select() {
      return this;
    }
    order() {
      return this;
    }
    eq(key, value) {
      this.params.set(key, value);
      return this;
    }
    single() {
      this.one = true;
      return this;
    }
    maybeSingle() {
      this.one = true;
      return this;
    }
    insert(body) {
      this.method = "POST";
      this.body = body;
      return this;
    }
    update(body) {
      this.method = "PATCH";
      this.body = body;
      return this;
    }
    delete() {
      this.method = "DELETE";
      return this;
    }
    then(resolve, reject) {
      return this.client
        .request(
          "/api/data/" + encodeURIComponent(this.table) + "?" + this.params,
          this.method,
          this.body,
        )
        .then((result) => {
          if (this.one && result.data) result.data = result.data[0] || null;
          return result;
        })
        .then(resolve, reject);
    }
  }
  class ApiClient {
    constructor(base = "") {
      this.base = base.replace(/\/$/, "");
      this.listeners = [];
      this.recoveryToken = null;
      this.auth = {
        signInWithPassword: (body) =>
          this.request("/api/auth/login", "POST", body),
        signUp: ({ email, password, options }) =>
          this.request("/api/auth/register", "POST", {
            email,
            password,
            full_name: options.data.full_name,
          }),
        resetPasswordForEmail: (email) =>
          this.request("/api/auth/recover", "POST", { email }),
        resend: ({ email }) =>
          this.request("/api/auth/resend", "POST", { email }),
        getUser: () => this.request("/api/auth/me"),
        getSession: async () => {
          const result = await this.request("/api/auth/me");
          return result.error?.status === 401
            ? { data: { session: null } }
            : result.error
              ? result
              : { data: { session: result.data.user } };
        },
        updateUser: ({ password }) =>
          this.request("/api/auth/reset", "POST", {
            password,
            token: this.recoveryToken,
          }),
        signOut: async () => {
          const result = await this.request("/api/auth/logout", "POST", {});
          if (!result.error || result.error.status === 401) {
            this.listeners.forEach((fn) => fn("SIGNED_OUT"));
            return { data: {} };
          }
          return result;
        },
        onAuthStateChange: (fn) => this.listeners.push(fn),
      };
    }
    async request(path, method = "GET", body) {
      try {
        const res = await fetch(this.base + path, {
          method,
          credentials: "include",
          headers:
            body instanceof FormData
              ? { "X-FIT-Client": "web" }
              : { "Content-Type": "application/json", "X-FIT-Client": "web" },
          body:
            body === undefined
              ? undefined
              : body instanceof FormData
                ? body
                : JSON.stringify(body),
          signal: AbortSignal.timeout(25000),
        });
        const payload = await res.json();
        if (!res.ok) {
          payload.error = { ...(payload.error || {}), status: res.status };
          return payload;
        }
        return payload;
      } catch {
        return {
          error: {
            code: "network_error",
            message:
              "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.",
          },
        };
      }
    }
    from(table) {
      return new Query(this, table);
    }
    rpc(name, body) {
      return name === "verify_institutional_user"
        ? this.request("/api/admin/verify", "POST", body)
        : Promise.resolve({ error: { message: "Operación desconocida." } });
    }
    async uploadPhoto(file) {
      const data = new FormData();
      data.append("file", file);
      return this.request("/api/photos", "POST", data);
    }
    async processLink() {
      const params = new URLSearchParams(location.hash.slice(1));
      const token = params.get("token");
      const flow = new URLSearchParams(location.search).get("flow");
      if (!token) return null;
      history.replaceState(null, "", location.pathname);
      if (flow === "recovery") {
        this.recoveryToken = token;
        return { flow };
      }
      if (flow === "confirm") {
        const result = await this.request("/api/auth/confirm", "POST", {
          token,
        });
        return { flow, ...result };
      }
      return null;
    }
  }
  root.FIT_CLIENT = ApiClient;
})(window);
