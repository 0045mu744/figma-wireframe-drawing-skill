# Figma Wireframe Generator — Plan

## Overview

Build a system that lets Bob generate high-fidelity IBM Carbon wireframes directly on the Figma
canvas from a combination of text prompts, reference images, and documents.

The system has three components:
- **Figma Relay Plugin** — runs inside the Figma desktop app, exposes a local HTTP server,
  executes canvas commands using the Figma Plugin API
- **figma-wireframe MCP Server** — a local Node.js MCP server Bob can call as tools;
  translates Bob's wireframe JSON spec into HTTP calls to the relay plugin
- **Bob (Plan/Agent mode)** — interprets user input, reasons about layout, emits a structured
  wireframe JSON spec, then calls the MCP tools to render it

Design system: **IBM Carbon Design System** (via Carbon's published Figma component library keys).
Input: text prompt + optional reference images or docs.
Output: pixel-perfect, high-fidelity Figma frames on the canvas.

---

## Sub-Task 1 — Figma Relay Plugin

**Status:** [ ] pending

### Intent
Build a Figma plugin that acts as a local HTTP relay. It runs persistently inside the Figma
desktop app and accepts JSON commands to create frames, components, text, and shapes on the canvas.
This is the only way to programmatically write to the Figma canvas without Figma's own REST API
support for node creation.

### Expected Outcomes
- A Figma plugin project exists at `figma-relay-plugin/`
- The plugin starts a WebSocket or polling-based local relay when opened (Figma plugins cannot
  open raw TCP sockets; the recommended pattern is polling a local HTTP server or using a shared
  file/clipboard bridge)
- Supported commands:
  - `create_file` — create a new Figma file and open it
  - `create_frame` — create a named frame at x/y with w/h
  - `create_text` — create a text node with font, size, colour
  - `create_rectangle` — create a filled rectangle
  - `import_carbon_component` — import a Carbon component by key onto the canvas
  - `set_fill` — set fill colour on a node by id
  - `set_layout` — apply auto-layout (direction, padding, gap) to a frame

### Todo List
1. Scaffold plugin: `manifest.json` (editorType: figma, ui: true), `code.ts`, `ui.html`
2. In `ui.html`: start a polling loop that GETs `http://localhost:7765/commands` every 500ms
3. In `code.ts`: receive messages from ui, dispatch to plugin API functions
4. Implement each command handler in `code.ts`
5. Resolve Carbon component keys — query the Carbon Figma community file for published
   component keys (Button, Input, Header, etc.) to use with `importComponentByKeyAsync`
6. Build with `tsc`, verify `code.js` output
7. Document how to load in Figma: Plugins → Development → Import plugin from manifest

### Relevant Context
- Figma Plugin API: `figma.createFrame()`, `figma.createText()`, `figma.createRectangle()`,
  `figma.importComponentByKeyAsync(key)`
- Figma plugins cannot open TCP servers directly — the UI iframe (ui.html) runs in a browser
  context and CAN make fetch/XHR calls to localhost; this is the relay bridge
- The plugin ui polls the MCP server's command queue endpoint; the MCP server queues commands
  and the plugin drains them

---

## Sub-Task 2 — figma-wireframe MCP Server

**Status:** [ ] pending

### Intent
Build a local Node.js MCP server that Bob can call as tools. It queues wireframe commands and
serves them to the Figma relay plugin via HTTP. Bob calls tools like `render_wireframe` or
`create_frame`; the server queues them and the plugin polls and executes them.

### Expected Outcomes
- MCP server project exists at `figma-wireframe-mcp/`
- Server exposes a command queue: `GET /commands` (plugin polls this), `DELETE /commands/:id`
  (plugin ACKs after execution)
- Bob-facing MCP tools:
  - `render_wireframe` — accepts a full wireframe JSON spec, queues all commands at once
  - `create_frame` — queue a single frame creation
  - `create_text` — queue a single text node
  - `import_carbon_component` — queue a Carbon component import
  - `get_status` — check how many commands are pending/completed
- Registered in `~/.bob/settings/mcp.json`

### Todo List
1. Scaffold: `figma-wireframe-mcp/` with `package.json` (ESM), `tsconfig.json`, `src/index.ts`
2. Install: `@modelcontextprotocol/sdk`, `zod`, `express` (for the HTTP queue server)
3. Implement in-memory command queue with uuid IDs
4. Implement Express HTTP endpoints: `GET /commands`, `DELETE /commands/:id`
5. Register MCP tools using `server.registerTool` (v2 API)
6. Define the wireframe JSON spec schema (frames, children, components, text, fills)
7. Build and verify
8. Register in `~/.bob/settings/mcp.json` with `command: node` pointing to `build/index.js`

### Relevant Context
- Build pattern: same as `figma-write-mcp` already built at
  `/Users/manan/Library/CloudStorage/OneDrive-IBM/Desktop/figma-write-mcp/`
- The server runs two things simultaneously: the MCP stdio transport (for Bob) and an Express
  HTTP server on port 7765 (for the Figma plugin to poll)

---

## Sub-Task 3 — Wireframe JSON Spec Schema

**Status:** [ ] pending

### Intent
Define a precise, structured JSON schema that Bob uses to describe a complete wireframe. This is
the contract between Bob's reasoning and the rendering layer. It must be expressive enough to
describe high-fidelity Carbon layouts without requiring Bob to think in pixels.

### Expected Outcomes
- Schema defined as a Zod schema in the MCP server (single source of truth)
- Schema exported as a JSON Schema file for documentation
- Supports: pages, frames, auto-layout, Carbon components, text, icons, fills, strokes, spacing
- Includes a Carbon component registry mapping human-readable names to Figma component keys
  (e.g. `"Button/Primary"` → `<figma-key>`)

### Todo List
1. Research and list Carbon Figma component keys for the most-used components:
   Button, TextInput, Dropdown, Header, SideNav, DataTable, Modal, Notification, Tag, Icon
2. Define the Zod schema for `WireframeSpec`, `PageSpec`, `FrameSpec`, `NodeSpec`
3. Add the Carbon component key registry as a static map in the MCP server
4. Write a sample wireframe JSON for a simple dashboard as a test fixture
5. Validate the sample against the schema

### Relevant Context
- Carbon Figma library is published at:
  https://www.figma.com/community/file/1157761539243882700 (Carbon Design System v11)
- Component keys can be found by inspecting nodes in the community file

---

## Sub-Task 4 — Bob Skill: figma-wireframe

**Status:** [ ] pending

### Intent
Create a Bob skill that teaches Bob how to interpret user input (text + images + docs), reason
about Carbon layout patterns, and emit a valid wireframe JSON spec. This is the intelligence layer
— without it Bob would need to be prompted from scratch every time.

### Expected Outcomes
- Skill file exists at `.bob/skills/figma-wireframe/SKILL.md`
- Skill covers:
  - How to interpret a text prompt into screens and flows
  - Carbon layout patterns: shell, grid, panels, forms, tables
  - How to map UI concepts to the wireframe JSON spec
  - How to call `render_wireframe` MCP tool with the spec
  - How to handle multi-screen projects and file organisation

### Todo List
1. Draft the skill instructions covering Carbon layout reasoning
2. Include the wireframe JSON spec format with annotated examples
3. Include the Carbon component name registry
4. Cover multi-project organisation patterns (one file per project vs pages)
5. Save to `.bob/skills/figma-wireframe/SKILL.md`

### Relevant Context
- Skill format: see existing skills in `~/.bob/skills/`
- Carbon layout docs: https://carbondesignsystem.com/guidelines/2x-grid/overview/

---

## Sub-Task 5 — End-to-End Test

**Status:** [ ] pending

### Intent
Validate the full pipeline works by generating a real wireframe from a text prompt.

### Expected Outcomes
- Prompt: "Create a dashboard wireframe for a cloud storage monitoring app using Carbon"
- Output: a Figma file with at least 2 screens (Dashboard overview, Detail view) rendered on
  the canvas with Carbon Header, SideNav, DataTable, and stat cards
- All components correctly placed and named in Figma layers panel

### Todo List
1. Open Figma desktop app and load the relay plugin (Plugins → Development → Run)
2. In Bob, activate the `figma-wireframe` skill
3. Run the prompt and verify the wireframe JSON spec looks correct
4. Call `render_wireframe` and watch commands execute on canvas
5. Verify layer names, component fidelity, and layout accuracy
6. Document any gaps found and fix

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Plugin bridge pattern | UI iframe polling localhost | Only option — plugin code.ts cannot open TCP sockets |
| MCP transport | stdio | Standard local pattern, no auth needed |
| HTTP queue port | 7765 | Arbitrary, avoid common ports |
| Design system | IBM Carbon v11 | User requirement |
| Component import method | importComponentByKeyAsync | Enables real Carbon components, not copies |
| Wireframe spec format | JSON via Zod schema | Structured, validatable, LLM-friendly |
