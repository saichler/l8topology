// Link Renderer for WebGL Topology
// Renders links as thick lines with direction arrows

class WebGLLinkRenderer {
    constructor(renderer) {
        this.renderer = renderer;
        this.gl = renderer.gl;

        // Link data
        this.links = [];
        this.linkMap = new Map(); // linkId -> index

        // Buffers
        this.lineBuffer = null;
        this.arrowBuffer = null;
        this.lineData = null;
        this.arrowData = null;

        // Constants
        this.LINE_VERTEX_SIZE = 6; // x, y, r, g, b, a
        this.lineWidth = 2.0;
        this.arrowSize = 8;

        // Colors for different statuses
        this.statusColors = {
            0: [0.459, 0.459, 0.459, 0.7], // Invalid - gray
            1: [0.0, 0.784, 0.325, 0.7],   // Up - green
            2: [1.0, 0.239, 0.0, 0.7],     // Down - red
            3: [1.0, 0.757, 0.027, 0.7]    // Partial - yellow
        };

        // Direction enum
        this.Direction = {
            INVALID: 0,
            ASIDE_TO_ZSIDE: 1,
            ZSIDE_TO_ASIDE: 2,
            BIDIRECTIONAL: 3
        };

        // Selection state
        this.selectedLinkId = null;
        this.hoveredLinkId = null;
    }

    // Set link data from topology
    setLinks(links, nodePositions) {
        this.links = [];
        this.linkMap.clear();

        let index = 0;
        Object.values(links).forEach(link => {
            const asidePos = nodePositions[link.aside] || this.findNodePosition(link.aside, nodePositions);
            const zsidePos = nodePositions[link.zside] || this.findNodePosition(link.zside, nodePositions);

            if (asidePos && zsidePos) {
                const status = link.status ?? 0;
                const linkData = {
                    id: link.linkId,
                    aside: link.aside,
                    zside: link.zside,
                    x1: asidePos.x,
                    y1: asidePos.y,
                    x2: zsidePos.x,
                    y2: zsidePos.y,
                    direction: link.direction ?? 0,
                    status: status,
                    color: [...this.statusColors[status]],
                    selected: false
                };
                this.links.push(linkData);
                this.linkMap.set(link.linkId, index);
                index++;
            }
        });

        this.buildBuffers();
    }

    // Find node position from link reference
    findNodePosition(linkRef, nodePositions) {
        const match = linkRef.match(/networkdevice<\{24\}\{24\}(\w+)\>/);
        if (match) {
            return nodePositions[match[1]];
        }
        return nodePositions[linkRef];
    }

    // Build WebGL buffers from link data
    buildBuffers() {
        const gl = this.gl;
        const linkCount = this.links.length;

        if (linkCount === 0) {
            this.lineData = null;
            this.arrowData = null;
            return;
        }

        // Build line data (2 vertices per line, 6 floats per vertex)
        this.lineData = new Float32Array(linkCount * 2 * this.LINE_VERTEX_SIZE);

        // Build arrow data (3 vertices per arrow, multiple arrows per link)
        const arrowVertices = [];

        this.links.forEach((link, i) => {
            this.updateLinkLine(i, link);
            this.buildArrowVertices(link, arrowVertices);
        });

        this.arrowData = new Float32Array(arrowVertices);

        // Create line buffer
        if (!this.lineBuffer) {
            this.lineBuffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.lineData, gl.DYNAMIC_DRAW);

        // Create arrow buffer
        if (!this.arrowBuffer) {
            this.arrowBuffer = gl.createBuffer();
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.arrowData, gl.STATIC_DRAW);
    }

    // Update line data for a single link
    updateLinkLine(index, link) {
        const offset = index * 2 * this.LINE_VERTEX_SIZE;

        // Vertex 1 (start)
        this.lineData[offset + 0] = link.x1;
        this.lineData[offset + 1] = link.y1;
        this.lineData[offset + 2] = link.color[0];
        this.lineData[offset + 3] = link.color[1];
        this.lineData[offset + 4] = link.color[2];
        this.lineData[offset + 5] = link.color[3];

        // Vertex 2 (end)
        this.lineData[offset + 6] = link.x2;
        this.lineData[offset + 7] = link.y2;
        this.lineData[offset + 8] = link.color[0];
        this.lineData[offset + 9] = link.color[1];
        this.lineData[offset + 10] = link.color[2];
        this.lineData[offset + 11] = link.color[3];
    }

