"use strict";
// ─── Types ────────────────────────────────────────────────────────────────────
// ─── State ────────────────────────────────────────────────────────────────────
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
    resolveParent(cmd.parentId).appendChild(frame);
    nodeRegistry.set(cmd.id, frame);
    return frame.id;
}
async function handleCreateText(cmd) {
    // Try IBM Plex Sans first, fall back to Inter
    let fontName = { family: 'IBM Plex Sans', style: 'Regular' };
    try {
        await figma.loadFontAsync(fontName);
    }
    catch (_a) {
        fontName = { family: 'Inter', style: 'Regular' };
        await figma.loadFontAsync(fontName);
    }
    const textNode = figma.createText();
    textNode.fontName = fontName;
    textNode.fontSize = cmd.fontSize;
    textNode.characters = cmd.text;
    textNode.fills = [solidPaint(cmd.color)];
    textNode.x = cmd.x;
    textNode.y = cmd.y;
    resolveParent(cmd.parentId).appendChild(textNode);
    nodeRegistry.set(cmd.id, textNode);
    return textNode.id;
}
async function handleCreateRectangle(cmd) {
    var _a, _b;
    // Accept either "fill" or "color" field name
    const fillColor = (_b = (_a = cmd.fill) !== null && _a !== void 0 ? _a : cmd.color) !== null && _b !== void 0 ? _b : { r: 0.8, g: 0.8, b: 0.8 };
    const rect = figma.createRectangle();
    rect.x = cmd.x;
    rect.y = cmd.y;
    rect.resize(cmd.width, cmd.height);
    rect.fills = [solidPaint(fillColor)];
    resolveParent(cmd.parentId).appendChild(rect);
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
            catch ( /* skip */_a) { /* skip */ }
        }
    }
    resolveParent(cmd.parentId).appendChild(instance);
    nodeRegistry.set(cmd.id, instance);
    return instance.id;
}
function handleSetAutolayout(cmd) {
    var _a;
    const node = (_a = nodeRegistry.get(cmd.nodeId)) !== null && _a !== void 0 ? _a : figma.getNodeById(cmd.nodeId);
    if (!node || node.type !== 'FRAME')
        return;
    const frame = node;
    frame.layoutMode = cmd.direction;
    frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = cmd.padding;
    frame.itemSpacing = cmd.gap;
}
// ─── Message Router ───────────────────────────────────────────────────────────
async function dispatch(cmd) {
    try {
        switch (cmd.type) {
            case 'ping': return {};
            case 'create_page': return { figmaNodeId: await handleCreatePage(cmd) };
            case 'switch_page': return { figmaNodeId: await handleSwitchPage(cmd) };
            case 'list_components': return { figmaNodeId: await handleListComponents(cmd) };
            case 'create_frame': return { figmaNodeId: await handleCreateFrame(cmd) };
            case 'create_text': return { figmaNodeId: await handleCreateText(cmd) };
            case 'create_rectangle': return { figmaNodeId: await handleCreateRectangle(cmd) };
            case 'import_carbon_component': return { figmaNodeId: await handleImportCarbonComponent(cmd) };
            case 'set_autolayout':
                handleSetAutolayout(cmd);
                return {};
            default: return { error: `Unknown command type: ${cmd.type}` };
        }
    }
    catch (err) {
        return { error: String(err) };
    }
}
// ─── Page management ─────────────────────────────────────────────────────────
async function handleCreatePage(cmd) {
    const page = figma.createPage();
    page.name = cmd.name;
    figma.currentPage = page;
    nodeRegistry.clear();
    return page.id;
}
async function handleSwitchPage(cmd) {
    const page = figma.root.children.find(p => p.name === cmd.name);
    if (!page)
        throw new Error(`Page "${cmd.name}" not found`);
    figma.currentPage = page;
    nodeRegistry.clear();
    return page.id;
}
// ─── List available library components ───────────────────────────────────────
async function handleListComponents(cmd) {
    var _a, _b;
    const filter = (_b = (_a = cmd.filter) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : '';
    const results = [];
    try {
        // Get all available library components (from enabled team/community libraries)
        const libs = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
        // For components, use the correct API
        const compsByKey = [];
        // Walk imported components already in this file
        const localAndImported = figma.root.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] });
        for (const node of localAndImported) {
            const n = node;
            if (!filter || n.name.toLowerCase().includes(filter)) {
                compsByKey.push({ key: n.key, name: n.name, libraryName: 'local' });
            }
        }
        return JSON.stringify({ count: compsByKey.length, components: compsByKey.slice(0, 100) });
    }
    catch (e) {
        return JSON.stringify({ error: String(e) });
    }
}
// ─── Plugin Entrypoint ────────────────────────────────────────────────────────
figma.showUI(__html__, { width: 340, height: 220, title: 'Wireframe Relay' });
figma.ui.onmessage = async (msg) => {
    if (msg.type === 'execute_command' && msg.command) {
        const result = await dispatch(msg.command);
        figma.ui.postMessage(Object.assign({ type: 'command_result', id: msg.command.id }, result));
    }
};
