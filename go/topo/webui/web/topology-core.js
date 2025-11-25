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
        this.maxZoom = 5;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

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

        // Mouse wheel zoom
        mapContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                this.zoomIn();
            } else {
                this.zoomOut();
            }
        });

        // Panning (drag to move)
        mapContainer.addEventListener('mousedown', (e) => {
            if (this.zoom > 1) {
                this.isPanning = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                mapContainer.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                const deltaX = (e.clientX - this.lastMouseX) / this.zoom;
                const deltaY = (e.clientY - this.lastMouseY) / this.zoom;
                this.panX += deltaX;
                this.panY += deltaY;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.applyZoom();
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isPanning) {
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
}
