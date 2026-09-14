/** Public GIS Web client (same as workout). No secrets. */
const CLIENT_ID =
  "674439380543-atvndeqpa9tpli755h879qabar53jneo.apps.googleusercontent.com";

/** Private Drive file — ACL is the gate; ID is not a secret. Live alice.json. */
const FILE_ID = "1IWrrE6N3Iefj2Q-EOJQdEtQEa3cIbjpa";

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const BAND_ORDER = ["Now", "Today", "Awaiting others", "Soon", "Later"];

const $ = (id) => document.getElementById(id);

function waitForGoogle() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve) => {
    const id = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(id);
        resolve();
      }
    }, 50);
  });
}

function setStatus(text) {
  $("status").textContent = text;
}

function render(data) {
  const root = $("list");
  root.innerHTML = "";
  const items = (data.items || []).filter((i) => i.status === "open");
  if (!items.length) {
    root.innerHTML = `<p class="empty">No open items.</p>`;
    return;
  }

  const byBand = new Map();
  for (const item of items) {
    const band = item.band || "Later";
    if (!byBand.has(band)) byBand.set(band, []);
    byBand.get(band).push(item);
  }

  const bands = [
    ...BAND_ORDER.filter((b) => byBand.has(b)),
    ...[...byBand.keys()].filter((b) => !BAND_ORDER.includes(b)),
  ];

  for (const band of bands) {
    const h = document.createElement("h2");
    h.className = "band";
    h.textContent = band;
    root.appendChild(h);
    for (const item of byBand.get(band)) {
      const el = document.createElement("article");
      el.className = "item";
      const due = item.due ? `<div class="meta">${escapeHtml(item.due)}</div>` : "";
      const note = item.note
        ? `<div class="note">${escapeHtml(item.note)}</div>`
        : "";
      el.innerHTML = `<div class="title">${escapeHtml(item.title || item.id)}</div>${due}${note}`;
      root.appendChild(el);
    }
  }

  const when = data.updatedAt
    ? new Date(data.updatedAt).toLocaleString()
    : "unknown";
  setStatus(`Loaded · ${data.source || "drive"} · ${when}`);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function fetchAliceJson(token) {
  const url = `https://www.googleapis.com/drive/v3/files/${FILE_ID}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive ${res.status}: ${text.slice(0, 180)}`);
  }
  return res.json();
}

async function loadWithToken(token) {
  setStatus("Loading Alice…");
  $("login").hidden = true;
  try {
    const data = await fetchAliceJson(token);
    render(data);
  } catch (err) {
    console.error(err);
    $("list").innerHTML = `<p class="err">${escapeHtml(err.message)}</p>`;
    $("login").hidden = false;
    setStatus("Could not load Drive file. Sign in again?");
  }
}

function requestToken(prompt) {
  return new Promise(async (resolve) => {
    await waitForGoogle();
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          resolve(null);
          return;
        }
        localStorage.setItem("alice_token", resp.access_token);
        localStorage.setItem(
          "alice_expiry",
          String(Date.now() + (resp.expires_in - 60) * 1000),
        );
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken(prompt ? { prompt: "consent" } : {});
  });
}

async function boot() {
  const login = $("login");
  login.hidden = false;
  login.addEventListener("click", async () => {
    setStatus("Signing in…");
    const token = await requestToken(true);
    if (!token) {
      setStatus("Sign-in failed or cancelled.");
      return;
    }
    await loadWithToken(token);
  });

  const cached = localStorage.getItem("alice_token");
  const expiry = parseInt(localStorage.getItem("alice_expiry") || "0", 10);
  if (cached && Date.now() < expiry) {
    await loadWithToken(cached);
    return;
  }

  // Silent refresh attempt (may fail until first explicit consent for Drive).
  const silent = await requestToken(false);
  if (silent) await loadWithToken(silent);
}

boot();
