// Map rendering methods for TopologyBrowser

// Null Island coordinates (0,0 lat/long in SVG space)
const NULL_ISLAND_X = 986;
const NULL_ISLAND_Y = 497;

// Node type icon configurations for hierarchical view
// Each type has a color and an SVG path generator function
const NODE_TYPE_ICONS = {
    0: null,  // Generic - use circle
    1: { color: '#f97316', name: 'SWITCH' },       // Orange
    2: { color: '#3b82f6', name: 'ROUTER' },       // Blue
    3: { color: '#8b5cf6', name: 'AGGREGATION' },  // Purple
    4: { color: '#ef4444', name: 'FIREWALL' },     // Red
    5: { color: '#22c55e', name: 'LOAD_BAL' },     // Green
    6: { color: '#06b6d4', name: 'AP' },           // Cyan
    7: { color: '#64748b', name: 'SERVER' },       // Slate
    8: { color: '#a855f7', name: 'STORAGE' },      // Purple
    9: { color: '#14b8a6', name: 'GATEWAY' }       // Teal
};

// Helper: Draw base rectangular device shape
function drawDeviceBox(g, x, y, width, height, color) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x - width / 2);
    rect.setAttribute('y', y - height / 2);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('rx', 3);
    rect.setAttribute('fill', color);
    rect.setAttribute('stroke', '#fff');
    rect.setAttribute('stroke-width', 1.5);
    g.appendChild(rect);
    return { left: x - width / 2, top: y - height / 2, width, height };
}

