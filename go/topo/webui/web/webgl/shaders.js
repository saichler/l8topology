// GLSL Shader Programs for WebGL Topology Renderer

const Shaders = {
    // Vertex shader for map background (full-screen quad)
    mapVertex: `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        uniform mat3 u_matrix;

        void main() {
            vec3 pos = u_matrix * vec3(a_position, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }
    `,

    // Fragment shader for map background
    mapFragment: `
        precision mediump float;
        varying vec2 v_texCoord;
        uniform sampler2D u_texture;
        uniform float u_opacity;

        void main() {
            vec4 color = texture2D(u_texture, v_texCoord);
            gl_FragColor = vec4(color.rgb, color.a * u_opacity);
        }
    `,

    // Vertex shader for nodes (instanced circles)
    nodeVertex: `
        attribute vec2 a_position;
        attribute vec2 a_center;
        attribute float a_radius;
        attribute vec4 a_color;
        attribute float a_selected;

        varying vec4 v_color;
        varying vec2 v_localPos;
        varying float v_selected;

        uniform mat3 u_matrix;
        uniform vec2 u_resolution;

        void main() {
            // Scale position by radius and translate to center
            vec2 worldPos = a_center + a_position * a_radius;
            vec3 pos = u_matrix * vec3(worldPos, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);

            v_color = a_color;
            v_localPos = a_position;
            v_selected = a_selected;
        }
    `,

    // Fragment shader for nodes (circle with border)
    nodeFragment: `
        precision mediump float;
        varying vec4 v_color;
        varying vec2 v_localPos;
        varying float v_selected;

        void main() {
            float dist = length(v_localPos);

            // Smooth circle edge
            float alpha = 1.0 - smoothstep(0.85, 1.0, dist);

            if (alpha < 0.01) discard;

            // Border effect
            float borderStart = 0.7;
            float border = smoothstep(borderStart, borderStart + 0.1, dist);

            // Selection glow
            vec3 baseColor = v_color.rgb;
            vec3 borderColor = vec3(1.0, 1.0, 1.0);

            if (v_selected > 0.5) {
                borderColor = vec3(1.0, 0.9, 0.0); // Yellow glow for selection
                alpha *= 1.2;
            }

            vec3 finalColor = mix(baseColor, borderColor, border * 0.8);
            gl_FragColor = vec4(finalColor, alpha * v_color.a);
        }
    `,

    // Vertex shader for links (lines)
    linkVertex: `
        attribute vec2 a_position;
        attribute vec4 a_color;

        varying vec4 v_color;

        uniform mat3 u_matrix;

        void main() {
            vec3 pos = u_matrix * vec3(a_position, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);
            v_color = a_color;
        }
    `,

    // Fragment shader for links
    linkFragment: `
        precision mediump float;
        varying vec4 v_color;

        void main() {
            gl_FragColor = v_color;
        }
    `,

    // Vertex shader for wide lines (using triangles for thickness)
    wideLinkVertex: `
        attribute vec2 a_position;
        attribute vec2 a_normal;
        attribute vec4 a_color;
        attribute float a_side;

        varying vec4 v_color;
        varying float v_edge;

        uniform mat3 u_matrix;
        uniform float u_lineWidth;
        uniform vec2 u_resolution;

        void main() {
            vec3 pos = u_matrix * vec3(a_position, 1.0);
            vec3 norm = u_matrix * vec3(a_normal, 0.0);

            // Offset by line width in screen space
            float width = u_lineWidth / min(u_resolution.x, u_resolution.y);
            pos.xy += normalize(norm.xy) * width * a_side;

            gl_Position = vec4(pos.xy, 0.0, 1.0);
            v_color = a_color;
            v_edge = abs(a_side);
        }
    `,

    // Fragment shader for wide lines with smooth edges
    wideLinkFragment: `
        precision mediump float;
        varying vec4 v_color;
        varying float v_edge;

        void main() {
            // Smooth edge falloff
            float alpha = 1.0 - smoothstep(0.5, 1.0, v_edge);
            gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
        }
    `,

    // Vertex shader for arrows (triangles)
    arrowVertex: `
        attribute vec2 a_position;
        attribute vec4 a_color;

        varying vec4 v_color;

        uniform mat3 u_matrix;

        void main() {
            vec3 pos = u_matrix * vec3(a_position, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);
            v_color = a_color;
        }
    `,

    // Fragment shader for arrows
    arrowFragment: `
        precision mediump float;
        varying vec4 v_color;

        void main() {
            gl_FragColor = v_color;
        }
    `,

    // Vertex shader for device icons (textured quads)
    iconVertex: `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        attribute vec2 a_center;
        attribute float a_size;
        attribute float a_iconIndex;
        attribute float a_selected;

        varying vec2 v_texCoord;
        varying float v_iconIndex;
        varying float v_selected;

        uniform mat3 u_matrix;
        uniform float u_iconsPerRow;

        void main() {
            // a_position already contains size-adjusted offsets, just add to center
            vec2 worldPos = a_center + a_position;
            vec3 pos = u_matrix * vec3(worldPos, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);

            // UV coordinates are pre-computed in JavaScript, pass through directly
            v_texCoord = a_texCoord;
            v_iconIndex = a_iconIndex;
            v_selected = a_selected;
        }
    `,

    // Fragment shader for device icons
    iconFragment: `
        precision mediump float;
        varying vec2 v_texCoord;
        varying float v_iconIndex;
        varying float v_selected;

        uniform sampler2D u_texture;

        void main() {
            vec4 color = texture2D(u_texture, v_texCoord);

            // Selection highlight
            if (v_selected > 0.5) {
                color.rgb = mix(color.rgb, vec3(1.0, 0.9, 0.0), 0.3);
            }

            if (color.a < 0.1) discard;
            gl_FragColor = color;
        }
    `,

    // Vertex shader for picking (renders unique colors for hit detection)
    pickingVertex: `
        attribute vec2 a_position;
        attribute vec2 a_center;
        attribute float a_radius;
        attribute vec3 a_pickColor;

        varying vec3 v_pickColor;
        varying vec2 v_localPos;

        uniform mat3 u_matrix;

        void main() {
            vec2 worldPos = a_center + a_position * a_radius;
            vec3 pos = u_matrix * vec3(worldPos, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);

            v_pickColor = a_pickColor;
            v_localPos = a_position;
        }
    `,

    // Fragment shader for picking
    pickingFragment: `
        precision mediump float;
        varying vec3 v_pickColor;
        varying vec2 v_localPos;

        void main() {
            float dist = length(v_localPos);
            if (dist > 1.0) discard;

            gl_FragColor = vec4(v_pickColor, 1.0);
        }
    `,

    // Vertex shader for selection rectangle
    selectionVertex: `
        attribute vec2 a_position;
        uniform mat3 u_matrix;

        void main() {
            vec3 pos = u_matrix * vec3(a_position, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);
        }
    `,

    // Fragment shader for selection rectangle
    selectionFragment: `
        precision mediump float;
        uniform vec4 u_color;

        void main() {
            gl_FragColor = u_color;
        }
    `,

    // Vertex shader for text labels (textured quads from font atlas)
    textVertex: `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;

        varying vec2 v_texCoord;

        uniform mat3 u_matrix;

        void main() {
            vec3 pos = u_matrix * vec3(a_position, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }
    `,

    // Fragment shader for text labels
    textFragment: `
        precision mediump float;
        varying vec2 v_texCoord;

        uniform sampler2D u_texture;
        uniform vec4 u_color;

        void main() {
            float alpha = texture2D(u_texture, v_texCoord).a;
            gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
        }
    `
};

// Compile shader from source
function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

// Create shader program from vertex and fragment shaders
function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
        return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }

    // Clean up shaders (they're now linked to the program)
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
}

// Get all attribute and uniform locations for a program
function getProgramLocations(gl, program, attributes, uniforms) {
    const locations = {
        attributes: {},
        uniforms: {}
    };

    attributes.forEach(name => {
        locations.attributes[name] = gl.getAttribLocation(program, name);
    });

    uniforms.forEach(name => {
        locations.uniforms[name] = gl.getUniformLocation(program, name);
    });

    return locations;
}
