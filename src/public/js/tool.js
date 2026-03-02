const toolName = document.getElementById("toolName");
const toolSummary = document.getElementById("toolSummary");
const toolDescription = document.getElementById("toolDescription");
const toolMeta = document.getElementById("toolMeta");
const toolSecrets = document.getElementById("toolSecrets");
const toolFiles = document.getElementById("toolFiles");

function formatFlag(label, value) {
  return value ? label : `No ${label.toLowerCase()}`;
}

function renderMeta(tool) {
  toolMeta.innerHTML = `
    <div class="row"><span>Version</span><strong>${tool.version}</strong></div>
    <div class="row"><span>Provider</span><strong>${tool.provider || "community"}</strong></div>
    <div class="row"><span>Payment</span><strong>${formatFlag("Uses payment", tool.usesPayment)}</strong></div>
    <div class="row"><span>Approval</span><strong>${formatFlag("Requires approval", tool.requiresApproval)}</strong></div>
  `;
}

function renderSecrets(secrets) {
  toolSecrets.innerHTML = "";
  if (!secrets || secrets.length === 0) {
    toolSecrets.innerHTML = '<span class="chip">None</span>';
    return;
  }
  secrets.forEach((secret) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = secret;
    toolSecrets.appendChild(chip);
  });
}

function renderFiles(files) {
  toolFiles.innerHTML = "";
  if (!files || files.length === 0) {
    toolFiles.innerHTML = '<div class="status">No files bundled for this tool.</div>';
    return;
  }
  files.forEach((file) => {
    const wrapper = document.createElement("div");
    wrapper.style.marginBottom = "16px";
    const title = document.createElement("div");
    title.style.marginBottom = "8px";
    title.style.fontWeight = "600";
    title.textContent = file.path;
    const block = document.createElement("pre");
    block.className = "code-block";
    block.textContent = file.content;
    wrapper.appendChild(title);
    wrapper.appendChild(block);
    toolFiles.appendChild(wrapper);
  });
}

async function loadTool() {
  const pathParts = window.location.pathname.split("/");
  const toolId = decodeURIComponent(pathParts[pathParts.length - 1] || "");
  if (!toolId) {
    toolSummary.textContent = "Missing tool identifier.";
    return;
  }

  try {
    const response = await fetch(`/v1/tools/${encodeURIComponent(toolId)}`);
    if (!response.ok) {
      toolSummary.textContent = "Tool not found.";
      return;
    }
    const tool = await response.json();
    toolName.textContent = tool.name || toolId;
    toolSummary.textContent = tool.summary || "Tool overview";
    toolDescription.textContent = tool.description || "No description provided.";
    renderMeta(tool);
    renderSecrets(tool.requiredSecrets || []);

    const bundleResponse = await fetch(
      `/v1/tools/${encodeURIComponent(toolId)}/versions/${encodeURIComponent(tool.version)}/bundle`
    );
    if (bundleResponse.ok) {
      const bundle = await bundleResponse.json();
      renderFiles(bundle.files || []);
    }
  } catch (error) {
    toolSummary.textContent = "Failed to load tool details.";
  }
}

loadTool();
