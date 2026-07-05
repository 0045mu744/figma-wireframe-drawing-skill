# Figma Wireframe Drawing Skill for Bob

A system that lets Bob (IBM's AI coding assistant) generate **high-fidelity IBM Carbon Design System wireframes directly on the Figma canvas** from text prompts, code projects, or reference documents.

## What this is

Bob cannot write to Figma via the REST API (Figma doesn't expose node-creation endpoints). This project solves that with a three-part architecture:

```
Bob (text prompt / code / docs)
  └─► figma-wireframe-mcp/     MCP server Bob calls as tools
        └─► HTTP :7765          command queue
              └─► figma-relay-plugin/  Figma plugin polling localhost
                    └─► figma.createFrame() / importComponentByKeyAsync()
                          └─► Figma Canvas
```

1. **`figma-relay-plugin/`** — A Figma plugin that runs inside the desktop app. Its UI iframe polls `localhost:7765` every 500ms for commands and executes them on the canvas using the Figma Plugin API.

2. **`figma-wireframe-mcp/`** — A local Node.js MCP server Bob connects to. Exposes tools like `render_wireframe`, `create_frame`, `import_carbon_component`. Runs both an MCP stdio transport (for Bob) and an Express HTTP server on port 7765 (for the plugin to poll).

3. **`skill/SKILL.md`** — A Bob skill file that teaches Bob how to interpret user input, reason about Carbon layout patterns, and emit a valid `WireframeSpec` JSON to render.

## Capabilities

- Generate complete multi-screen wireframes from a single text prompt
- Read a React/Next.js/Vue codebase and generate a Figma screen per route
- Use real IBM Carbon v11 components (not images — actual editable Figma components)
- Supports: frames, auto-layout, text, rectangles, and 35+ Carbon components
- Multi-project: one Figma file per project, multiple pages per file

## Setup (one-time per machine)

### 1. Install the MCP server

```bash
cd figma-wireframe-mcp
npm install
npm run build
```

Add to `~/.bob/settings/mcp.json`:

```json
"figma-wireframe": {
  "command": "node",
  "args": ["/absolute/path/to/figma-wireframe-mcp/build/index.js"]
}
```

### 2. Install the Figma relay plugin

```bash
cd figma-relay-plugin
npm install
npm run build
```

In Figma desktop: **Plugins > Development > Import plugin from manifest** and select `figma-relay-plugin/manifest.json`.

### 3. Enable Carbon library in Figma

In any Figma file: **Assets panel > Libraries > enable "IBM Carbon Design System v11"** (community file). One-time toggle — no copying components manually.

### 4. Install the Bob skill

Copy `skill/SKILL.md` to `~/.bob/skills/figma-wireframe/SKILL.md`.

## Daily usage

1. Open Figma desktop
2. Run the relay plugin (Plugins > Development > figma-relay-plugin) — panel shows Relay active
3. Open Bob and ask:

> "Create a wireframe for a cloud storage dashboard with IBM Carbon"

> "Here is our React app — generate a Figma wireframe of all the screens"

Bob reads your input, generates a WireframeSpec, calls render_wireframe, and the plugin draws every screen directly on your Figma canvas.

## For colleagues

Each colleague needs:
- This repo cloned
- Steps 1-4 above (15 minutes one-time setup)
- No Figma dev mode license required
- No Figma API token required

## Supported Carbon components (35+)

| Category | Components |
|---|---|
| Navigation | Header, SideNav, Breadcrumb, Tabs, Pagination |
| Forms | TextInput, TextArea, Dropdown, MultiSelect, Checkbox, Toggle, DatePicker, TimePicker, Slider, NumberInput, Search, FileUploader |
| Actions | Button (Primary/Secondary/Ghost/Danger/Tertiary), Link |
| Data | DataTable, StructuredList |
| Feedback | Modal, Notification (Toast/Inline/Actionable), Loading, ProgressBar |
| Content | Tag, Accordion, CodeSnippet |

## Architecture decisions

| Decision | Choice | Reason |
|---|---|---|
| Plugin bridge | UI iframe polls localhost | Plugin code.ts has no network access; UI iframe is a browser context |
| MCP transport | stdio | Standard local pattern, no auth needed |
| Queue port | 7765 | Avoids common ports |
| Design system | IBM Carbon v11 | Project requirement |
| Component import | importComponentByKeyAsync | Real Carbon components, not static copies |
| Spec format | JSON via Zod schema | Structured, validatable, LLM-friendly |

## Repository structure

```
figma-wireframe-drawing-skill/
├── README.md
├── figma-wireframe-plan.md          full architecture plan and decisions
├── figma-relay-plugin/
│   ├── manifest.json
│   ├── src/code.ts                  plugin main thread (TypeScript)
│   ├── src/code.js                  compiled output
│   ├── ui.html                      polling UI iframe
│   ├── tsconfig.json
│   └── package.json
├── figma-wireframe-mcp/
│   ├── src/index.ts                 MCP server + Express queue (TypeScript)
│   ├── build/index.js               compiled output
│   ├── tsconfig.json
│   └── package.json
└── skill/
    └── SKILL.md                     Bob skill instructions
```

## License

MIT