// Create SVG icon for network device (Modern flat style - Option B)
function createNetworkDeviceIcon(x, y, size, color, nodeType) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const w = size * 0.9;
    const h = size * 0.6;

    if (nodeType === 1) {
        // SWITCH: Rectangle with horizontal port lines
        drawDeviceBox(g, x, y, w, h, color);
        // Port lines (4 horizontal lines)
        for (let i = 0; i < 4; i++) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            const lx = x - w * 0.35 + i * (w * 0.7 / 3);
            line.setAttribute('x1', lx);
            line.setAttribute('y1', y - h * 0.25);
            line.setAttribute('x2', lx);
            line.setAttribute('y2', y + h * 0.25);
            line.setAttribute('stroke', '#fff');
            line.setAttribute('stroke-width', 2);
            line.setAttribute('stroke-linecap', 'round');
            g.appendChild(line);
        }
    } else if (nodeType === 2) {
        // ROUTER: Rectangle with circular routing arrows
        drawDeviceBox(g, x, y, w, h, color);
        // Circular arrows (routing symbol)
        const r = h * 0.28;
        const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arc.setAttribute('d', `
            M${x - r},${y - r * 0.3}
            A${r},${r} 0 1,1 ${x + r},${y - r * 0.3}
        `);
        arc.setAttribute('fill', 'none');
        arc.setAttribute('stroke', '#fff');
        arc.setAttribute('stroke-width', 2);
        g.appendChild(arc);
        // Arrow heads on both ends
        const arrow1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrow1.setAttribute('d', `M${x - r - 3},${y - r * 0.3 + 2} L${x - r},${y - r * 0.3 - 4} L${x - r + 4},${y - r * 0.3 + 1}`);
        arrow1.setAttribute('fill', 'none');
        arrow1.setAttribute('stroke', '#fff');
        arrow1.setAttribute('stroke-width', 2);
        arrow1.setAttribute('stroke-linejoin', 'round');
        arrow1.setAttribute('stroke-linecap', 'round');
        g.appendChild(arrow1);
        const arrow2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrow2.setAttribute('d', `M${x + r + 3},${y - r * 0.3 + 2} L${x + r},${y - r * 0.3 - 4} L${x + r - 4},${y - r * 0.3 + 1}`);
        arrow2.setAttribute('fill', 'none');
        arrow2.setAttribute('stroke', '#fff');
        arrow2.setAttribute('stroke-width', 2);
        arrow2.setAttribute('stroke-linejoin', 'round');
        arrow2.setAttribute('stroke-linecap', 'round');
        g.appendChild(arrow2);
    } else if (nodeType === 3) {
        // AGGREGATION: Rectangle with converging arrows
        drawDeviceBox(g, x, y, w, h, color);
        // Three arrows converging to center
        const arrows = [
            { x1: x - w * 0.3, y1: y - h * 0.2, x2: x, y2: y },
            { x1: x + w * 0.3, y1: y - h * 0.2, x2: x, y2: y },
            { x1: x, y1: y + h * 0.3, x2: x, y2: y }
        ];
        arrows.forEach(a => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', a.x1);
            line.setAttribute('y1', a.y1);
            line.setAttribute('x2', a.x2);
            line.setAttribute('y2', a.y2);
            line.setAttribute('stroke', '#fff');
            line.setAttribute('stroke-width', 2);
            line.setAttribute('stroke-linecap', 'round');
            g.appendChild(line);
        });
        // Center dot
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', x);
        dot.setAttribute('cy', y);
        dot.setAttribute('r', 3);
        dot.setAttribute('fill', '#fff');
        g.appendChild(dot);
    } else if (nodeType === 4) {
        // FIREWALL: Rectangle with brick wall pattern
        drawDeviceBox(g, x, y, w, h, color);
        // Brick pattern (horizontal and vertical lines)
        const brickH = h * 0.25;
        // Horizontal lines
        for (let i = 1; i < 3; i++) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x - w * 0.38);
            line.setAttribute('y1', y - h / 2 + i * brickH + brickH * 0.3);
            line.setAttribute('x2', x + w * 0.38);
            line.setAttribute('y2', y - h / 2 + i * brickH + brickH * 0.3);
            line.setAttribute('stroke', '#fff');
            line.setAttribute('stroke-width', 1.5);
            g.appendChild(line);
        }
        // Vertical lines (offset per row)
        const vLines = [
            { x: x - w * 0.12, y1: y - h * 0.35, y2: y - h * 0.1 },
            { x: x + w * 0.15, y1: y - h * 0.35, y2: y - h * 0.1 },
            { x: x, y1: y - h * 0.1, y2: y + h * 0.15 },
            { x: x - w * 0.25, y1: y - h * 0.1, y2: y + h * 0.15 },
            { x: x + w * 0.25, y1: y - h * 0.1, y2: y + h * 0.15 },
            { x: x - w * 0.12, y1: y + h * 0.15, y2: y + h * 0.38 },
            { x: x + w * 0.15, y1: y + h * 0.15, y2: y + h * 0.38 }
        ];
        vLines.forEach(v => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', v.x);
            line.setAttribute('y1', v.y1);
            line.setAttribute('x2', v.x);
            line.setAttribute('y2', v.y2);
            line.setAttribute('stroke', '#fff');
            line.setAttribute('stroke-width', 1.5);
            g.appendChild(line);
        });
    } else if (nodeType === 5) {
        // LOAD_BALANCER: Rectangle with balance scale symbol
        drawDeviceBox(g, x, y, w, h, color);
        // Triangle base
        const triH = h * 0.35;
        const tri = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tri.setAttribute('d', `M${x},${y - triH} L${x - w * 0.25},${y + triH * 0.5} L${x + w * 0.25},${y + triH * 0.5} Z`);
        tri.setAttribute('fill', 'none');
        tri.setAttribute('stroke', '#fff');
        tri.setAttribute('stroke-width', 2);
        tri.setAttribute('stroke-linejoin', 'round');
        g.appendChild(tri);
        // Horizontal bar on top
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        bar.setAttribute('x1', x - w * 0.3);
        bar.setAttribute('y1', y - triH);
        bar.setAttribute('x2', x + w * 0.3);
        bar.setAttribute('y2', y - triH);
        bar.setAttribute('stroke', '#fff');
        bar.setAttribute('stroke-width', 2);
        bar.setAttribute('stroke-linecap', 'round');
        g.appendChild(bar);
    } else if (nodeType === 6) {
        // ACCESS_POINT: Rectangle with WiFi waves
        drawDeviceBox(g, x, y, w, h, color);
        // WiFi arcs
        for (let i = 3; i >= 1; i--) {
            const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const r = h * 0.2 * i;
            arc.setAttribute('d', `M${x - r * 0.7},${y + h * 0.1} A${r},${r} 0 0,1 ${x + r * 0.7},${y + h * 0.1}`);
            arc.setAttribute('fill', 'none');
            arc.setAttribute('stroke', '#fff');
            arc.setAttribute('stroke-width', 2);
            arc.setAttribute('stroke-linecap', 'round');
            g.appendChild(arc);
        }
        // Base dot
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', x);
        dot.setAttribute('cy', y + h * 0.2);
        dot.setAttribute('r', 2.5);
        dot.setAttribute('fill', '#fff');
        g.appendChild(dot);
    } else if (nodeType === 7) {
        // SERVER: Rectangle with horizontal rack lines
        drawDeviceBox(g, x, y, w, h, color);
        // Rack lines (3 horizontal slots)
        for (let i = 0; i < 3; i++) {
            const ly = y - h * 0.25 + i * h * 0.25;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x - w * 0.35);
            line.setAttribute('y1', ly);
            line.setAttribute('x2', x + w * 0.35);
            line.setAttribute('y2', ly);
            line.setAttribute('stroke', '#fff');
            line.setAttribute('stroke-width', 2);
            line.setAttribute('stroke-linecap', 'round');
            g.appendChild(line);
            // LED dots on the right
            const led = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            led.setAttribute('cx', x + w * 0.3);
            led.setAttribute('cy', ly);
            led.setAttribute('r', 2);
            led.setAttribute('fill', '#fff');
            g.appendChild(led);
        }
    } else if (nodeType === 8) {
        // STORAGE: Rectangle with stacked disks symbol
        drawDeviceBox(g, x, y, w, h, color);
        // Stacked cylinder disks
        const diskW = w * 0.5;
        const diskH = h * 0.15;
        for (let i = 0; i < 3; i++) {
            const dy = y - h * 0.2 + i * diskH * 1.2;
            const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            ellipse.setAttribute('cx', x);
            ellipse.setAttribute('cy', dy);
            ellipse.setAttribute('rx', diskW / 2);
            ellipse.setAttribute('ry', diskH / 2);
            ellipse.setAttribute('fill', 'none');
            ellipse.setAttribute('stroke', '#fff');
            ellipse.setAttribute('stroke-width', 1.5);
            g.appendChild(ellipse);
        }
    } else if (nodeType === 9) {
        // GATEWAY: Rectangle with door/portal symbol
        drawDeviceBox(g, x, y, w, h, color);
        // Door frame
        const doorW = w * 0.35;
        const doorH = h * 0.6;
        const door = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        door.setAttribute('x', x - doorW / 2);
        door.setAttribute('y', y - doorH / 2);
        door.setAttribute('width', doorW);
        door.setAttribute('height', doorH);
        door.setAttribute('rx', 2);
        door.setAttribute('fill', 'none');
        door.setAttribute('stroke', '#fff');
        door.setAttribute('stroke-width', 2);
        g.appendChild(door);
        // Arrow going through
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrow.setAttribute('d', `M${x - w * 0.35},${y} L${x + w * 0.35},${y} M${x + w * 0.2},${y - h * 0.15} L${x + w * 0.35},${y} L${x + w * 0.2},${y + h * 0.15}`);
        arrow.setAttribute('fill', 'none');
        arrow.setAttribute('stroke', '#fff');
        arrow.setAttribute('stroke-width', 2);
        arrow.setAttribute('stroke-linecap', 'round');
        arrow.setAttribute('stroke-linejoin', 'round');
        g.appendChild(arrow);
    } else {
        // Default: Simple rectangle with question mark
        drawDeviceBox(g, x, y, w, h, color);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y + 4);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#fff');
        text.setAttribute('font-size', h * 0.5);
        text.setAttribute('font-weight', 'bold');
        text.textContent = '?';
        g.appendChild(text);
    }

    return g;
}

