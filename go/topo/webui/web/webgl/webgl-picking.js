// Picking System for WebGL Topology
// Handles hit detection using GPU color picking and CPU math

class WebGLPickingRenderer {
    constructor(renderer) {
        this.renderer = renderer;
        this.gl = renderer.gl;

        // Offscreen framebuffer for picking
        this.pickingFramebuffer = null;
        this.pickingTexture = null;
        this.pickingSize = 1; // Size of area to sample (1x1 for single pixel)

        // Pixel buffer for reading
        this.pixelBuffer = new Uint8Array(4);

        // Last pick result
        this.lastPickResult = null;
        this.lastPickX = -1;
        this.lastPickY = -1;

        this.isInitialized = false;
    }

    // Initialize picking framebuffer
    init() {
        const gl = this.gl;

        // Create framebuffer
        this.pickingFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFramebuffer);

        // Create texture for color attachment
        this.pickingTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.pickingTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // Attach texture to framebuffer
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pickingTexture, 0);

        // Check framebuffer status
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Picking framebuffer is not complete');
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            return false;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.isInitialized = true;
        return true;
    }

    // Resize picking framebuffer to match canvas
    resize(width, height) {
        if (!this.isInitialized) return;

        const gl = this.gl;

        gl.bindTexture(gl.TEXTURE_2D, this.pickingTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // Pick at screen coordinates
    pick(screenX, screenY, camera, nodeRenderer, linkRenderer, iconRenderer, useIcons) {
        // Check cache
        if (screenX === this.lastPickX && screenY === this.lastPickY) {
            return this.lastPickResult;
        }

        // Try CPU picking first (faster for small datasets)
        const worldPos = camera.screenToWorld(screenX, screenY);
        let result = this.pickCPU(worldPos.x, worldPos.y, nodeRenderer, linkRenderer, iconRenderer, useIcons);

        this.lastPickX = screenX;
        this.lastPickY = screenY;
        this.lastPickResult = result;

        return result;
    }

    // CPU-based picking (point-in-shape tests)
    pickCPU(worldX, worldY, nodeRenderer, linkRenderer, iconRenderer, useIcons) {
        // Try nodes/icons first (they're on top)
        if (useIcons && iconRenderer) {
            const icon = iconRenderer.findIconAt(worldX, worldY);
            if (icon) {
                return { type: 'node', id: icon.id, data: icon };
            }
        } else if (nodeRenderer) {
            const node = nodeRenderer.findNodeAt(worldX, worldY);
            if (node) {
                return { type: 'node', id: node.id, data: node };
            }
        }

        // Try links
        if (linkRenderer) {
            const link = linkRenderer.findLinkAt(worldX, worldY, 8);
            if (link) {
                return { type: 'link', id: link.id, data: link };
            }
        }

        return null;
    }

    // GPU-based picking (render unique colors and read back)
    pickGPU(screenX, screenY, camera, nodeRenderer) {
        if (!this.isInitialized || !nodeRenderer) return null;

        const gl = this.gl;
        const width = camera.canvasWidth;
        const height = camera.canvasHeight;

        // Bind picking framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFramebuffer);
        gl.viewport(0, 0, width, height);

        // Clear with background color (index 0 = no hit)
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Disable blending for picking
        gl.disable(gl.BLEND);

        // Render nodes with pick colors
        nodeRenderer.drawPicking(camera);

        // Read pixel at mouse position (flip Y for WebGL coordinates)
        const pixelX = Math.floor(screenX);
        const pixelY = height - Math.floor(screenY) - 1;

        gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pixelBuffer);

        // Restore state
        gl.enable(gl.BLEND);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);

        // Decode pick color to index
        const r = this.pixelBuffer[0];
        const g = this.pixelBuffer[1];
        const b = this.pixelBuffer[2];

        const index = nodeRenderer.colorToIndex(r, g, b);

        if (index >= 0) {
            const node = nodeRenderer.getNodeAtIndex(index);
            if (node) {
                return { type: 'node', id: node.id, data: node };
            }
        }

        return null;
    }

    // Invalidate cache
    invalidate() {
        this.lastPickX = -1;
        this.lastPickY = -1;
        this.lastPickResult = null;
    }

    // Cleanup
    destroy() {
        const gl = this.gl;

        if (this.pickingFramebuffer) {
            gl.deleteFramebuffer(this.pickingFramebuffer);
            this.pickingFramebuffer = null;
        }

        if (this.pickingTexture) {
            gl.deleteTexture(this.pickingTexture);
            this.pickingTexture = null;
        }

        this.isInitialized = false;
    }
}

// Selection Rectangle Manager
class SelectionManager {
    constructor() {
        this.isSelecting = false;
        this.startX = 0;
        this.startY = 0;
        this.endX = 0;
        this.endY = 0;
    }

    // Start selection at screen coordinates
    startSelection(screenX, screenY) {
        this.isSelecting = true;
        this.startX = screenX;
        this.startY = screenY;
        this.endX = screenX;
        this.endY = screenY;
    }

    // Update selection end point
    updateSelection(screenX, screenY) {
        if (!this.isSelecting) return;
        this.endX = screenX;
        this.endY = screenY;
    }

    // End selection and return bounds
    endSelection() {
        this.isSelecting = false;

        const x = Math.min(this.startX, this.endX);
        const y = Math.min(this.startY, this.endY);
        const width = Math.abs(this.endX - this.startX);
        const height = Math.abs(this.endY - this.startY);

        // Only valid if selection is at least 10px
        if (width < 10 || height < 10) {
            return null;
        }

        return { x, y, width, height };
    }

    // Get current selection rectangle (in screen coords)
    getScreenRect() {
        if (!this.isSelecting) return null;

        return {
            x: Math.min(this.startX, this.endX),
            y: Math.min(this.startY, this.endY),
            width: Math.abs(this.endX - this.startX),
            height: Math.abs(this.endY - this.startY)
        };
    }

    // Convert selection to world coordinates
    getWorldRect(camera) {
        const screenRect = this.getScreenRect();
        if (!screenRect) return null;

        const topLeft = camera.screenToWorld(screenRect.x, screenRect.y);
        const bottomRight = camera.screenToWorld(
            screenRect.x + screenRect.width,
            screenRect.y + screenRect.height
        );

        return {
            x: topLeft.x,
            y: topLeft.y,
            x1: bottomRight.x,
            y1: bottomRight.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y
        };
    }

    // Cancel selection
    cancel() {
        this.isSelecting = false;
    }
}

// Pan Manager
class PanManager {
    constructor() {
        this.isPanning = false;
        this.lastX = 0;
        this.lastY = 0;
    }

    // Start panning
    startPan(screenX, screenY) {
        this.isPanning = true;
        this.lastX = screenX;
        this.lastY = screenY;
    }

    // Update pan and return delta
    updatePan(screenX, screenY) {
        if (!this.isPanning) return { dx: 0, dy: 0 };

        const dx = screenX - this.lastX;
        const dy = screenY - this.lastY;

        this.lastX = screenX;
        this.lastY = screenY;

        return { dx, dy };
    }

    // End panning
    endPan() {
        this.isPanning = false;
    }
}
