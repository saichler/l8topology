# l8topology

[![Go Version](https://img.shields.io/badge/Go-1.26+-00ADD8?style=flat&logo=go)](https://go.dev/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

A high-performance network topology visualization and management system for the Layer 8 Ecosystem. L8topology provides real-time network topology discovery, multiple layout algorithms, and GPU-accelerated WebGL rendering for handling enterprise-scale network graphs (30K+ nodes, 300K+ links).

## Features

- **Interactive Visualization** - Pan, zoom, and select nodes/links on an interactive world map using Robinson projection
- **Multiple Layout Algorithms** - Geographic (Location), Hierarchical, Circular, Radial, and Force-Directed layouts
- **WebGL Rendering** - GPU-accelerated rendering with instanced nodes, batched links, camera controls, and hit-detection picking
- **Network Discovery** - Extensible discovery engine with Layer 1 (physical) topology discovery from network device inventory
- **Real-time Updates** - Live topology updates through the Layer 8 service-oriented architecture
- **Device Type Icons** - Visual representation for Routers, Switches, Firewalls, Load Balancers, Access Points, Servers, Storage, and Gateways
- **Link Status Visualization** - Color-coded link status (Up/Down/Partial) with directional arrows and bidirectional merging
- **Viewport Culling** - Server-side filtering by viewport bounds for efficient rendering of large topologies
- **Location Aggregation** - Groups nodes by geographic location in map layout with aggregate counts
- **Geographic Projection** - Robinson pseudo-cylindrical projection calibrated for accurate world map positioning
- **Topology Registry** - Multiple topologies can be registered and browsed via TopoListService
- **REST API** - Full API for topology queries, layout selection, and management

## Architecture

```
+-----------------------------------------------------------------+
|                        Web Browser                              |
|  +-------------+  +-------------+  +-------------------------+ |
|  |  UI Layer   |  |  Data Mgmt  |  |  WebGL Renderer         | |
|  | (topology-  |  | (topology-  |  |  (camera, nodes, links, | |
|  |  ui.js)     |  |  data.js)   |  |   picking, icons)       | |
|  +-------------+  +-------------+  +-------------------------+ |
+---------------------------------+-------------------------------+
                                  | REST API
+---------------------------------v-------------------------------+
|                        Go Backend                               |
|  +-------------+  +-------------+  +-------------------------+ |
|  | TopoService |  | TopoList    |  |  Discovery Engine       | |
|  |  (Cache +   |  |  Service    |  |  (ITopoDiscovery)       | |
|  |   Layouts)  |  |  (Registry) |  |  Layer1, WorldCities    | |
|  +-------------+  +-------------+  +-------------------------+ |
+-----------------------------------------------------------------+
```

### Core Components

| Component | Description |
|-----------|-------------|
| **TopoService** | Core topology service managing nodes, links, and locations with in-memory caching. Handles CRUD operations, viewport-filtered queries, layout algorithm execution, and location aggregation. |
| **TopoListService** | Registry service for managing multiple topologies. Clients query this to discover available topology services. |
| **ITopoDiscovery** | Extensible discovery interface. Implementations convert external inventory systems into topology nodes and links. |
| **Layer1 Discovery** | Layer 1 (physical) discovery implementation using Probler's NetworkDevice inventory. Converts devices to topology nodes with geographic positioning. |
| **WorldCities** | Thread-safe geographic lookup from CSV data, resolving city names to latitude/longitude coordinates with lazy loading. |
| **WebGL Renderer** | GPU-accelerated rendering pipeline with instanced node drawing, link batching, camera/projection management, color-based hit-detection picking, and device type icon rendering. |

### Layout Algorithms

| Layout | Description |
|--------|-------------|
| **Location** | Positions nodes by geographic coordinates using Robinson projection on a world map. Supports location aggregation (multiple nodes at the same location shown as a single aggregate node with count). |
| **Hierarchical** | Tree-like layout from root nodes. Levels assigned based on longest path; nodes centered horizontally within each level. |
| **Circular** | Arranges nodes in concentric rings with inner nodes positioned tighter than outer ones. |
| **Radial** | Spoke layout radiating from central hub nodes. Multiple centers detected based on connectivity. |
| **Force-Directed** | Physics-based simulation using Coulomb repulsion and Hooke's law spring attraction. Iterates up to 300 steps with velocity damping (0.85) until convergence. |

## Project Structure

```
l8topology/
+-- go/
|   +-- topo/
|   |   +-- topo_service/         # Core topology service + layout algorithms
|   |   |   +-- TopoService.go        # Service activation, CRUD, web endpoint
|   |   |   +-- TopoServiceGet.go     # Query handling, viewport filtering, aggregation
|   |   |   +-- TopoServiceUtils.go   # Discovery orchestration, link matching
|   |   |   +-- Hierarchical.go       # Hierarchical layout algorithm
|   |   |   +-- Circular.go           # Circular layout algorithm
|   |   |   +-- Radial.go             # Radial layout algorithm
|   |   |   +-- Force_Directed.go     # Force-directed layout algorithm
|   |   +-- topo_list/            # Topology registry service
|   |   +-- discover/             # Discovery engine implementations
|   |   |   +-- Layer1.go             # Layer 1 physical topology discovery
|   |   |   +-- WorldCities.go        # Geographic city-to-coordinate lookup
|   |   +-- webui/web/            # Frontend assets
|   |       +-- index.html            # Main application page
|   |       +-- app.js                # Application bootstrap
|   |       +-- topology-core.js      # TopologyBrowser class, state management
|   |       +-- topology-data.js      # Data loading, caching, L8Query construction
|   |       +-- topology-ui.js        # UI elements, detail popups, modals
|   |       +-- topology-map.js       # SVG rendering (legacy fallback)
|   |       +-- styles.css            # Dark theme with cyan accents
|   |       +-- resources/            # Static assets (world.svg)
|   |       +-- webgl/               # GPU-accelerated rendering
|   |           +-- webgl-renderer.js     # WebGL context management
|   |           +-- webgl-nodes.js        # Instanced node rendering
|   |           +-- webgl-links.js        # Batched link rendering
|   |           +-- webgl-camera.js       # View/projection matrix, zoom
|   |           +-- webgl-picking.js      # Color-based hit detection
|   |           +-- webgl-icons.js        # Device type icon rendering
|   |           +-- webgl-topology.js     # Integration layer
|   |           +-- shaders.js            # GLSL vertex/fragment shaders
|   +-- types/l8topo/             # Generated protobuf Go types
|   +-- tests/                    # Integration tests + mock services
+-- proto/
|   +-- topology.proto            # Protobuf type definitions
+-- resources/
|   +-- world.svg                 # Robinson projection world map
+-- LICENSE
```

## Installation

### Prerequisites

- Go 1.26 or higher
- Protocol Buffers compiler (for regenerating types)

### Build from Source

```bash
# Clone the repository
git clone https://github.com/saichler/l8topology.git
cd l8topology/go

# Initialize and download dependencies
go mod tidy

# Build all packages
go build ./...

# Run tests
go test -tags=unit -v ./...
```

### Running with Coverage

```bash
go test -tags=unit -v -coverpkg=./topo/... -coverprofile=cover.html ./...
go tool cover -html=cover.html
```

## Usage

### Implementing a Discovery Provider

L8topology uses the `ITopoDiscovery` interface to integrate with external inventory systems. Implement this interface to discover topology from your own data source:

```go
type ITopoDiscovery interface {
    ServiceName() string
    ServiceArea() byte
    Query() string
    ModelTypeName() string
    IdOf(elem interface{}) string
    LocationOf(elem interface{}) string
    NodeType(elem interface{}) l8topo.L8TopologyNodeType
    ConvertToTopologyNode(elem interface{}) (*l8topo.L8TopologyNode, *l8topo.L8TopologyLocation)
    IsConnected(aside, zside interface{}) (bool, l8topo.L8TopologyLinkDirection)
}
```

The built-in `Layer1` implementation discovers physical network topology from Probler's NetworkDevice inventory.

### Querying Topology

Topology data is queried via `L8TopologyQuery`, which specifies the layout algorithm and optional viewport bounds:

```go
query := &l8topo.L8TopologyQuery{
    Layout: l8topo.L8TopologyLayout_Force_Directed,
    X:  0,   Y:  0,    // viewport top-left
    X1: 1920, Y1: 1080, // viewport bottom-right
}
```

The service returns an `L8Topology` containing positioned nodes, links, and locations filtered to the viewport.

### Data Types

Core protobuf types:

```protobuf
message L8Topology {
    string name = 1;
    map<string, L8TopologyNode> nodes = 2;
    map<string, L8TopologyLink> links = 3;
    map<string, L8TopologyLocation> locations = 4;
}
```

**Node types**: Generic, Switch, Router, Network Aggregation, Firewall, Load Balancer, Access Point, Server, Storage, Gateway

**Link directions**: AsideToZside, ZsideToAside, Bidirectional

**Link statuses**: Up, Down, Partial

**Layouts**: Location, Hierarchical, Circular, Radial, Force_Directed

## Dependencies

| Package | Purpose |
|---------|---------|
| [l8bus](https://github.com/saichler/l8bus) | Message bus for inter-service communication |
| [l8services](https://github.com/saichler/l8services) | Base service framework and cache management |
| [l8web](https://github.com/saichler/l8web) | Web service and REST endpoint definitions |
| [l8types](https://github.com/saichler/l8types) | Core interface definitions (IVNic, IService, IElements) |
| [l8utils](https://github.com/saichler/l8utils) | Utilities (cache, web, logging) |
| [l8reflect](https://github.com/saichler/l8reflect) | Property reflection for model introspection |
| [l8srlz](https://github.com/saichler/l8srlz) | Object serialization |
| [l8test](https://github.com/saichler/l8test) | Test framework (virtual networks) |
| [l8pollaris](https://github.com/saichler/l8pollaris) | Polling and targeting framework |
| [probler](https://github.com/saichler/probler) | Network device discovery (SNMP) |
| [protobuf](https://google.golang.org/protobuf) | Protocol buffer runtime |

## Performance

L8topology is designed for enterprise-scale network visualization:

- **Nodes**: Handles 30,000+ nodes
- **Links**: Handles 300,000+ links
- **WebGL**: GPU-accelerated rendering with instanced drawing for 10-30x speedup over SVG
- **Viewport culling**: Server-side filtering reduces data transfer to only visible elements
- **Location aggregation**: Reduces visual complexity by grouping co-located nodes
- **Force-directed convergence**: Velocity damping ensures simulation settles efficiently

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Related Projects

- [l8bus](https://github.com/saichler/l8bus) - Message bus framework
- [l8services](https://github.com/saichler/l8services) - Service framework
- [l8web](https://github.com/saichler/l8web) - Web service framework
- [l8types](https://github.com/saichler/l8types) - Core type interfaces
- [l8utils](https://github.com/saichler/l8utils) - Shared utilities
- [l8reflect](https://github.com/saichler/l8reflect) - Reflection framework
- [l8pollaris](https://github.com/saichler/l8pollaris) - Polling framework
- [probler](https://github.com/saichler/probler) - Network discovery