    // Build arrow vertices for a link
    buildArrowVertices(link, vertices) {
        const dx = link.x2 - link.x1;
        const dy = link.y2 - link.y1;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len < 1) return;

        const nx = dx / len;
        const ny = dy / len;

        // Perpendicular vector
        const px = -ny;
        const py = nx;

        const arrowLen = this.arrowSize;
        const arrowWidth = this.arrowSize * 0.6;

        const addArrow = (tipX, tipY, dirX, dirY) => {
            // Arrow tip
            vertices.push(tipX, tipY, link.color[0], link.color[1], link.color[2], link.color[3]);
            // Arrow base left
            vertices.push(
                tipX - dirX * arrowLen + px * arrowWidth,
                tipY - dirY * arrowLen + py * arrowWidth,
                link.color[0], link.color[1], link.color[2], link.color[3]
            );
            // Arrow base right
            vertices.push(
                tipX - dirX * arrowLen - px * arrowWidth,
                tipY - dirY * arrowLen - py * arrowWidth,
                link.color[0], link.color[1], link.color[2], link.color[3]
            );
        };

        // Arrow at end (A->Z direction)
        if (link.direction === this.Direction.ASIDE_TO_ZSIDE ||
            link.direction === this.Direction.BIDIRECTIONAL) {
            // Offset arrow from endpoint
            const tipX = link.x2 - nx * 10;
            const tipY = link.y2 - ny * 10;
            addArrow(tipX, tipY, nx, ny);
        }

