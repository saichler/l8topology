// Icon Renderer for WebGL Topology
// Renders device type icons for non-map layouts

class WebGLIconRenderer {
    constructor(renderer) {
        this.renderer = renderer;
        this.gl = renderer.gl;

        // Icon atlas
        this.atlasTexture = null;
        this.atlasCanvas = null;
        this.atlasSize = 512;
        this.iconSize = 64;
        this.iconsPerRow = 4;

        // Icon data
        this.icons = [];
        this.iconMap = new Map(); // nodeId -> index
        this.iconBuffer = null;
        this.iconData = null;

        // Constants
        this.ICON_VERTEX_SIZE = 8; // position(2) + texCoord(2) + center(2) + size(1) + iconIndex(1)

        // Icon type configs (matches NODE_TYPE_ICONS from topology-map.js)
        this.iconConfigs = {
            0: { color: '#0ea5e9', name: 'GENERIC' },
            1: { color: '#f97316', name: 'SWITCH' },
            2: { color: '#3b82f6', name: 'ROUTER' },
            3: { color: '#8b5cf6', name: 'AGGREGATION' },
            4: { color: '#ef4444', name: 'FIREWALL' },
            5: { color: '#22c55e', name: 'LOAD_BAL' },
            6: { color: '#06b6d4', name: 'AP' },
            7: { color: '#64748b', name: 'SERVER' },
            8: { color: '#a855f7', name: 'STORAGE' },
            9: { color: '#14b8a6', name: 'GATEWAY' }
        };

        // Selection state
        this.selectedIconId = null;
        this.hoveredIconId = null;

        this.isInitialized = false;
    }

    // Initialize the icon atlas
    async init() {
        await this.createIconAtlas();
        this.isInitialized = true;
    }

    // Create texture atlas with all device icons
    async createIconAtlas() {
        const canvas = document.createElement('canvas');
        canvas.width = this.atlasSize;
        canvas.height = this.atlasSize;
        const ctx = canvas.getContext('2d');

        // Clear with transparent background
        ctx.clearRect(0, 0, this.atlasSize, this.atlasSize);

        // Draw each icon type
        Object.entries(this.iconConfigs).forEach(([typeIndex, config], i) => {
            const col = i % this.iconsPerRow;
            const row = Math.floor(i / this.iconsPerRow);
            const x = col * this.iconSize + this.iconSize / 2;
            const y = row * this.iconSize + this.iconSize / 2;

            this.drawIconToCanvas(ctx, x, y, parseInt(typeIndex), config.color);
        });

        this.atlasCanvas = canvas;
        this.atlasTexture = this.renderer.createTextureFromCanvas(canvas);
    }

