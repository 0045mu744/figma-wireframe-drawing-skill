---
name: figma-wireframe
description: Generate high-fidelity IBM Carbon wireframes directly in Figma from text prompts, code projects, or reference documents. Use when asked to wireframe, draw UI in Figma, create Figma screens, generate figma screens, or wireframe this project.
---

# Figma Wireframe Generator

You translate user intent — text, code, or images — into high-fidelity IBM Carbon wireframes rendered live on the Figma canvas. The pipeline is:

```
User input → Bob reasons about screens & layouts → WireframeSpec JSON → render_wireframe tool → Figma canvas
```

---

## 1. Activation Phrases

Activate this skill when the user says anything like:
- "create a wireframe"
- "generate Figma screens"
- "draw UI in Figma"
- "wireframe this project"
- "sketch out the app in Figma"
- "make a Figma mockup for…"

---

## 2. Pre-Flight Setup Check

Before generating anything, verify the full pipeline is running:

**Step A — Check the MCP server**
Call `get_queue_status`. If it throws an error, the `figma-wireframe` MCP server is not running.
Tell the user: "The figma-wireframe MCP server isn't responding. Make sure it's registered in your Bob MCP settings and the process is running."

**Step B — Check the relay plugin**
After calling `get_queue_status`, queue one test `create_text` command and call `get_queue_status` again after 3 seconds. If `pending` count does not drop to 0, the Figma relay plugin is not consuming commands. Tell the user: "Please open the Figma desktop app, go to Plugins → Development, and run the figma-wireframe relay plugin. It needs to be actively running to consume commands."

**Step C — Carbon library**
Remind the user: "Make sure the IBM Carbon Design System Figma library is enabled in your Figma file (File → Libraries → enable Carbon)."

---

## 3. How to Interpret Input

### Text prompt
1. Read the prompt and extract every distinct screen or view the user mentions.
2. For each screen, identify: what data is displayed, what actions are available, what navigation exists.
3. Map each screen to a Carbon layout pattern (see Section 4).
4. List the screens and their patterns back to the user for confirmation before generating.

### Code project
1. Read the router/navigation file to find all routes (e.g. `src/App.jsx`, `src/router/index.ts`, `src/routes.tsx`).
2. For each route, read the corresponding page component. Look for: data fetching calls, table components, form fields, charts, modals.
3. Map each component to the nearest Carbon equivalent (see Section 6).
4. Generate one WireframeSpec page per route.

### Reference images
1. Describe what you see in the image: header, sidebar, main content area, tables, forms, cards, modals.
2. Identify the layout structure (shell, grid, panels).
3. Map each visible UI element to the closest Carbon component.
4. Generate the WireframeSpec based on that mapping.

### Docs / PRD
1. Extract all user flows and screens mentioned.
2. Note the data shown per screen and any CRUD operations.
3. Convert each screen into a page in the WireframeSpec.

---

## 4. Carbon Layout Patterns

Use these standard patterns. Pick the closest match for each screen.

### App Shell
The base for almost every full-page screen. Header spans full width; SideNav is on the left at 256px; content fills the remaining space.

```json
{
  "type": "frame", "id": "shell", "name": "App Shell",
  "width": 1440, "height": 900, "x": 0, "y": 0,
  "children": [
    { "type": "carbon_component", "id": "header", "name": "Header",
      "carbonComponent": "Header/Header", "x": 0, "y": 0, "width": 1440, "height": 48 },
    { "type": "carbon_component", "id": "sidenav", "name": "SideNav",
      "carbonComponent": "SideNav/SideNav", "x": 0, "y": 48, "width": 256, "height": 852 },
    { "type": "frame", "id": "content", "name": "Content Area",
      "x": 256, "y": 48, "width": 1184, "height": 852 }
  ]
}
```

### Dashboard
App Shell + a 4-up stat card grid + a DataTable below the cards.

```json
{ "type": "frame", "id": "content", "name": "Content Area",
  "x": 256, "y": 48, "width": 1184, "height": 852,
  "autolayout": { "direction": "VERTICAL", "gap": 16, "padding": 32 },
  "children": [
    { "type": "frame", "id": "stat-row", "name": "Stat Cards",
      "autolayout": { "direction": "HORIZONTAL", "gap": 16, "padding": 0 },
      "children": [
        { "type": "carbon_component", "id": "c1", "carbonComponent": "Tile/Default", "width": 268, "height": 120 },
        { "type": "carbon_component", "id": "c2", "carbonComponent": "Tile/Default", "width": 268, "height": 120 },
        { "type": "carbon_component", "id": "c3", "carbonComponent": "Tile/Default", "width": 268, "height": 120 },
        { "type": "carbon_component", "id": "c4", "carbonComponent": "Tile/Default", "width": 268, "height": 120 }
      ]
    },
    { "type": "carbon_component", "id": "table", "carbonComponent": "DataTable/Default",
      "width": 1120, "height": 400 }
  ]
}
```

