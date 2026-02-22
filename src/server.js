const express = require("express");
const { loadTools, getBundleFiles, toolsDir } = require("./data/tool-store");

const app = express();
app.use(express.json());

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