    // Draw a single icon to the atlas canvas using Lucide-style designs
    drawIconToCanvas(ctx, x, y, nodeType, color) {
        const size = this.iconSize * 0.75;

        ctx.save();
        ctx.translate(x, y);

        // Draw background circle
        const bgRadius = size * 0.48;
        ctx.beginPath();
        ctx.arc(0, 0, bgRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Subtle border
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Set up icon stroke style (Lucide-style)
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Scale factor for icon content (Lucide icons are 24x24)
        const s = size * 0.32;

        switch (nodeType) {
            case 1: // SWITCH - Network icon (connected nodes)
                this.drawLucideNetwork(ctx, s);
                break;

            case 2: // ROUTER - Router with signal
                this.drawLucideRouter(ctx, s);
                break;

            case 3: // AGGREGATION - Git merge
                this.drawLucideGitMerge(ctx, s);
                break;

            case 4: // FIREWALL - Shield
                this.drawLucideShield(ctx, s);
                break;

            case 5: // LOAD_BALANCER - Split/Scale
                this.drawLucideScale(ctx, s);
                break;

            case 6: // ACCESS_POINT - Wifi
                this.drawLucideWifi(ctx, s);
                break;

            case 7: // SERVER - Server rack
                this.drawLucideServer(ctx, s);
                break;

            case 8: // STORAGE - Hard drive
                this.drawLucideHardDrive(ctx, s);
                break;

            case 9: // GATEWAY - Door/Portal
                this.drawLucideGateway(ctx, s);
                break;

            default: // GENERIC - Box
                this.drawLucideBox(ctx, s);
                break;
        }

        ctx.restore();
    }

    // Lucide-style Network icon (connected nodes)
    drawLucideNetwork(ctx, s) {
        // Center node
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
        ctx.stroke();

        // Outer nodes and connections
        const angles = [0, Math.PI * 0.67, Math.PI * 1.33];
        const r = s * 0.8;
        angles.forEach(angle => {
            const nx = Math.cos(angle - Math.PI / 2) * r;
            const ny = Math.sin(angle - Math.PI / 2) * r;
            // Connection line
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(nx, ny);
            ctx.stroke();
            // Outer node
            ctx.beginPath();
            ctx.arc(nx, ny, s * 0.18, 0, Math.PI * 2);
            ctx.stroke();
        });
    }

    // Lucide-style Router icon
    drawLucideRouter(ctx, s) {
        // Main box
        ctx.beginPath();
        ctx.roundRect(-s * 0.9, -s * 0.35, s * 1.8, s * 0.9, s * 0.15);
        ctx.stroke();

        // Antennas
        ctx.beginPath();
        ctx.moveTo(-s * 0.4, -s * 0.35);
        ctx.lineTo(-s * 0.55, -s * 0.8);
        ctx.moveTo(s * 0.4, -s * 0.35);
        ctx.lineTo(s * 0.55, -s * 0.8);
        ctx.stroke();

        // LED indicators
        ctx.beginPath();
        ctx.arc(-s * 0.45, s * 0.1, s * 0.1, 0, Math.PI * 2);
        ctx.arc(0, s * 0.1, s * 0.1, 0, Math.PI * 2);
        ctx.arc(s * 0.45, s * 0.1, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }

    // Lucide-style Git Merge icon (for aggregation)
    drawLucideGitMerge(ctx, s) {
        // Main vertical line
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.9);
        ctx.lineTo(0, s * 0.9);
        ctx.stroke();

        // Branch line
        ctx.beginPath();
        ctx.moveTo(-s * 0.6, -s * 0.5);
        ctx.quadraticCurveTo(-s * 0.3, -s * 0.2, 0, s * 0.1);
        ctx.stroke();

        // Nodes
        ctx.beginPath();
        ctx.arc(0, -s * 0.7, s * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-s * 0.6, -s * 0.5, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, s * 0.7, s * 0.2, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Lucide-style Shield icon (for firewall)
    drawLucideShield(ctx, s) {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.9);
        ctx.lineTo(s * 0.75, -s * 0.55);
        ctx.lineTo(s * 0.75, s * 0.1);
        ctx.quadraticCurveTo(s * 0.6, s * 0.7, 0, s * 0.95);
        ctx.quadraticCurveTo(-s * 0.6, s * 0.7, -s * 0.75, s * 0.1);
        ctx.lineTo(-s * 0.75, -s * 0.55);
        ctx.closePath();
        ctx.stroke();

        // Checkmark inside
        ctx.beginPath();
        ctx.moveTo(-s * 0.25, s * 0.05);
        ctx.lineTo(-s * 0.05, s * 0.25);
        ctx.lineTo(s * 0.3, -s * 0.15);
        ctx.stroke();
    }

    // Lucide-style Scale icon (for load balancer)
    drawLucideScale(ctx, s) {
        // Center pole
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.7);
        ctx.lineTo(0, s * 0.9);
        ctx.stroke();

        // Top bar
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, -s * 0.5);
        ctx.lineTo(s * 0.8, -s * 0.5);
        ctx.stroke();

        // Left plate
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, -s * 0.5);
        ctx.lineTo(-s * 0.95, s * 0.1);
        ctx.lineTo(-s * 0.45, s * 0.1);
        ctx.lineTo(-s * 0.6, -s * 0.5);
        ctx.stroke();

        // Right plate
        ctx.beginPath();
        ctx.moveTo(s * 0.8, -s * 0.5);
        ctx.lineTo(s * 0.95, s * 0.1);
        ctx.lineTo(s * 0.45, s * 0.1);
        ctx.lineTo(s * 0.6, -s * 0.5);
        ctx.stroke();

