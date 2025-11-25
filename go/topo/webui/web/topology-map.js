// Map rendering methods for TopologyBrowser

// Null Island coordinates (0,0 lat/long in SVG space)
const NULL_ISLAND_X = 986;
const NULL_ISLAND_Y = 497;

TopologyBrowser.prototype.renderMap = function() {
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

TopologyBrowser.prototype.drawNode = function(svg, node, pos, locationKey) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'node');
    group.setAttribute('data-node-id', locationKey);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pos.x);
    circle.setAttribute('cy', pos.y);
    circle.setAttribute('r', '6');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', pos.x);
    text.setAttribute('y', pos.y - 10);
    text.textContent = node.nodeId || node.name;

    group.appendChild(circle);
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
