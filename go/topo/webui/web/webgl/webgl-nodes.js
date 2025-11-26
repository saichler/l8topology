// Node Renderer for WebGL Topology
// Uses instanced rendering for efficient drawing of many nodes

class WebGLNodeRenderer {
    constructor(renderer) {
        this.renderer = renderer;
        this.gl = renderer.gl;

        // Node data
        this.nodes = [];
        this.nodeMap = new Map(); // nodeId -> index

        // Buffers
        this.instanceBuffer = null;
        this.instanceData = null;

        // Constants
        this.INSTANCE_SIZE = 10; // floats per instance: x, y, radius, r, g, b, a, selected, pickR, pickG
        this.circleSegments = 32;

        // Selection state
        this.selectedNodeId = null;
        this.hoveredNodeId = null;

        // Colors for different node states
        this.defaultColor = [0.055, 0.647, 0.914, 1.0]; // Sky blue
        this.hoverColor = [0.082, 0.749, 0.937, 1.0];   // Lighter blue
    }

    // Set node data from topology
    setNodes(nodes, locations) {
        this.nodes = [];
        this.nodeMap.clear();

        let index = 0;
        Object.entries(nodes).forEach(([locationKey, node]) => {
            const location = locations[node.location];
            if (location && location.svgX !== undefined && location.svgY !== undefined) {
                const nodeData = {
                    id: locationKey,
                    nodeId: node.nodeId,
                    x: location.svgX,
                    y: location.svgY,
                    radius: this.calculateRadius(node.count || 1),
                    count: node.count || 1,
                    type: node.type || 0,
                    color: [...this.defaultColor],
                    selected: false
                };
                this.nodes.push(nodeData);
                this.nodeMap.set(locationKey, index);
                index++;
            }
        });

        this.buildBuffers();
    }

    // Calculate node radius based on count
    calculateRadius(count) {
        const baseRadius = 6;
        return count > 1 ? Math.min(baseRadius + Math.log2(count) * 3, 20) : baseRadius;
    }

    // Build WebGL buffers from node data
    buildBuffers() {
        const gl = this.gl;
        const nodeCount = this.nodes.length;

        if (nodeCount === 0) {
            this.instanceData = null;
            return;
        }

        // Create instance data array
        this.instanceData = new Float32Array(nodeCount * this.INSTANCE_SIZE);

        this.nodes.forEach((node, i) => {
            this.updateNodeInstance(i, node);
        });

        // Create or update instance buffer
        if (!this.instanceBuffer) {
            this.instanceBuffer = gl.createBuffer();
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.instanceData, gl.DYNAMIC_DRAW);
    }

    // Update instance data for a single node
    updateNodeInstance(index, node) {
        const offset = index * this.INSTANCE_SIZE;
        const data = this.instanceData;

        // Generate unique pick color from index
        const pickColor = this.indexToColor(index);

        data[offset + 0] = node.x;
        data[offset + 1] = node.y;
        data[offset + 2] = node.radius;
        data[offset + 3] = node.color[0];
        data[offset + 4] = node.color[1];
        data[offset + 5] = node.color[2];
        data[offset + 6] = node.color[3];
        data[offset + 7] = node.selected ? 1.0 : 0.0;
        data[offset + 8] = pickColor[0];
        data[offset + 9] = pickColor[1];
    }

    // Convert index to unique RGB color for picking
    indexToColor(index) {
        // Reserve 0 for "no hit", so add 1
        const id = index + 1;
        return [
            ((id >> 0) & 0xFF) / 255,
            ((id >> 8) & 0xFF) / 255,
            ((id >> 16) & 0xFF) / 255
        ];
    }

    // Convert pick color back to index
    colorToIndex(r, g, b) {
        const id = r + (g << 8) + (b << 16);
        return id > 0 ? id - 1 : -1;
    }

    // Draw all nodes
    draw(camera) {
        if (!this.instanceData || this.nodes.length === 0) return;

        const gl = this.gl;
        const program = this.renderer.programs.node;
        const locs = this.renderer.programs.nodeLocations;

        gl.useProgram(program);

        // Set uniforms
        gl.uniformMatrix3fv(locs.uniforms.u_matrix, false, camera.getMatrix());
        gl.uniform2f(locs.uniforms.u_resolution, camera.canvasWidth, camera.canvasHeight);

        // Bind unit circle for vertex positions
        const circle = this.renderer.buffers.unitCircle;
        gl.bindBuffer(gl.ARRAY_BUFFER, circle.buffer);
        gl.enableVertexAttribArray(locs.attributes.a_position);
        gl.vertexAttribPointer(locs.attributes.a_position, 2, gl.FLOAT, false, 0, 0);

        // Draw each node (instancing would be better but requires WebGL2/extension)
        this.nodes.forEach((node, i) => {
            const offset = i * this.INSTANCE_SIZE;

            // Set per-instance attributes as uniforms (simpler than true instancing)
            gl.vertexAttrib2f(locs.attributes.a_center,
                this.instanceData[offset + 0],
                this.instanceData[offset + 1]
            );
            gl.vertexAttrib1f(locs.attributes.a_radius, this.instanceData[offset + 2]);
            gl.vertexAttrib4f(locs.attributes.a_color,
                this.instanceData[offset + 3],
                this.instanceData[offset + 4],
                this.instanceData[offset + 5],
                this.instanceData[offset + 6]
            );
            gl.vertexAttrib1f(locs.attributes.a_selected, this.instanceData[offset + 7]);

            gl.drawArrays(gl.TRIANGLE_FAN, 0, circle.vertexCount);
        });

        gl.disableVertexAttribArray(locs.attributes.a_position);
    }