TopologyBrowser.prototype.renderMap = function() {
    // Non-map layouts use shared rendering with icons
    if (this.layoutMode !== 'map') {
        this.renderLayout();
        return;
    }
    const overlaySvg = document.getElementById('overlay-svg');

    overlaySvg.innerHTML = `
        <defs>
            <!-- Arrow END markers (at line end, pointing in line direction) -->
            <marker id="arrow-end-status-1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#00c853" />
            </marker>
            <marker id="arrow-end-status-2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff3d00" />
            </marker>
            <marker id="arrow-end-status-3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffc107" />
            </marker>
            <marker id="arrow-end-status-0" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#757575" />
            </marker>
            <!-- Arrow START markers (at line start, pointing away from line) -->
            <marker id="arrow-start-status-1" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 10 0 L 0 5 L 10 10 z" fill="#00c853" />
            </marker>
            <marker id="arrow-start-status-2" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 10 0 L 0 5 L 10 10 z" fill="#ff3d00" />
            </marker>
            <marker id="arrow-start-status-3" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 10 0 L 0 5 L 10 10 z" fill="#ffc107" />
            </marker>
            <marker id="arrow-start-status-0" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 10 0 L 0 5 L 10 10 z" fill="#757575" />
            </marker>
        </defs>
    `;

    const nodes = this.currentTopology.nodes || {};
    const links = this.currentTopology.links || {};
    const locations = this.currentTopology.locations || {};

    // Build node positions from locations map using server-side SVG coordinates
    const nodePositions = {};
    Object.entries(nodes).forEach(([locationKey, node]) => {
        const location = locations[node.location];
        if (location) {
            const pos = (location.svgX !== undefined && location.svgY !== undefined)
                ? { x: location.svgX, y: location.svgY }
                : { x: NULL_ISLAND_X, y: NULL_ISLAND_Y };
            nodePositions[node.nodeId] = pos;
        }
    });

    // Draw links
    Object.values(links).forEach(link => {
        const asideNode = this.findNodeByLink(link.aside, nodes);
        const zsideNode = this.findNodeByLink(link.zside, nodes);

        if (asideNode && zsideNode) {
            const asidePos = nodePositions[asideNode.nodeId];
            const zsidePos = nodePositions[zsideNode.nodeId];

            if (asidePos && zsidePos) {
                this.drawLink(overlaySvg, link, asidePos, zsidePos);
            }
        }
    });

    // Draw nodes
    Object.entries(nodes).forEach(([locationKey, node]) => {
        const pos = nodePositions[node.nodeId];
        if (pos) {
            this.drawNode(overlaySvg, node, pos, locationKey);
        }
    });
};

