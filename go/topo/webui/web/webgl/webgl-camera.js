// Camera System for WebGL Topology Renderer
// Handles zoom, pan, and coordinate transformations

class WebGLCamera {
    constructor(viewWidth, viewHeight) {
        // View dimensions (SVG coordinate space)
        this.viewWidth = viewWidth || 2000;
        this.viewHeight = viewHeight || 857;

        // Camera state
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;

        // Zoom limits (minZoom 0.25 allows seeing full map since base is 2x)
        this.minZoom = 0.25;
        this.maxZoom = 10;

        // Canvas dimensions (will be set on resize)
        this.canvasWidth = 0;
        this.canvasHeight = 0;

        // Cached matrices
        this.projectionMatrix = new Float32Array(9);
        this.viewMatrix = new Float32Array(9);
        this.combinedMatrix = new Float32Array(9);
        this.inverseMatrix = new Float32Array(9);

        // Animation state
        this.targetZoom = 1.0;
        this.targetPanX = 0;
        this.targetPanY = 0;
        this.isAnimating = false;
        this.animationSpeed = 0.15;
    }

    // Set canvas dimensions and update projection
    setCanvasSize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;
        this.updateMatrices();
    }

    // Set view dimensions (SVG coordinate space)
    setViewSize(width, height) {
        this.viewWidth = width;
        this.viewHeight = height;
        this.updateMatrices();
    }

    // Zoom in
    zoomIn(factor = 1.2) {
        this.setZoom(this.zoom * factor);
    }

    // Zoom out
    zoomOut(factor = 1.2) {
        this.setZoom(this.zoom / factor);
    }

    // Set zoom level
    setZoom(zoom, animate = false) {
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));

        if (animate) {
            this.targetZoom = newZoom;
            this.isAnimating = true;
        } else {
            this.zoom = newZoom;
            this.updateMatrices();
        }

        return this.zoom;
    }

    // Zoom to a specific point (keeps that point at same screen position)
    zoomToPoint(screenX, screenY, zoomDelta) {
        // Convert screen point to world coordinates before zoom
        const worldBefore = this.screenToWorld(screenX, screenY);

        // Apply zoom
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomDelta));
        this.zoom = newZoom;

        // Convert same screen point to world coordinates after zoom
        this.updateMatrices();
        const worldAfter = this.screenToWorld(screenX, screenY);

        // Adjust pan to keep the point stationary
        // The difference tells us how the world point moved; we need to shift the view back
        this.panX -= (worldAfter.x - worldBefore.x);
        this.panY -= (worldAfter.y - worldBefore.y);

        this.updateMatrices();
    }

    // Pan by delta in screen pixels
    pan(deltaX, deltaY) {
        // Convert screen delta to world delta
        const canvasAspect = this.canvasWidth / this.canvasHeight;
        const viewAspect = this.viewWidth / this.viewHeight;

        let baseScale;
        if (canvasAspect > viewAspect) {
            baseScale = this.canvasHeight / this.viewHeight;
        } else {
            baseScale = this.canvasWidth / this.viewWidth;
        }

        // Pan is in world coordinates, so divide by scale and zoom
        this.panX -= deltaX / baseScale / this.zoom;
        this.panY -= deltaY / baseScale / this.zoom;
        this.updateMatrices();
    }

    // Set pan position directly (in world coordinates)
    setPan(x, y, animate = false) {
        if (animate) {
            this.targetPanX = x;
            this.targetPanY = y;
            this.isAnimating = true;
        } else {
            this.panX = x;
            this.panY = y;
            this.updateMatrices();
        }
    }

    // Reset to default view
    reset(animate = false) {
        if (animate) {
            this.targetZoom = 1.0;
            this.targetPanX = 0;
            this.targetPanY = 0;
            this.isAnimating = true;
        } else {
            this.zoom = 1.0;
            this.panX = 0;
            this.panY = 0;
            this.updateMatrices();
        }
    }

    // Zoom to fit a bounding box (in world coordinates)
    zoomToBounds(x, y, width, height, padding = 0.1) {
        // Calculate required zoom to fit bounds
        const scaleX = this.canvasWidth / (width * (1 + padding));
        const scaleY = this.canvasHeight / (height * (1 + padding));
        const baseScale = this.getWorldScale();
        const newZoom = Math.min(scaleX, scaleY) / baseScale;

        // Calculate pan to center bounds
        // Pan moves the effective center: effective_center = viewCenter + pan
        // We want effective_center = bounds_center
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        this.setZoom(Math.max(this.minZoom, Math.min(this.maxZoom, newZoom)));
        this.panX = centerX - this.viewWidth / 2;
        this.panY = centerY - this.viewHeight / 2;
        this.updateMatrices();
    }

    // Get the base scale factor (pixels per world unit at zoom=1)
    getWorldScale() {
        const aspectCanvas = this.canvasWidth / this.canvasHeight;
        const aspectView = this.viewWidth / this.viewHeight;

        let scale;
        if (aspectCanvas > aspectView) {
            // Canvas is wider - fit to height
            scale = this.canvasHeight / this.viewHeight;
        } else {
            // Canvas is taller - fit to width
            scale = this.canvasWidth / this.viewWidth;
        }

        // Match the 2x base scale used in computeCombinedMatrix
        return scale * 2.0;
    }

    // Update all matrices
    updateMatrices() {
        this.computeProjectionMatrix();
        this.computeViewMatrix();
        this.computeCombinedMatrix();
        this.computeInverseMatrix();
    }

    // Compute projection matrix (maps view coords to clip coords)
    computeProjectionMatrix() {
        // This will be combined with view matrix, so keep it simple
        // Just store the base scale factors
        const m = this.projectionMatrix;

        // Identity for now - actual projection done in combined matrix
        m[0] = 1; m[1] = 0; m[2] = 0;
        m[3] = 0; m[4] = 1; m[5] = 0;
        m[6] = 0; m[7] = 0; m[8] = 1;
    }

    // Compute view matrix (applies zoom and pan)
    computeViewMatrix() {
        // Identity for now - actual transform done in combined matrix
        const m = this.viewMatrix;
        m[0] = 1; m[1] = 0; m[2] = 0;
        m[3] = 0; m[4] = 1; m[5] = 0;
        m[6] = 0; m[7] = 0; m[8] = 1;
    }

    // Compute combined matrix that maps world coords directly to clip coords
    computeCombinedMatrix() {
        const m = this.combinedMatrix;

        // Calculate scale to fit view in canvas while maintaining aspect ratio
        const canvasAspect = this.canvasWidth / this.canvasHeight;
        const viewAspect = this.viewWidth / this.viewHeight;

        let baseScale;
        if (canvasAspect > viewAspect) {
            // Canvas is wider than view - fit to height
            baseScale = 2.0 / this.viewHeight;
        } else {
            // Canvas is taller than view - fit to width
            baseScale = 2.0 / this.viewWidth;
        }

        // Scale up by 2x so 100% zoom shows the map at a more usable size
        baseScale *= 2.0;

        // Apply zoom
        const scale = baseScale * this.zoom;

        // Scale factors for X and Y (correct for canvas aspect ratio)
        const scaleX = scale * (this.canvasHeight / this.canvasWidth);
        const scaleY = -scale; // Negative to flip Y axis

        // Center of view in world coordinates
        const viewCenterX = this.viewWidth / 2;
        const viewCenterY = this.viewHeight / 2;

        // Translation: move view center to origin, then apply pan
        // In clip space, origin (0,0) is center of screen
        const translateX = -(viewCenterX + this.panX) * scaleX;
        const translateY = -(viewCenterY + this.panY) * scaleY;

        // Build matrix (column-major for WebGL)
        m[0] = scaleX;
        m[1] = 0;
        m[2] = 0;

        m[3] = 0;
        m[4] = scaleY;
        m[5] = 0;

        m[6] = translateX;
        m[7] = translateY;
        m[8] = 1;
    }

    // Compute inverse of combined matrix for picking
    computeInverseMatrix() {
        this.invertMatrix(this.inverseMatrix, this.combinedMatrix);
    }

    // Multiply two 3x3 matrices (column-major)
    multiplyMatrices(out, a, b) {
        const a00 = a[0], a01 = a[1], a02 = a[2];
        const a10 = a[3], a11 = a[4], a12 = a[5];
        const a20 = a[6], a21 = a[7], a22 = a[8];

        const b00 = b[0], b01 = b[1], b02 = b[2];
        const b10 = b[3], b11 = b[4], b12 = b[5];
        const b20 = b[6], b21 = b[7], b22 = b[8];

        out[0] = a00 * b00 + a10 * b01 + a20 * b02;
        out[1] = a01 * b00 + a11 * b01 + a21 * b02;
        out[2] = a02 * b00 + a12 * b01 + a22 * b02;

        out[3] = a00 * b10 + a10 * b11 + a20 * b12;
        out[4] = a01 * b10 + a11 * b11 + a21 * b12;
        out[5] = a02 * b10 + a12 * b11 + a22 * b12;

        out[6] = a00 * b20 + a10 * b21 + a20 * b22;
        out[7] = a01 * b20 + a11 * b21 + a21 * b22;
        out[8] = a02 * b20 + a12 * b21 + a22 * b22;
    }

    // Invert a 3x3 matrix
    invertMatrix(out, m) {
        const a00 = m[0], a01 = m[1], a02 = m[2];
        const a10 = m[3], a11 = m[4], a12 = m[5];
        const a20 = m[6], a21 = m[7], a22 = m[8];

        const b01 = a22 * a11 - a12 * a21;
        const b11 = -a22 * a10 + a12 * a20;
        const b21 = a21 * a10 - a11 * a20;

        const det = a00 * b01 + a01 * b11 + a02 * b21;

        if (Math.abs(det) < 1e-10) {
            // Matrix is not invertible, return identity
            out[0] = 1; out[1] = 0; out[2] = 0;
            out[3] = 0; out[4] = 1; out[5] = 0;
            out[6] = 0; out[7] = 0; out[8] = 1;
            return;
        }

        const invDet = 1.0 / det;

        out[0] = b01 * invDet;
        out[1] = (-a22 * a01 + a02 * a21) * invDet;
        out[2] = (a12 * a01 - a02 * a11) * invDet;
        out[3] = b11 * invDet;
        out[4] = (a22 * a00 - a02 * a20) * invDet;
        out[5] = (-a12 * a00 + a02 * a10) * invDet;
        out[6] = b21 * invDet;
        out[7] = (-a21 * a00 + a01 * a20) * invDet;
        out[8] = (a11 * a00 - a01 * a10) * invDet;
    }

    // Convert screen coordinates to world (SVG) coordinates
    screenToWorld(screenX, screenY) {
        // Normalize to clip space (-1 to 1)
        const clipX = (screenX / this.canvasWidth) * 2 - 1;
        const clipY = -((screenY / this.canvasHeight) * 2 - 1); // Flip Y

        // Apply inverse matrix
        const m = this.inverseMatrix;
        const w = m[2] * clipX + m[5] * clipY + m[8];
        const x = (m[0] * clipX + m[3] * clipY + m[6]) / w;
        const y = (m[1] * clipX + m[4] * clipY + m[7]) / w;

        return { x, y };
    }

    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        const m = this.combinedMatrix;
        const w = m[2] * worldX + m[5] * worldY + m[8];
        const clipX = (m[0] * worldX + m[3] * worldY + m[6]) / w;
        const clipY = (m[1] * worldX + m[4] * worldY + m[7]) / w;

        const screenX = (clipX + 1) / 2 * this.canvasWidth;
        const screenY = (-clipY + 1) / 2 * this.canvasHeight;

        return { x: screenX, y: screenY };
    }

    // Get the combined matrix for shader uniforms
    getMatrix() {
        return this.combinedMatrix;
    }

    // Get zoom level as percentage string
    getZoomPercent() {
        return `${Math.round(this.zoom * 100)}%`;
    }

    // Update animation (call each frame)
    update(deltaTime) {
        if (!this.isAnimating) return false;

        const t = Math.min(1, this.animationSpeed * (deltaTime / 16.67));

        // Lerp towards targets
        this.zoom = this.lerp(this.zoom, this.targetZoom, t);
        this.panX = this.lerp(this.panX, this.targetPanX, t);
        this.panY = this.lerp(this.panY, this.targetPanY, t);

        // Check if animation is complete
        const zoomDiff = Math.abs(this.zoom - this.targetZoom);
        const panXDiff = Math.abs(this.panX - this.targetPanX);
        const panYDiff = Math.abs(this.panY - this.targetPanY);

        if (zoomDiff < 0.001 && panXDiff < 0.1 && panYDiff < 0.1) {
            this.zoom = this.targetZoom;
            this.panX = this.targetPanX;
            this.panY = this.targetPanY;
            this.isAnimating = false;
        }

        this.updateMatrices();
        return true;
    }

    // Linear interpolation helper
    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    // Get visible bounds in world coordinates
    getVisibleBounds() {
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(this.canvasWidth, this.canvasHeight);

        return {
            x: topLeft.x,
            y: topLeft.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y,
            x1: bottomRight.x,
            y1: bottomRight.y
        };
    }

    // Check if a point is visible
    isPointVisible(worldX, worldY, margin = 0) {
        const bounds = this.getVisibleBounds();
        return worldX >= bounds.x - margin &&
               worldX <= bounds.x1 + margin &&
               worldY >= bounds.y - margin &&
               worldY <= bounds.y1 + margin;
    }

    // Check if a circle is visible
    isCircleVisible(worldX, worldY, radius) {
        return this.isPointVisible(worldX, worldY, radius);
    }
}
