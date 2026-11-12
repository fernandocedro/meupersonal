(() => {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const baseUrl = isLocal ? window.location.origin : "https://falling-art-9ea8.frcmxpx.workers.dev";
  window.MP_API_URL = (path) => `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
})();