        // Arrow at start (Z->A direction)
        if (link.direction === this.Direction.ZSIDE_TO_ASIDE ||
            link.direction === this.Direction.BIDIRECTIONAL) {
            // Offset arrow from start point, pointing back
            const tipX = link.x1 + nx * 10;
            const tipY = link.y1 + ny * 10;
            addArrow(tipX, tipY, -nx, -ny);
        }
    }

    // Draw all links
    draw(camera) {
        if (!this.lineData || this.links.length === 0) return;

        const gl = this.gl;

        // Draw lines
        this.drawLines(camera);

        // Draw arrows
        this.drawArrows(camera);
    }

    // Draw link lines
    drawLines(camera) {
        const gl = this.gl;
        const program = this.renderer.programs.link;
        const locs = this.renderer.programs.linkLocations;

        gl.useProgram(program);
        gl.uniformMatrix3fv(locs.uniforms.u_matrix, false, camera.getMatrix());

        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);

        const stride = this.LINE_VERTEX_SIZE * 4; // bytes

        gl.enableVertexAttribArray(locs.attributes.a_position);
        gl.vertexAttribPointer(locs.attributes.a_position, 2, gl.FLOAT, false, stride, 0);

        gl.enableVertexAttribArray(locs.attributes.a_color);
        gl.vertexAttribPointer(locs.attributes.a_color, 4, gl.FLOAT, false, stride, 8);

        // Set line width (note: may be limited by GPU)
        gl.lineWidth(this.lineWidth);

        gl.drawArrays(gl.LINES, 0, this.links.length * 2);

        gl.disableVertexAttribArray(locs.attributes.a_position);
        gl.disableVertexAttribArray(locs.attributes.a_color);
    }

    // Draw direction arrows
    drawArrows(camera) {
        if (!this.arrowData || this.arrowData.length === 0) return;

        const gl = this.gl;
        const program = this.renderer.programs.arrow;
        const locs = this.renderer.programs.arrowLocations;

        gl.useProgram(program);
        gl.uniformMatrix3fv(locs.uniforms.u_matrix, false, camera.getMatrix());

        gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowBuffer);

        const stride = 6 * 4; // 6 floats * 4 bytes

        gl.enableVertexAttribArray(locs.attributes.a_position);
        gl.vertexAttribPointer(locs.attributes.a_position, 2, gl.FLOAT, false, stride, 0);

        gl.enableVertexAttribArray(locs.attributes.a_color);
        gl.vertexAttribPointer(locs.attributes.a_color, 4, gl.FLOAT, false, stride, 8);

        const vertexCount = this.arrowData.length / 6;
        gl.drawArrays(gl.TRIANGLES, 0, vertexCount);

        gl.disableVertexAttribArray(locs.attributes.a_position);
        gl.disableVertexAttribArray(locs.attributes.a_color);
    }

    // Select a link by ID
    selectLink(linkId) {
        // Deselect previous
        if (this.selectedLinkId !== null) {
            const prevIndex = this.linkMap.get(this.selectedLinkId);
            if (prevIndex !== undefined) {
                const link = this.links[prevIndex];
                link.selected = false;
                link.color = [...this.statusColors[link.status]];
                this.updateLinkLine(prevIndex, link);
            }
        }

        this.selectedLinkId = linkId;

        // Select new
        if (linkId !== null) {
            const index = this.linkMap.get(linkId);
            if (index !== undefined) {
                const link = this.links[index];
                link.selected = true;
                link.color[3] = 1.0; // Full opacity
                this.updateLinkLine(index, link);
            }
        }

        this.updateLineBuffer();
    }

    // Set hover state on a link
    setHovered(linkId) {
        // Unhover previous
        if (this.hoveredLinkId !== null && this.hoveredLinkId !== this.selectedLinkId) {
            const prevIndex = this.linkMap.get(this.hoveredLinkId);
            if (prevIndex !== undefined) {
                const link = this.links[prevIndex];
                link.color = [...this.statusColors[link.status]];
                this.updateLinkLine(prevIndex, link);
            }
        }

        this.hoveredLinkId = linkId;

        // Hover new
        if (linkId !== null && linkId !== this.selectedLinkId) {
            const index = this.linkMap.get(linkId);
            if (index !== undefined) {
                const link = this.links[index];
                link.color[3] = 1.0; // Full opacity
                this.updateLinkLine(index, link);
            }
        }

        this.updateLineBuffer();
    }

    // Get link by ID
    getLinkById(linkId) {
        const index = this.linkMap.get(linkId);
        return index !== undefined ? this.links[index] : null;
    }

    // Find link at world coordinates
    findLinkAt(worldX, worldY, threshold = 5) {
        for (let i = this.links.length - 1; i >= 0; i--) {
            const link = this.links[i];
            const dist = this.pointToLineDistance(worldX, worldY, link.x1, link.y1, link.x2, link.y2);

            if (dist <= threshold) {
                return link;
            }
        }
        return null;
    }

    // Calculate distance from point to line segment
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;

        if (lenSq === 0) {
            // Line segment is a point
            return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        }

        // Project point onto line segment
        let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const projX = x1 + t * dx;
        const projY = y1 + t * dy;

        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
    }

    // Highlight links connected to nodes
    highlightConnected(nodeIds) {
        const nodeSet = new Set(nodeIds);

        this.links.forEach((link, i) => {
            const asideId = this.extractNodeId(link.aside);
            const zsideId = this.extractNodeId(link.zside);

            if (nodeSet.has(asideId) || nodeSet.has(zsideId)) {
                link.color[3] = 1.0; // Full opacity
            } else {
                link.color[3] = 0.15; // Dimmed
            }
            this.updateLinkLine(i, link);
        });

        this.updateLineBuffer();
        this.rebuildArrows();
    }

    // Extract node ID from link reference
    extractNodeId(linkRef) {
        const match = linkRef.match(/networkdevice<\{24\}\{24\}(\w+)\>/);
        return match ? match[1] : linkRef;
    }

    // Reset all highlights
    resetHighlight() {
        this.links.forEach((link, i) => {
            link.color = [...this.statusColors[link.status]];
            if (link.id === this.selectedLinkId) {
                link.selected = true;
                link.color[3] = 1.0;
            }
            this.updateLinkLine(i, link);
        });

        this.updateLineBuffer();
        this.rebuildArrows();
    }

    // Update line buffer on GPU
    updateLineBuffer() {
        if (!this.lineData || !this.lineBuffer) return;

        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lineData);
    }

    // Rebuild arrow buffer (needed when colors change)
    rebuildArrows() {
        const arrowVertices = [];
        this.links.forEach(link => {
            this.buildArrowVertices(link, arrowVertices);
        });

        this.arrowData = new Float32Array(arrowVertices);

        if (this.arrowBuffer) {
            const gl = this.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.arrowBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.arrowData, gl.STATIC_DRAW);
        }
    }

    // Get all links
    getAllLinks() {
        return this.links;
    }

    // Cleanup
    destroy() {
        const gl = this.gl;

        if (this.lineBuffer) {
            gl.deleteBuffer(this.lineBuffer);
            this.lineBuffer = null;
        }

        if (this.arrowBuffer) {
            gl.deleteBuffer(this.arrowBuffer);
            this.arrowBuffer = null;
        }

        this.lineData = null;
        this.arrowData = null;
        this.links = [];
        this.linkMap.clear();
    }
}
