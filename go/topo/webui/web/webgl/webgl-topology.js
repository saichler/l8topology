// WebGL Topology Manager
// Integrates all WebGL components for complete topology visualization

class WebGLTopology {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.options = {
            viewWidth: 2000,
            viewHeight: 857,
            backgroundColor: [0.94, 0.97, 1.0, 1.0],
            ...options
        };

        // Components
        this.renderer = null;
        this.camera = null;
        this.nodeRenderer = null;
        this.linkRenderer = null;
        this.iconRenderer = null;
        this.pickingRenderer = null;
        this.selectionManager = new SelectionManager();
        this.panManager = new PanManager();

        // State
        this.isInitialized = false;
        this.layoutMode = 'map';
        this.mapTexture = null;
        this.topology = null;
        this.nodePositions = {};

        // Event callbacks
        this.onNodeClick = null;
        this.onLinkClick = null;
        this.onNodeHover = null;
        this.onLinkHover = null;
        this.onSelectionComplete = null;
        this.onZoomChange = null;

        // Animation
        this.animationFrameId = null;
        this.needsRender = true;
        this.lastFrameTime = 0;

        // Bind methods
        this.render = this.render.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    // Initialize all WebGL components
    async init() {
        // Create renderer
        this.renderer = new WebGLRenderer(this.canvas);
        if (!this.renderer.init()) {
            console.error('Failed to initialize WebGL renderer');
            return false;
        }
        this.renderer.backgroundColor = this.options.backgroundColor;

        // Create camera
        this.camera = new WebGLCamera(this.options.viewWidth, this.options.viewHeight);
        this.camera.setCanvasSize(this.canvas.width, this.canvas.height);

        // Create renderers
        this.nodeRenderer = new WebGLNodeRenderer(this.renderer);
        this.linkRenderer = new WebGLLinkRenderer(this.renderer);
        this.iconRenderer = new WebGLIconRenderer(this.renderer);
        await this.iconRenderer.init();

        // Create picking system
        this.pickingRenderer = new WebGLPickingRenderer(this.renderer);
        this.pickingRenderer.init();
        this.pickingRenderer.resize(this.canvas.width, this.canvas.height);

        // Setup event listeners
        this.setupEventListeners();

        // Start render loop
        this.startRenderLoop();

        this.isInitialized = true;
        return true;
    }

    // Load map texture (handles SVG by converting to canvas)
    async loadMapTexture(url) {
        try {
            // For SVG files, convert to canvas for better WebGL compatibility
            if (url.toLowerCase().endsWith('.svg')) {
                this.mapTexture = await this.loadSVGAsTexture(url);
            } else {
                this.mapTexture = await this.renderer.loadTexture(url);
            }
            this.needsRender = true;
        } catch (error) {
            console.error('Failed to load map texture:', error);
        }
    }

    // Load SVG and convert to canvas texture
    async loadSVGAsTexture(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                // Create canvas at desired resolution
                const canvas = document.createElement('canvas');
                const scale = 2; // 2x resolution for crisp rendering
                canvas.width = this.options.viewWidth * scale;
                canvas.height = this.options.viewHeight * scale;

                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#f0f9ff'; // Light blue background
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Create texture from canvas
                const texture = this.renderer.createTextureFromCanvas(canvas);
                resolve(texture);
            };

            img.onerror = () => {
                reject(new Error(`Failed to load SVG: ${url}`));
            };