// Helper to find node from link aside/zside reference
TopologyBrowser.prototype.findNodeByLink = function(linkRef, nodes) {
    // Link references can be:
    // 1. Full format: "networkdevice<{24}{24}FW1>.physicals..." - extract nodeId from regex
    // 2. Simple format: "FW1" - use directly as nodeId
    const match = linkRef.match(/networkdevice<\{24\}\{24\}(\w+)\>/);
    const nodeIdToFind = match ? match[1] : linkRef;

    // Find node with matching nodeId
    for (const [locationKey, node] of Object.entries(nodes)) {
        if (node.nodeId === nodeIdToFind) {
            return node;
        }
    }

    // Fallback: try direct lookup by key
    return nodes[linkRef];
};

TopologyBrowser.prototype.drawLink = function(svg, link, asidePos, zsidePos) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');

    // Set class based on direction and status (default to 0 if undefined)
    const direction = link.direction ?? 0;
    const status = link.status ?? 0;
    const directionClass = `direction-${direction}`;
    const statusClass = `status-${status}`;
    line.setAttribute('class', `link ${directionClass} ${statusClass}`);

    line.setAttribute('x1', asidePos.x);
    line.setAttribute('y1', asidePos.y);
    line.setAttribute('x2', zsidePos.x);
    line.setAttribute('y2', zsidePos.y);
    line.setAttribute('data-link-id', link.linkId);
    line.style.pointerEvents = 'stroke';
    line.style.cursor = 'pointer';

    // Set arrow markers based on direction
    switch(direction) {
        case this.LinkDirection.ASIDE_TO_ZSIDE:
            line.setAttribute('marker-end', `url(#arrow-end-${statusClass})`);
            break;
        case this.LinkDirection.ZSIDE_TO_ASIDE:
            line.setAttribute('marker-start', `url(#arrow-start-${statusClass})`);
            break;
        case this.LinkDirection.BIDIRECTIONAL:
            line.setAttribute('marker-start', `url(#arrow-start-${statusClass})`);
            line.setAttribute('marker-end', `url(#arrow-end-${statusClass})`);
            break;
    }

    line.addEventListener('click', () => {
        this.showLinkDetails(link.linkId);
    });

    svg.appendChild(line);
};