### Form Page
App Shell + centered content area + stacked form fields with a submit button.

```json
{ "type": "frame", "id": "form-content", "name": "Form Content",
  "x": 256, "y": 48, "width": 1184, "height": 852,
  "autolayout": { "direction": "VERTICAL", "gap": 0, "padding": 64 },
  "children": [
    { "type": "frame", "id": "form-card", "name": "Form Card",
      "width": 640, "height": 600,
      "autolayout": { "direction": "VERTICAL", "gap": 24, "padding": 32 },
      "children": [
        { "type": "text", "id": "form-title", "text": "Create New Resource", "fontSize": 20 },
        { "type": "carbon_component", "id": "f1", "carbonComponent": "TextInput/Default", "width": 576, "height": 64 },
        { "type": "carbon_component", "id": "f2", "carbonComponent": "TextInput/Default", "width": 576, "height": 64 },
        { "type": "carbon_component", "id": "f3", "carbonComponent": "Dropdown/Default", "width": 576, "height": 64 },
        { "type": "carbon_component", "id": "submit", "carbonComponent": "Button/Primary", "width": 160, "height": 48 }
      ]
    }
  ]
}
```

### Detail / Drilldown Page
App Shell + breadcrumb + content area with Tabs.

```json
{ "type": "frame", "id": "detail-content", "name": "Detail Content",
  "x": 256, "y": 48, "width": 1184, "height": 852,
  "autolayout": { "direction": "VERTICAL", "gap": 0, "padding": 32 },
  "children": [
    { "type": "carbon_component", "id": "breadcrumb", "carbonComponent": "Breadcrumb/Default", "width": 400, "height": 24 },
    { "type": "text", "id": "page-title", "text": "Resource Name", "fontSize": 28 },
    { "type": "carbon_component", "id": "tabs", "carbonComponent": "Tabs/Default", "width": 1120, "height": 48 },
    { "type": "frame", "id": "tab-content", "name": "Tab Content",
      "width": 1120, "height": 660,
      "autolayout": { "direction": "VERTICAL", "gap": 16, "padding": 24 },
      "children": []
    }
  ]
}
```

### Modal Flow
Render the base page normally. Add a second page that shows the same layout with a Modal node overlaid.

```json
{ "type": "carbon_component", "id": "modal", "carbonComponent": "Modal/Default",
  "x": 520, "y": 300, "width": 400, "height": 300 }
```

---

## 5. WireframeSpec Format — Full Annotated Examples

### Example A — Simple Login Screen (1 page)

