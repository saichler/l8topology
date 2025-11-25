class TopologyBrowser {
    constructor() {
        this.topologies = [];
        this.topologyMetadataList = [];
        this.currentTopology = null;
        this.selectedTopologyName = null;
        this.mapWidth = 0;
        this.mapHeight = 0;
        this.apiBaseUrl = '/probler';

        // Link Direction Enum
        this.LinkDirection = {
            INVALID: 0,
            ASIDE_TO_ZSIDE: 1,
            ZSIDE_TO_ASIDE: 2,
            BIDIRECTIONAL: 3
        };

        // Link Status Enum
        this.LinkStatus = {
            INVALID: 0,
            UP: 1,
            DOWN: 2,
            PARTIAL: 3
        };

        // Pagination settings for large datasets
        this.pageSize = 50;
        this.nodesPage = 0;
        this.linksPage = 0;
        this.nodesFilter = '';
        this.linksFilter = '';

        // Cached arrays for filtered data
        this.filteredNodes = [];
        this.filteredLinks = [];

        // Zoom and pan state
        this.zoom = 1;
        this.minZoom = 0.5;
        this.maxZoom = 10;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Canvas selection state
        this.isSelecting = false;
        this.selectionStartX = 0;
        this.selectionStartY = 0;
        this.canvasSelection = null; // {x, y, x1, y1} in SVG coordinates

        // Layout mode: 'map' or 'hierarchical'
        this.layoutMode = 'map';

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTopologyList();
    }

    setupEventListeners() {
        const topologySelect = document.getElementById('topology-select');
        const refreshBtn = document.getElementById('refresh-btn');
        const worldMap = document.getElementById('world-map');

        topologySelect.addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadTopology(e.target.value);
            } else {
                this.clearTopology();
            }
        });

        refreshBtn.addEventListener('click', () => {
            const selected = topologySelect.value;
            if (selected) {
                this.loadTopology(selected);
            } else {
                this.loadTopologyList();
            }
        });

        // Zoom controls
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const zoomResetBtn = document.getElementById('zoom-reset-btn');
        const mapContainer = document.getElementById('map-container');

        zoomInBtn.addEventListener('click', () => this.zoomIn());
        zoomOutBtn.addEventListener('click', () => this.zoomOut());
        zoomResetBtn.addEventListener('click', () => this.resetZoom());

        // Layout select dropdown
        const layoutSelect = document.getElementById('layout-select');
        layoutSelect.addEventListener('change', (e) => this.setLayout(e.target.value));

        // Mouse wheel zoom
        mapContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                this.zoomIn();
            } else {
                this.zoomOut();
            }
        });

        // Panning (drag to move) or canvas selection (Shift+drag)
        mapContainer.addEventListener('mousedown', (e) => {
            if (e.shiftKey) {
                // Start canvas selection
                this.isSelecting = true;
                const rect = mapContainer.getBoundingClientRect();
                this.selectionStartX = e.clientX - rect.left;
                this.selectionStartY = e.clientY - rect.top;
                this.createSelectionRectangle();
                mapContainer.style.cursor = 'crosshair';
                e.preventDefault();
            } else if (this.zoom > 1) {
                this.isPanning = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                mapContainer.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isSelecting) {
                const rect = mapContainer.getBoundingClientRect();
                const currentX = e.clientX - rect.left;
                const currentY = e.clientY - rect.top;
                this.updateSelectionRectangle(currentX, currentY);
            } else if (this.isPanning) {
                const deltaX = (e.clientX - this.lastMouseX) / this.zoom;
                const deltaY = (e.clientY - this.lastMouseY) / this.zoom;
                this.panX += deltaX;
                this.panY += deltaY;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.applyZoom();
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.isSelecting) {
                this.isSelecting = false;
                const rect = mapContainer.getBoundingClientRect();
                const endX = e.clientX - rect.left;
                const endY = e.clientY - rect.top;
                this.finalizeCanvasSelection(endX, endY);
                mapContainer.style.cursor = 'default';
            } else if (this.isPanning) {
                this.isPanning = false;
                mapContainer.style.cursor = this.zoom > 1 ? 'grab' : 'default';
            }
        });

        worldMap.addEventListener('load', () => {
            this.mapWidth = 2000;
            this.mapHeight = 857;
            this.syncOverlayWithMap();

            if (this.currentTopology) {
                this.renderMap();
            }
        });

        // Handle case where image is already loaded (cached)
        if (worldMap.complete) {
            this.mapWidth = 2000;
            this.mapHeight = 857;
            this.syncOverlayWithMap();
        }

        // Sync overlay when window resizes
        window.addEventListener('resize', () => {
            this.syncOverlayWithMap();
            if (this.currentTopology) {
                this.renderMap();
            }
        });

        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Modal event listeners
        const modal = document.getElementById('link-modal');
        const modalClose = document.getElementById('modal-close');

        modalClose.addEventListener('click', () => this.closeModal());

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    syncOverlayWithMap() {
        const worldMap = document.getElementById('world-map');
        const overlaySvg = document.getElementById('overlay-svg');

        // Get the actual rendered size and position of the world map image
        const mapRect = worldMap.getBoundingClientRect();
        const containerRect = worldMap.parentElement.getBoundingClientRect();

        // Calculate position relative to container
        const left = mapRect.left - containerRect.left;
        const top = mapRect.top - containerRect.top;

        // Size and position the overlay to exactly match the map image
        overlaySvg.style.width = mapRect.width + 'px';
        overlaySvg.style.height = mapRect.height + 'px';
        overlaySvg.style.left = left + 'px';
        overlaySvg.style.top = top + 'px';
    }

    zoomIn() {
        if (this.zoom < this.maxZoom) {
            this.zoom = Math.min(this.zoom * 1.2, this.maxZoom);
            this.applyZoom();
        }
    }

    zoomOut() {
        if (this.zoom > this.minZoom) {
            this.zoom = Math.max(this.zoom / 1.2, this.minZoom);
            this.applyZoom();
        }
    }

    resetZoom() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.applyZoom();

        // Clear canvas selection and re-fetch topology with default coordinates
        if (this.canvasSelection) {
            this.canvasSelection = null;
            if (this.selectedTopologyName) {
                this.loadTopology(this.selectedTopologyName);
            }
        }
    }

    applyZoom() {
        const mapContainer = document.getElementById('map-container');
        const worldMap = document.getElementById('world-map');
        const overlaySvg = document.getElementById('overlay-svg');

        // Apply transform to both map and overlay
        const transform = `scale(${this.zoom}) translate(${this.panX}px, ${this.panY}px)`;
        worldMap.style.transform = transform;
        worldMap.style.transformOrigin = 'center center';
        overlaySvg.style.transform = transform;
        overlaySvg.style.transformOrigin = 'center center';

        // Update zoom level display
        const zoomLevel = document.getElementById('zoom-level');
        zoomLevel.textContent = `${Math.round(this.zoom * 100)}%`;

        // Update cursor to indicate panning is available when zoomed in
        if (!this.isPanning) {
            mapContainer.style.cursor = this.zoom > 1 ? 'grab' : 'default';
        }
    }

    setStatus(message, type = '') {
        const statusBar = document.getElementById('status-bar');
        statusBar.textContent = message;
        statusBar.className = type;
    }

    // Helper function to format large numbers with commas
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Debounce function to limit search input frequency
    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Reset pagination when loading new topology
    resetPagination() {
        this.nodesPage = 0;
        this.linksPage = 0;
        this.nodesFilter = '';
        this.linksFilter = '';
        this.filteredNodes = [];
        this.filteredLinks = [];
    }

    // Canvas selection methods
    createSelectionRectangle() {
        const mapContainer = document.getElementById('map-container');
        let selectionRect = document.getElementById('canvas-selection-rect');
        if (!selectionRect) {
            selectionRect = document.createElement('div');
            selectionRect.id = 'canvas-selection-rect';
            mapContainer.appendChild(selectionRect);
        }
        selectionRect.style.left = this.selectionStartX + 'px';
        selectionRect.style.top = this.selectionStartY + 'px';
        selectionRect.style.width = '0px';
        selectionRect.style.height = '0px';
        selectionRect.style.display = 'block';
    }

    updateSelectionRectangle(currentX, currentY) {
        const selectionRect = document.getElementById('canvas-selection-rect');
        if (!selectionRect) return;

        const x = Math.min(this.selectionStartX, currentX);
        const y = Math.min(this.selectionStartY, currentY);
        const width = Math.abs(currentX - this.selectionStartX);
        const height = Math.abs(currentY - this.selectionStartY);

        selectionRect.style.left = x + 'px';
        selectionRect.style.top = y + 'px';
        selectionRect.style.width = width + 'px';
        selectionRect.style.height = height + 'px';
    }

    finalizeCanvasSelection(endX, endY) {
        const selectionRect = document.getElementById('canvas-selection-rect');
        if (selectionRect) {
            selectionRect.style.display = 'none';
        }

        // Only process if we have a meaningful selection (at least 10px in each direction)
        const width = Math.abs(endX - this.selectionStartX);
        const height = Math.abs(endY - this.selectionStartY);
        if (width < 10 || height < 10) {
            this.setStatus('Selection too small, please drag a larger area');
            return;
        }

        // Convert screen coordinates to SVG coordinates
        const svgCoords = this.screenToSvgCoordinates(
            Math.min(this.selectionStartX, endX),
            Math.min(this.selectionStartY, endY),
            Math.max(this.selectionStartX, endX),
            Math.max(this.selectionStartY, endY)
        );

        if (svgCoords) {
            this.canvasSelection = svgCoords;
            this.setStatus(`Canvas selected: (${Math.round(svgCoords.x)}, ${Math.round(svgCoords.y)}) to (${Math.round(svgCoords.x1)}, ${Math.round(svgCoords.y1)})`);

            // Zoom into the selected canvas area
            this.zoomToCanvas(svgCoords);

            // Re-fetch topology with the new canvas selection
            if (this.selectedTopologyName) {
                this.loadTopologyWithCanvas(this.selectedTopologyName);
            }
        }
    }

    zoomToCanvas(svgCoords) {
        const worldMap = document.getElementById('world-map');
        const mapContainer = document.getElementById('map-container');
        if (!worldMap || !mapContainer) return;

        const containerRect = mapContainer.getBoundingClientRect();

        // Calculate the base (unzoomed) map display size
        const containerAspect = containerRect.width / containerRect.height;
        const mapAspect = this.mapWidth / this.mapHeight;

        let baseMapWidth, baseMapHeight, baseMapOffsetX, baseMapOffsetY;
        if (containerAspect > mapAspect) {
            baseMapHeight = containerRect.height;
            baseMapWidth = baseMapHeight * mapAspect;
            baseMapOffsetX = (containerRect.width - baseMapWidth) / 2;
            baseMapOffsetY = 0;
        } else {
            baseMapWidth = containerRect.width;
            baseMapHeight = baseMapWidth / mapAspect;
            baseMapOffsetX = 0;
            baseMapOffsetY = (containerRect.height - baseMapHeight) / 2;
        }

        // Calculate the size of the selected area in SVG coordinates
        const selectionWidth = svgCoords.x1 - svgCoords.x;
        const selectionHeight = svgCoords.y1 - svgCoords.y;

        // Calculate zoom level to fit the selection in the view
        const zoomX = this.mapWidth / selectionWidth;
        const zoomY = this.mapHeight / selectionHeight;
        const newZoom = Math.min(zoomX, zoomY, this.maxZoom) * 0.9; // 0.9 for some padding

        // Calculate the center of the selection in SVG coordinates
        const targetSvgX = (svgCoords.x + svgCoords.x1) / 2;
        const targetSvgY = (svgCoords.y + svgCoords.y1) / 2;

        // Convert target SVG coords to image coords (relative to image top-left)
        const baseScaleX = this.mapWidth / baseMapWidth;
        const targetImageX = targetSvgX / baseScaleX;
        const targetImageY = targetSvgY / baseScaleX;  // Use same scale for both

        // Image center (transform origin)
        const imageCenterX = baseMapWidth / 2;
        const imageCenterY = baseMapHeight / 2;

        // Calculate pan to center the target point
        // CSS transform: scale(zoom) translate(panX, panY) applies translate FIRST (right-to-left)
        // So pan is NOT multiplied by zoom
        this.panX = imageCenterX - targetImageX;
        this.panY = imageCenterY - targetImageY;
        this.zoom = newZoom;

        this.applyZoom();
    }

    screenToSvgCoordinates(screenX, screenY, screenX1, screenY1) {
        const worldMap = document.getElementById('world-map');
        const mapContainer = document.getElementById('map-container');
        if (!worldMap || !mapContainer) return null;

        const containerRect = mapContainer.getBoundingClientRect();

        // Calculate the base (unzoomed) map display size and position
        const containerAspect = containerRect.width / containerRect.height;
        const mapAspect = this.mapWidth / this.mapHeight;

        let baseMapWidth, baseMapHeight, baseMapOffsetX, baseMapOffsetY;
        if (containerAspect > mapAspect) {
            baseMapHeight = containerRect.height;
            baseMapWidth = baseMapHeight * mapAspect;
            baseMapOffsetX = (containerRect.width - baseMapWidth) / 2;
            baseMapOffsetY = 0;
        } else {
            baseMapWidth = containerRect.width;
            baseMapHeight = baseMapWidth / mapAspect;
            baseMapOffsetX = 0;
            baseMapOffsetY = (containerRect.height - baseMapHeight) / 2;
        }

        const baseScaleX = this.mapWidth / baseMapWidth;
        const baseScaleY = this.mapHeight / baseMapHeight;

        // Image center in container coords (transform origin)
        const imageCenterInContainerX = baseMapOffsetX + baseMapWidth / 2;
        const imageCenterInContainerY = baseMapOffsetY + baseMapHeight / 2;

        // Convert screen point to SVG coordinates
        // CSS transform: scale(zoom) translate(panX, panY) - reverse: unscale first, then untranslate
        const convertPoint = (sx, sy) => {
            const relX = sx - imageCenterInContainerX;
            const relY = sy - imageCenterInContainerY;
            const unscaledX = relX / this.zoom;
            const unscaledY = relY / this.zoom;
            const unpannedX = unscaledX - this.panX;
            const unpannedY = unscaledY - this.panY;
            const imageX = unpannedX + baseMapWidth / 2;
            const imageY = unpannedY + baseMapHeight / 2;
            const svgX = imageX * baseScaleX;
            const svgY = imageY * baseScaleY;
            return { x: svgX, y: svgY };
        };

        const p1 = convertPoint(screenX, screenY);
        const p2 = convertPoint(screenX1, screenY1);

        return {
            x: Math.max(0, p1.x),
            y: Math.max(0, p1.y),
            x1: Math.min(this.mapWidth, p2.x),
            y1: Math.min(this.mapHeight, p2.y)
        };
    }

    clearCanvasSelection() {
        this.canvasSelection = null;
        const selectionRect = document.getElementById('canvas-selection-rect');
        if (selectionRect) {
            selectionRect.style.display = 'none';
        }
        this.setStatus('Canvas selection cleared');
    }

    setLayout(layout) {
        const worldMap = document.getElementById('world-map');

        this.layoutMode = layout;

        // Show/hide world map based on layout
        if (layout === 'map') {
            worldMap.style.display = 'block';
        } else {
            worldMap.style.display = 'none';
        }

        // Reset zoom/pan when switching layouts
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.applyZoom();

        // Reload topology from server with new layout (retain canvas selection if any)
        if (this.selectedTopologyName) {
            if (this.canvasSelection) {
                this.loadTopologyWithCanvas(this.selectedTopologyName);
            } else {
                this.loadTopology(this.selectedTopologyName);
            }
        }
    }
}
