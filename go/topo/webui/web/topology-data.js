// Data loading and topology management methods for TopologyBrowser

TopologyBrowser.prototype.switchTab = function(tabName) {
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
};

TopologyBrowser.prototype.loadTopologyList = async function() {
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
};

TopologyBrowser.prototype.populateTopologySelect = function() {
    const select = document.getElementById('topology-select');
    select.innerHTML = '<option value="">-- Select a Topology --</option>';

    this.topologies.forEach(topology => {
        const option = document.createElement('option');
        option.value = topology;
        option.textContent = topology;
        select.appendChild(option);
    });
};

TopologyBrowser.prototype.loadTopology = async function(name) {
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
};

TopologyBrowser.prototype.topologyNameToEndpoint = function(name, metadata, canvasSelection) {
    // Map layout mode to layout enum value
    // 0=Location, 1=Hierarchical, 2=Circular, 3=Radial, 4=Force_Directed
    const layoutMap = { 'map': 0, 'hierarchical': 1, 'circular': 2, 'radial': 3, 'force': 4 };
    const layout = layoutMap[this.layoutMode] || 0;

    // Build body with layout and canvas selection if available
    const bodyObj = {
        layout: layout,
        x: canvasSelection ? canvasSelection.x : 0,
        y: canvasSelection ? canvasSelection.y : 0,
        x1: canvasSelection ? canvasSelection.x1 : 0,
        y1: canvasSelection ? canvasSelection.y1 : 0
    };
    const body = encodeURIComponent(JSON.stringify(bodyObj));

    // Use metadata if available (serviceName and serviceArea)
    if (metadata && metadata.serviceName !== undefined && metadata.serviceArea !== undefined) {
        return `${this.apiBaseUrl}/${metadata.serviceArea}/${metadata.serviceName}?body=${body}`;
    }
    // Fallback: Extract layer from name (e.g., "Network-L1" -> "L1")
    const match = name.match(/L(\d+)/i);
    if (match) {
        const layer = `L${match[1]}`;
        return `${this.apiBaseUrl}/1/${layer}?body=${body}`;
    }
    // Default fallback
    return `${this.apiBaseUrl}/1/${name}?body=${body}`;
};

TopologyBrowser.prototype.loadTopologyWithCanvas = async function(name) {
    this.setStatus(`Loading topology with canvas selection: ${name}...`);
    this.resetPagination();

    try {
        // Find metadata for this topology
        const metadata = this.topologyMetadataList.find(item => item.name === name);
        const endpoint = this.topologyNameToEndpoint(name, metadata, this.canvasSelection);
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        this.currentTopology = await response.json();
        this.renderTopology();
        const coords = this.canvasSelection;
        this.setStatus(`Topology "${name}" loaded for canvas (${Math.round(coords.x)}, ${Math.round(coords.y)}) to (${Math.round(coords.x1)}, ${Math.round(coords.y1)})`, 'success');
    } catch (error) {
        console.error('Error loading topology with canvas:', error);
        this.setStatus(`Error loading topology: ${error.message}`, 'error');
    }
};

TopologyBrowser.prototype.generateMockTopology = function(name) {
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
};

TopologyBrowser.prototype.renderTopology = function() {
    if (!this.currentTopology) {
        return;
    }

    this.updateTopologyInfo();
    this.updateNodesList();
    this.updateLinksList();
    this.renderMap();
};

TopologyBrowser.prototype.updateTopologyInfo = function() {
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
};

TopologyBrowser.prototype.clearTopology = function() {
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
};

// Direction and status helper methods
TopologyBrowser.prototype.getDirectionSymbol = function(direction) {
    switch(direction) {
        case this.LinkDirection.ASIDE_TO_ZSIDE: return '\u2192';
        case this.LinkDirection.ZSIDE_TO_ASIDE: return '\u2190';
        case this.LinkDirection.BIDIRECTIONAL: return '\u2194';
        default: return '\u2297'; // Invalid
    }
};

TopologyBrowser.prototype.getStatusText = function(status) {
    switch(status) {
        case this.LinkStatus.UP: return 'Up';
        case this.LinkStatus.DOWN: return 'Down';
        case this.LinkStatus.PARTIAL: return 'Partial';
        default: return 'Unknown';
    }
};

TopologyBrowser.prototype.getStatusClass = function(status) {
    switch(status) {
        case this.LinkStatus.UP: return 'status-up';
        case this.LinkStatus.DOWN: return 'status-down';
        case this.LinkStatus.PARTIAL: return 'status-partial';
        default: return 'status-invalid';
    }
};

TopologyBrowser.prototype.getDirectionText = function(direction) {
    switch(direction) {
        case this.LinkDirection.ASIDE_TO_ZSIDE: return 'A-Side to Z-Side';
        case this.LinkDirection.ZSIDE_TO_ASIDE: return 'Z-Side to A-Side';
        case this.LinkDirection.BIDIRECTIONAL: return 'Bidirectional';
        default: return 'Invalid';
    }
};

// Extract node ID from link reference string
// Handles both "networkdevice<{24}{24}FW1>..." format and simple "FW1" format
TopologyBrowser.prototype.extractNodeIdFromLink = function(linkRef) {
    const match = linkRef.match(/networkdevice<\{24\}\{24\}(\w+)\>/);
    return match ? match[1] : linkRef;
};
