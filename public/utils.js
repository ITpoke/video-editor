const API_BASE = "";

async function apiPost(path, body, isFormData = false) {
  const opts = {
    method: "POST",
    body: isFormData ? body : JSON.stringify(body),
  };
  if (!isFormData) opts.headers = { "Content-Type": "application/json" };
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res;
}

async function apiPostJSON(path, body) {
  const res = await apiPost(path, body);
  return res.json();
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const mil = Math.floor((ms % 1000));
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(mil).padStart(3, "0")}`;
}

function pxToTime(px, zoom) {
  return (px / zoom) * 1000;
}

function timeToPx(ms, zoom) {
  return (ms / 1000) * zoom;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function createElement(tag, className, attrs = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v);
  });
  return el;
}
