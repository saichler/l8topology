// UI components methods for TopologyBrowser (lists, modals, pagination)

TopologyBrowser.prototype.updateNodesList = function() {
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
        const countBadge = node.count > 1 ? `<span class="node-count-badge">${node.count}</span>` : '';
        html += `
            <div class="node-item" data-node-id="${node._key}">
                <div class="node-item-id">${node.nodeId || node.name}${countBadge}</div>
                <div class="node-item-location">${node.location || 'N/A'}</div>
            </div>
        `;
    });

    html += '</div>';

    // Pagination controls
    if (totalPages > 1) {
        html += `
            <div class="pagination-controls">
                <button class="page-btn" id="nodes-prev" ${this.nodesPage === 0 ? 'disabled' : ''}>\u25C0</button>
                <span class="page-info">${this.nodesPage + 1} / ${totalPages}</span>
                <button class="page-btn" id="nodes-next" ${this.nodesPage >= totalPages - 1 ? 'disabled' : ''}>\u25B6</button>
            </div>
        `;
    }

    nodesContainer.innerHTML = html;

    // Add event listeners
    this.setupNodesListEvents();
};

TopologyBrowser.prototype.setupNodesListEvents = function() {
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
};

TopologyBrowser.prototype.updateLinksList = function() {
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
                <button class="page-btn" id="links-prev" ${this.linksPage === 0 ? 'disabled' : ''}>\u25C0</button>
                <span class="page-info">${this.linksPage + 1} / ${totalPages}</span>
                <button class="page-btn" id="links-next" ${this.linksPage >= totalPages - 1 ? 'disabled' : ''}>\u25B6</button>
            </div>
        `;
    }

    linksContainer.innerHTML = html;

    // Add event listeners
    this.setupLinksListEvents();
};

TopologyBrowser.prototype.setupLinksListEvents = function() {
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
};

TopologyBrowser.prototype.showNodeDetails = function(nodeId) {
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
                <span class="link-detail-label">Device Count</span>
                <span class="link-detail-value">${node.count || 1}</span>
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
};

TopologyBrowser.prototype.showLinkDetails = function(linkId) {
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
};

TopologyBrowser.prototype.closeModal = function() {
    const modal = document.getElementById('link-modal');
    modal.classList.remove('active');
};
