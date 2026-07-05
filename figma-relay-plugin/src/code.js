"use strict";
// ─── Types ────────────────────────────────────────────────────────────────────
// ─── State ────────────────────────────────────────────────────────────────────
/** Maps command-provided IDs → created SceneNodes so parentId references work */
const nodeRegistry = new Map();
// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolveParent(parentId) {
    if (parentId) {
        const parent = nodeRegistry.get(parentId);
        if (parent && 'appendChild' in parent) {
            return parent;
        }
    }
    return figma.currentPage;
}
function solidPaint(color) {
    return { type: 'SOLID', color };
}
// ─── Command Handlers ─────────────────────────────────────────────────────────
async function handleCreateFrame(cmd) {
    const frame = figma.createFrame();
    frame.name = cmd.name;
    frame.x = cmd.x;
    frame.y = cmd.y;
    frame.resize(cmd.width, cmd.height);
    frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    const parent = resolveParent(cmd.parentId);
    parent.appendChild(frame);
    nodeRegistry.set(cmd.id, frame);
    return frame.id;
}
async function handleCreateText(cmd) {
    await figma.loadFontAsync({ family: 'IBM Plex Sans', style: 'Regular' });
    await figma.loadFontAsync({ family: 'IBM Plex Sans', style: 'Medium' });
    const textNode = figma.createText();
    textNode.fontName = { family: 'IBM Plex Sans', style: 'Regular' };
    textNode.fontSize = cmd.fontSize;
    textNode.characters = cmd.text;
    textNode.fills = [solidPaint(cmd.color)];
    textNode.x = cmd.x;
    textNode.y = cmd.y;
    const parent = resolveParent(cmd.parentId);
    parent.appendChild(textNode);
    nodeRegistry.set(cmd.id, textNode);
    return textNode.id;
}
async function handleCreateRectangle(cmd) {
    const rect = figma.createRectangle();
    rect.x = cmd.x;
    rect.y = cmd.y;
    rect.resize(cmd.width, cmd.height);
    rect.fills = [solidPaint(cmd.color)];
    const parent = resolveParent(cmd.parentId);
    parent.appendChild(rect);
    nodeRegistry.set(cmd.id, rect);
    return rect.id;
}
async function handleImportCarbonComponent(cmd) {
    const component = await figma.importComponentByKeyAsync(cmd.key);
    const instance = component.createInstance();
    instance.x = cmd.x;
    instance.y = cmd.y;
    if (cmd.props) {
        for (const [key, value] of Object.entries(cmd.props)) {
            try {
                instance.setProperties({ [key]: value });
            }
            catch (_a) {
                // property may not exist on this component — skip silently
            }
        }
    }
    const parent = resolveParent(cmd.parentId);
    parent.appendChild(instance);
    nodeRegistry.set(cmd.id, instance);
    return instance.id;
}
function handleSetAutolayout(cmd) {
    var _a;
    const node = (_a = nodeRegistry.get(cmd.nodeId)) !== null && _a !== void 0 ? _a : figma.getNodeById(cmd.nodeId);
    if (!node || node.type !== 'FRAME') {
        console.error(`set_autolayout: node ${cmd.nodeId} not found or not a frame`);
        return;
    }
    const frame = node;
    frame.layoutMode = cmd.direction;
    frame.paddingTop = cmd.padding;
    frame.paddingBottom = cmd.padding;
    frame.paddingLeft = cmd.padding;
    frame.paddingRight = cmd.padding;
    frame.itemSpacing = cmd.gap;
}
// ─── Message Router ───────────────────────────────────────────────────────────
async function dispatch(cmd) {
    try {
        switch (cmd.type) {
            case 'ping':
                return {};
            case 'create_frame':
                return { figmaNodeId: await handleCreateFrame(cmd) };
            case 'create_text':
                return { figmaNodeId: await handleCreateText(cmd) };
            case 'create_rectangle':
                return { figmaNodeId: await handleCreateRectangle(cmd) };
            case 'import_carbon_component':
                return { figmaNodeId: await handleImportCarbonComponent(cmd) };
            case 'set_autolayout':
                handleSetAutolayout(cmd);
                return {};
            default:
                return { error: `Unknown command type: ${cmd.type}` };
        }
    }
    catch (err) {
        return { error: String(err) };
    }
}
// ─── Plugin Entrypoint ────────────────────────────────────────────────────────
figma.showUI(__html__, { width: 340, height: 200, title: 'Wireframe Relay' });
figma.ui.onmessage = async (msg) => {
    if (msg.type === 'execute_command' && msg.command) {
        const result = await dispatch(msg.command);
        figma.ui.postMessage(Object.assign({ type: 'command_result', id: msg.command.id }, result));
    }
};
