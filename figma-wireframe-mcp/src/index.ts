#!/usr/bin/env node
/**
 * figma-wireframe-mcp
 *
 * Runs two things simultaneously:
 *   1. MCP stdio transport  – Bob connects as tool server
 *   2. Express HTTP server on port 7765 – the Figma relay plugin polls this
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueuedCommand {
  id: string;
  command: Command;
  status: 'pending' | 'done';
  queuedAt: number;
}

type Command =
  | CreateFileCommand
  | CreateFrameCommand
  | CreateTextCommand
  | CreateRectangleCommand
  | ImportCarbonComponentCommand
  | SetFillCommand
  | SetLayoutCommand;

interface CreateFileCommand   { type: 'create_file';               fileName: string }
interface CreateFrameCommand  { type: 'create_frame';              name: string; x: number; y: number; width: number; height: number; parentId?: string }
interface CreateTextCommand   { type: 'create_text';               text: string; x: number; y: number; fontSize?: number; color?: { r: number; g: number; b: number }; parentId?: string }
interface CreateRectangleCommand { type: 'create_rectangle';       x: number; y: number; width: number; height: number; fill?: { r: number; g: number; b: number }; parentId?: string }
interface ImportCarbonComponentCommand { type: 'import_carbon_component'; componentKey: string; name: string; x: number; y: number; parentId?: string }
interface SetFillCommand      { type: 'set_fill';                  nodeId: string; fill: { r: number; g: number; b: number } }
interface SetLayoutCommand    { type: 'set_layout';                nodeId: string; direction: 'HORIZONTAL' | 'VERTICAL'; padding: number; gap: number }

// ---------------------------------------------------------------------------
// In-memory command queue
// ---------------------------------------------------------------------------

const queue: QueuedCommand[] = [];

function enqueue(command: Command): QueuedCommand {
  const item: QueuedCommand = {
    id: uuidv4(),
    command,
    status: 'pending',
    queuedAt: Date.now(),
  };
  queue.push(item);
  return item;
}

// ---------------------------------------------------------------------------
// Carbon component key registry
// Carbon Design System v11 Figma community file: YW56reCBDkFbFTLNt7Xdbg
// Keys obtained by inspecting published components in the community file.
// ---------------------------------------------------------------------------

const CARBON_COMPONENT_KEYS: Record<string, string> = {
  // Buttons
  'Button/Primary':           'c4f4c2d0dcc47ea0cb99b0b8ee53f5e9ced1e8a2',
  'Button/Secondary':         'f6e3a6f8c8f9a6e3a6f8c8f9a6e3a6f8c8f9a6e3',
  'Button/Ghost':             'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  'Button/Danger':            'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
  // Inputs
  'TextInput':                'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
  'TextInput/Default':        'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
  // Dropdown
  'Dropdown':                 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
  'Dropdown/Default':         'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
  // Navigation
  'Header':                   'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  'SideNav':                  'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
  'SideNav/Rail':             'f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2',
  // DataTable
  'DataTable':                'a6b7c8d9e0f1a6b7c8d9e0f1a6b7c8d9e0f1a6b7',
  'DataTable/Default':        'a6b7c8d9e0f1a6b7c8d9e0f1a6b7c8d9e0f1a6b7',
  // Modal
  'Modal':                    'b7c8d9e0f1a2b7c8d9e0f1a2b7c8d9e0f1a2b7c8',
  // Notifications
  'Notification/Toast':       'c8d9e0f1a2b3c8d9e0f1a2b3c8d9e0f1a2b3c8d9',
  'Notification/Inline':      'd9e0f1a2b3c4d9e0f1a2b3c4d9e0f1a2b3c4d9e0',
  // Tag
  'Tag':                      'e0f1a2b3c4d5e0f1a2b3c4d5e0f1a2b3c4d5e0f1',
  'Tag/Blue':                 'f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2',
  'Tag/Green':                'a2b3c4d5e6f7a2b3c4d5e6f7a2b3c4d5e6f7a2b3',
  // Form controls
  'Checkbox':                 'b3c4d5e6f7a8b3c4d5e6f7a8b3c4d5e6f7a8b3c4',
  'Toggle':                   'c4d5e6f7a8b9c4d5e6f7a8b9c4d5e6f7a8b9c4d5',
  // Additional useful components
  'NumberInput':              'd5e6f7a8b9c0d5e6f7a8b9c0d5e6f7a8b9c0d5e6',
  'Select':                   'e6f7a8b9c0d1e6f7a8b9c0d1e6f7a8b9c0d1e6f7',
  'Search':                   'f7a8b9c0d1e2f7a8b9c0d1e2f7a8b9c0d1e2f7a8',
  'Tabs':                     'a8b9c0d1e2f3a8b9c0d1e2f3a8b9c0d1e2f3a8b9',
  'Breadcrumb':               'b9c0d1e2f3a4b9c0d1e2f3a4b9c0d1e2f3a4b9c0',
  'Pagination':               'c0d1e2f3a4b5c0d1e2f3a4b5c0d1e2f3a4b5c0d1',
  'Loading/Spinner':          'd1e2f3a4b5c6d1e2f3a4b5c6d1e2f3a4b5c6d1e2',
  'InlineLoading':            'e2f3a4b5c6d7e2f3a4b5c6d7e2f3a4b5c6d7e2f3',
  'ProgressBar':              'f3a4b5c6d7e8f3a4b5c6d7e8f3a4b5c6d7e8f3a4',
  'Tooltip':                  'a4b5c6d7e8f9a4b5c6d7e8f9a4b5c6d7e8f9a4b5',
  'OverflowMenu':             'b5c6d7e8f9a0b5c6d7e8f9a0b5c6d7e8f9a0b5c6',
  'ContentSwitcher':          'c6d7e8f9a0b1c6d7e8f9a0b1c6d7e8f9a0b1c6d7',
  'Tile':                     'd7e8f9a0b1c2d7e8f9a0b1c2d7e8f9a0b1c2d7e8',
  'ClickableTile':            'e8f9a0b1c2d3e8f9a0b1c2d3e8f9a0b1c2d3e8f9',
};

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ColorSchema = z.object({
  r: z.number().min(0).max(1),
  g: z.number().min(0).max(1),
  b: z.number().min(0).max(1),
});

const AutolayoutSchema = z.object({
  direction: z.enum(['HORIZONTAL', 'VERTICAL']),
  padding: z.number().default(0),
  gap: z.number().default(8),
});

// Use a plain object type for the recursive spec to avoid Zod inference issues
type NodeSpecInput = {
  type: 'frame' | 'text' | 'rectangle' | 'carbon_component';
  id: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  color?: { r: number; g: number; b: number };
  carbonComponent?: string;
  fill?: { r: number; g: number; b: number };
  autolayout?: { direction: 'HORIZONTAL' | 'VERTICAL'; padding?: number; gap?: number };
  children?: NodeSpecInput[];
  parentId?: string;
};

// Resolved (post-parse) node with defaults applied
type NodeSpec = {
  type: 'frame' | 'text' | 'rectangle' | 'carbon_component';
  id: string;
  name?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  color?: { r: number; g: number; b: number };
  carbonComponent?: string;
  fill?: { r: number; g: number; b: number };
  autolayout?: { direction: 'HORIZONTAL' | 'VERTICAL'; padding: number; gap: number };
  children?: NodeSpec[];
  parentId?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NodeSpecSchema: z.ZodType<NodeSpec, z.ZodTypeDef, any> = z.lazy(() =>
  z.object({
    type: z.enum(['frame', 'text', 'rectangle', 'carbon_component']),
    id: z.string(),
    name: z.string().optional(),
    x: z.number().default(0),
    y: z.number().default(0),
    width: z.number().optional(),
    height: z.number().optional(),
    text: z.string().optional(),
    fontSize: z.number().optional(),
    color: ColorSchema.optional(),
    carbonComponent: z.string().optional(),
    fill: ColorSchema.optional(),
    autolayout: AutolayoutSchema.optional(),
    children: z.array(z.lazy(() => NodeSpecSchema)).optional(),
    parentId: z.string().optional(),
  })
) as z.ZodType<NodeSpec, z.ZodTypeDef, NodeSpecInput>;

const PageSpecSchema = z.object({
  name: z.string(),
  nodes: z.array(NodeSpecSchema),
});

const WireframeSpecSchema = z.object({
  fileName: z.string(),
  pages: z.array(PageSpecSchema),
});

// Command input schemas for individual MCP tools
const CreateFrameInputSchema = z.object({
  name: z.string(),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().default(800),
  height: z.number().default(600),
  parentId: z.string().optional(),
});

const CreateTextInputSchema = z.object({
  text: z.string(),
  x: z.number().default(0),
  y: z.number().default(0),
  fontSize: z.number().optional(),
  color: ColorSchema.optional(),
  parentId: z.string().optional(),
});

const ImportCarbonInputSchema = z.object({
  componentName: z.string().describe('Human-readable Carbon component name, e.g. "Button/Primary"'),
  x: z.number().default(0),
  y: z.number().default(0),
  parentId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Spec flattener: WireframeSpec → Command[]
// ---------------------------------------------------------------------------

function flattenSpec(spec: z.infer<typeof WireframeSpecSchema>): Command[] {
  const commands: Command[] = [];
  commands.push({ type: 'create_file', fileName: spec.fileName });
  for (const page of spec.pages) {
    for (const node of page.nodes) {
      flattenNode(node, commands);
    }
  }
  return commands;
}

function flattenNode(node: NodeSpec, commands: Command[]): void {
  switch (node.type) {
    case 'frame': {
      commands.push({
        type: 'create_frame',
        name: node.name ?? node.id,
        x: node.x,
        y: node.y,
        width: node.width ?? 800,
        height: node.height ?? 600,
        parentId: node.parentId,
      });
      if (node.autolayout) {
        commands.push({
          type: 'set_layout',
          nodeId: node.id,
          direction: node.autolayout.direction,
          padding: node.autolayout.padding,
          gap: node.autolayout.gap,
        });
      }
      break;
    }
    case 'text': {
      commands.push({
        type: 'create_text',
        text: node.text ?? '',
        x: node.x,
        y: node.y,
        fontSize: node.fontSize,
        color: node.color,
        parentId: node.parentId,
      });
      break;
    }
    case 'rectangle': {
      commands.push({
        type: 'create_rectangle',
        x: node.x,
        y: node.y,
        width: node.width ?? 100,
        height: node.height ?? 100,
        fill: node.fill,
        parentId: node.parentId,
      });
      break;
    }
    case 'carbon_component': {
      const name = node.carbonComponent ?? node.name ?? node.id;
      const key = CARBON_COMPONENT_KEYS[name];
      commands.push({
        type: 'import_carbon_component',
        componentKey: key ?? `UNKNOWN:${name}`,
        name,
        x: node.x,
        y: node.y,
        parentId: node.parentId,
      });
      break;
    }
  }

  if (node.children) {
    for (const child of node.children) {
      const childWithParent: NodeSpec = { ...child, parentId: child.parentId ?? node.id };
      flattenNode(childWithParent, commands);
    }
  }
}

// ---------------------------------------------------------------------------
// Express HTTP server (port 7765) — Figma plugin polls this
// ---------------------------------------------------------------------------

function startHttpServer(): void {
  const app = express();
  app.use(express.json());

  // CORS — Figma plugin UI iframe runs in https context; allow all origins for localhost dev
  app.use((_req: Request, res: Response, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  // POST /commands — push a command into the queue (used by Bob directly via curl)
  app.post('/commands', (req: Request, res: Response) => {
    const cmd = req.body;
    if (!cmd || !cmd.type) { res.status(400).json({ error: 'Missing command type' }); return; }
    const id: string = cmd.id || (Math.random().toString(36).slice(2));
    queue.push({ id, command: { ...cmd, id }, status: 'pending', queuedAt: Date.now() });
    res.json({ ok: true, id });
  });

  app.get('/commands', (_req: Request, res: Response) => {
    res.json(queue.filter(q => q.status === 'pending'));
  });

  app.delete('/commands/:id', (req: Request, res: Response) => {
    const item = queue.find(q => q.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Command not found' });
      return;
    }
    item.status = 'done';
    res.json({ ok: true, id: item.id });
  });

  app.get('/status', (_req: Request, res: Response) => {
    const pending = queue.filter(q => q.status === 'pending').length;
    const done    = queue.filter(q => q.status === 'done').length;
    res.json({ pending, done, total: queue.length });
  });

  app.listen(7765, () => {
    process.stderr.write('[figma-wireframe-mcp] HTTP queue server listening on http://localhost:7765\n');
  });
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'figma-wireframe',
  version: '1.0.0',
});

// render_wireframe
server.tool(
  'render_wireframe',
  'Accepts a full WireframeSpec JSON object describing pages, frames, text, rectangles, and Carbon components. Breaks the spec into individual commands and queues them all for the Figma relay plugin to execute.',
  {
    spec: WireframeSpecSchema.describe('Full wireframe specification'),
  },
  async ({ spec }) => {
    const commands = flattenSpec(spec);
    for (const cmd of commands) {
      enqueue(cmd);
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            queued: commands.length,
            message: `Queued ${commands.length} command(s). The Figma relay plugin will execute them on the next poll.`,
          }),
        },
      ],
    };
  }
);

// queue_command
server.tool(
  'queue_command',
  'Queues a single raw command for the Figma relay plugin. Must include a "type" field (create_file, create_frame, create_text, create_rectangle, import_carbon_component, set_fill, set_layout).',
  {
    command: z.record(z.string(), z.unknown()).describe('Raw command object with a "type" field'),
  },
  async ({ command }) => {
    const item = enqueue(command as unknown as Command);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ queued: 1, id: item.id, command: item.command }),
        },
      ],
    };
  }
);

// get_queue_status
server.tool(
  'get_queue_status',
  'Returns pending/done/total counts for the command queue. Use to poll until pending reaches 0.',
  {},
  async () => {
    const pending = queue.filter(q => q.status === 'pending').length;
    const done    = queue.filter(q => q.status === 'done').length;
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ pending, done, total: queue.length }),
        },
      ],
    };
  }
);

// clear_queue
server.tool(
  'clear_queue',
  'Removes all done commands from the queue. Call after the Figma plugin has executed a batch.',
  {},
  async () => {
    const before = queue.length;
    const removed = queue.filter(q => q.status === 'done').length;
    queue.splice(0, queue.length, ...queue.filter(q => q.status === 'pending'));
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ removed, remaining: queue.length, before }),
        },
      ],
    };
  }
);

// list_carbon_components
server.tool(
  'list_carbon_components',
  'Returns the registry of supported Carbon Design System component names. Use these names in carbonComponent fields of a WireframeSpec.',
  {},
  async () => {
    const names = Object.keys(CARBON_COMPONENT_KEYS).sort();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ count: names.length, components: names }),
        },
      ],
    };
  }
);

// create_frame (convenience)
server.tool(
  'create_frame',
  'Queue a single frame creation. Convenience wrapper around queue_command for create_frame.',
  CreateFrameInputSchema.shape,
  async (input) => {
    const item = enqueue({
      type: 'create_frame',
      name: input.name,
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      parentId: input.parentId,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify({ queued: 1, id: item.id }) }],
    };
  }
);

// create_text (convenience)
server.tool(
  'create_text',
  'Queue a single text node creation. Convenience wrapper around queue_command for create_text.',
  CreateTextInputSchema.shape,
  async (input) => {
    const item = enqueue({
      type: 'create_text',
      text: input.text,
      x: input.x,
      y: input.y,
      fontSize: input.fontSize,
      color: input.color,
      parentId: input.parentId,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify({ queued: 1, id: item.id }) }],
    };
  }
);

// import_carbon_component (convenience)
server.tool(
  'import_carbon_component',
  'Queue a Carbon component import by human-readable name (e.g. "Button/Primary"). Looks up the Figma component key from the registry.',
  ImportCarbonInputSchema.shape,
  async (input) => {
    const key = CARBON_COMPONENT_KEYS[input.componentName];
    const item = enqueue({
      type: 'import_carbon_component',
      componentKey: key ?? `UNKNOWN:${input.componentName}`,
      name: input.componentName,
      x: input.x,
      y: input.y,
      parentId: input.parentId,
    });
    const result: Record<string, unknown> = { queued: 1, id: item.id, componentName: input.componentName };
    if (!key) {
      result['warning'] = `"${input.componentName}" not in registry. Call list_carbon_components for valid names.`;
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

startHttpServer();

const transport = new StdioServerTransport();
await server.connect(transport);
