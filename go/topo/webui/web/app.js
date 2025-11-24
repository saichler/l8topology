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

        // Map coordinate bounds - calibrated for this specific SVG world map
        // Note: This SVG uses a modified Mercator projection with these empirical bounds
        this.mapBounds = {
            minLon: -180,
            maxLon: 180,
            minLat: -60,      // Adjusted for this SVG map
            maxLat: 84.1      // Adjusted for this SVG map (small increase from 83.7 to add ~20px to Y)
        };

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
            this.mapHeight = 857;  // Updated for new Simplemaps SVG
            this.syncOverlayWithMap();

            // Draw debug dot at 0/0 (Null Island)
            const overlaySvg = document.getElementById('overlay-svg');
            this.drawDebugDot(overlaySvg);

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

    switchTab(tabName) {
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update tab panes
        const tabPanes = document.querySelectorAll('.tab-pane');
        tabPanes.forEach(pane => {
            if (pane.id === `tab-${tabName}`) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });
    }

    async loadTopologyList() {
        this.setStatus('Loading topology list...');

        try {
            const query = encodeURIComponent('{"text":"select * from l8topologymetadata"}');
            const response = await fetch(`${this.apiBaseUrl}/0/TopoList?body=${query}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            // Response is L8TopologyMetadataList with 'list' array of L8TopologyMetadata objects
            this.topologyMetadataList = data.list || [];
            this.topologies = this.topologyMetadataList.map(item => item.name);
            this.populateTopologySelect();
            this.setStatus('Topology list loaded', 'success');
        } catch (error) {
            console.error('Error loading topology list:', error);
            this.setStatus(`Error loading topology list: ${error.message}`, 'error');

            this.topologies = ['Network-L1', 'Network-L2', 'Network-L3'];
            this.topologyMetadataList = [];
            this.populateTopologySelect();
        }
    }

    populateTopologySelect() {
        const select = document.getElementById('topology-select');
        select.innerHTML = '<option value="">-- Select a Topology --</option>';

        this.topologies.forEach(topology => {
            const option = document.createElement('option');
            option.value = topology;
            option.textContent = topology;
            select.appendChild(option);
        });
    }

    async loadTopology(name) {
        this.setStatus(`Loading topology: ${name}...`);
        this.resetPagination();
        this.selectedTopologyName = name;

        try {
            // Find metadata for this topology to get serviceName and serviceArea
            const metadata = this.topologyMetadataList.find(item => item.name === name);
            const endpoint = this.topologyNameToEndpoint(name, metadata);
            const response = await fetch(endpoint);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.currentTopology = await response.json();
            this.renderTopology();
            this.setStatus(`Topology "${name}" loaded successfully`, 'success');
        } catch (error) {
            console.error('Error loading topology:', error);
            this.setStatus(`Error loading topology: ${error.message}`, 'error');

            this.currentTopology = this.generateMockTopology(name);
            this.renderTopology();
        }
    }

    topologyNameToEndpoint(name, metadata) {
        // Use metadata if available (serviceName and serviceArea)
        if (metadata && metadata.serviceName !== undefined && metadata.serviceArea !== undefined) {
            return `${this.apiBaseUrl}/${metadata.serviceArea}/${metadata.serviceName}`;
        }
        // Fallback: Extract layer from name (e.g., "Network-L1" -> "L1")
        const match = name.match(/L(\d+)/i);
        if (match) {
            const layer = `L${match[1]}`;
            return `${this.apiBaseUrl}/1/${layer}`;
        }
        // Default fallback
        return `${this.apiBaseUrl}/1/${name}`;
    }

    generateMockTopology(name) {
        return {
            name: name,
            nodes: {
                'R1': {
                    nodeId: 'R1',
                    name: 'R1',
                    location: 'San Francisco, California, USA'
                },
                'R2': {
                    nodeId: 'R2',
                    name: 'R2',
                    location: 'London, United Kingdom'
                },
                'SW1': {
                    nodeId: 'SW1',
                    name: 'SW1',
                    location: 'Tokyo, Japan'
                },
                'FW1': {
                    nodeId: 'FW1',
                    name: 'FW1',
                    location: 'New York, New York, USA'
                }
            },
            links: {
                'networkdevice<{24}{24}R1>.physicals<{24}physical-1>.ports<{2}0>->networkdevice<{24}{24}R2>.physicals<{24}physical-1>.ports<{2}0>': {
                    linkId: 'networkdevice<{24}{24}R1>.physicals<{24}physical-1>.ports<{2}0>->networkdevice<{24}{24}R2>.physicals<{24}physical-1>.ports<{2}0>',
                    aside: 'networkdevice<{24}{24}R1>.physicals<{24}physical-1>.ports<{2}0>',
                    zside: 'networkdevice<{24}{24}R2>.physicals<{24}physical-1>.ports<{2}0>',
                    direction: 3,  // Bidirectional
                    status: 1      // Up
                },
                'networkdevice<{24}{24}R2>.physicals<{24}physical-1>.ports<{2}1>->networkdevice<{24}{24}SW1>.physicals<{24}physical-1>.ports<{2}0>': {
                    linkId: 'networkdevice<{24}{24}R2>.physicals<{24}physical-1>.ports<{2}1>->networkdevice<{24}{24}SW1>.physicals<{24}physical-1>.ports<{2}0>',
                    aside: 'networkdevice<{24}{24}R2>.physicals<{24}physical-1>.ports<{2}1>',
                    zside: 'networkdevice<{24}{24}SW1>.physicals<{24}physical-1>.ports<{2}0>',
                    direction: 1,  // AsideToZside
                    status: 1      // Up
                },
                'networkdevice<{24}{24}R1>.physicals<{24}physical-1>.ports<{2}1><-networkdevice<{24}{24}FW1>.physicals<{24}physical-1>.ports<{2}0>': {
                    linkId: 'networkdevice<{24}{24}R1>.physicals<{24}physical-1>.ports<{2}1><-networkdevice<{24}{24}FW1>.physicals<{24}physical-1>.ports<{2}0>',
                    aside: 'networkdevice<{24}{24}R1>.physicals<{24}physical-1>.ports<{2}1>',
                    zside: 'networkdevice<{24}{24}FW1>.physicals<{24}physical-1>.ports<{2}0>',
                    direction: 2,  // ZsideToAside
                    status: 2      // Down
                },
                'networkdevice<{24}{24}SW1>.physicals<{24}physical-1>.ports<{2}1><->networkdevice<{24}{24}FW1>.physicals<{24}physical-1>.ports<{2}1>': {
                    linkId: 'networkdevice<{24}{24}SW1>.physicals<{24}physical-1>.ports<{2}1><->networkdevice<{24}{24}FW1>.physicals<{24}physical-1>.ports<{2}1>',
                    aside: 'networkdevice<{24}{24}SW1>.physicals<{24}physical-1>.ports<{2}1>',
                    zside: 'networkdevice<{24}{24}FW1>.physicals<{24}physical-1>.ports<{2}1>',
                    direction: 3,  // Bidirectional
                    status: 3      // Partial
                }
            },
            locations: {
                'San Francisco, California, USA': {
                    location: 'San Francisco, California, USA',
                    longitude: -122.4194,
                    latitude: 37.7749
                },
                'London, United Kingdom': {
                    location: 'London, United Kingdom',
                    longitude: -0.1278,
                    latitude: 51.5074
                },
                'Tokyo, Japan': {
                    location: 'Tokyo, Japan',
                    longitude: 139.6917,
                    latitude: 35.6895
                },
                'New York, New York, USA': {
                    location: 'New York, New York, USA',
                    longitude: -74.0060,
                    latitude: 40.7128
                }
            }
        };
    }

    renderTopology() {
        if (!this.currentTopology) {
            return;
        }

        this.updateTopologyInfo();
        this.updateNodesList();
        this.updateLinksList();
        this.renderMap();
    }

    updateTopologyInfo() {
        const nameEl = document.getElementById('topology-name');
        const infoDiv = document.getElementById('topology-info');
        const nodeCount = Object.keys(this.currentTopology.nodes || {}).length;
        const linkCount = Object.keys(this.currentTopology.links || {}).length;
        const locationCount = Object.keys(this.currentTopology.locations || {}).length;

        nameEl.textContent = this.selectedTopologyName || 'Topology';
        infoDiv.innerHTML = `
            <span class="summary-item"><strong>${this.formatNumber(nodeCount)}</strong> nodes</span>
            <span class="summary-item"><strong>${this.formatNumber(linkCount)}</strong> links</span>
            <span class="summary-item"><strong>${this.formatNumber(locationCount)}</strong> locations</span>
        `;
    }

    updateNodesList() {
        const nodesContainer = document.getElementById('nodes-list');
        const nodeCount = document.getElementById('node-count');
        const nodes = this.currentTopology.nodes || {};
        const allNodes = Object.entries(nodes).map(([nodeId, node]) => ({ ...node, _key: nodeId }));
        const totalCount = allNodes.length;

        nodeCount.textContent = this.formatNumber(totalCount);

        if (totalCount === 0) {
            nodesContainer.innerHTML = '<p class="placeholder">No nodes to display</p>';
            return;
        }

        // Filter nodes
        this.filteredNodes = allNodes.filter(node => {
            if (!this.nodesFilter) return true;
            const filter = this.nodesFilter.toLowerCase();
            return (node.nodeId && node.nodeId.toLowerCase().includes(filter)) ||
                   (node.name && node.name.toLowerCase().includes(filter)) ||
                   (node.location && node.location.toLowerCase().includes(filter));
        });

        const filteredCount = this.filteredNodes.length;
        const totalPages = Math.ceil(filteredCount / this.pageSize);
        const startIdx = this.nodesPage * this.pageSize;
        const endIdx = Math.min(startIdx + this.pageSize, filteredCount);
        const pageNodes = this.filteredNodes.slice(startIdx, endIdx);

        // Build HTML
        let html = `
            <div class="list-controls">
                <input type="text" class="list-search" id="nodes-search"
                       placeholder="Search nodes..." value="${this.nodesFilter}">
                <div class="list-info">
                    ${this.nodesFilter ? `${filteredCount} of ${totalCount}` : totalCount} nodes
                </div>
            </div>
            <div class="list-items" id="nodes-items">
        `;

        pageNodes.forEach(node => {
            html += `
                <div class="node-item" data-node-id="${node._key}">
                    <div class="node-item-id">${node.nodeId || node.name}</div>
                    <div class="node-item-location">${node.location || 'N/A'}</div>
                </div>
            `;
        });

        html += '</div>';

        // Pagination controls
        if (totalPages > 1) {
            html += `
                <div class="pagination-controls">
                    <button class="page-btn" id="nodes-prev" ${this.nodesPage === 0 ? 'disabled' : ''}>◀</button>
                    <span class="page-info">${this.nodesPage + 1} / ${totalPages}</span>
                    <button class="page-btn" id="nodes-next" ${this.nodesPage >= totalPages - 1 ? 'disabled' : ''}>▶</button>
                </div>
            `;
        }

        nodesContainer.innerHTML = html;

        // Add event listeners
        this.setupNodesListEvents();
    }

    setupNodesListEvents() {
        // Search input
        const searchInput = document.getElementById('nodes-search');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.nodesFilter = e.target.value;
                this.nodesPage = 0;
                this.updateNodesList();
            }, 300));
        }

        // Pagination buttons
        const prevBtn = document.getElementById('nodes-prev');
        const nextBtn = document.getElementById('nodes-next');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.nodesPage > 0) {
                    this.nodesPage--;
                    this.updateNodesList();
                }
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(this.filteredNodes.length / this.pageSize);
                if (this.nodesPage < totalPages - 1) {
                    this.nodesPage++;
                    this.updateNodesList();
                }
            });
        }

        // Node items click
        const nodeItems = document.querySelectorAll('#nodes-items .node-item');
        nodeItems.forEach(item => {
            item.addEventListener('click', () => {
                const nodeId = item.getAttribute('data-node-id');
                this.highlightNode(nodeId);
            });
        });
    }

    updateLinksList() {
        const linksContainer = document.getElementById('links-list');
        const linkCount = document.getElementById('link-count');
        const links = this.currentTopology.links || {};
        const nodes = this.currentTopology.nodes || {};
        const allLinks = Object.values(links);
        const totalCount = allLinks.length;

        linkCount.textContent = this.formatNumber(totalCount);

        if (totalCount === 0) {
            linksContainer.innerHTML = '<p class="placeholder">No links to display</p>';
            return;
        }

        // Filter links
        this.filteredLinks = allLinks.filter(link => {
            if (!this.linksFilter) return true;
            const filter = this.linksFilter.toLowerCase();
            const asideNode = this.findNodeByLink(link.aside, nodes);
            const zsideNode = this.findNodeByLink(link.zside, nodes);
            return (link.linkId && link.linkId.toLowerCase().includes(filter)) ||
                   (asideNode?.nodeId && asideNode.nodeId.toLowerCase().includes(filter)) ||
                   (zsideNode?.nodeId && zsideNode.nodeId.toLowerCase().includes(filter)) ||
                   (link.aside && link.aside.toLowerCase().includes(filter)) ||
                   (link.zside && link.zside.toLowerCase().includes(filter));
        });

        const filteredCount = this.filteredLinks.length;
        const totalPages = Math.ceil(filteredCount / this.pageSize);
        const startIdx = this.linksPage * this.pageSize;
        const endIdx = Math.min(startIdx + this.pageSize, filteredCount);
        const pageLinks = this.filteredLinks.slice(startIdx, endIdx);

        // Build HTML
        let html = `
            <div class="list-controls">
                <input type="text" class="list-search" id="links-search"
                       placeholder="Search links..." value="${this.linksFilter}">
                <div class="list-info">
                    ${this.linksFilter ? `${filteredCount} of ${totalCount}` : totalCount} links
                </div>
            </div>
            <div class="list-items" id="links-items">
        `;

        pageLinks.forEach(link => {
            const asideNode = this.findNodeByLink(link.aside, nodes);
            const zsideNode = this.findNodeByLink(link.zside, nodes);
            const directionSymbol = this.getDirectionSymbol(link.direction);
            const statusClass = this.getStatusClass(link.status);

            html += `
                <div class="link-item" data-link-id="${link.linkId}">
                    <div class="link-item-direction">
                        ${asideNode?.nodeId || this.extractNodeIdFromLink(link.aside)} ${directionSymbol} ${zsideNode?.nodeId || this.extractNodeIdFromLink(link.zside)}
                    </div>
                    <div class="link-item-status ${statusClass}">${this.getStatusText(link.status)}</div>
                </div>
            `;
        });

        html += '</div>';

        // Pagination controls
        if (totalPages > 1) {
            html += `
                <div class="pagination-controls">
                    <button class="page-btn" id="links-prev" ${this.linksPage === 0 ? 'disabled' : ''}>◀</button>
                    <span class="page-info">${this.linksPage + 1} / ${totalPages}</span>
                    <button class="page-btn" id="links-next" ${this.linksPage >= totalPages - 1 ? 'disabled' : ''}>▶</button>
                </div>
            `;
        }

        linksContainer.innerHTML = html;

        // Add event listeners
        this.setupLinksListEvents();
    }

    // Extract node ID from link reference string
    // Handles both "networkdevice<{24}{24}FW1>..." format and simple "FW1" format
    extractNodeIdFromLink(linkRef) {
        const match = linkRef.match(/networkdevice<\{24\}\{24\}(\w+)\>/);
        return match ? match[1] : linkRef;
    }

    setupLinksListEvents() {
        // Search input
        const searchInput = document.getElementById('links-search');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.linksFilter = e.target.value;
                this.linksPage = 0;
                this.updateLinksList();
            }, 300));
        }

        // Pagination buttons
        const prevBtn = document.getElementById('links-prev');
        const nextBtn = document.getElementById('links-next');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.linksPage > 0) {
                    this.linksPage--;
                    this.updateLinksList();
                }
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(this.filteredLinks.length / this.pageSize);
                if (this.linksPage < totalPages - 1) {
                    this.linksPage++;
                    this.updateLinksList();
                }
            });
        }

        const linkItems = document.querySelectorAll('#links-items .link-item');
        linkItems.forEach(item => {
            item.addEventListener('click', () => {
                const linkId = item.getAttribute('data-link-id');
                this.showLinkDetails(linkId);
            });
        });
    }

    getDirectionSymbol(direction) {
        switch(direction) {
            case this.LinkDirection.ASIDE_TO_ZSIDE: return '→';
            case this.LinkDirection.ZSIDE_TO_ASIDE: return '←';
            case this.LinkDirection.BIDIRECTIONAL: return '↔';
            default: return '⊗'; // Invalid
        }
    }

    getStatusText(status) {
        switch(status) {
            case this.LinkStatus.UP: return 'Up';
            case this.LinkStatus.DOWN: return 'Down';
            case this.LinkStatus.PARTIAL: return 'Partial';
            default: return 'Unknown';
        }
    }

    getStatusClass(status) {
        switch(status) {
            case this.LinkStatus.UP: return 'status-up';
            case this.LinkStatus.DOWN: return 'status-down';
            case this.LinkStatus.PARTIAL: return 'status-partial';
            default: return 'status-invalid';
        }
    }

    renderMap() {
        const overlaySvg = document.getElementById('overlay-svg');
        const worldMap = document.getElementById('world-map');
        const container = document.getElementById('map-container');

        const worldMapRect = worldMap.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        overlaySvg.innerHTML = `
            <defs>
                <!-- Arrow END markers (at line end, pointing in line direction) -->
                <marker id="arrow-end-status-1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#00c853" />
                </marker>
                <marker id="arrow-end-status-2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff3d00" />
                </marker>
                <marker id="arrow-end-status-3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffc107" />
                </marker>
                <marker id="arrow-end-status-0" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#757575" />
                </marker>
                <!-- Arrow START markers (at line start, pointing away from line) -->
                <marker id="arrow-start-status-1" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 10 0 L 0 5 L 10 10 z" fill="#00c853" />
                </marker>
                <marker id="arrow-start-status-2" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 10 0 L 0 5 L 10 10 z" fill="#ff3d00" />
                </marker>
                <marker id="arrow-start-status-3" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 10 0 L 0 5 L 10 10 z" fill="#ffc107" />
                </marker>
                <marker id="arrow-start-status-0" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 10 0 L 0 5 L 10 10 z" fill="#757575" />
                </marker>
            </defs>
        `;

        const nodes = this.currentTopology.nodes || {};
        const links = this.currentTopology.links || {};
        const locations = this.currentTopology.locations || {};

        console.log(`[DEBUG] Nodes count: ${Object.keys(nodes).length}`);
        console.log(`[DEBUG] Links count: ${Object.keys(links).length}`);
        console.log(`[DEBUG] Locations count: ${Object.keys(locations).length}`);

        // Build node positions from locations map (nodes keyed by nodeId)
        const nodePositions = {};
        Object.entries(nodes).forEach(([locationKey, node], idx) => {
            const location = locations[node.location];
            if (idx < 3) {
                console.log(`[DEBUG] Node ${idx}: key="${locationKey}", nodeId="${node.nodeId}", location="${node.location}"`);
                console.log(`[DEBUG]   location data:`, location);
            }
            if (location) {
                const pos = this.latLongToXY(location.latitude, location.longitude, worldMapRect, containerRect);
                nodePositions[node.nodeId] = pos;  // Key by nodeId, not locationKey
                if (idx < 3) {
                    console.log(`[DEBUG]   position stored for nodeId="${node.nodeId}":`, pos);
                }
            }
        });
        console.log(`[DEBUG] NodePositions keys:`, Object.keys(nodePositions));

        // Draw links - find nodes by extracting node ID from aside/zside
        const linkValues = Object.values(links);
        console.log(`[DEBUG] Total links to process: ${linkValues.length}`);

        let linksDrawn = 0;
        let linksSkippedNoNode = 0;
        let linksSkippedNoPos = 0;

        linkValues.forEach((link, idx) => {
            const asideNode = this.findNodeByLink(link.aside, nodes);
            const zsideNode = this.findNodeByLink(link.zside, nodes);

            if (idx < 5) {
                console.log(`[DEBUG] Link ${idx}: aside="${link.aside}", zside="${link.zside}"`);
                console.log(`[DEBUG]   asideNode:`, asideNode);
                console.log(`[DEBUG]   zsideNode:`, zsideNode);
            }

            if (asideNode && zsideNode) {
                const asidePos = nodePositions[asideNode.nodeId];
                const zsidePos = nodePositions[zsideNode.nodeId];

                if (idx < 5) {
                    console.log(`[DEBUG]   asidePos:`, asidePos);
                    console.log(`[DEBUG]   zsidePos:`, zsidePos);
                }

                if (asidePos && zsidePos) {
                    this.drawLink(overlaySvg, link, asidePos, zsidePos);
                    linksDrawn++;
                } else {
                    linksSkippedNoPos++;
                    if (linksSkippedNoPos <= 3) {
                        console.log(`[DEBUG] Link skipped - no position: aside="${link.aside}" (pos: ${!!asidePos}), zside="${link.zside}" (pos: ${!!zsidePos})`);
                    }
                }
            } else {
                linksSkippedNoNode++;
                if (linksSkippedNoNode <= 3) {
                    console.log(`[DEBUG] Link skipped - no node: aside="${link.aside}" (found: ${!!asideNode}), zside="${link.zside}" (found: ${!!zsideNode})`);
                }
            }
        });

        console.log(`[DEBUG] Links summary: drawn=${linksDrawn}, skippedNoNode=${linksSkippedNoNode}, skippedNoPos=${linksSkippedNoPos}`);

        Object.entries(nodes).forEach(([locationKey, node]) => {
            const pos = nodePositions[node.nodeId];
            if (pos) {
                this.drawNode(overlaySvg, node, pos, locationKey);
            }
        });

        // Debug: Draw red dot at 0/0
        this.drawDebugDot(overlaySvg);
    }

    // Helper to find node from link aside/zside reference
    findNodeByLink(linkRef, nodes) {
        // Link references can be:
        // 1. Full format: "networkdevice<{24}{24}FW1>.physicals..." - extract nodeId from regex
        // 2. Simple format: "FW1" - use directly as nodeId
        const match = linkRef.match(/networkdevice<\{24\}\{24\}(\w+)\>/);
        const nodeIdToFind = match ? match[1] : linkRef;

        // Find node with matching nodeId
        for (const [locationKey, node] of Object.entries(nodes)) {
            if (node.nodeId === nodeIdToFind) {
                return node;
            }
        }

        // Fallback: try direct lookup by key
        return nodes[linkRef];
    }

    latLongToXY(lat, lon, mapRect, containerRect) {
        // Map to SVG native coordinate space (viewBox: 0 0 2000 857)
        // SVG from Simplemaps.com uses Robinson Projection
        const svgWidth = 2000;
        const svgHeight = 857;

        // Robinson projection lookup table (latitude -> PLEN, PDFE)
        // PLEN affects X scaling, PDFE affects Y position
        const robinsonTable = [
            { lat: 0,  plen: 1.0000, pdfe: 0.0000 },
            { lat: 5,  plen: 0.9986, pdfe: 0.0620 },
            { lat: 10, plen: 0.9954, pdfe: 0.1240 },
            { lat: 15, plen: 0.9900, pdfe: 0.1860 },
            { lat: 20, plen: 0.9822, pdfe: 0.2480 },
            { lat: 25, plen: 0.9730, pdfe: 0.3100 },
            { lat: 30, plen: 0.9600, pdfe: 0.3720 },
            { lat: 35, plen: 0.9427, pdfe: 0.4340 },
            { lat: 40, plen: 0.9216, pdfe: 0.4958 },
            { lat: 45, plen: 0.8962, pdfe: 0.5571 },
            { lat: 50, plen: 0.8679, pdfe: 0.6176 },
            { lat: 55, plen: 0.8350, pdfe: 0.6769 },
            { lat: 60, plen: 0.7986, pdfe: 0.7346 },
            { lat: 65, plen: 0.7597, pdfe: 0.7903 },
            { lat: 70, plen: 0.7186, pdfe: 0.8435 },
            { lat: 75, plen: 0.6732, pdfe: 0.8936 },
            { lat: 80, plen: 0.6213, pdfe: 0.9394 },
            { lat: 85, plen: 0.5722, pdfe: 0.9761 },
            { lat: 90, plen: 0.5322, pdfe: 1.0000 }
        ];

        // Interpolate Robinson parameters for given latitude
        const absLat = Math.abs(lat);
        let plen, pdfe;

        if (absLat >= 90) {
            plen = 0.5322;
            pdfe = 1.0000;
        } else {
            const idx = Math.floor(absLat / 5);
            const t = (absLat - idx * 5) / 5;
            const row1 = robinsonTable[idx];
            const row2 = robinsonTable[Math.min(idx + 1, 18)];
            plen = row1.plen + t * (row2.plen - row1.plen);
            pdfe = row1.pdfe + t * (row2.pdfe - row1.pdfe);
        }

        // SVG-specific calibration (Simplemaps Robinson projection)
        // Calibrated from SVG path coordinates analysis
        const centerX = 986;       // X coordinate of longitude 0 (Null Island)
        const equatorY = 497;      // Y coordinate of the equator on this SVG
        const eastScale = 1020;    // Pixels from centerX to 180°E (plen=1)
        const westScale = 1000;    // Pixels from centerX to 180°W (plen=1)
        const northScale = 511;    // Pixels from equator to ~83°N (pdfe≈0.97)
        const southScale = 528;    // Pixels from equator to ~55°S (pdfe≈0.68)

        // X: longitude scaled by plen, with different scales for east/west
        const xScale = lon >= 0 ? eastScale : westScale;
        const x = centerX + (lon / 180) * xScale * plen;

        // Y: based on pdfe, with different scales for north/south hemispheres
        const scale = lat >= 0 ? northScale : southScale;
        const y = equatorY - (lat >= 0 ? 1 : -1) * pdfe * scale;

        return { x, y };
    }

    // Draw red dot at 0/0 (Null Island) for reference
    drawDebugDot(svg) {
        const pos = this.latLongToXY(0, 0);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);
        circle.setAttribute('r', '8');
        circle.setAttribute('fill', 'red');
        circle.setAttribute('stroke', 'white');
        circle.setAttribute('stroke-width', '2');
        svg.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', pos.x);
        text.setAttribute('y', pos.y - 12);
        text.setAttribute('fill', 'red');
        text.setAttribute('font-size', '14');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = '0/0';
        svg.appendChild(text);
    }

    drawLink(svg, link, asidePos, zsidePos) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');

        // Set class based on direction and status (default to 0 if undefined)
        const direction = link.direction ?? 0;
        const status = link.status ?? 0;
        const directionClass = `direction-${direction}`;
        const statusClass = `status-${status}`;
        line.setAttribute('class', `link ${directionClass} ${statusClass}`);

        line.setAttribute('x1', asidePos.x);
        line.setAttribute('y1', asidePos.y);
        line.setAttribute('x2', zsidePos.x);
        line.setAttribute('y2', zsidePos.y);
        line.setAttribute('data-link-id', link.linkId);
        line.style.pointerEvents = 'stroke';
        line.style.cursor = 'pointer';

        // Set arrow markers based on direction
        switch(direction) {
            case this.LinkDirection.ASIDE_TO_ZSIDE:
                // Arrow points from A-side to Z-side (at the end)
                line.setAttribute('marker-end', `url(#arrow-end-${statusClass})`);
                break;
            case this.LinkDirection.ZSIDE_TO_ASIDE:
                // Arrow points from Z-side to A-side (at the start)
                line.setAttribute('marker-start', `url(#arrow-start-${statusClass})`);
                break;
            case this.LinkDirection.BIDIRECTIONAL:
                // Arrows at both ends
                line.setAttribute('marker-start', `url(#arrow-start-${statusClass})`);
                line.setAttribute('marker-end', `url(#arrow-end-${statusClass})`);
                break;
            case this.LinkDirection.INVALID:
                // No arrows for invalid direction
                break;
        }

        line.addEventListener('click', () => {
            this.showLinkDetails(link.linkId);
        });

        svg.appendChild(line);
    }

    drawNode(svg, node, pos, locationKey) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'node');
        group.setAttribute('data-node-id', locationKey);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);
        circle.setAttribute('r', '6');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', pos.x);
        text.setAttribute('y', pos.y - 10);
        text.textContent = node.nodeId || node.name;

        group.appendChild(circle);
        group.appendChild(text);
        svg.appendChild(group);

        group.addEventListener('click', () => {
            this.showNodeDetails(locationKey);
        });
    }

    showNodeDetails(nodeId) {
        const node = this.currentTopology.nodes[nodeId];
        if (!node) return;

        const locations = this.currentTopology.locations || {};
        const location = locations[node.location];
        const nodes = this.currentTopology.nodes || {};

        const modal = document.getElementById('link-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');

        modalTitle.textContent = node.nodeId || node.name;

        // Build modal body content
        let html = `
            <div class="link-detail-section">
                <h4>Node Information</h4>
                <div class="link-detail-row">
                    <span class="link-detail-label">Node ID</span>
                    <span class="link-detail-value">${node.nodeId || 'N/A'}</span>
                </div>
                <div class="link-detail-row">
                    <span class="link-detail-label">Name</span>
                    <span class="link-detail-value">${node.name || 'N/A'}</span>
                </div>
                <div class="link-detail-row">
                    <span class="link-detail-label">Location</span>
                    <span class="link-detail-value">${node.location || 'N/A'}</span>
                </div>
                <div class="link-detail-row">
                    <span class="link-detail-label">Latitude</span>
                    <span class="link-detail-value">${location?.latitude ?? 'N/A'}</span>
                </div>
                <div class="link-detail-row">
                    <span class="link-detail-label">Longitude</span>
                    <span class="link-detail-value">${location?.longitude ?? 'N/A'}</span>
                </div>
            </div>
        `;

        // Find connected links - check if link aside/zside references this node
        const connectedLinks = Object.values(this.currentTopology.links || {}).filter(link => {
            const asideNode = this.findNodeByLink(link.aside, nodes);
            const zsideNode = this.findNodeByLink(link.zside, nodes);
            return asideNode?.nodeId === node.nodeId || zsideNode?.nodeId === node.nodeId;
        });

        html += `
            <div class="link-detail-section">
                <h4>Connected Links (${connectedLinks.length})</h4>
        `;

        if (connectedLinks.length === 0) {
            html += '<p class="no-aggregated">No connected links</p>';
        } else {
            html += `
                <table class="aggregated-table">
                    <thead>
                        <tr>
                            <th>A-Side</th>
                            <th>Z-Side</th>
                            <th>Direction</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            connectedLinks.forEach(link => {
                const asideNode = this.findNodeByLink(link.aside, nodes);
                const zsideNode = this.findNodeByLink(link.zside, nodes);
                const asideName = asideNode?.nodeId || this.extractNodeIdFromLink(link.aside);
                const zsideName = zsideNode?.nodeId || this.extractNodeIdFromLink(link.zside);

                html += `
                    <tr>
                        <td>${asideName}</td>
                        <td>${zsideName}</td>
                        <td>${this.getDirectionSymbol(link.direction)}</td>
                        <td class="${this.getStatusClass(link.status)}">${this.getStatusText(link.status)}</td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
            `;
        }

        html += '</div>';
        modalBody.innerHTML = html;

        // Show modal
        modal.classList.add('active');

        // Highlight the node on the map
        this.highlightNode(nodeId);
    }

    highlightNode(nodeId) {
        const nodes = document.querySelectorAll('.node');
        nodes.forEach(node => {
            if (node.getAttribute('data-node-id') === nodeId) {
                node.style.opacity = '1';
                const circle = node.querySelector('circle');
                circle.setAttribute('r', '8');
            } else {
                node.style.opacity = '0.3';
            }
        });

        setTimeout(() => {
            nodes.forEach(node => {
                node.style.opacity = '1';
                const circle = node.querySelector('circle');
                circle.setAttribute('r', '6');
            });
        }, 2000);
    }

    highlightLink(linkId) {
        const links = document.querySelectorAll('.link');
        links.forEach(link => {
            if (link.getAttribute('data-link-id') === linkId) {
                link.style.opacity = '1';
                link.style.strokeWidth = '4';
            } else {
                link.style.opacity = '0.2';
            }
        });

        setTimeout(() => {
            links.forEach(link => {
                link.style.opacity = '0.7';
                link.style.strokeWidth = '2';
            });
        }, 2000);
    }

    showLinkDetails(linkId) {
        const link = this.currentTopology.links[linkId];
        if (!link) return;

        const nodes = this.currentTopology.nodes || {};
        const asideNode = this.findNodeByLink(link.aside, nodes);
        const zsideNode = this.findNodeByLink(link.zside, nodes);

        const modal = document.getElementById('link-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');

        // Build the connection string for title
        const asideName = asideNode?.nodeId || this.extractNodeIdFromLink(link.aside);
        const zsideName = zsideNode?.nodeId || this.extractNodeIdFromLink(link.zside);
        const dirSymbol = this.getDirectionSymbol(link.direction);
        modalTitle.textContent = `${asideName} ${dirSymbol} ${zsideName}`;

        // Build modal body content
        let html = `
            <div class="link-detail-section">
                <h4>Link Information</h4>
                <div class="link-detail-row">
                    <span class="link-detail-label">Link ID</span>
                    <span class="link-detail-value" style="word-break: break-all;">${link.linkId}</span>
                </div>
                <div class="link-detail-row">
                    <span class="link-detail-label">A-Side Node</span>
                    <span class="link-detail-value">${asideName}${asideNode?.location ? ` (${asideNode.location})` : ''}</span>
                </div>
                <div class="link-detail-row">
                    <span class="link-detail-label">A-Side Port</span>
                    <span class="link-detail-value" style="word-break: break-all;">${link.aside}</span>
                </div>
                <div class="link-detail-row">
                    <span class="link-detail-label">Z-Side Node</span>
                    <span class="link-detail-value">${zsideName}${zsideNode?.location ? ` (${zsideNode.location})` : ''}</span>
                </div>
                <div class="link-detail-row">
                    <span class="link-detail-label">Z-Side Port</span>
                    <span class="link-detail-value" style="word-break: break-all;">${link.zside}</span>
                </div>
                <div class="link-detail-row">
                    <span class="link-detail-label">Direction</span>
                    <span class="link-detail-value">${this.getDirectionText(link.direction)}</span>
                </div>
                <div class="link-detail-row">
                    <span class="link-detail-label">Status</span>
                    <span class="link-detail-value ${this.getStatusClass(link.status)}">${this.getStatusText(link.status)}</span>
                </div>
            </div>
        `;

        modalBody.innerHTML = html;

        // Show modal
        modal.classList.add('active');

        // Highlight the link on the map
        this.highlightLink(linkId);
    }

    getDirectionText(direction) {
        switch(direction) {
            case this.LinkDirection.ASIDE_TO_ZSIDE: return 'A-Side to Z-Side';
            case this.LinkDirection.ZSIDE_TO_ASIDE: return 'Z-Side to A-Side';
            case this.LinkDirection.BIDIRECTIONAL: return 'Bidirectional';
            default: return 'Invalid';
        }
    }

    closeModal() {
        const modal = document.getElementById('link-modal');
        modal.classList.remove('active');
    }

    clearTopology() {
        this.currentTopology = null;
        this.selectedTopologyName = null;
        this.resetPagination();
        this.resetZoom();
        const overlaySvg = document.getElementById('overlay-svg');
        overlaySvg.innerHTML = `
            <defs>
                <!-- Arrow END markers (at line end, pointing in line direction) -->
                <marker id="arrow-end-status-1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#00c853" />
                </marker>
                <marker id="arrow-end-status-2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff3d00" />
                </marker>
                <marker id="arrow-end-status-3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffc107" />
                </marker>
                <marker id="arrow-end-status-0" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#757575" />
                </marker>
                <!-- Arrow START markers (at line start, pointing away from line) -->
                <marker id="arrow-start-status-1" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 10 0 L 0 5 L 10 10 z" fill="#00c853" />
                </marker>
                <marker id="arrow-start-status-2" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 10 0 L 0 5 L 10 10 z" fill="#ff3d00" />
                </marker>
                <marker id="arrow-start-status-3" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 10 0 L 0 5 L 10 10 z" fill="#ffc107" />
                </marker>
                <marker id="arrow-start-status-0" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 10 0 L 0 5 L 10 10 z" fill="#757575" />
                </marker>
            </defs>
        `;

        document.getElementById('topology-name').textContent = 'Topology';
        document.getElementById('topology-info').innerHTML = '<p class="placeholder">Select a topology to view details</p>';
        document.getElementById('nodes-list').innerHTML = '<p class="placeholder">No nodes to display</p>';
        document.getElementById('links-list').innerHTML = '<p class="placeholder">No links to display</p>';
        document.getElementById('node-count').textContent = '0';
        document.getElementById('link-count').textContent = '0';
        // Reset to nodes tab
        this.switchTab('nodes');
        this.setStatus('Ready');
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

const browser = new TopologyBrowser();
