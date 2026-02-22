const fs = require("fs");
const path = require("path");

const TOOLS_DIR = process.env.TOOLS_DIR
  ? path.resolve(process.env.TOOLS_DIR)
  : path.join(__dirname, "..", "..", "tools");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isDirectory(entry) {
  return entry.isDirectory();
}

function listDirectories(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter(isDirectory)
    .map((entry) => path.join(dirPath, entry.name));
}

function compareSemver(a, b) {
  const toParts = (value) =>
    value
      .split(".")
      .map((segment) => Number.parseInt(segment, 10))
      .map((segment) => (Number.isFinite(segment) ? segment : 0));
  const partsA = toParts(a);
  const partsB = toParts(b);
  const length = Math.max(partsA.length, partsB.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (partsB[index] || 0) - (partsA[index] || 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function loadTools() {
  const toolMap = new Map();
  const toolDirectories = listDirectories(TOOLS_DIR);

  toolDirectories.forEach((toolDir) => {
    const versionDirectories = listDirectories(toolDir);
    versionDirectories.forEach((versionDir) => {
      const manifestPath = path.join(versionDir, "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        return;
      }

      const manifest = readJson(manifestPath);
      if (!manifest || !manifest.id) {
        return;
      }

      const toolEntry =
        toolMap.get(manifest.id) || {
          id: manifest.id,
          name: manifest.name,
          provider: manifest.provider,
          tags: Array.isArray(manifest.tags) ? manifest.tags : [],
          versions: []
        };

      toolEntry.versions.push({
        version: manifest.version,
        summary: manifest.summary,
        description: manifest.description,
        entry: manifest.entry,
        schema: manifest.schema,
        requiresApproval: Boolean(manifest.requiresApproval),
        requiredSecrets: Array.isArray(manifest.requiredSecrets)
          ? manifest.requiredSecrets
          : [],
        sourceDir: versionDir,
        filesDir: path.join(versionDir, "files")
      });

      toolMap.set(manifest.id, toolEntry);
    });
  });

  const tools = Array.from(toolMap.values());
  tools.forEach((tool) => {
    tool.versions.sort((a, b) => compareSemver(a.version, b.version));
  });

  return tools;
}

function collectFiles(dirPath, files = []) {
  if (!fs.existsSync(dirPath)) {
    return files;
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  entries.forEach((entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectFiles(entryPath, files);
      return;
    }
    files.push(entryPath);
  });
  return files;
}

function isBinaryBuffer(buffer) {
  return buffer.includes(0);
}

function getBundleFiles(version) {
  const filesRoot = version.filesDir;
  const filePaths = collectFiles(filesRoot);
  return filePaths.map((filePath) => {
    const buffer = fs.readFileSync(filePath);
    const relative = path.relative(filesRoot, filePath).split(path.sep).join("/");
    if (isBinaryBuffer(buffer)) {
      return {
        path: relative,
        content: buffer.toString("base64"),
        encoding: "base64"
      };
    }
    return {
      path: relative,
      content: buffer.toString("utf8"),
      encoding: "utf8"
    };
  });
}

module.exports = {
  loadTools,
  getBundleFiles,
  toolsDir: TOOLS_DIR
};
