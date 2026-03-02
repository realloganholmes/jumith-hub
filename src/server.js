const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { loadTools, getBundleFiles, toolsDir } = require("./data/tool-store");

const app = express();
app.use(express.json());

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

const upload = multer({ storage: multer.memoryStorage() });

const PORT = Number(process.env.PORT) || 4000;

function buildManifest(tool, version) {
  return {
    id: tool.id,
    name: tool.name,
    version: version.version,
    summary: version.summary,
    description: version.description,
    tags: tool.tags,
    provider: tool.provider,
    entry: version.entry,
    schema: version.schema,
    usesPayment: version.usesPayment,
    requiresApproval: version.requiresApproval,
    requiredSecrets: version.requiredSecrets
  };
}

function makeError(code, message, details = {}) {
  return { error: { code, message, details } };
}

function normalizeQueryValue(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSlug(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
}

function summaryFromDescription(description) {
  if (!description) {
    return "";
  }
  const normalized = description.replace(/\s+/g, " ").trim();
  if (normalized.length <= 120) {
    return normalized;
  }
  return `${normalized.slice(0, 117)}...`;
}

function parseSecrets(value) {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(/[\n,]+/)
    .map((secret) => secret.trim())
    .filter(Boolean);
}

function nextVersion(versions) {
  if (!Array.isArray(versions) || versions.length === 0) {
    return "1.0.0";
  }
  const latest = versions[0];
  const parts = latest.version.split(".").map((part) => Number.parseInt(part, 10));
  const [major, minor, patch] = [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  return `${major}.${minor}.${patch + 1}`;
}

function loadToolsSafe(res) {
  try {
    return loadTools();
  } catch (error) {
    console.error("Failed to load tools:", error);
    res.status(500).json(
      makeError("INTERNAL_ERROR", "Failed to load tool registry", {
        toolsDir
      })
    );
    return null;
  }
}

app.get("/v1/tools/search", (req, res) => {
  const tools = loadToolsSafe(res);
  if (!tools) {
    return;
  }
  const q = normalizeQueryValue(req.query.q);
  const tagFilter = normalizeQueryValue(req.query.tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (!q && tagFilter.length === 0) {
    return res.status(400).json(
      makeError("INVALID_REQUEST", "Missing query parameter: q or tags", {
        fields: ["q", "tags"]
      })
    );
  }

  const limit = Math.min(Math.max(parseNumber(req.query.limit, 20), 1), 100);
  const offset = Math.max(parseNumber(req.query.offset, 0), 0);

  const filtered = tools.filter((tool) => {
    const latest = tool.versions[0];
    const searchTarget = `${tool.name} ${latest.summary}`.toLowerCase();
    const matchesQuery = q ? searchTarget.includes(q.toLowerCase()) : true;
    const matchesTags =
      tagFilter.length === 0 ||
      tagFilter.some((tag) => tool.tags.map((value) => value.toLowerCase()).includes(tag.toLowerCase()));
    return matchesQuery && matchesTags;
  });

  const results = filtered.slice(offset, offset + limit).map((tool) => {
    const latest = tool.versions[0];
    return {
      id: tool.id,
      name: tool.name,
      version: latest.version,
      summary: latest.summary,
      tags: tool.tags,
      provider: tool.provider,
      usesPayment: latest.usesPayment,
      requiresApproval: latest.requiresApproval,
      requiredSecrets: latest.requiredSecrets
    };
  });

  return res.json({ results, total: filtered.length });
});

app.get("/v1/tools/:id", (req, res) => {
  const tools = loadToolsSafe(res);
  if (!tools) {
    return;
  }
  const tool = tools.find((item) => item.id === req.params.id);
  if (!tool) {
    return res
      .status(404)
      .json(makeError("TOOL_NOT_FOUND", `Tool ${req.params.id} not found`));
  }

  const latest = tool.versions[0];
  return res.json(buildManifest(tool, latest));
});

app.get("/v1/tools", (req, res) => {
  const tools = loadToolsSafe(res);
  if (!tools) {
    return;
  }
  const q = normalizeQueryValue(req.query.q);
  const filtered = q
    ? tools.filter((tool) => {
        const latest = tool.versions[0];
        const searchTarget = `${tool.name} ${latest.summary} ${latest.description}`.toLowerCase();
        return searchTarget.includes(q.toLowerCase());
      })
    : tools;

  const results = filtered.map((tool) => {
    const latest = tool.versions[0];
    return {
      id: tool.id,
      name: tool.name,
      version: latest.version,
      summary: latest.summary,
      description: latest.description,
      tags: tool.tags,
      provider: tool.provider,
      usesPayment: latest.usesPayment,
      requiresApproval: latest.requiresApproval,
      requiredSecrets: latest.requiredSecrets
    };
  });

  return res.json({ results, total: results.length });
});

app.post("/v1/tools/upload", upload.single("file"), (req, res) => {
  const name = normalizeQueryValue(req.body.name);
  const description = normalizeQueryValue(req.body.description);
  const usesPayment = Boolean(req.body.uses_payment);
  const requiresApproval = Boolean(req.body.requires_approval);
  const requiredSecrets = parseSecrets(req.body.required_secrets);
  const file = req.file;

  if (!name || !description || !file) {
    return res.status(400).json(
      makeError("INVALID_REQUEST", "Missing required fields: name, description, file", {
        fields: ["name", "description", "file"]
      })
    );
  }

  const toolSlug = normalizeSlug(name);
  if (!toolSlug) {
    return res
      .status(400)
      .json(makeError("INVALID_REQUEST", "Tool name produced an invalid id"));
  }

  const extension = path.extname(file.originalname || "").toLowerCase();
  if (extension !== ".py") {
    return res
      .status(400)
      .json(makeError("INVALID_REQUEST", "Tool file must be a .py file"));
  }

  const tools = loadToolsSafe(res);
  if (!tools) {
    return;
  }

  const toolId = `tool:${toolSlug}`;
  const existing = tools.find((tool) => tool.id === toolId);
  const version = nextVersion(existing ? existing.versions : []);
  const versionDir = path.join(toolsDir, toolSlug, version);
  const filesDir = path.join(versionDir, "files");
  const entryFileName = file.originalname || `${toolSlug}.py`;
  const entryPath = path.join(filesDir, entryFileName);
  const manifestPath = path.join(versionDir, "manifest.json");

  try {
    fs.mkdirSync(filesDir, { recursive: true });
    fs.writeFileSync(entryPath, file.buffer);
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          id: toolId,
          name: toolSlug,
          version,
          summary: summaryFromDescription(description),
          description,
          tags: [],
          provider: "community",
          entry: {
            runtime: "python",
            main: `files/${entryFileName}`
          },
          schema: {
            input: { type: "object", properties: {} },
            output: { type: "object", properties: {} }
          },
          usesPayment,
          requiresApproval,
          requiredSecrets
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error("Failed to save tool upload:", error);
    return res
      .status(500)
      .json(makeError("INTERNAL_ERROR", "Failed to persist tool upload"));
  }

  return res.status(201).json({
    id: toolId,
    version,
    name: toolSlug
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/tools/:id", (req, res) => {
  res.sendFile(path.join(publicDir, "tool.html"));
});

app.get("/upload", (req, res) => {
  res.sendFile(path.join(publicDir, "upload.html"));
});

app.get("/v1/tools/:id/versions/:version/bundle", (req, res) => {
  const tools = loadToolsSafe(res);
  if (!tools) {
    return;
  }
  const tool = tools.find((item) => item.id === req.params.id);
  if (!tool) {
    return res
      .status(404)
      .json(makeError("TOOL_NOT_FOUND", `Tool ${req.params.id} not found`));
  }

  const version = tool.versions.find((item) => item.version === req.params.version);
  if (!version) {
    return res
      .status(404)
      .json(
        makeError(
          "VERSION_NOT_FOUND",
          `Version ${req.params.version} for tool ${req.params.id} not found`
        )
      );
  }

  let files;
  try {
    files = getBundleFiles(version);
  } catch (error) {
    console.error("Failed to build bundle:", error);
    return res
      .status(500)
      .json(makeError("INTERNAL_ERROR", "Failed to build tool bundle"));
  }

  return res.json({
    manifest: buildManifest(tool, version),
    files
  });
});

app.use((req, res) => {
  res.status(404).json(makeError("INVALID_REQUEST", "Unknown endpoint"));
});

app.listen(PORT, () => {
  console.log(`Registry hub running on http://localhost:${PORT}`);
});