TopologyBrowser.prototype.drawNode = function(svg, node, pos, locationKey, isHierarchical) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'node');
    group.setAttribute('data-node-id', locationKey);

    // Scale size based on count (min 6, max 20 for circles, larger for icons)
    const baseRadius = 6;
    const radius = node.count > 1 ? Math.min(baseRadius + Math.log2(node.count) * 3, 20) : baseRadius;

    const nodeType = node.type || 0;
    const iconConfig = isHierarchical ? NODE_TYPE_ICONS[nodeType] : null;

    let iconHeight = radius;
    if (iconConfig) {
        // Use SVG icon for hierarchical view with non-generic node types
        const iconSize = Math.max(28, radius * 2.5);
        iconHeight = iconSize / 2;
        const icon = createNetworkDeviceIcon(pos.x, pos.y, iconSize, iconConfig.color, nodeType);
        icon.setAttribute('class', 'node-icon');
        group.appendChild(icon);
    } else {
        // Use circle for map view or generic node type
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);
        circle.setAttribute('r', radius);
        group.appendChild(circle);
    }

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', pos.x);
    text.setAttribute('y', pos.y - iconHeight - 6);
    const label = node.count > 1 ? `${node.nodeId || node.name} (${node.count})` : (node.nodeId || node.name);
    text.textContent = label;

    group.appendChild(text);
    svg.appendChild(group);

    group.addEventListener('click', () => {
        this.showNodeDetails(locationKey);
    });
};

TopologyBrowser.prototype.highlightNode = function(nodeId) {
    const nodes = document.querySelectorAll('.node');
    nodes.forEach(node => {
        if (node.getAttribute('data-node-id') === nodeId) {
            node.style.opacity = '1';
            const circle = node.querySelector('circle');
            circle.setAttribute('r', '8');
        } else {
            node.style.opacity = '0.3';
        }
    });

    setTimeout(() => {
        nodes.forEach(node => {
            node.style.opacity = '1';
            const circle = node.querySelector('circle');
            circle.setAttribute('r', '6');
        });
    }, 2000);
};

TopologyBrowser.prototype.highlightLink = function(linkId) {
    const links = document.querySelectorAll('.link');
    links.forEach(link => {
        if (link.getAttribute('data-link-id') === linkId) {
            link.style.opacity = '1';
            link.style.strokeWidth = '4';
        } else {
            link.style.opacity = '0.2';
        }
    });

    setTimeout(() => {
        links.forEach(link => {
            link.style.opacity = '0.7';
            link.style.strokeWidth = '2';
        });
    }, 2000);
};

// Shared layout rendering for non-map layouts (positions calculated server-side)
TopologyBrowser.prototype.renderLayout = function() {
    const overlaySvg = document.getElementById('overlay-svg');

    overlaySvg.innerHTML = `
        <defs>
            <marker id="arrow-end-status-1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#00c853" />
            </marker>
            <marker id="arrow-end-status-2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff3d00" />
            </marker>
            <marker id="arrow-end-status-3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffc107" />
            </marker>
            <marker id="arrow-end-status-0" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#757575" />
            </marker>
            <marker id="arrow-start-status-1" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 10 0 L 0 5 L 10 10 z" fill="#00c853" />
            </marker>
            <marker id="arrow-start-status-2" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 10 0 L 0 5 L 10 10 z" fill="#ff3d00" />
            </marker>
            <marker id="arrow-start-status-3" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 10 0 L 0 5 L 10 10 z" fill="#ffc107" />
            </marker>
            <marker id="arrow-start-status-0" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 10 0 L 0 5 L 10 10 z" fill="#757575" />
            </marker>
        </defs>
        <rect width="100%" height="100%" fill="#f0f9ff" rx="8" />
    `;

    const nodes = this.currentTopology.nodes || {};
    const links = this.currentTopology.links || {};
    const locations = this.currentTopology.locations || {};

    const nodePositions = {};
    Object.entries(nodes).forEach(([locationKey, node]) => {
        const location = locations[node.location];
        if (location && location.svgX !== undefined && location.svgY !== undefined) {
            nodePositions[node.nodeId] = { x: location.svgX, y: location.svgY };
        }
    });

    Object.values(links).forEach(link => {
        const asidePos = nodePositions[link.aside];
        const zsidePos = nodePositions[link.zside];
        if (asidePos && zsidePos) {
            this.drawLink(overlaySvg, link, asidePos, zsidePos);
        }
    });

    Object.entries(nodes).forEach(([locationKey, node]) => {
        const pos = nodePositions[node.nodeId];
        if (pos) {
            this.drawNode(overlaySvg, node, pos, locationKey, true);
        }
    });
};
