const REGISTRATIONS_KEY = "ieqtb.registrations";
const ADMIN_SESSION_KEY = "ieqtb.admin.session";
const ADMIN_SESSION_VALUE = "allowed";

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function getRegistrations() {
  return readJson(REGISTRATIONS_KEY, []);
}

export function saveRegistration(registration) {
  const current = getRegistrations();
  const next = [registration, ...current];
  window.localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(next));
  return next;
}

export function deleteRegistration(id) {
  const current = getRegistrations();
  const next = current.filter((r) => r.id !== id);
  window.localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(next));
  return next;
}

export function clearRegistrations() {
  window.localStorage.removeItem(REGISTRATIONS_KEY);
}

export function getRegistrationCount() {
  return getRegistrations().length;
}

export function exportRegistrationsAsCsv() {
  const rows = getRegistrations();
  const headers = ["id", "nome", "idade", "email", "igreja", "telefone", "criadoEm"];
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.name,
        row.age,
        row.email,
        row.church,
        row.phone,
        row.createdAt,
      ]
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  ];

  return csvRows.join("\n");
}

export function setAdminSession() {
  window.localStorage.setItem(ADMIN_SESSION_KEY, ADMIN_SESSION_VALUE);
}

export function clearAdminSession() {
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
}

export function isAdminAuthenticated() {
  return window.localStorage.getItem(ADMIN_SESSION_KEY) === ADMIN_SESSION_VALUE;
}
