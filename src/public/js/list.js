const toolGrid = document.getElementById("toolGrid");
const searchInput = document.getElementById("searchInput");
const resultsCount = document.getElementById("resultsCount");
const emptyState = document.getElementById("emptyState");

let tools = [];

function formatFlag(label, value) {
  return value ? label : `No ${label.toLowerCase()}`;
}

function renderTools(list) {
  toolGrid.innerHTML = "";
  if (list.length === 0) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
  }

  list.forEach((tool) => {
    const card = document.createElement("div");
    card.className = "card tool-card";

    const tags = tool.tags && tool.tags.length ? tool.tags : ["untagged"];
    const requiredSecrets = tool.requiredSecrets || [];

    card.innerHTML = `
      <h3>${tool.name}</h3>
      <p>${tool.summary || tool.description || "No description provided."}</p>
      <div class="chip-row">
        ${tags.map((tag) => `<span class="chip">${tag}</span>`).join("")}
      </div>
      <div class="meta">
        <div class="row">
          <span>Version</span>
          <strong>${tool.version}</strong>
        </div>
        <div class="row">
          <span>Payment</span>
          <strong>${formatFlag("Uses payment", tool.usesPayment)}</strong>
        </div>
        <div class="row">
          <span>Approval</span>
          <strong>${formatFlag("Requires approval", tool.requiresApproval)}</strong>
        </div>
        <div class="row">
          <span>Secrets</span>
          <strong>${requiredSecrets.length}</strong>
        </div>
      </div>
      <div class="actions" style="margin-top: 16px;">
        <a class="button primary" href="/tools/${encodeURIComponent(tool.id)}">View tool</a>
      </div>
    `;

    toolGrid.appendChild(card);
  });
}

function updateResults(query) {
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? tools.filter((tool) => {
        const target = `${tool.name} ${tool.summary} ${tool.description}`.toLowerCase();
        return target.includes(normalized);
      })
    : tools;
  resultsCount.textContent = `${filtered.length} tool${filtered.length === 1 ? "" : "s"}`;
  renderTools(filtered);
}

async function loadTools() {
  try {
    const response = await fetch("/v1/tools");
    const data = await response.json();
    tools = Array.isArray(data.results) ? data.results : [];
  } catch (error) {
    tools = [];
  }
  updateResults("");
}

searchInput.addEventListener("input", (event) => {
  updateResults(event.target.value);
});

loadTools();
