// Core WebGL Renderer for Topology Visualization

class WebGLRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.programs = {};
        this.buffers = {};
        this.textures = {};
        this.camera = null;
        this.nodeRenderer = null;
        this.linkRenderer = null;
        this.iconRenderer = null;
        this.pickingRenderer = null;
        this.isInitialized = false;
        this.animationFrameId = null;
        this.needsRender = true;
        this.mapOpacity = 1.0;
        this.backgroundColor = [0.94, 0.97, 1.0, 1.0]; // Light blue background
    }

    init() {
        // Try WebGL2 first, fall back to WebGL1
        this.gl = this.canvas.getContext('webgl2', {
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true
        });

        if (!this.gl) {
            this.gl = this.canvas.getContext('webgl', {
                alpha: true,
                antialias: true,
                preserveDrawingBuffer: true
            });
            this.isWebGL2 = false;
            console.log('Using WebGL 1');
        } else {
            this.isWebGL2 = true;
            console.log('Using WebGL 2');
        }

        if (!this.gl) {
            console.error('WebGL not supported');
            return false;
        }

        this.initShaderPrograms();
        this.initBuffers();
        this.setupBlending();
        this.resize();

        this.isInitialized = true;
        return true;
    }

    initShaderPrograms() {
        const gl = this.gl;

        // Map background program
        this.programs.map = createProgram(gl, Shaders.mapVertex, Shaders.mapFragment);
        this.programs.mapLocations = getProgramLocations(gl, this.programs.map,
            ['a_position', 'a_texCoord'],
            ['u_matrix', 'u_texture', 'u_opacity']
        );

        // Node rendering program
        this.programs.node = createProgram(gl, Shaders.nodeVertex, Shaders.nodeFragment);
        this.programs.nodeLocations = getProgramLocations(gl, this.programs.node,
            ['a_position', 'a_center', 'a_radius', 'a_color', 'a_selected'],
            ['u_matrix', 'u_resolution']
        );

        // Link rendering program
        this.programs.link = createProgram(gl, Shaders.linkVertex, Shaders.linkFragment);
        this.programs.linkLocations = getProgramLocations(gl, this.programs.link,
            ['a_position', 'a_color'],
            ['u_matrix']
        );

        // Wide link program (for thick lines)
        this.programs.wideLink = createProgram(gl, Shaders.wideLinkVertex, Shaders.wideLinkFragment);
        this.programs.wideLinkLocations = getProgramLocations(gl, this.programs.wideLink,
            ['a_position', 'a_normal', 'a_color', 'a_side'],
            ['u_matrix', 'u_lineWidth', 'u_resolution']
        );

        // Arrow program
        this.programs.arrow = createProgram(gl, Shaders.arrowVertex, Shaders.arrowFragment);
        this.programs.arrowLocations = getProgramLocations(gl, this.programs.arrow,
            ['a_position', 'a_color'],
            ['u_matrix']
        );

        // Icon program
        this.programs.icon = createProgram(gl, Shaders.iconVertex, Shaders.iconFragment);
        this.programs.iconLocations = getProgramLocations(gl, this.programs.icon,
            ['a_position', 'a_texCoord', 'a_center', 'a_size', 'a_iconIndex', 'a_selected'],
            ['u_matrix', 'u_texture', 'u_iconsPerRow']
        );

        // Picking program
        this.programs.picking = createProgram(gl, Shaders.pickingVertex, Shaders.pickingFragment);
        this.programs.pickingLocations = getProgramLocations(gl, this.programs.picking,
            ['a_position', 'a_center', 'a_radius', 'a_pickColor'],
            ['u_matrix']
        );

        // Selection rectangle program
        this.programs.selection = createProgram(gl, Shaders.selectionVertex, Shaders.selectionFragment);
        this.programs.selectionLocations = getProgramLocations(gl, this.programs.selection,
            ['a_position'],
            ['u_matrix', 'u_color']
        );
    }

    initBuffers() {
        const gl = this.gl;

        // Unit quad for map and icons (reusable)
        this.buffers.unitQuad = this.createQuadBuffer();

        // Unit circle vertices (for node rendering)
        this.buffers.unitCircle = this.createCircleBuffer(32);

        // Dynamic buffers will be created when data is loaded
        this.buffers.nodes = null;
        this.buffers.links = null;
        this.buffers.arrows = null;
        this.buffers.icons = null;
        this.buffers.picking = null;
    }

    createQuadBuffer() {
        const gl = this.gl;
        const vertices = new Float32Array([
            // Position (x, y), TexCoord (u, v)
            -1, -1, 0, 1,
             1, -1, 1, 1,
            -1,  1, 0, 0,
             1,  1, 1, 0
        ]);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        return {
            buffer,
            vertexCount: 4,
            stride: 16,
            positionOffset: 0,
            texCoordOffset: 8
        };
    }

    createCircleBuffer(segments) {
        const gl = this.gl;
        const vertices = [];

        // Center vertex
        vertices.push(0, 0);

        // Circle vertices
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            vertices.push(Math.cos(angle), Math.sin(angle));
        }

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        return {
            buffer,
            vertexCount: segments + 2,
            stride: 8,
            positionOffset: 0
        };
    }

    setupBlending() {
        const gl = this.gl;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    resize() {
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.gl.viewport(0, 0, displayWidth, displayHeight);
            this.needsRender = true;
        }
    }

    clear() {
        const gl = this.gl;
        const [r, g, b, a] = this.backgroundColor;
        gl.clearColor(r, g, b, a);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // Load texture from image URL
    loadTexture(url) {
        return new Promise((resolve, reject) => {
            const gl = this.gl;
            const texture = gl.createTexture();
            const image = new Image();

            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

                // Check if image is power of 2
                if (this.isPowerOf2(image.width) && this.isPowerOf2(image.height)) {
                    gl.generateMipmap(gl.TEXTURE_2D);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                } else {
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                }

                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

                resolve({
                    texture,
                    width: image.width,
                    height: image.height
                });
            };

            image.onerror = () => {
                reject(new Error(`Failed to load texture: ${url}`));
            };

            image.src = url;
        });
    }

    // Create texture from canvas (for generating icon atlas)
    createTextureFromCanvas(sourceCanvas) {
        const gl = this.gl;
        const texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        return {
            texture,
            width: sourceCanvas.width,
            height: sourceCanvas.height
        };
    }

    isPowerOf2(value) {
        return (value & (value - 1)) === 0;
    }

    // Create a buffer from Float32Array data
    createBuffer(data, usage = this.gl.STATIC_DRAW) {
        const gl = this.gl;
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, usage);
        return buffer;
    }

    // Update existing buffer with new data
    updateBuffer(buffer, data) {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    }

    // Create index buffer
    createIndexBuffer(data) {
        const gl = this.gl;
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return buffer;
    }

    // Setup vertex attribute
    setupAttribute(location, buffer, size, type, normalized, stride, offset) {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, type, normalized, stride, offset);
    }

    // Disable vertex attribute
    disableAttribute(location) {
        this.gl.disableVertexAttribArray(location);
    }

    // Draw map background
    drawMap(texture, matrix) {
        if (!texture) return;

        const gl = this.gl;
        const program = this.programs.map;
        const locs = this.programs.mapLocations;

        gl.useProgram(program);

        // Set uniforms
        gl.uniformMatrix3fv(locs.uniforms.u_matrix, false, matrix);
        gl.uniform1i(locs.uniforms.u_texture, 0);
        gl.uniform1f(locs.uniforms.u_opacity, this.mapOpacity);

        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture.texture);

        // Setup attributes
        const quad = this.buffers.unitQuad;
        gl.bindBuffer(gl.ARRAY_BUFFER, quad.buffer);

        gl.enableVertexAttribArray(locs.attributes.a_position);
        gl.vertexAttribPointer(locs.attributes.a_position, 2, gl.FLOAT, false, quad.stride, quad.positionOffset);

        gl.enableVertexAttribArray(locs.attributes.a_texCoord);
        gl.vertexAttribPointer(locs.attributes.a_texCoord, 2, gl.FLOAT, false, quad.stride, quad.texCoordOffset);

        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, quad.vertexCount);

        gl.disableVertexAttribArray(locs.attributes.a_position);
        gl.disableVertexAttribArray(locs.attributes.a_texCoord);
    }

    // Draw selection rectangle
    drawSelectionRect(x, y, width, height, matrix) {
        const gl = this.gl;
        const program = this.programs.selection;
        const locs = this.programs.selectionLocations;

        gl.useProgram(program);

        // Create rectangle vertices
        const vertices = new Float32Array([
            x, y,
            x + width, y,
            x + width, y + height,
            x, y + height,
            x, y // Close the rectangle
        ]);

        const buffer = this.createBuffer(vertices, gl.DYNAMIC_DRAW);

        gl.uniformMatrix3fv(locs.uniforms.u_matrix, false, matrix);
        gl.uniform4f(locs.uniforms.u_color, 0.055, 0.647, 0.914, 0.3); // Semi-transparent blue

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(locs.attributes.a_position);
        gl.vertexAttribPointer(locs.attributes.a_position, 2, gl.FLOAT, false, 0, 0);

        // Draw filled rectangle
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

        // Draw border
        gl.uniform4f(locs.uniforms.u_color, 0.055, 0.647, 0.914, 0.8);
        gl.drawArrays(gl.LINE_STRIP, 0, 5);

        gl.disableVertexAttribArray(locs.attributes.a_position);
        gl.deleteBuffer(buffer);
    }

    // Request a render on next animation frame
    requestRender() {
        this.needsRender = true;
    }

    // Cleanup resources
    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        const gl = this.gl;

        // Delete programs
        Object.values(this.programs).forEach(prog => {
            if (prog && typeof prog !== 'object') {
                gl.deleteProgram(prog);
            }
        });

        // Delete buffers
        Object.values(this.buffers).forEach(buf => {
            if (buf && buf.buffer) {
                gl.deleteBuffer(buf.buffer);
            }
        });

        // Delete textures
        Object.values(this.textures).forEach(tex => {
            if (tex && tex.texture) {
                gl.deleteTexture(tex.texture);
            }
        });

        this.isInitialized = false;
    }
}
