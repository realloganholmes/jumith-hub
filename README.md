# jumith-hub
MCP server registry for Jumith

## Local setup
1) Install dependencies:
   - `npm install`
2) Start the server:
   - `npm run dev`

Server starts on `http://localhost:4000` by default.

## Tool storage (no inline code)
Tools live on disk under `tools/` and are loaded at request time. Layout:
- `tools/<tool-name>/<version>/manifest.json`
- `tools/<tool-name>/<version>/files/...`

To add a tool, drop its MCP tool files into `files/` and write a matching
`manifest.json` (see `tools/math.add/1.0.0/manifest.json` for an example).

## API quick check
- Search: `GET /v1/tools/search?q=email`
- Search by tags: `GET /v1/tools/search?tags=math,utility`
- Describe: `GET /v1/tools/tool:email.send`
- Bundle: `GET /v1/tools/tool:email.send/versions/1.2.0/bundle`
