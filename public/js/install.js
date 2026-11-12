(() => {
  const button = document.querySelector("#install-app-button");
  if (!button) return;

  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (standalone) {
    button.hidden = true;
    return;
  }

  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    button.textContent = "Instalar aplicativo";
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    button.hidden = true;
  });

  button.addEventListener("click", async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      return;
    }

    const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const instructions = isAppleMobile
      ? "No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”."
      : "No Android, abra o menu do Chrome (⋮) e toque em “Instalar app” ou “Adicionar à tela inicial”.";
    const dialog = document.createElement("dialog");
    dialog.className = "install-app-dialog";
    dialog.innerHTML = `<form method="dialog"><h2>Instalar Meu Personal</h2><p>${instructions}</p><button class="btn primary">Entendi</button></form>`;
    document.body.append(dialog);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(error => {
        console.error("Não foi possível registrar o modo offline do app:", error);
      });
    }, { once: true });
  }
})();
