import {
  clearAdminSession,
  clearRegistrations,
  deleteRegistration,
  exportRegistrationsAsCsv,
  getRegistrations,
  getRegistrationCount,
  isAdminAuthenticated,
  saveRegistration,
  setAdminSession,
} from "./scripts/storage.js";

const ADMIN_PASSWORD = "IEQTB1245";

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

// ============================================
// Admin Page Functions
// ============================================

function renderRegistrations(registrations, searchTerm = "") {
  const tbody = document.querySelector("#registrationsList");
  if (!tbody) return;

  let filtered = registrations;

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = registrations.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.email.toLowerCase().includes(term)
    );
  }

  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <strong>Nenhum cadastro encontrado</strong>
          ${
            searchTerm
              ? "Tente buscar por otro termo."
              : "Aún não há participantes cadastrados."
          }
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (r) => `
      <tr>
        <td>
          <span class="registration-name">${r.name}</span>
          <span class="registration-email">${r.email}</span>
        </td>
        <td>${r.age}</td>
        <td>${r.church}</td>
        <td>${r.phone}</td>
        <td class="registration-date">${formatCreatedAt(r.createdAt)}</td>
        <td>
          <button type="button" class="delete-btn" data-id="${r.id}">
            🗑️ Excluir
          </button>
        </td>
      </tr>
    `
    )
    .join("");

  tbody.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      if (confirm("Tem certeza que deseja excluir este participante?")) {
        deleteRegistration(id);
        refreshAdminTable();
      }
    });
  });
}

function refreshAdminTable() {
  const searchInput = document.querySelector("#searchInput");
  const searchTerm = searchInput ? searchInput.value : "";
  renderRegistrations(getRegistrations(), searchTerm);

  const countNode = document.querySelector("#totalCount");
  if (countNode) {
    countNode.textContent = String(getRegistrationCount());
  }
}

function showAdminPanel() {
  const authModal = document.querySelector("#authModal");
  const adminPanel = document.querySelector("#adminPanel");

  if (authModal) authModal.classList.add("hidden");
  if (adminPanel) adminPanel.classList.add("visible");

  refreshAdminTable();
}

function hideAdminPanel() {
  const authModal = document.querySelector("#authModal");
  const adminPanel = document.querySelector("#adminPanel");

  if (authModal) {
    authModal.classList.remove("hidden");
    authModal.style.display = "flex";
  }
  if (adminPanel) adminPanel.classList.remove("visible");
}

export function initAdminPage() {
  const root = document.querySelector("[data-admin-page]");
  if (!root) return;

  const authModal = document.querySelector("#authModal");
  if (!authModal) return;

  const authSubmit = document.querySelector("#authSubmit");
  const authError = document.querySelector("#authError");
  const passwordInput = document.querySelector("#adminPassword");
  const exportBtn = document.querySelector("#exportBtn");
  const logoutBtn = document.querySelector("#logoutBtn");
  const searchInput = document.querySelector("#searchInput");

  if (!authSubmit || !passwordInput) return;

authSubmit.addEventListener("click", () => {
    const password = passwordInput.value.trim();

    // Aceita senha em maiúsculas OU minúsculas (case-insensitive)
    if (password.toUpperCase() !== ADMIN_PASSWORD) {
      if (authError) authError.classList.add("visible");
      if (passwordInput) {
        passwordInput.classList.add("error");
        passwordInput.focus();
      }
      return;
    }

    if (authError) authError.classList.remove("visible");
    if (passwordInput) {
      passwordInput.classList.remove("error");
      passwordInput.value = "";
    }

    setAdminSession();
    showAdminPanel();
  });

  passwordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      authSubmit.click();
    }
  });

  passwordInput.addEventListener("input", () => {
    if (authError) authError.classList.remove("visible");
    if (passwordInput) passwordInput.classList.remove("error");
  });

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const csv = exportRegistrationsAsCsv();
      downloadCsv("ieqtb-cadastros.csv", csv);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearAdminSession();
      hideAdminPanel();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      refreshAdminTable();
    });
  }

  window.addEventListener("storage", () => {
    if (!isAdminAuthenticated()) {
      hideAdminPanel();
    } else {
      refreshAdminTable();
    }
  });
}

// ============================================
// Init pages
// ============================================

initHomePage();
initAdminPage();
