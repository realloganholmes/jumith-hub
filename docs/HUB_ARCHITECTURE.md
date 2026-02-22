# Registry Hub Architecture

## Purpose

The Registry Hub is a public (or semi-public) service that indexes MCP-compatible tools
and enforces strict safety and capability constraints so local agents can safely discover
and execute tools without trusting arbitrary code.

The hub never executes tools.
It only validates, indexes, and serves metadata and signed artifacts.

---

## Core Responsibilities

- Tool discovery and search
- Metadata validation
- Permission enforcement
- Secret requirement declaration
- Artifact hosting
- Versioning and immutability

---

## High-Level Principles

- Declarative over imperative
- Metadata-first, code-second
- No dynamic behavior
- No opaque binaries
- Reproducible and deterministic tools

---

## Hub Components

### 1. Tool Registry API

Provides:
- Search by keyword
- Fetch tool details by ID
- Version listing

Endpoints:
- GET /tools/search
- GET /tools/{toolId}
- GET /tools/{toolId}/versions

---

### 2. Tool Manifest Validator

Validates submitted MCP tools.

Enforces:
- Valid schema
- Explicit permissions
- Explicit secret requirements
- Approved runtimes only
- Network allowlists only

Rejects:
- Filesystem access
- Code execution permissions
- Dynamic package installs
- Undeclared secrets

---

### 3. MCP Manifest Schema

Each tool must include a manifest:

```json
{
  "id": "pizza-order",
  "name": "Pizza Order Tool",
  "description": "Order pizza from Vendor X",
  "runtime": "python",
  "entrypoint": "server.py",
  "required_secrets": [
    { "key": "USERNAME", "required": true },
    { "key": "PASSWORD", "required": true }
  ],
  "permissions": {
    "network": ["https://api.vendor.com"],
    "filesystem": false,
    "execution": false
  },
  "input_schema": {},
  "output_schema": {}
}
```

---

### 4. Artifact Store

Stores:
- MCP server code
- Manifests
- Checksums

Rules:
- Immutable versions
- Content-addressed storage
- No overwrites

---

### 5. Trust & Safety Layer

- Automated static checks
- Manual review (optional)
- Runtime constraints enforced via manifest only

---

## What the Hub Never Does

- Never executes MCP tools
- Never handles user secrets
- Never performs auth on behalf of users
- Never allows runtime mutation

---

## Summary

The hub is a *capability catalog*, not an execution platform.