    // Draw nodes for picking (unique color per node)
    drawPicking(camera) {
        if (!this.instanceData || this.nodes.length === 0) return;

        const gl = this.gl;
        const program = this.renderer.programs.picking;
        const locs = this.renderer.programs.pickingLocations;

        gl.useProgram(program);
        gl.uniformMatrix3fv(locs.uniforms.u_matrix, false, camera.getMatrix());

        const circle = this.renderer.buffers.unitCircle;
        gl.bindBuffer(gl.ARRAY_BUFFER, circle.buffer);
        gl.enableVertexAttribArray(locs.attributes.a_position);
        gl.vertexAttribPointer(locs.attributes.a_position, 2, gl.FLOAT, false, 0, 0);

        this.nodes.forEach((node, i) => {
            const offset = i * this.INSTANCE_SIZE;
            const pickColor = this.indexToColor(i);

            gl.vertexAttrib2f(locs.attributes.a_center,
                this.instanceData[offset + 0],
                this.instanceData[offset + 1]
            );
            gl.vertexAttrib1f(locs.attributes.a_radius,
                this.instanceData[offset + 2] * 1.2 // Slightly larger hit area
            );
            gl.vertexAttrib3f(locs.attributes.a_pickColor, pickColor[0], pickColor[1], pickColor[2]);

            gl.drawArrays(gl.TRIANGLE_FAN, 0, circle.vertexCount);
        });

        gl.disableVertexAttribArray(locs.attributes.a_position);
    }

    // Select a node by ID
    selectNode(nodeId) {
        // Deselect previous
        if (this.selectedNodeId !== null) {
            const prevIndex = this.nodeMap.get(this.selectedNodeId);
            if (prevIndex !== undefined) {
                this.nodes[prevIndex].selected = false;
                this.nodes[prevIndex].color = [...this.defaultColor];
                this.updateNodeInstance(prevIndex, this.nodes[prevIndex]);
            }
        }

        this.selectedNodeId = nodeId;

        // Select new
        if (nodeId !== null) {
            const index = this.nodeMap.get(nodeId);
            if (index !== undefined) {
                this.nodes[index].selected = true;
                this.updateNodeInstance(index, this.nodes[index]);
            }
        }

        this.updateBuffer();
    }

    // Set hover state on a node
    setHovered(nodeId) {
        // Unhover previous
        if (this.hoveredNodeId !== null && this.hoveredNodeId !== this.selectedNodeId) {
            const prevIndex = this.nodeMap.get(this.hoveredNodeId);
            if (prevIndex !== undefined) {
                this.nodes[prevIndex].color = [...this.defaultColor];
                this.updateNodeInstance(prevIndex, this.nodes[prevIndex]);
            }
        }

        this.hoveredNodeId = nodeId;

        // Hover new (unless it's selected)
        if (nodeId !== null && nodeId !== this.selectedNodeId) {
            const index = this.nodeMap.get(nodeId);
            if (index !== undefined) {
                this.nodes[index].color = [...this.hoverColor];
                this.updateNodeInstance(index, this.nodes[index]);
            }
        }

        this.updateBuffer();
    }

    // Get node at pick index
    getNodeAtIndex(index) {
        if (index >= 0 && index < this.nodes.length) {
            return this.nodes[index];
        }
        return null;
    }

    // Get node by ID
    getNodeById(nodeId) {
        const index = this.nodeMap.get(nodeId);
        return index !== undefined ? this.nodes[index] : null;
    }

    // Update GPU buffer
    updateBuffer() {
        if (!this.instanceData || !this.instanceBuffer) return;

        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData);
    }

    // Highlight connected nodes (dim others)
    highlightConnected(nodeIds) {
        const connectedSet = new Set(nodeIds);

        this.nodes.forEach((node, i) => {
            if (connectedSet.has(node.id) || connectedSet.has(node.nodeId)) {
                node.color[3] = 1.0; // Full opacity
            } else {
                node.color[3] = 0.3; // Dimmed
            }
            this.updateNodeInstance(i, node);
        });

        this.updateBuffer();
    }

    // Reset all highlights
    resetHighlight() {
        this.nodes.forEach((node, i) => {
            node.color = [...this.defaultColor];
            if (node.id === this.selectedNodeId) {
                node.selected = true;
            }
            this.updateNodeInstance(i, node);
        });

        this.updateBuffer();
    }

    // Find node at world coordinates
    findNodeAt(worldX, worldY) {
        // Search in reverse order (top nodes first)
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const node = this.nodes[i];
            const dx = worldX - node.x;
            const dy = worldY - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= node.radius * 1.2) { // 20% margin for easier clicking
                return node;
            }
        }
        return null;
    }

    // Get all nodes
    getAllNodes() {
        return this.nodes;
    }

    // Cleanup
    destroy() {
        if (this.instanceBuffer) {
            this.gl.deleteBuffer(this.instanceBuffer);
            this.instanceBuffer = null;
        }
        this.instanceData = null;
        this.nodes = [];
        this.nodeMap.clear();
    }
}