            img.src = url;
        });
    }

    // Set topology data
    setTopology(topology) {
        this.topology = topology;
        this.buildNodePositions();
        this.updateRenderers();
        this.needsRender = true;
    }

    // Build node positions map
    buildNodePositions() {
        this.nodePositions = {};

        if (!this.topology) return;

        const nodes = this.topology.nodes || {};
        const locations = this.topology.locations || {};

        Object.entries(nodes).forEach(([locationKey, node]) => {
            const location = locations[node.location];
            if (location && location.svgX !== undefined && location.svgY !== undefined) {
                this.nodePositions[node.nodeId] = { x: location.svgX, y: location.svgY };
            }
        });
    }

    // Update all renderers with current topology
    updateRenderers() {
        if (!this.topology) return;

        const nodes = this.topology.nodes || {};
        const links = this.topology.links || {};
        const locations = this.topology.locations || {};

        // Update link renderer
        this.linkRenderer.setLinks(links, this.nodePositions);

        // Update node or icon renderer based on layout
        if (this.layoutMode === 'map') {
            this.nodeRenderer.setNodes(nodes, locations);
        } else {
            this.iconRenderer.setIcons(nodes, locations);
        }
    }

    // Set layout mode
    setLayoutMode(mode) {
        this.layoutMode = mode;

        // Update background visibility
        if (mode === 'map') {
            this.renderer.mapOpacity = 1.0;
            this.renderer.backgroundColor = [0.94, 0.97, 1.0, 1.0];
        } else {
            this.renderer.mapOpacity = 0.0;
            this.renderer.backgroundColor = [0.941, 0.973, 1.0, 1.0]; // Light blue
        }

        // Rebuild renderers
        if (this.topology) {
            this.updateRenderers();
        }

        this.camera.reset();
        this.needsRender = true;
    }

    // Setup event listeners
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);
        this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
        window.addEventListener('resize', this.handleResize);
    }

    // Handle mouse down
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (e.shiftKey) {
            // Start selection
            this.selectionManager.startSelection(x, y);
            this.canvas.style.cursor = 'crosshair';
        } else if (this.camera.zoom > 1) {
            // Start panning
            this.panManager.startPan(x, y);
            this.canvas.style.cursor = 'grabbing';
        }

        this.needsRender = true;
    }

    // Handle mouse move
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.selectionManager.isSelecting) {
            this.selectionManager.updateSelection(x, y);
            this.needsRender = true;
        } else if (this.panManager.isPanning) {
            const delta = this.panManager.updatePan(x, y);
            this.camera.pan(delta.dx, delta.dy);
            this.pickingRenderer.invalidate();
            this.needsRender = true;
        } else {
            // Hover detection
            this.handleHover(x, y);
        }
    }

    // Handle mouse up
    handleMouseUp(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.selectionManager.isSelecting) {
            // Get world bounds BEFORE ending selection (endSelection sets isSelecting=false)
            const worldBounds = this.selectionManager.getWorldRect(this.camera);
            const bounds = this.selectionManager.endSelection();
            this.canvas.style.cursor = this.camera.zoom > 1 ? 'grab' : 'default';

            if (bounds && worldBounds && this.onSelectionComplete) {
                this.onSelectionComplete(worldBounds);
            }
        } else if (this.panManager.isPanning) {
            this.panManager.endPan();
            this.canvas.style.cursor = this.camera.zoom > 1 ? 'grab' : 'default';
        } else {
            // Click detection
            this.handleClick(x, y);
        }

        this.needsRender = true;
    }

    // Handle wheel zoom
    handleWheel(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const zoomDelta = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        this.camera.zoomToPoint(x, y, zoomDelta);

        this.canvas.style.cursor = this.camera.zoom > 1 ? 'grab' : 'default';
        this.pickingRenderer.invalidate();
        this.needsRender = true;

        if (this.onZoomChange) {
            this.onZoomChange(this.camera.zoom, this.camera.getZoomPercent());
        }
    }

    // Handle window resize
    handleResize() {
        this.renderer.resize();
        this.camera.setCanvasSize(this.canvas.width, this.canvas.height);
        this.pickingRenderer.resize(this.canvas.width, this.canvas.height);
        this.needsRender = true;
    }

    // Handle hover
    handleHover(screenX, screenY) {
        const useIcons = this.layoutMode !== 'map';
        const result = this.pickingRenderer.pick(
            screenX, screenY, this.camera,
            this.nodeRenderer, this.linkRenderer, this.iconRenderer, useIcons
        );

        if (result) {
            this.canvas.style.cursor = 'pointer';

            if (result.type === 'node') {
                if (this.onNodeHover) this.onNodeHover(result.id, result.data);
                if (useIcons) {
                    // No hover effect for icons currently
                } else {
                    this.nodeRenderer.setHovered(result.id);
                }
            } else if (result.type === 'link') {
                if (this.onLinkHover) this.onLinkHover(result.id, result.data);
                this.linkRenderer.setHovered(result.id);
            }
        } else {
            this.canvas.style.cursor = this.camera.zoom > 1 ? 'grab' : 'default';
            if (!useIcons) this.nodeRenderer.setHovered(null);
            this.linkRenderer.setHovered(null);
        }

        this.needsRender = true;
    }

    // Handle click
    handleClick(screenX, screenY) {
        const useIcons = this.layoutMode !== 'map';
        const result = this.pickingRenderer.pick(
            screenX, screenY, this.camera,
            this.nodeRenderer, this.linkRenderer, this.iconRenderer, useIcons
        );

        if (result) {
            if (result.type === 'node') {
                if (useIcons) {
                    this.iconRenderer.selectIcon(result.id);
                } else {
                    this.nodeRenderer.selectNode(result.id);
                }
                if (this.onNodeClick) this.onNodeClick(result.id, result.data);
            } else if (result.type === 'link') {
                this.linkRenderer.selectLink(result.id);
                if (this.onLinkClick) this.onLinkClick(result.id, result.data);
            }
        }
    }

    // Zoom controls
    zoomIn() {
        this.camera.zoomIn();
        this.pickingRenderer.invalidate();
        this.needsRender = true;
        if (this.onZoomChange) {
            this.onZoomChange(this.camera.zoom, this.camera.getZoomPercent());
        }
    }

    zoomOut() {
        this.camera.zoomOut();
        this.pickingRenderer.invalidate();
        this.needsRender = true;
        if (this.onZoomChange) {
            this.onZoomChange(this.camera.zoom, this.camera.getZoomPercent());
        }
    }

    resetZoom() {
        this.camera.reset();
        this.pickingRenderer.invalidate();
        this.needsRender = true;
        if (this.onZoomChange) {
            this.onZoomChange(this.camera.zoom, this.camera.getZoomPercent());
        }
    }

    // Zoom to bounds
    zoomToBounds(bounds) {
        this.camera.zoomToBounds(bounds.x, bounds.y, bounds.width, bounds.height);
        this.pickingRenderer.invalidate();
        this.needsRender = true;
        if (this.onZoomChange) {
            this.onZoomChange(this.camera.zoom, this.camera.getZoomPercent());
        }
    }

    // Get current zoom level
    getZoom() {
        return this.camera.zoom;
    }

    getZoomPercent() {
        return this.camera.getZoomPercent();
    }

    // Get visible bounds in world coordinates
    getVisibleBounds() {
        return this.camera.getVisibleBounds();
    }

    // Highlight node
    highlightNode(nodeId) {
        if (this.layoutMode === 'map') {
            this.nodeRenderer.selectNode(nodeId);
        } else {
            this.iconRenderer.selectIcon(nodeId);
        }
        this.needsRender = true;
    }

    // Highlight link
    highlightLink(linkId) {
        this.linkRenderer.selectLink(linkId);
        this.needsRender = true;
    }

    // Reset all highlights
    resetHighlights() {
        this.nodeRenderer.resetHighlight();
        this.linkRenderer.resetHighlight();
        this.needsRender = true;
    }

    // Start render loop
    startRenderLoop() {
        const loop = (timestamp) => {
            const deltaTime = timestamp - this.lastFrameTime;
            this.lastFrameTime = timestamp;

            // Update camera animation
            if (this.camera.update(deltaTime)) {
                this.needsRender = true;
            }

            // Render if needed
            if (this.needsRender) {
                this.render();
                this.needsRender = false;
            }

            this.animationFrameId = requestAnimationFrame(loop);
        };

        this.animationFrameId = requestAnimationFrame(loop);
    }

    // Render frame
    render() {
        if (!this.isInitialized) return;

        this.renderer.resize();
        this.camera.setCanvasSize(this.canvas.width, this.canvas.height);
        this.renderer.clear();

        // Draw map background (only in map mode)
        if (this.layoutMode === 'map' && this.mapTexture) {
            this.drawMap();
        }

        // Draw links (always under nodes)
        this.linkRenderer.draw(this.camera);

        // Draw nodes or icons based on layout
        if (this.layoutMode === 'map') {
            this.nodeRenderer.draw(this.camera);
        } else {
            this.iconRenderer.draw(this.camera);
        }

        // Draw selection rectangle
        if (this.selectionManager.isSelecting) {
            const rect = this.selectionManager.getWorldRect(this.camera);
            if (rect) {
                this.renderer.drawSelectionRect(rect.x, rect.y, rect.width, rect.height, this.camera.getMatrix());
            }
        }
    }

    // Draw map background with proper scaling
    drawMap() {
        if (!this.mapTexture) return;

        const gl = this.renderer.gl;
        const program = this.renderer.programs.map;
        const locs = this.renderer.programs.mapLocations;

        gl.useProgram(program);

        // Create matrix that maps the map texture to fill the view
        const matrix = this.camera.getMatrix();
        gl.uniformMatrix3fv(locs.uniforms.u_matrix, false, matrix);
        gl.uniform1i(locs.uniforms.u_texture, 0);
        gl.uniform1f(locs.uniforms.u_opacity, this.renderer.mapOpacity);

        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.mapTexture.texture);

        // Create map quad that fills the view space (0,0 to viewWidth,viewHeight)
        const w = this.options.viewWidth;
        const h = this.options.viewHeight;

        const vertices = new Float32Array([
            0, 0, 0, 0,
            w, 0, 1, 0,
            0, h, 0, 1,
            w, h, 1, 1
        ]);

        const buffer = this.renderer.createBuffer(vertices, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(locs.attributes.a_position);
        gl.vertexAttribPointer(locs.attributes.a_position, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(locs.attributes.a_texCoord);
        gl.vertexAttribPointer(locs.attributes.a_texCoord, 2, gl.FLOAT, false, 16, 8);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.disableVertexAttribArray(locs.attributes.a_position);
        gl.disableVertexAttribArray(locs.attributes.a_texCoord);
        gl.deleteBuffer(buffer);
    }

    // Request a render
    requestRender() {
        this.needsRender = true;
    }

    // Cleanup
    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        // Remove event listeners
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
        this.canvas.removeEventListener('wheel', this.handleWheel);
        window.removeEventListener('resize', this.handleResize);

        // Destroy components
        if (this.nodeRenderer) this.nodeRenderer.destroy();
        if (this.linkRenderer) this.linkRenderer.destroy();
        if (this.iconRenderer) this.iconRenderer.destroy();
        if (this.pickingRenderer) this.pickingRenderer.destroy();
        if (this.renderer) this.renderer.destroy();

        this.isInitialized = false;
    }
}
