# Registry API Specification (Jumith)

## Overview
The registry is a read-only HTTP JSON API that allows the local agent to:

1) Search for tools
2) Fetch tool metadata (schema, secrets, entrypoint)
3) Download tool code in a bundle format

The local runtime expects Node-runtime tools that export a Tool interface compatible
with the local Tool definition. Secrets are provided at execution time via a
ToolExecutionContext.env object; the registry must declare required secrets so the
local agent can prompt/store them.

---

## Base URL
Configurable by REGISTRY_BASE_URL on the client side.

All endpoints are under /v1.

---

## Tool Identity Model
- id: globally unique registry ID (string). Example: tool:email.send.
- name: human-friendly name (string). Example: email.send.
- version: semver string (e.g. 1.2.0).

---

## Endpoints

### 1) Search tools
GET /v1/tools/search

Query parameters
- q (string, required): search query
- limit (number, optional): default 20, max 100
- offset (number, optional): default 0
- tags (string, optional): comma-separated tag filter

Response 200
```json
{
  "results": [
    {
      "id": "tool:email.send",
      "name": "email.send",
      "version": "1.2.0",
      "summary": "Send transactional email",
      "tags": ["email", "smtp"],
      "provider": "acme",
      "requiresApproval": true,
      "requiredSecrets": ["smtp_user", "smtp_pass"]
    }
  ],
  "total": 42
}
```

Notes
- summary is required.
- requiresApproval and requiredSecrets are optional but should be provided if known
  at index time.

---

### 2) Describe tool
GET /v1/tools/{id}

Response 200
```json
{
  "id": "tool:email.send",
  "name": "email.send",
  "version": "1.2.0",
  "summary": "Send transactional email",
  "description": "Full description of what the tool does.",
  "tags": ["email", "smtp"],
  "provider": "acme",
  "entry": {
    "runtime": "node",
    "main": "dist/index.js",
    "export": "tool"
  },
  "schema": {
    "input": {
      "type": "object",
      "properties": {
        "to": { "type": "string" },
        "subject": { "type": "string" },
        "body": { "type": "string" }
      },
      "required": ["to", "subject", "body"]
    },
    "output": {
      "type": "object",
      "properties": {
        "messageId": { "type": "string" }
      }
    }
  },
  "requiresApproval": true,
  "requiredSecrets": ["smtp_user", "smtp_pass"]
}
```

Field semantics
- entry.runtime: must be "node" (currently the only supported runtime).
- entry.main: relative path inside the bundle to the JS entrypoint.
- entry.export (optional): which named export to use from the module. If omitted,
  client will look for tool, then default.
- schema is optional but should be JSON Schema compatible if provided.
- requiredSecrets must be declared here to enable secret prompts and storage.

---

### 3) Download tool bundle
GET /v1/tools/{id}/versions/{version}/bundle

Response 200
```json
{
  "manifest": {
    "id": "tool:email.send",
    "name": "email.send",
    "version": "1.2.0",
    "summary": "Send transactional email",
    "description": "Full description of what the tool does.",
    "tags": ["email", "smtp"],
    "provider": "acme",
    "entry": {
      "runtime": "node",
      "main": "dist/index.js",
      "export": "tool"
    },
    "schema": {
      "input": { "type": "object", "properties": { "to": { "type": "string" } } },
      "output": { "type": "object", "properties": { "messageId": { "type": "string" } } }
    },
    "requiresApproval": true,
    "requiredSecrets": ["smtp_user", "smtp_pass"]
  },
  "files": [
    {
      "path": "dist/index.js",
      "content": "export const tool = { ... }",
      "encoding": "utf8"
    },
    {
      "path": "package.json",
      "content": "eyJuYW1lIjoiZW1haWwuLi4i",
      "encoding": "base64"
    }
  ]
}
```

Bundle rules
- Each file has:
  - path: relative path only (no absolute paths, no ..)
  - content: file content
  - encoding: "utf8" (default if omitted) or "base64"
- manifest must match the describe endpoint.

---

## Tool Runtime Contract (Node)
Tools must export a Tool object with:

```ts
export interface Tool<Input, Output> {
  name: string;
  description: string;
  requiredSecrets?: string[];
  requiresApproval?: boolean;
  getApprovalMessage?(input: Input): string;
  execute(
    input: Input,
    context?: { toolName: string; env: Record<string, string> }
  ): Promise<Output>;
}
```

Secret injection
- The client will populate context.env with keys formatted as:
  <toolName>-<secretName>

Example: for tool order_pizza and secret dominos_password
the key is order_pizza-dominos_password.

The tool must read secrets from that key. This is consistent with local tools.

---

## Error Model
All non-2xx responses should return:

```json
{
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "Tool tool:email.send not found",
    "details": {}
  }
}
```

Suggested error codes
- INVALID_REQUEST
- TOOL_NOT_FOUND
- VERSION_NOT_FOUND
- INTERNAL_ERROR
- UNSUPPORTED_RUNTIME

---

## Versioning and Caching
- Tools should be immutable by version.
- Clients may cache bundles by (id, version).

---

## Security Expectations
- Registry responses must not include secrets.
- Tool bundles must be safe, signed or integrity-checked server-side (if you add
  signing later, add sha256 to describe and bundle responses).

---

## Optional Future Endpoints (not required today)
- GET /v1/tools/{id}/versions
- GET /v1/tags
- GET /v1/providers
