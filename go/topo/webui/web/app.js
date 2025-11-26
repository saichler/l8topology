// Initialize the Topology Browser application with WebGL support

let browser = null;
let webglTopology = null;
let useWebGL = true; // Set to false to use SVG fallback

async function initializeApp() {
    // Create the browser instance (handles data loading and UI)
    browser = new TopologyBrowser();

    // Try to initialize WebGL
    if (useWebGL) {
        const canvas = document.getElementById('webgl-canvas');
        if (canvas) {
            webglTopology = new WebGLTopology(canvas, {
                viewWidth: 2000,
                viewHeight: 857
            });

            const success = await webglTopology.init();
            if (success) {
                console.log('WebGL initialized successfully');

                // Load the map texture
                await webglTopology.loadMapTexture('resources/world.svg');

                // Wire up event callbacks
                setupWebGLCallbacks();

                // Override browser methods to use WebGL
                overrideBrowserMethods();
            } else {
                console.warn('WebGL initialization failed, falling back to SVG');
                useWebGL = false;
                showSVGFallback();
            }
        }
    } else {
        showSVGFallback();
    }
}

// Setup WebGL event callbacks
function setupWebGLCallbacks() {
    // Node click
    webglTopology.onNodeClick = (nodeId, nodeData) => {
        browser.showNodeDetails(nodeId);
    };

    // Link click
    webglTopology.onLinkClick = (linkId, linkData) => {
        browser.showLinkDetails(linkId);
    };

    // Zoom change
    webglTopology.onZoomChange = (zoom, zoomPercent) => {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = zoomPercent;
        }
    };

    // Selection complete (canvas selection)
    webglTopology.onSelectionComplete = (bounds) => {
        if (bounds && browser.selectedTopologyName) {
            browser.canvasSelection = bounds;
            browser.setStatus(`Canvas selected: (${Math.round(bounds.x)}, ${Math.round(bounds.y)}) to (${Math.round(bounds.x1)}, ${Math.round(bounds.y1)})`);

            // Zoom to selected area
            webglTopology.zoomToBounds(bounds);

            // Reload topology with canvas selection
            browser.loadTopologyWithCanvas(browser.selectedTopologyName);
        }
    };
}

// Override browser methods to use WebGL renderer
function overrideBrowserMethods() {
    // Override renderMap to use WebGL
    browser.renderMap = function() {
        if (!this.currentTopology || !webglTopology) return;

        webglTopology.setTopology(this.currentTopology);
        webglTopology.requestRender();
    };

    // Override renderLayout to use WebGL
    browser.renderLayout = function() {
        if (!this.currentTopology || !webglTopology) return;

        webglTopology.setTopology(this.currentTopology);
        webglTopology.requestRender();
    };

    // Override setLayout to update WebGL
    const originalSetLayout = browser.setLayout.bind(browser);
    browser.setLayout = function(layout) {
        this.layoutMode = layout;

        if (webglTopology) {
            webglTopology.setLayoutMode(layout);
        }

        // Reset zoom
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.applyZoom();

        // Reload topology
        if (this.selectedTopologyName) {
            if (this.canvasSelection) {
                this.loadTopologyWithCanvas(this.selectedTopologyName);
            } else {
                this.loadTopology(this.selectedTopologyName);
            }
        }
    };

    // Override zoom methods to use WebGL
    browser.zoomIn = function() {
        if (webglTopology) {
            webglTopology.zoomIn();
            this.zoom = webglTopology.getZoom();
        }
    };

    browser.zoomOut = function() {
        if (webglTopology) {
            webglTopology.zoomOut();
            this.zoom = webglTopology.getZoom();
        }
    };

    browser.resetZoom = function() {
        if (webglTopology) {
            webglTopology.resetZoom();
            this.zoom = 1;
            this.panX = 0;
            this.panY = 0;
        }

        // Clear canvas selection
        if (this.canvasSelection) {
            this.canvasSelection = null;
            if (this.selectedTopologyName) {
                this.loadTopology(this.selectedTopologyName);
            }
        }
    };

    browser.applyZoom = function() {
        // Update zoom display
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel && webglTopology) {
            zoomLevel.textContent = webglTopology.getZoomPercent();
        }
    };

    // Override highlightNode to use WebGL
    browser.highlightNode = function(nodeId) {
        if (webglTopology) {
            webglTopology.highlightNode(nodeId);

            // Reset highlight after 2 seconds
            setTimeout(() => {
                webglTopology.resetHighlights();
            }, 2000);
        }
    };

    // Override highlightLink to use WebGL
    browser.highlightLink = function(linkId) {
        if (webglTopology) {
            webglTopology.highlightLink(linkId);

            // Reset highlight after 2 seconds
            setTimeout(() => {
                webglTopology.resetHighlights();
            }, 2000);
        }
    };

    // Disable SVG-based mouse events since WebGL handles them
    const mapContainer = document.getElementById('map-container');
    const originalMouseDown = mapContainer.onmousedown;
    mapContainer.onmousedown = null;

    // Update setupEventListeners to not add mouse events to map container
    // The WebGL canvas handles all mouse events now
}

// Show SVG fallback (when WebGL is not available)
function showSVGFallback() {
    const canvas = document.getElementById('webgl-canvas');
    const worldMap = document.getElementById('world-map');
    const overlaySvg = document.getElementById('overlay-svg');

    if (canvas) canvas.style.display = 'none';
    if (worldMap) worldMap.style.display = 'block';
    if (overlaySvg) overlaySvg.style.display = 'block';

    console.log('Using SVG fallback renderer');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeApp);
