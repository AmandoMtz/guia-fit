(function () {
  "use strict";
  window.addEventListener("DOMContentLoaded", () => {
    const toast = (message) => {
      const element = document.querySelector("#toast");
      element.textContent = message;
      element.classList.add("show");
      setTimeout(() => element.classList.remove("show"), 2600);
    };
    const gameContext = {
      state: {
        user: {
          id: "local-player",
          account_type: "student",
          email: "jugador@alumnos.uat.edu.mx",
        },
      },
      $: (selector) => document.querySelector(selector),
      toast,
    };
    window.FIT_OFFLINE_GAME.mount(gameContext);
    window.FIT_OFFLINE_GAME.render(gameContext);
  });
})();