        // Base
        ctx.beginPath();
        ctx.moveTo(-s * 0.4, s * 0.9);
        ctx.lineTo(s * 0.4, s * 0.9);
        ctx.stroke();
    }

    // Lucide-style Wifi icon
    drawLucideWifi(ctx, s) {
        // Waves
        const waves = [0.9, 0.6, 0.3];
        waves.forEach(scale => {
            ctx.beginPath();
            ctx.arc(0, s * 0.4, s * scale, -Math.PI * 0.75, -Math.PI * 0.25);
            ctx.stroke();
        });

        // Center dot
        ctx.beginPath();
        ctx.arc(0, s * 0.4, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
    }

    // Lucide-style Server icon
    drawLucideServer(ctx, s) {
        // Top unit
        ctx.beginPath();
        ctx.roundRect(-s * 0.8, -s * 0.9, s * 1.6, s * 0.55, s * 0.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s * 0.5, -s * 0.62, s * 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Bottom unit
        ctx.beginPath();
        ctx.roundRect(-s * 0.8, -s * 0.2, s * 1.6, s * 0.55, s * 0.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.08, s * 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Connection lines at bottom
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, s * 0.35);
        ctx.lineTo(-s * 0.3, s * 0.9);
        ctx.moveTo(s * 0.3, s * 0.35);
        ctx.lineTo(s * 0.3, s * 0.9);
        ctx.stroke();
    }

    // Lucide-style Hard Drive icon (for storage)
    drawLucideHardDrive(ctx, s) {
        // Main body
        ctx.beginPath();
        ctx.roundRect(-s * 0.9, -s * 0.6, s * 1.8, s * 1.2, s * 0.15);
        ctx.stroke();

        // Divider line
        ctx.beginPath();
        ctx.moveTo(-s * 0.9, s * 0.15);
        ctx.lineTo(s * 0.9, s * 0.15);
        ctx.stroke();

        // Platter circles
        ctx.beginPath();
        ctx.arc(0, -s * 0.2, s * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -s * 0.2, s * 0.12, 0, Math.PI * 2);
        ctx.fill();

        // LED
        ctx.beginPath();
        ctx.arc(s * 0.6, s * 0.38, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }

    // Lucide-style Gateway icon (door with arrow)
    drawLucideGateway(ctx, s) {
        // Door frame
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, s * 0.9);
        ctx.lineTo(-s * 0.5, -s * 0.9);
        ctx.lineTo(s * 0.3, -s * 0.9);
        ctx.lineTo(s * 0.3, s * 0.9);
        ctx.stroke();

        // Arrow going through
        ctx.beginPath();
        ctx.moveTo(-s * 0.9, 0);
        ctx.lineTo(s * 0.9, 0);
        ctx.stroke();

        // Arrow head
        ctx.beginPath();
        ctx.moveTo(s * 0.5, -s * 0.3);
        ctx.lineTo(s * 0.9, 0);
        ctx.lineTo(s * 0.5, s * 0.3);
        ctx.stroke();
    }

    // Lucide-style Box icon (for generic)
    drawLucideBox(ctx, s) {
        // 3D box
        ctx.beginPath();
        // Front face
        ctx.moveTo(-s * 0.6, -s * 0.2);
        ctx.lineTo(-s * 0.6, s * 0.7);
        ctx.lineTo(s * 0.6, s * 0.7);
        ctx.lineTo(s * 0.6, -s * 0.2);
        ctx.closePath();
        ctx.stroke();

        // Top face
        ctx.beginPath();
        ctx.moveTo(-s * 0.6, -s * 0.2);
        ctx.lineTo(0, -s * 0.7);
        ctx.lineTo(s * 0.9, -s * 0.35);
        ctx.lineTo(s * 0.6, -s * 0.2);
        ctx.stroke();

        // Right face edge
        ctx.beginPath();
        ctx.moveTo(s * 0.6, -s * 0.2);
        ctx.lineTo(s * 0.9, -s * 0.35);
        ctx.lineTo(s * 0.9, s * 0.55);
        ctx.lineTo(s * 0.6, s * 0.7);
        ctx.stroke();
    }

    // Set icon data from topology nodes (for non-map layouts)
    setIcons(nodes, locations) {
        this.icons = [];
        this.iconMap.clear();

        let index = 0;
        Object.entries(nodes).forEach(([locationKey, node]) => {
            const location = locations[node.location];
            if (location && location.svgX !== undefined && location.svgY !== undefined) {
                const nodeType = node.type || 0;
                const iconData = {
                    id: locationKey,
                    nodeId: node.nodeId,
                    x: location.svgX,
                    y: location.svgY,
                    size: this.calculateSize(node.count || 1),
                    type: nodeType,
                    iconIndex: Math.min(nodeType, 9),
                    selected: false
                };
                this.icons.push(iconData);
                this.iconMap.set(locationKey, index);
                index++;
            }
        });

        this.buildBuffers();
    }

    // Calculate icon size based on node count
    calculateSize(count) {
        const baseSize = 28;
        return count > 1 ? Math.min(baseSize + Math.log2(count) * 8, 50) : baseSize;
    }

    // Build WebGL buffers
    buildBuffers() {
        const gl = this.gl;
        const iconCount = this.icons.length;

        if (iconCount === 0) {
            this.iconData = null;
            return;
        }

        // 6 vertices per icon (2 triangles for quad)
        // Each vertex: position(2) + texCoord(2) + center(2) + size(1) + iconIndex(1) + selected(1)
        const vertexSize = 9;
        this.iconData = new Float32Array(iconCount * 6 * vertexSize);

        this.icons.forEach((icon, i) => {
            this.updateIconQuad(i, icon);
        });

        if (!this.iconBuffer) {
            this.iconBuffer = gl.createBuffer();
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iconBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.iconData, gl.DYNAMIC_DRAW);
    }

    // Update quad vertices for a single icon
    updateIconQuad(index, icon) {
        const vertexSize = 9;
        const offset = index * 6 * vertexSize;

        // UV coordinates for this icon in atlas
        // Use actual pixel dimensions for UV scale (iconSize / atlasSize)
        const iconCol = icon.iconIndex % this.iconsPerRow;
        const iconRow = Math.floor(icon.iconIndex / this.iconsPerRow);
        const uvScale = this.iconSize / this.atlasSize;  // 64/512 = 0.125
        const u0 = iconCol * uvScale;
        const v0 = iconRow * uvScale;
        const u1 = u0 + uvScale;
        const v1 = v0 + uvScale;

        // Half size for vertex positions
        const hs = icon.size / 2;
        const sel = icon.selected ? 1.0 : 0.0;

        // Quad vertices (2 triangles)
        // Note: V coordinates are flipped (v0 at top, v1 at bottom) because
        // WebGL textures have (0,0) at bottom-left while Canvas has (0,0) at top-left
        // Screen top (-hs Y) should sample canvas top (lower V value)
        const vertices = [
            // Triangle 1
            [-hs, -hs, u0, v0, icon.x, icon.y, icon.size, icon.iconIndex, sel],
            [hs, -hs, u1, v0, icon.x, icon.y, icon.size, icon.iconIndex, sel],
            [-hs, hs, u0, v1, icon.x, icon.y, icon.size, icon.iconIndex, sel],
            // Triangle 2
            [-hs, hs, u0, v1, icon.x, icon.y, icon.size, icon.iconIndex, sel],
            [hs, -hs, u1, v0, icon.x, icon.y, icon.size, icon.iconIndex, sel],
            [hs, hs, u1, v1, icon.x, icon.y, icon.size, icon.iconIndex, sel]
        ];

        vertices.forEach((v, vi) => {
            const base = offset + vi * vertexSize;
            for (let j = 0; j < vertexSize; j++) {
                this.iconData[base + j] = v[j];
            }
        });
    }

    // Draw all icons
    draw(camera) {
        if (!this.isInitialized || !this.iconData || this.icons.length === 0) return;
        if (!this.atlasTexture) return;

        const gl = this.gl;
        const program = this.renderer.programs.icon;
        const locs = this.renderer.programs.iconLocations;

        gl.useProgram(program);

        // Set uniforms
        gl.uniformMatrix3fv(locs.uniforms.u_matrix, false, camera.getMatrix());
        gl.uniform1i(locs.uniforms.u_texture, 0);
        gl.uniform1f(locs.uniforms.u_iconsPerRow, this.iconsPerRow);

        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture.texture);

        // Bind buffer and setup attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iconBuffer);

        const vertexSize = 9;
        const stride = vertexSize * 4; // bytes

        gl.enableVertexAttribArray(locs.attributes.a_position);
        gl.vertexAttribPointer(locs.attributes.a_position, 2, gl.FLOAT, false, stride, 0);

        gl.enableVertexAttribArray(locs.attributes.a_texCoord);
        gl.vertexAttribPointer(locs.attributes.a_texCoord, 2, gl.FLOAT, false, stride, 8);

        gl.enableVertexAttribArray(locs.attributes.a_center);
        gl.vertexAttribPointer(locs.attributes.a_center, 2, gl.FLOAT, false, stride, 16);

        gl.enableVertexAttribArray(locs.attributes.a_size);
        gl.vertexAttribPointer(locs.attributes.a_size, 1, gl.FLOAT, false, stride, 24);

        gl.enableVertexAttribArray(locs.attributes.a_iconIndex);
        gl.vertexAttribPointer(locs.attributes.a_iconIndex, 1, gl.FLOAT, false, stride, 28);

        gl.enableVertexAttribArray(locs.attributes.a_selected);
        gl.vertexAttribPointer(locs.attributes.a_selected, 1, gl.FLOAT, false, stride, 32);

        // Draw all icons
        gl.drawArrays(gl.TRIANGLES, 0, this.icons.length * 6);

        // Disable attributes
        gl.disableVertexAttribArray(locs.attributes.a_position);
        gl.disableVertexAttribArray(locs.attributes.a_texCoord);
        gl.disableVertexAttribArray(locs.attributes.a_center);
        gl.disableVertexAttribArray(locs.attributes.a_size);
        gl.disableVertexAttribArray(locs.attributes.a_iconIndex);
        gl.disableVertexAttribArray(locs.attributes.a_selected);
    }

    // Select an icon by node ID
    selectIcon(nodeId) {
        if (this.selectedIconId !== null) {
            const prevIndex = this.iconMap.get(this.selectedIconId);
            if (prevIndex !== undefined) {
                this.icons[prevIndex].selected = false;
                this.updateIconQuad(prevIndex, this.icons[prevIndex]);
            }
        }

        this.selectedIconId = nodeId;

        if (nodeId !== null) {
            const index = this.iconMap.get(nodeId);
            if (index !== undefined) {
                this.icons[index].selected = true;
                this.updateIconQuad(index, this.icons[index]);
            }
        }

        this.updateBuffer();
    }

    // Find icon at world coordinates
    findIconAt(worldX, worldY) {
        for (let i = this.icons.length - 1; i >= 0; i--) {
            const icon = this.icons[i];
            const hs = icon.size / 2 * 1.1; // 10% margin

            if (worldX >= icon.x - hs && worldX <= icon.x + hs &&
                worldY >= icon.y - hs && worldY <= icon.y + hs) {
                return icon;
            }
        }
        return null;
    }

    // Get icon by ID
    getIconById(nodeId) {
        const index = this.iconMap.get(nodeId);
        return index !== undefined ? this.icons[index] : null;
    }

    // Update buffer on GPU
    updateBuffer() {
        if (!this.iconData || !this.iconBuffer) return;

        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iconBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.iconData);
    }

    // Get all icons
    getAllIcons() {
        return this.icons;
    }

    // Cleanup
    destroy() {
        const gl = this.gl;

        if (this.iconBuffer) {
            gl.deleteBuffer(this.iconBuffer);
            this.iconBuffer = null;
        }

        if (this.atlasTexture) {
            gl.deleteTexture(this.atlasTexture.texture);
            this.atlasTexture = null;
        }

        this.iconData = null;
        this.icons = [];
        this.iconMap.clear();
        this.isInitialized = false;
    }
}
