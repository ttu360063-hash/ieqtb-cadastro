import {
  saveRegistration,
  getRegistrations,
  getRegistrationCount,
  exportRegistrationsAsCsv,
  groupChurches,
  subscribeRealtime,
  unsubscribeRealtime,
} from "./scripts/supabase.js";

const ADMIN_PASSWORD = "IEQTB1248";

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
  const nome = getFieldValue(form, "name");
  const idade = getFieldValue(form, "age");
  const email = getFieldValue(form, "email");
  const igreja = getFieldValue(form, "church");
  const telefone = getFieldValue(form, "phone");

  if (nome.length < 3) {
    setError(errors, "name", "Informe seu nome completo.");
  }

  const idadeNumber = Number(idade);
  if (!idade || Number.isNaN(idadeNumber) || idadeNumber < 1 || idadeNumber > 120) {
    setError(errors, "age", "Informe uma idade válida.");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setError(errors, "email", "Digite um e-mail válido.");
  }

  if (igreja.length < 2) {
    setError(errors, "church", "Informe o nome da igreja.");
  }

  const digitsOnly = telefone.replace(/\D/g, "");
  if (digitsOnly.length < 10) {
    setError(errors, "phone", "Informe um telefone válido.");
  }

  return {
    errors,
    values: {
      nome,
      idade: idadeNumber,
      email: email.toLowerCase().trim(),
      igreja,
      telefone: telefone.replace(/\D/g, ""),
    },
  };
}

function renderFieldErrors(form, errors) {
  // Add data-error-for to inputs if not present
  const inputs = form.querySelectorAll('input');
  inputs.forEach(input => {
    if (!input.parentNode.querySelector('.error-msg')) {
      const errorSpan = document.createElement('span');
      errorSpan.className = 'error-msg';
      errorSpan.setAttribute('data-error-for', input.name);
      input.parentNode.appendChild(errorSpan);
    }
  });

  const nodes = form.querySelectorAll("[data-error-for]");
  nodes.forEach((node) => {
    const key = node.getAttribute("data-error-for");
    node.textContent = errors[key] || "";
    node.style.display = errors[key] ? 'block' : 'none';
  });
}

function clearFieldErrors(form) {
  renderFieldErrors(form, {});
}

function createRegistrationRecord(values) {
  return {
    nome: values.nome,
    idade: values.idade,
    email: values.email,
    igreja: values.igreja,
    telefone: values.telefone,
    created_at: new Date().toISOString(),
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
  const successBox = document.querySelector("#successBox");

  if (!form || !successBox) return;

  form.addEventListener("input", () => {
    clearFieldErrors(form);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const result = validateRegistration(form);
    renderFieldErrors(form, result.errors);

    if (Object.keys(result.errors).length > 0) {
      successBox.hidden = true;
      return;
    }

    try {
      const registration = createRegistrationRecord(result.values);
      await saveRegistration(registration);
      form.reset();
      clearFieldErrors(form);
      successBox.hidden = false;
      successBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao enviar inscrição. Tente novamente.');
    }
  });
}

function renderRegistrations(registrations) {
  const container = document.querySelector("#registrationsList");
  if (!container) return;

  // Sort by newest first
  registrations.sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));

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
    .map((r) => `
      <div class="reg-card">
        <div class="reg-card-head">
          <span class="reg-card-name">${r.nome || r.name}</span>
        </div>
        <div class="reg-detail">
          <span class="reg-detail-label">Idade</span>
          <span class="reg-detail-value">${(r.idade || r.age)} anos</span>
        </div>
        <div class="reg-detail">
          <span class="reg-detail-label">Email</span>
          <span class="reg-detail-value">${r.email}</span>
        </div>
        <div class="reg-detail">
          <span class="reg-detail-label">Igreja</span>
          <span class="reg-detail-value">${r.igreja || r.church}</span>
        </div>
        <div class="reg-detail">
          <span class="reg-detail-label">Telefone</span>
          <span class="reg-detail-value">${r.telefone || r.phone}</span>
        </div>
        <div class="reg-detail">
          <span class="reg-detail-label">Cadastrado em</span>
          <span class="reg-detail-value">${formatCreatedAt(r.created_at || r.createdAt)}</span>
        </div>
      </div>
    `)
    .join("");
}

async function refreshAdminTable() {
  try {
    const registrations = await getRegistrations();

    renderRegistrations(registrations);

    const countNode = document.querySelector("#totalCount");
    if (countNode) {
      const count = await getRegistrationCount();
      countNode.textContent = String(count);
    }
    
    const churchesNode = document.querySelector("#churchesCount");
    if (churchesNode && registrations.length > 0) {
      const uniqueChurchesCount = groupChurches(registrations);
      churchesNode.textContent = String(uniqueChurchesCount);
    }
  } catch (err) {
    console.error('Erro no refresh:', err);
  }
}

async function showAdminPanel() {
  const authScreen = document.querySelector("#authScreen");
  const adminPanel = document.querySelector("#adminPanel");

  if (authScreen) authScreen.style.display = "none";
  if (adminPanel) adminPanel.style.display = "flex";

  await refreshAdminTable();
  
  // Realtime subscription
  subscribeRealtime(() => refreshAdminTable());
}

function hideAdminPanel() {
  const authScreen = document.querySelector("#authScreen");
  const adminPanel = document.querySelector("#adminPanel");

  if (authScreen) {
    authScreen.style.display = "flex";
  }
  if (adminPanel) adminPanel.style.display = "none";
  
  unsubscribeRealtime();
}

export function initAdminPage() {
  const authScreen = document.querySelector("#authScreen");
  const adminPanel = document.querySelector("#adminPanel");
  
  if (!authScreen || !adminPanel) return;

  const ADMIN_SESSION_KEY = 'ieqtb_admin_session';
  let adminAuthenticated = false;

  function setAdminSession() {
    adminAuthenticated = true;
    localStorage.setItem(ADMIN_SESSION_KEY, 'true');
  }

  function clearAdminSession() {
    adminAuthenticated = false;
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }

  const loginBtn = document.querySelector("#loginBtn");
  const authError = document.querySelector("#authError");
  const passwordInput = document.querySelector("#passwordInput");
  const exportBtn = document.querySelector("#exportBtn");
  const logoutBtn = document.querySelector("#logoutBtn");

  if (!loginBtn || !passwordInput) return;

  loginBtn.addEventListener("click", async () => {
    const password = passwordInput.value.trim();

    if (password !== ADMIN_PASSWORD) {
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
    try {
      await showAdminPanel();
    } catch (error) {
      console.error('Erro ao mostrar painel:', error);
      alert('Erro ao acessar painel. Tente novamente.');
    }
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
    exportBtn.addEventListener("click", async () => {
      try {
        const csv = await exportRegistrationsAsCsv();
        downloadCsv("ieqtb-cadastros.csv", csv);
      } catch (err) {
        console.error('Erro no export:', err);
        alert('Erro ao gerar CSV');
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
    if (localStorage.getItem(ADMIN_SESSION_KEY) !== 'true') {
      hideAdminPanel();
    }
  });
}

// Init pages
initHomePage();
initAdminPage();

