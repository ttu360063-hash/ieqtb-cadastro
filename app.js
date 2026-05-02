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

function renderRegistrations(registrations) {
  const container = document.querySelector("#registrationsList");
  if (!container) return;

  // Sort by newest first
  registrations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (registrations.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📋</span>
        <span class="empty-state-title">Nenhum cadastro encontrado</span>
        <span class="empty-state-text">Os participantes aparecerão aqui após se cadastrarem.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = registrations
    .map(
      (r) => `
      <div class="reg-card">
        <div class="reg-card-head">
          <span class="reg-card-name">${r.name}</span>
          <button type="button" class="reg-card-remove" data-id="${r.id}">
            🗑️
          </button>
        </div>
        <div class="reg-detail">
          <span class="reg-detail-label">Idade</span>
          <span class="reg-detail-value">${r.age} anos</span>
        </div>
        <div class="reg-detail">
          <span class="reg-detail-label">Email</span>
          <span class="reg-detail-value">${r.email}</span>
        </div>
        <div class="reg-detail">
          <span class="reg-detail-label">Igreja</span>
          <span class="reg-detail-value">${r.church}</span>
        </div>
        <div class="reg-detail">
          <span class="reg-detail-label">Telefone</span>
          <span class="reg-detail-value">${r.phone}</span>
        </div>
        <div class="reg-detail">
          <span class="reg-detail-label">Cadastrado em</span>
          <span class="reg-detail-value">${formatCreatedAt(r.createdAt)}</span>
        </div>
      </div>
    `
    )
    .join("");

  container.querySelectorAll(".reg-card-remove").forEach((btn) => {
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
  renderRegistrations(getRegistrations());

  const countNode = document.querySelector("#totalCount");
  if (countNode) {
    countNode.textContent = String(getRegistrationCount());
  }
}

function showAdminPanel() {
  const authScreen = document.querySelector("#authScreen");
  const adminPanel = document.querySelector("#adminPanel");

  if (authScreen) authScreen.style.display = "none";
  if (adminPanel) adminPanel.style.display = "flex";

  refreshAdminTable();
}

function hideAdminPanel() {
  const authScreen = document.querySelector("#authScreen");
  const adminPanel = document.querySelector("#adminPanel");

  if (authScreen) {
    authScreen.style.display = "flex";
  }
  if (adminPanel) adminPanel.style.display = "none";
}

export function initAdminPage() {
  const authScreen = document.querySelector("#authScreen");
  const adminPanel = document.querySelector("#adminPanel");
  
  if (!authScreen || !adminPanel) return;

  const loginBtn = document.querySelector("#loginBtn");
  const authError = document.querySelector("#authError");
  const passwordInput = document.querySelector("#passwordInput");
  const exportBtn = document.querySelector("#exportBtn");
  const logoutBtn = document.querySelector("#logoutBtn");
  const clearAllBtn = document.querySelector("#clearAllBtn");

  if (!loginBtn || !passwordInput) return;

// Always show auth screen first - no bypass
  // Session must be cleared before showing auth screen
  if (isAdminAuthenticated()) {
    clearAdminSession();
  }

  loginBtn.addEventListener("click", () => {
    const password = passwordInput.value.trim();

    // Case-insensitive password check
    if (password.toUpperCase() !== ADMIN_PASSWORD) {
      if (authError) authError.classList.add("show");
      if (passwordInput) {
        passwordInput.classList.add("fail");
        passwordInput.focus();
      }
      return;
    }

    if (authError) authError.classList.remove("show");
    if (passwordInput) {
      passwordInput.classList.remove("fail");
      passwordInput.value = "";
    }

    setAdminSession();
    showAdminPanel();
  });

  passwordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      loginBtn.click();
    }
  });

  passwordInput.addEventListener("input", () => {
    if (authError) authError.classList.remove("show");
    if (passwordInput) passwordInput.classList.remove("fail");
  });

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const csv = exportRegistrationsAsCsv();
      downloadCsv("ieqtb-cadastros.csv", csv);
    });
  }

  // Clear all data button
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => {
      if (confirm("⚠️ ATENÇÃO! Isso irá excluir TODOS os cadastros. Tem certeza?")) {
        clearRegistrations();
        refreshAdminTable();
        alert("Todos os cadastros foram excluídos.");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearAdminSession();
      hideAdminPanel();
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
