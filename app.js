/** Public GIS Web client (same as workout). No secrets. */
const CLIENT_ID =
  "674439380543-atvndeqpa9tpli755h879qabar53jneo.apps.googleusercontent.com";

/** Private Drive file — ACL is the gate; ID is not a secret. Live alice.json. */
const FILE_ID = "1IWrrE6N3Iefj2Q-EOJQdEtQEa3cIbjpa";

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

/** Open-work order — matches Alice Canvas bands. */
const BANDS = ["Now", "Today", "Awaiting others", "Soon"];

const BAND_COLLAPSED_DEFAULT = {
  Now: false,
  Today: false,
  "Awaiting others": true,
  Soon: true,
  Done: false,
};

const LS_HIDE = "alice_hide_details";
const LS_COLLAPSE = "alice_band_collapsed";
const LS_THEME = "alice_theme"; // "light" | "dark" | null (= system)

const $ = (id) => document.getElementById(id);

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
}

function resolveTheme() {
  const saved = localStorage.getItem(LS_THEME);
  if (saved === "light" || saved === "dark") return saved;
  return systemPrefersDark() ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = $("theme-toggle");
  if (btn) btn.textContent = theme === "dark" ? "Light" : "Dark";
}

function toggleTheme() {
  const next = resolveTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(LS_THEME, next);
  applyTheme(next);
}

let state = {
  data: null,
  hideDetails: localStorage.getItem(LS_HIDE) === "1",
  bandCollapsed: loadCollapse(),
};

function loadCollapse() {
  try {
    return JSON.parse(localStorage.getItem(LS_COLLAPSE) || "{}");
  } catch {
    return {};
  }
}

function saveCollapse() {
  localStorage.setItem(LS_COLLAPSE, JSON.stringify(state.bandCollapsed));
}

function collapsedFor(band) {
  // Hide details hides done rows; when off, Done stays expanded for undo.
  if (band === "Done" && !state.hideDetails) return false;
  const v = state.bandCollapsed[band];
  return typeof v === "boolean" ? v : BAND_COLLAPSED_DEFAULT[band];
}

function toggleBand(band) {
  state.bandCollapsed[band] = !collapsedFor(band);
  saveCollapse();
  render();
}

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

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function markFor(status) {
  if (status === "done") return "[x]";
  if (status === "skip") return "[~]";
  return "[ ]";
}

function itemEl(item) {
  const el = document.createElement("article");
  el.className = `item ${item.status || "open"}`;
  const due = item.due ? `<div class="meta">${escapeHtml(item.due)}</div>` : "";
  const note = item.note
    ? `<div class="note">${escapeHtml(item.note)}</div>`
    : "";
  const skipPill =
    item.status === "skip" ? `<span class="pill">skip</span>` : "";
  el.innerHTML = `<div class="row-main"><span class="mark">${markFor(item.status)}</span><div><div class="title">${escapeHtml(item.title || item.id)}${skipPill}</div>${due}${note}</div></div>`;
  return el;
}

function bandBlock(label, count, items, key) {
  if (!count) return null;
  const collapsed = collapsedFor(key);
  const wrap = document.createElement("section");
  wrap.className = "band-block";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "band-toggle";
  btn.textContent = `${collapsed ? "▸" : "▾"} ${label} · ${count}`;
  btn.addEventListener("click", () => toggleBand(key));
  wrap.appendChild(btn);
  if (!collapsed) {
    for (const item of items) wrap.appendChild(itemEl(item));
  }
  return wrap;
}

function render() {
  const data = state.data;
  if (!data) return;

  const items = data.items || [];
  const root = $("list");
  root.innerHTML = "";

  const doneItems = items.filter(
    (i) => i.status === "done" || i.status === "skip",
  );
  const hiddenCount = items.filter((i) => i.status === "done").length;

  $("meta-row").hidden = false;
  $("last-sync").textContent = `Last sync: ${
    data.lastSync || data.updatedAt || "unknown — ask Alice to sync"
  }`;

  const hideLabel = $("hide-label");
  let hideText = "Hide details";
  if (state.hideDetails && hiddenCount > 0) hideText += ` · ${hiddenCount}`;
  hideLabel.textContent = hideText;

  const hideInput = $("hide-done");
  hideInput.checked = state.hideDetails;

  let any = false;
  for (const band of BANDS) {
    const bandItems = items.filter(
      (i) => i.band === band && i.status === "open",
    );
    const block = bandBlock(band, bandItems.length, bandItems, band);
    if (block) {
      root.appendChild(block);
      any = true;
    }
  }

  if (!state.hideDetails && doneItems.length) {
    const block = bandBlock("Done", doneItems.length, doneItems, "Done");
    if (block) {
      root.appendChild(block);
      any = true;
    }
  }

  if (!any) {
    root.innerHTML = `<p class="empty">No open items.</p>`;
  }

  const openN = items.filter((i) => i.status === "open").length;
  const bits = [`${openN} open`];
  if (doneItems.length && !state.hideDetails) bits.push(`${doneItems.length} done`);
  if (data.context) bits.push(data.context);
  setStatus(bits.join(" · "));
}

function wireChrome() {
  applyTheme(resolveTheme());
  $("theme-toggle").addEventListener("click", toggleTheme);
  window
    .matchMedia?.("(prefers-color-scheme: dark)")
    ?.addEventListener("change", () => {
      if (!localStorage.getItem(LS_THEME)) applyTheme(resolveTheme());
    });

  $("hide-done").addEventListener("change", (e) => {
    state.hideDetails = !!e.target.checked;
    localStorage.setItem(LS_HIDE, state.hideDetails ? "1" : "0");
    render();
  });
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
    state.data = await fetchAliceJson(token);
    render();
  } catch (err) {
    console.error(err);
    $("list").innerHTML = `<p class="err">${escapeHtml(err.message)}</p>`;
    $("login").hidden = false;
    $("meta-row").hidden = true;
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
  wireChrome();
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

  const silent = await requestToken(false);
  if (silent) await loadWithToken(silent);
}

boot();
