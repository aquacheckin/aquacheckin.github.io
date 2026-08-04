// ============================================================================
// Aqua-Checkin — HTML/JS rebuild backed by Firebase
// ----------------------------------------------------------------------------
// Employee directory is read LIVE (read-only) from the AQUALocator project.
// Check-ins and in-app "guests" are written to this app's own project.
// If firebase-config.js still has placeholder values, the app runs in a local
// "demo mode" backed by localStorage.
// ============================================================================

import { firebaseConfig, locatorConfig, locatorEmployeesPath, adminPin } from "./firebase-config.js";

const isConfigured =
  firebaseConfig &&
  firebaseConfig.projectId &&
  !String(firebaseConfig.projectId).startsWith("YOUR_");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

let toastTimer;
function toast(msg, isError = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

function personKey(p) {
  return `${(p.first || "").trim().toLowerCase()}|${(p.last || "").trim().toLowerCase()}`;
}

// Normalize an AQUALocator employee document into the app's shape.
function mapLocatorDoc(id, d) {
  if ((d.responsibilities || "").trim().toUpperCase() === "XXX") return null;
  let first = (d.First || "").trim();
  let last = (d.Last || "").trim();
  const name = (d.name || "").trim();
  if ((!first || !last) && name && name.toLowerCase() !== "n/a") {
    const parts = name.split(/\s+/);
    first = first || parts[0] || "";
    last = last || (parts.length > 1 ? parts[parts.length - 1] : "");
  }
  if (last.includes(",")) last = last.split(",")[0].trim();
  if (!first && !last) return null;
  return {
    id,
    first,
    last,
    dept: (d.dept || "").trim(),
    title: (d.title || "").trim(),
    ext: (d.ext || "").trim(),
    email: (d.email || "").trim(),
    source: "dir",
  };
}

// ---------------------------------------------------------------------------
// Data layer
// ---------------------------------------------------------------------------
const DataStore = isConfigured ? await makeFirebaseStore() : makeLocalStore();

async function makeFirebaseStore() {
  const { initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
  );
  const {
    getFirestore, collection, addDoc, onSnapshot, query, where, orderBy,
    serverTimestamp,
  } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
  );

  // Two Firebase apps: our own (checkins/guests) + AQUALocator (read-only dir).
  const checkinApp = initializeApp(firebaseConfig);
  const locatorApp = initializeApp(locatorConfig, "locator");
  const dbCheckin = getFirestore(checkinApp);
  const dbLocator = getFirestore(locatorApp);

  const employeesCol = collection(dbLocator, locatorEmployeesPath);
  const guestsCol = collection(dbCheckin, "guests");
  const checkinsCol = collection(dbCheckin, "checkins");
  const resetsCol = collection(dbCheckin, "resets");

  return {
    mode: "firebase",

    // Directory = AQUALocator employees + our own in-app guests, merged live.
    subscribeDirectory(cb) {
      let dir = [];
      let guests = [];
      const emit = () => {
        const merged = [...dir, ...guests];
        merged.sort((a, b) => (a.last || "").localeCompare(b.last || ""));
        cb(merged);
      };
      const u1 = onSnapshot(employeesCol, (snap) => {
        dir = snap.docs.map((d) => mapLocatorDoc(d.id, d.data())).filter(Boolean);
        emit();
      }, (e) => toast("Directory load error: " + e.message, true));
      const u2 = onSnapshot(guestsCol, (snap) => {
        guests = snap.docs.map((d) => ({ id: d.id, source: "guest", ...d.data() }));
        emit();
      }, () => { /* guests optional */ });
      return () => { u1(); u2(); };
    },

    subscribeTodayCheckins(cb) {
      const q = query(checkinsCol, where("date", "==", todayKey()));
      return onSnapshot(q, (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, (e) => toast("Report load error: " + e.message, true));
    },

    subscribeTodayResets(cb) {
      const q = query(resetsCol, where("date", "==", todayKey()));
      return onSnapshot(q, (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, () => { /* resets optional */ });
    },

    async addGuest(g) {
      await addDoc(guestsCol, g);
    },

    async addCheckin(rec) {
      await addDoc(checkinsCol, { ...rec, date: todayKey(), ts: serverTimestamp() });
    },

    async addReset() {
      await addDoc(resetsCol, { date: todayKey(), ts: serverTimestamp() });
    },
  };
}

function makeLocalStore() {
  const read = (k, def) => JSON.parse(localStorage.getItem(k) || JSON.stringify(def));
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const dirListeners = new Set();
  const chkListeners = new Set();
  const resListeners = new Set();
  const emitDir = () =>
    dirListeners.forEach((cb) => cb(read("aq_guests", []).map((g) => ({ source: "guest", ...g }))));
  const emitChk = () =>
    chkListeners.forEach((cb) => cb(read("aq_checkins", []).filter((c) => c.date === todayKey())));
  const emitRes = () =>
    resListeners.forEach((cb) => cb(read("aq_resets", []).filter((r) => r.date === todayKey())));

  return {
    mode: "local",
    subscribeDirectory(cb) { dirListeners.add(cb); emitDir(); return () => dirListeners.delete(cb); },
    subscribeTodayCheckins(cb) { chkListeners.add(cb); emitChk(); return () => chkListeners.delete(cb); },
    subscribeTodayResets(cb) { resListeners.add(cb); emitRes(); return () => resListeners.delete(cb); },
    async addGuest(g) {
      const list = read("aq_guests", []);
      list.push({ id: "g" + Date.now(), ...g });
      write("aq_guests", list); emitDir();
    },
    async addCheckin(rec) {
      const list = read("aq_checkins", []);
      list.push({ id: "c" + Date.now(), ...rec, date: todayKey(), ts: Date.now() });
      write("aq_checkins", list); emitChk();
    },
    async addReset() {
      const list = read("aq_resets", []);
      list.push({ id: "r" + Date.now(), date: todayKey(), ts: Date.now() });
      write("aq_resets", list); emitRes();
    },
  };
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let directory = [];      // merged employees + guests
let todayCheckins = [];
let filterStr = "";
let dirLoaded = false;
let resetTs = 0;         // check-ins at/before this are ignored (soft reset)
let adminUnlocked = sessionStorage.getItem("aq_admin") === "1";

function toMillis(ts) {
  return ts && ts.toMillis ? ts.toMillis() : (ts || 0);
}

function statusMap() {
  const map = new Map();
  for (const c of todayCheckins) {
    const t = toMillis(c.ts);
    if (t <= resetTs) continue; // ignore anything before the latest reset
    const k = personKey(c);
    const prev = map.get(k);
    if (!prev || t >= prev.t) map.set(k, { status: c.status, t, time: c.time });
  }
  return map;
}

// Everyone currently checked "in" today (shared by Report and Admin).
function computePresent() {
  const sm = statusMap();
  const present = [];
  const known = new Set();
  for (const p of directory) {
    const st = sm.get(personKey(p));
    if (st && st.status === "in") { present.push({ ...p, time: st.time }); known.add(personKey(p)); }
  }
  for (const [k, st] of sm) {
    if (st.status === "in" && !known.has(k)) {
      const c = todayCheckins.find((x) => personKey(x) === k);
      if (c) present.push({ first: c.first, last: c.last, dept: c.dept, time: st.time });
    }
  }
  present.sort((a, b) => (a.last || "").localeCompare(b.last || ""));
  return present;
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------
function initials(p) {
  const a = (p.first || "").trim(), b = (p.last || "").trim();
  return ((a[0] || "") + (b[0] || "")).toUpperCase() || "?";
}
function hueFor(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
function avatarHtml(p) {
  const cls = p.source === "guest" ? "avatar guest" : "avatar";
  return `<div class="${cls}" style="--h:${hueFor(personKey(p))}">${escapeHtml(initials(p))}</div>`;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderPeople() {
  const list = $("#peopleList");
  const empty = $("#peopleEmpty");
  const f = filterStr.trim().toLowerCase();

  const count = $("#resultCount");

  if (!f) {
    list.innerHTML = "";
    if (count) count.hidden = true;
    empty.style.display = "block";
    empty.textContent = dirLoaded
      ? "Type a name or department above to search the directory."
      : "Loading directory…";
    return;
  }
  empty.style.display = "none";

  const matches = directory.filter(
    (p) =>
      (p.first || "").toLowerCase().includes(f) ||
      (p.last || "").toLowerCase().includes(f) ||
      (p.dept || "").toLowerCase().includes(f)
  );

  if (count) {
    count.hidden = false;
    const capped = matches.length > 60 ? " · showing 60" : "";
    count.textContent = `${matches.length} ${matches.length === 1 ? "match" : "matches"}${capped}`;
  }

  if (!matches.length) {
    list.innerHTML = `<div class="empty">No match for “${escapeHtml(filterStr)}”.<br>Try a different spelling or
      <a href="#" data-goto="guest">add a guest</a>.</div>`;
    return;
  }

  const sm = statusMap();
  list.innerHTML = matches
    .slice(0, 60)
    .map((p) => {
      const st = sm.get(personKey(p));
      const badge = st
        ? `<span class="badge ${st.status}">${st.status === "in" ? "In" : "Out"}</span>`
        : "";
      const guestTag = p.source === "guest" ? '<span class="badge out">Guest</span>' : "";
      return `
      <li class="person">
        ${avatarHtml(p)}
        <div class="who">
          <div class="name">${escapeHtml(p.first)} ${escapeHtml(p.last)}${badge}${guestTag}</div>
          <div class="dept" data-dept="${escapeAttr(p.dept)}">${escapeHtml(p.dept || "")}</div>
        </div>
        <div class="acts">
          <button class="btn green small" data-act="in"  data-key="${p.id}">IN</button>
          <button class="btn red small"   data-act="out" data-key="${p.id}">OUT</button>
        </div>
      </li>`;
    })
    .join("");
}

function renderReport() {
  const body = $("#reportBody");
  const empty = $("#reportEmpty");
  const present = computePresent();

  $("#reportMeta").textContent =
    `${new Date().toLocaleDateString()} — ${present.length} checked in`;

  if (!present.length) {
    body.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  body.innerHTML = present
    .map(
      (p) => `<tr>
        <td>${escapeHtml(p.first)}</td>
        <td>${escapeHtml(p.last)}</td>
        <td>${escapeHtml(p.dept || "")}</td>
        <td>${escapeHtml(p.time || "")}</td>
      </tr>`
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Admin panel (PIN-gated)
// ---------------------------------------------------------------------------
function renderAdmin() {
  const locked = !adminUnlocked;
  $("#adminLocked").style.display = locked ? "block" : "none";
  $("#adminPanel").style.display = locked ? "none" : "block";
  $("#adminLockBtn").style.display = locked ? "none" : "inline-block";
  if (locked) { $("#pinInput").value = ""; setTimeout(() => $("#pinInput").focus(), 0); return; }

  const present = computePresent();
  $("#adminMeta").textContent =
    `${new Date().toLocaleDateString()} — ${present.length} currently checked in`;
  const list = $("#adminList");
  const empty = $("#adminEmpty");
  if (!present.length) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  list.innerHTML = present
    .map(
      (p) => `
      <li class="person">
        ${avatarHtml(p)}
        <div class="who">
          <div class="name">${escapeHtml(p.first)} ${escapeHtml(p.last)}
            <span class="badge in">In${p.time ? " · " + escapeHtml(p.time) : ""}</span></div>
          <div class="dept">${escapeHtml(p.dept || "")}</div>
        </div>
        <div class="acts">
          <button class="btn red small" data-admin-out
            data-first="${escapeAttr(p.first)}" data-last="${escapeAttr(p.last)}"
            data-dept="${escapeAttr(p.dept || "")}">Check out</button>
        </div>
      </li>`
    )
    .join("");
}

function unlockAdmin(e) {
  e.preventDefault();
  const val = $("#pinInput").value.trim();
  if (val && val === String(adminPin)) {
    adminUnlocked = true;
    sessionStorage.setItem("aq_admin", "1");
    renderAdmin();
  } else {
    toast("Incorrect PIN.", true);
    $("#pinInput").value = "";
  }
}

function lockAdmin() {
  adminUnlocked = false;
  sessionStorage.removeItem("aq_admin");
  renderAdmin();
}

async function resetToday() {
  if (!adminUnlocked) return;
  const present = computePresent();
  const msg = present.length
    ? `Reset today's roll call? All ${present.length} checked-in people will show as not checked in.\n\nThe check-in history is preserved — this only clears today's report.`
    : `Reset today's roll call? (No one is currently checked in.)\n\nThe check-in history is preserved.`;
  if (!window.confirm(msg)) return;
  const btn = $("#resetBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Resetting…';
  try {
    await DataStore.addReset();
    toast("Today's check-ins have been reset.");
  } catch (err) {
    toast("Could not reset: " + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Reset all check-ins for today";
  }
}

async function adminCheckOut(btn) {
  const rec = {
    first: btn.getAttribute("data-first"),
    last: btn.getAttribute("data-last"),
    dept: btn.getAttribute("data-dept"),
    status: "out",
    time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
  btn.disabled = true;
  try {
    await DataStore.addCheckin(rec);
    toast(`${rec.first} ${rec.last} checked out.`);
  } catch (e) {
    toast("Could not check out: " + e.message, true);
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function checkPerson(id, status) {
  const p = directory.find((e) => e.id === id);
  if (!p) return;
  const btns = $$(`[data-key="${id}"]`);
  btns.forEach((b) => (b.disabled = true));
  try {
    await DataStore.addCheckin({
      first: p.first,
      last: p.last,
      dept: p.dept || "",
      status,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    });
    toast(`${p.first} ${p.last} checked ${status.toUpperCase()}. Have a great day!`);
  } catch (e) {
    toast("Could not save check-in: " + e.message, true);
  } finally {
    btns.forEach((b) => (b.disabled = false));
  }
}

async function addGuest(e) {
  e.preventDefault();
  const first = $("#gFirst").value.trim();
  const last = $("#gLast").value.trim();
  const dept = $("#gDept").value.trim() || "Guest";
  if (!first || !last) return;
  const btn = $("#guestSubmit");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Adding…';
  try {
    await DataStore.addGuest({ first, last, dept, title: "Guest", ext: "", email: "" });
    toast(`${first} ${last} added. You can now check them in.`);
    $("#guestForm").reset();
    $("#gDept").value = "Guest";
    filterStr = last;
    $("#search").value = last;
    show("home");
    renderPeople();
  } catch (err) {
    toast("Could not add guest: " + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Add Guest";
  }
}

// ---------------------------------------------------------------------------
// View router
// ---------------------------------------------------------------------------
function show(name) {
  $$(".view").forEach((v) => v.classList.remove("active"));
  const el = $("#view-" + name);
  if (el) el.classList.add("active");
  if (name === "report") renderReport();
  if (name === "admin") renderAdmin();
  if (name === "home") $("#search").focus();
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
function wire() {
  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-goto]");
    if (nav) { e.preventDefault(); show(nav.getAttribute("data-goto")); return; }
    const act = e.target.closest("[data-act]");
    if (act) { checkPerson(act.getAttribute("data-key"), act.getAttribute("data-act")); return; }
    const adminOut = e.target.closest("[data-admin-out]");
    if (adminOut) { adminCheckOut(adminOut); return; }
    const dept = e.target.closest(".dept[data-dept]");
    if (dept) {
      filterStr = dept.getAttribute("data-dept") || "";
      $("#search").value = filterStr;
      renderPeople();
    }
  });

  const searchEl = $("#search");
  const clearEl = $("#searchClear");
  searchEl.addEventListener("input", (e) => {
    filterStr = e.target.value;
    if (clearEl) clearEl.hidden = filterStr.length === 0;
    renderPeople();
  });
  if (clearEl) {
    clearEl.addEventListener("click", () => {
      filterStr = "";
      searchEl.value = "";
      clearEl.hidden = true;
      renderPeople();
      searchEl.focus();
    });
  }
  $("#guestForm").addEventListener("submit", addGuest);
  $("#printBtn").addEventListener("click", () => window.print());
  $("#logo").addEventListener("click", () => location.reload());
  $("#pinForm").addEventListener("submit", unlockAdmin);
  $("#adminLockBtn").addEventListener("click", lockAdmin);
  $("#resetBtn").addEventListener("click", resetToday);

  if (!isConfigured) $("#configBanner").style.display = "block";
}

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------
function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
function escapeAttr(s = "") { return escapeHtml(s); }

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function boot() {
  wire();
  DataStore.subscribeDirectory((rows) => {
    directory = rows;
    dirLoaded = true;
    refreshActiveViews();
  });
  DataStore.subscribeTodayCheckins((rows) => {
    todayCheckins = rows;
    refreshActiveViews();
  });
  DataStore.subscribeTodayResets((rows) => {
    resetTs = rows.reduce((max, r) => Math.max(max, toMillis(r.ts)), 0);
    refreshActiveViews();
  });
}

function refreshActiveViews() {
  renderPeople();
  if ($("#view-report").classList.contains("active")) renderReport();
  if ($("#view-admin").classList.contains("active")) renderAdmin();
}

boot();
