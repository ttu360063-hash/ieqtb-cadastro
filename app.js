import {
  clearAdminSession,
  clearRegistrations,
  exportRegistrationsAsCsv,
  getRegistrations,
  getRegistrationCount,
  isAdminAuthenticated,
  saveRegistration,
  setAdminSession,
} from "./scripts/storage.js";

const ADMIN_ACCESS_CODE = "ieqtb2026";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getFieldValue(form, name) {
  const field = form.elements.namedItem(name);
  if (!field || !("value" in field)) return "";
  return String(field.value).trim();
}

function setError(errors, name, message) {
  errors[name] = message;
}

function validateRegistration(form) {
  const errors = {};
  const name = getFieldValue(form, "name");
  const age = getFieldValue(form, "age");
  const email = getFieldValue(form, "email");
  const church = getFieldValue(form, "church");
  const phone = getFieldValue(form, "phone");

  if (name.length < 3) {
    setError(errors, "name", "Informe seu nome completo.");
  }

  const ageNumber = Number(age);
  if (!age || Number.isNaN(ageNumber) || ageNumber < 1 || ageNumber > 120) {
    setError(errors, "age", "Informe uma idade válida.");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setError(errors, "email", "Digite um e-mail válido.");
  }

  if (church.length < 2) {
    setError(errors, "church", "Informe o nome da igreja.");
  }

  const digitsOnly = phone.replace(/\D/g, "");
  if (digitsOnly.length < 10) {
    setError(errors, "phone", "Informe um telefone válido.");
  }

  return {
    errors,
    values: {
      name,
      age: ageNumber,
      email,
      church,
      phone,
    },
  };
}

function renderFieldErrors(form, errors) {
  const nodes = form.querySelectorAll("[data-error-for]");
  nodes.forEach((node) => {
    const key = node.getAttribute("data-error-for");
    node.textContent = errors[key] || "";
  });
}

function clearFieldErrors(form) {
  renderFieldErrors(form, {});
}

function createRegistrationRecord(values) {
  return {
    id: crypto.randomUUID(),
    name: values.name,
    age: values.age,
    email: values.email,
    church: values.church,
    phone: values.phone,
    createdAt: new Date().toISOString(),
  };
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatCreatedAt(createdAt) {
  try {
    return dateFormatter.format(new Date(createdAt));
  } catch {
    return createdAt;
  }
}

export function initHomePage() {
  const form = document.querySelector("#registrationForm");
  const totalCount = document.querySelector("#totalCount");
  const successBox = document.querySelector("#successBox");

  if (!form || !totalCount || !successBox) return;

  const updateCount = () => {
    totalCount.textContent = String(getRegistrationCount());
  };

  updateCount();

  form.addEventListener("input", () => {
    clearFieldErrors(form);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const result = validateRegistration(form);
    renderFieldErrors(form, result.errors);

    if (Object.keys(result.errors).length > 0) {
      successBox.hidden = true;
      return;
    }

    const registration = createRegistrationRecord(result.values);
    saveRegistration(registration);
    form.reset();
    clearFieldErrors(form);
    updateCount();

    successBox.hidden = false;
    successBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

function renderRegistrationRows(tbody, registrations) {
  tbody.innerHTML = "";

  if (registrations.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="6" class="empty-state">
        Nenhum cadastro foi salvo ainda.
      </td>
    `;
    tbody.appendChild(row);
    return;
  }

  registrations.forEach((registration) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <strong>${registration.name}</strong>
        <span>${registration.email}</span>
      </td>
      <td>${registration.age}</td>
      <td>${registration.church}</td>
      <td>${registration.phone}</td>
      <td>${formatCreatedAt(registration.createdAt)}</td>
      <td>${registration.id.slice(0, 8)}</td>
    `;
    tbody.appendChild(row);
  });
}

function refreshAdminStats(nodes) {
  const registrations = getRegistrations();
  nodes.count.textContent = String(registrations.length);
  nodes.status.textContent = isAdminAuthenticated()
    ? "Sessão administrativa ativa"
    : "Acesso restrito";
  renderRegistrationRows(nodes.tbody, registrations);
}

function renderAdminLogin(authCard, panel, statusMessage) {
  authCard.hidden = false;
  panel.hidden = true;
  statusMessage.textContent = "Digite o código para visualizar os cadastros.";
}

function renderAdminPanel(authCard, panel, statusMessage, nodes) {
  authCard.hidden = true;
  panel.hidden = false;
  statusMessage.textContent = "Você já pode consultar, exportar ou limpar os cadastros.";
  refreshAdminStats(nodes);
}

export function initAdminPage() {
  const root = document.querySelector("[data-admin-page]");
  if (!root) return;

  const authCard = document.querySelector("#adminAuthCard");
  const panel = document.querySelector("#adminPanel");
  const form = document.querySelector("#adminAuthForm");
  const codeInput = document.querySelector("#adminCode");
  const statusMessage = document.querySelector("#adminStatusMessage");
  const countNode = document.querySelector("#adminCount");
  const stateNode = document.querySelector("#adminState");
  const tbody = document.querySelector("#registrationsTableBody");
  const exportButton = document.querySelector("#exportCsvButton");
  const clearButton = document.querySelector("#clearRegistrationsButton");
  const logoutButton = document.querySelector("#logoutButton");

  if (
    !authCard ||
    !panel ||
    !form ||
    !codeInput ||
    !statusMessage ||
    !countNode ||
    !stateNode ||
    !tbody ||
    !exportButton ||
    !clearButton ||
    !logoutButton
  ) {
    return;
  }

  const nodes = {
    count: countNode,
    status: stateNode,
    tbody,
  };

  const syncView = () => {
    if (isAdminAuthenticated()) {
      renderAdminPanel(authCard, panel, statusMessage, nodes);
      return;
    }

    renderAdminLogin(authCard, panel, statusMessage);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = codeInput.value.trim().toLowerCase();

    if (code !== ADMIN_ACCESS_CODE) {
      statusMessage.textContent = "Código inválido. Tente novamente.";
      codeInput.focus();
      codeInput.select();
      return;
    }

    setAdminSession();
    codeInput.value = "";
    syncView();
  });

  exportButton.addEventListener("click", () => {
    const csv = exportRegistrationsAsCsv();
    downloadCsv("ieqtb-cadastros.csv", csv);
  });

  clearButton.addEventListener("click", () => {
    const confirmed = window.confirm(
      "Deseja apagar todos os cadastros salvos neste navegador?"
    );

    if (!confirmed) return;

    clearRegistrations();
    refreshAdminStats(nodes);
  });

  logoutButton.addEventListener("click", () => {
    clearAdminSession();
    syncView();
  });

  window.addEventListener("storage", () => {
    if (isAdminAuthenticated()) {
      refreshAdminStats(nodes);
    }
  });

  syncView();
}

initHomePage();
initAdminPage();