```json
{
  "fileName": "MyApp Wireframes",
  "pages": [
    {
      "name": "Login",
      "nodes": [
        {
          "type": "frame",
          "id": "login-frame",
          "name": "Login Screen",
          "width": 1440,
          "height": 900,
          "x": 0,
          "y": 0,
          "children": [
            {
              "type": "rectangle",
              "id": "bg",
              "name": "Background",
              "x": 0, "y": 0,
              "width": 1440, "height": 900,
              "fill": { "r": 0.96, "g": 0.96, "b": 0.96 }
            },
            {
              "type": "frame",
              "id": "login-card",
              "name": "Login Card",
              "x": 560, "y": 250,
              "width": 320, "height": 360,
              "autolayout": { "direction": "VERTICAL", "gap": 20, "padding": 32 },
              "children": [
                {
                  "type": "text",
                  "id": "title",
                  "text": "Sign in",
                  "fontSize": 28,
                  "color": { "r": 0.1, "g": 0.1, "b": 0.1 }
                },
                {
                  "type": "carbon_component",
                  "id": "email-input",
                  "name": "Email Field",
                  "carbonComponent": "TextInput/Default",
                  "width": 256, "height": 64
                },
                {
                  "type": "carbon_component",
                  "id": "password-input",
                  "name": "Password Field",
                  "carbonComponent": "TextInput/Default",
                  "width": 256, "height": 64
                },
                {
                  "type": "carbon_component",
                  "id": "sign-in-btn",
                  "name": "Sign In Button",
                  "carbonComponent": "Button/Primary",
                  "width": 256, "height": 48
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

### Example B — Cloud Storage Monitoring App (2 pages: Dashboard + Detail)

This is the canonical multi-screen example. Each page is a full 1440×900 desktop frame.

```json
{
  "fileName": "Cloud Storage Monitor — Wireframes",
  "pages": [
    {
      "name": "Dashboard",
      "nodes": [
        {
          "type": "frame",
          "id": "dashboard-shell",
          "name": "Dashboard",
          "width": 1440, "height": 900,
          "x": 0, "y": 0,
          "children": [
            {
              "type": "carbon_component",
              "id": "app-header",
              "name": "App Header",
              "carbonComponent": "Header/Header",
              "x": 0, "y": 0, "width": 1440, "height": 48
            },
            {
              "type": "carbon_component",
              "id": "side-nav",
              "name": "Side Navigation",
              "carbonComponent": "SideNav/SideNav",
              "x": 0, "y": 48, "width": 256, "height": 852
            },
            {
              "type": "frame",
              "id": "main-content",
              "name": "Main Content",
              "x": 256, "y": 48,
              "width": 1184, "height": 852,
              "autolayout": { "direction": "VERTICAL", "gap": 24, "padding": 32 },
              "children": [
                {
                  "type": "text",
                  "id": "page-heading",
                  "text": "Storage Overview",
                  "fontSize": 28,
                  "color": { "r": 0.1, "g": 0.1, "b": 0.1 }
                },
                {
                  "type": "frame",
                  "id": "kpi-row",
                  "name": "KPI Cards",
                  "autolayout": { "direction": "HORIZONTAL", "gap": 16, "padding": 0 },
                  "children": [
                    { "type": "carbon_component", "id": "kpi-1", "carbonComponent": "Tile/Default", "width": 260, "height": 112 },
                    { "type": "carbon_component", "id": "kpi-2", "carbonComponent": "Tile/Default", "width": 260, "height": 112 },
                    { "type": "carbon_component", "id": "kpi-3", "carbonComponent": "Tile/Default", "width": 260, "height": 112 },
                    { "type": "carbon_component", "id": "kpi-4", "carbonComponent": "Tile/Default", "width": 260, "height": 112 }
                  ]
                },
                {
                  "type": "frame",
                  "id": "table-section",
                  "name": "Buckets Table",
                  "autolayout": { "direction": "VERTICAL", "gap": 8, "padding": 0 },
                  "children": [
                    {
                      "type": "text",
                      "id": "table-heading",
                      "text": "Storage Buckets",
                      "fontSize": 16,
                      "color": { "r": 0.1, "g": 0.1, "b": 0.1 }
                    },
                    {
                      "type": "carbon_component",
                      "id": "buckets-table",
                      "name": "Buckets DataTable",
                      "carbonComponent": "DataTable/Default",
                      "width": 1120, "height": 400
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "name": "Bucket Detail",
      "nodes": [
        {
          "type": "frame",
          "id": "detail-shell",
          "name": "Bucket Detail",
          "width": 1440, "height": 900,
          "x": 0, "y": 0,
          "children": [
            {
              "type": "carbon_component",
              "id": "detail-header",
              "name": "App Header",
              "carbonComponent": "Header/Header",
              "x": 0, "y": 0, "width": 1440, "height": 48
            },
            {
              "type": "carbon_component",
              "id": "detail-nav",
              "name": "Side Navigation",
              "carbonComponent": "SideNav/SideNav",
              "x": 0, "y": 48, "width": 256, "height": 852
            },
            {
              "type": "frame",
              "id": "detail-content",
              "name": "Detail Content",
              "x": 256, "y": 48,
              "width": 1184, "height": 852,
              "autolayout": { "direction": "VERTICAL", "gap": 16, "padding": 32 },
              "children": [
                {
                  "type": "carbon_component",
                  "id": "breadcrumb",
                  "name": "Breadcrumb",
                  "carbonComponent": "Breadcrumb/Default",
                  "width": 400, "height": 24
                },
                {
                  "type": "text",
                  "id": "bucket-name",
                  "text": "my-production-bucket",
                  "fontSize": 28,
                  "color": { "r": 0.1, "g": 0.1, "b": 0.1 }
                },
                {
                  "type": "carbon_component",
                  "id": "detail-tabs",
                  "name": "Detail Tabs",
                  "carbonComponent": "Tabs/Default",
                  "width": 1120, "height": 48
                },
                {
                  "type": "carbon_component",
                  "id": "objects-table",
                  "name": "Objects Table",
                  "carbonComponent": "DataTable/Default",
                  "width": 1120, "height": 480
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 6. Carbon Component Name Registry

Always call `list_carbon_components` first to get the live registry. The names below are stable
reference values — use them verbatim in `carbonComponent` fields.

| Category | Component Name |
|---|---|
| **Navigation** | `Header/Header`, `SideNav/SideNav`, `Breadcrumb/Default`, `Tabs/Default`, `Pagination/Default` |
| **Forms** | `TextInput/Default`, `Dropdown/Default`, `Select/Default`, `Checkbox/Default`, `RadioButton/Default`, `Toggle/Default`, `DatePicker/Default`, `NumberInput/Default`, `TextArea/Default` |
| **Actions** | `Button/Primary`, `Button/Secondary`, `Button/Danger`, `Button/Ghost`, `Button/Tertiary` |
| **Data display** | `DataTable/Default`, `Tile/Default`, `Tag/Default`, `ProgressBar/Default` |
| **Feedback** | `Modal/Default`, `InlineNotification/Default`, `ToastNotification/Default`, `Loading/Default` |
| **Layout** | `Grid/Default`, `Accordion/Default` |

**Mapping UI concepts → Carbon components:**
- Search bar → `Search/Default`
- Alert / banner → `InlineNotification/Default`
- Status badge → `Tag/Default`
- Stat card → `Tile/Default`
- Spinner → `Loading/Default`
- Confirmation dialog → `Modal/Default`
- Row of filters → `Dropdown/Default` (multiple instances)

---

## 7. Standard Frame Dimensions

| Device | Width | Height |
|---|---|---|
| Desktop (default) | 1440 | 900 |
| Laptop | 1280 | 800 |
| Tablet | 768 | 1024 |
| Mobile | 375 | 812 |

For multi-page specs, place each top-level frame at `x: 0, y: 0` — they live on separate pages
so positions don't collide.

---

## 8. Step-by-Step Workflow

Follow this sequence every time:

1. **Understand the input.** Apply Section 3 to extract screens, data, and actions.
2. **List the screens.** Write out each screen name and the Carbon layout pattern you'll use.
3. **Confirm with the user.** Show the list: "I'll generate these N screens: [list]. Does this look right?" Wait for approval.
4. **Get the component registry.** Call `list_carbon_components` and note any names that differ from the table in Section 6.
5. **Generate the WireframeSpec.** Build the full JSON following the format in Section 5. Use `children` arrays for nested frames. Assign unique string `id` values to every node.
6. **Render.** Call `render_wireframe` with the complete spec.
7. **Poll until done.** Call `get_queue_status` in a loop. Keep polling until `pending === 0`. If `pending` stays above 0 for more than 30 seconds, tell the user the relay plugin may have stopped.
8. **Done.** Tell the user: "Your wireframe is ready in Figma — [N] screens on [N] pages in the file '[fileName]'."

---

## 9. Multi-Project Organisation

| Situation | Approach |
|---|---|
| New project | One new `fileName` per project in the WireframeSpec |
| Multiple screens for same project | One `fileName`, multiple entries in `pages` array |
| Code project with routes | One page per route (`/dashboard` → page `"Dashboard"`, `/settings` → page `"Settings"`, etc.) |
| Adding screens to existing Figma file | Note: `render_wireframe` creates a new file; for additions, generate a separate file and tell the user to copy frames manually |

---

## 10. From Code to Wireframe

When given a codebase, follow this process:

1. **Find the router.** Look for `App.jsx`, `App.tsx`, `router/index.ts`, `routes.ts`, or similar. Use `grep` to search for route definitions: `grep -r "path:" src/` or `grep -r "<Route" src/`.
2. **Read each page component.** For every route, open the corresponding component file. Identify:
   - What API data does it fetch? (reveals what the DataTable columns or cards should show)
   - What forms does it render? (map fields to `TextInput`, `Dropdown`, etc.)
   - What modals or dialogs does it use?
   - What navigation elements does it include?
3. **Map to Carbon.** Apply the table in Section 6. When unsure, pick the nearest Carbon component and note your assumption.
4. **Build the spec.** One page per route. Use the App Shell pattern unless the route is a full-page modal or auth screen.
5. **Generate.**

---

## 11. Common Mistakes to Avoid

- **Using unknown component names.** Always call `list_carbon_components` first. A typo in `carbonComponent` causes silent failures in the relay plugin.
- **Forgetting `id` uniqueness.** Every node across the entire spec must have a unique `id` string. Use descriptive IDs like `"dashboard-header"` not `"header"` — the same shell repeats across pages.
- **Skipping `parentId` when needed.** When using `queue_command` directly (not `render_wireframe`), each node needs a `parentId`. When using `render_wireframe` with `children` arrays, `parentId` is inferred automatically — don't add it.
- **Infinite polling.** Always set a mental timeout. If `get_queue_status` shows pending > 0 after 30 seconds, stop and diagnose.
- **Wrong dimensions.** Default to 1440×900 for desktop unless the user specifies otherwise.
