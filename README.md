# l8topology

[![Go Version](https://img.shields.io/badge/Go-1.25+-00ADD8?style=flat&logo=go)](https://go.dev/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

A high-performance network topology visualization and management system written in Go with an interactive web-based UI. L8topology provides real-time network topology discovery, multiple layout algorithms, and GPU-accelerated WebGL rendering for handling large-scale network graphs.

## Features

- **Interactive Visualization** - Pan, zoom, and select nodes/links on an interactive world map
- **Multiple Layout Algorithms** - Geographic, Hierarchical, Circular, Radial, and Force-Directed layouts
- **WebGL Rendering** - GPU-accelerated rendering for handling 30K+ nodes and 300K+ links
- **Network Discovery** - Layer 1 topology discovery from network devices
- **Real-time Updates** - Live topology updates through service-oriented architecture
- **Device Type Icons** - Visual representation for Switches, Routers, Firewalls, and more
- **Link Status Visualization** - Color-coded link status (Up/Down/Partial) with directional arrows
- **REST API** - Full API for topology queries and management

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Browser                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  UI Layer   │  │  Data Mgmt  │  │  WebGL/SVG Renderer     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API
┌────────────────────────────┴────────────────────────────────────┐
│                        Go Backend                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ TopoService │  │ TopoList    │  │  Discovery Engine       │  │
│  │  (Cache)    │  │  Service    │  │  (Layer1, etc.)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Description |
|-----------|-------------|
| **TopoService** | Core topology handler managing nodes, links, locations, and layout calculations |
| **TopoListService** | Registry service for managing multiple topologies |
| **Discovery Engine** | Extensible discovery plugins (Layer 1 network topology) |
| **WebGL Renderer** | GPU-accelerated rendering with camera, picking, and shader systems |

## Project Structure

```
l8topology/
├── go/
│   ├── topo/
│   │   ├── topo_service/     # Core topology service
│   │   ├── topo_list/        # Topology registry
│   │   ├── discover/         # Discovery engines
│   │   └── webui/web/        # Frontend assets
│   │       ├── webgl/        # WebGL rendering components
│   │       ├── app.js        # Application entry
│   │       ├── topology-*.js # Core modules
│   │       └── styles.css    # Styling
│   ├── types/l8topo/         # Protocol buffer types
│   └── tests/                # Integration tests
├── proto/
│   └── topology.proto        # Data type definitions
├── resources/                # Static assets (world map)
└── LICENSE
```

## Installation

### Prerequisites

- Go 1.25 or higher
- Protocol Buffers compiler (for regenerating types)

### Build from Source

```bash
# Clone the repository
git clone https://github.com/saichler/l8topology.git
cd l8topology/go

# Initialize and download dependencies
go mod tidy

# Build
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

### Basic Integration

```go
import (
    "github.com/saichler/l8topology/go/topo/topo_service"
    "github.com/saichler/l8types/go/types"
)

// Create a new topology service
service := topo_service.NewTopoService(resources, servicePoints)

// Add nodes to topology
node := &types.L8TopologyNode{
    NodeId:   "node-1",
    Name:     "Core Router",
    Type:     types.L8TopologyNodeType_Router,
    Location: "New York",
}

// Add links between nodes
link := &types.L8TopologyLink{
    LinkId:    "link-1",
    Aside:     "node-1",
    Zside:     "node-2",
    Direction: types.L8TopologyLinkDirection_Bidirectional,
    Status:    types.L8TopologyLinkStatus_Up,
}
```

### Data Types

The topology system uses Protocol Buffers for data serialization:

```protobuf
// Core topology container
message L8Topology {
    string name = 1;
    map<string, L8TopologyNode> nodes = 2;
    map<string, L8TopologyLink> links = 3;
    map<string, L8TopologyLocation> locations = 4;
}

// Node types: Generic, Switch, Router, Firewall, LoadBalancer, Server, Storage, Cloud
// Link directions: AsideToZside, ZsideToAside, Bidirectional
// Link statuses: Up, Down, Partial
// Layouts: Location, Hierarchical, Circular, Radial, Force_Directed
```

### Layout Algorithms

| Layout | Description |
|--------|-------------|
| **Location** | Position nodes by geographic coordinates on world map |
| **Hierarchical** | Tree-like layout showing network hierarchy |
| **Circular** | Arrange nodes in a ring pattern |
| **Radial** | Spoke layout radiating from central nodes |
| **Force-Directed** | Physics-based simulation for natural clustering |

## API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/topologies` | GET | List available topologies |
| `/topology/{name}` | GET | Get topology by name |
| `/topology/{name}/nodes` | GET | Get all nodes in topology |
| `/topology/{name}/links` | GET | Get all links in topology |
| `/topology/{name}/layout/{type}` | POST | Apply layout algorithm |

## Dependencies

### Direct Dependencies

| Package | Purpose |
|---------|---------|
| [l8bus](https://github.com/saichler/l8bus) | Message bus for inter-service communication |
| [l8services](https://github.com/saichler/l8services) | Service framework |
| [l8web](https://github.com/saichler/l8web) | Web service framework |
| [l8pollaris](https://github.com/saichler/l8pollaris) | Monitoring/polling framework |
| [probler](https://github.com/saichler/probler) | Network device/link discovery |
| [protobuf](https://google.golang.org/protobuf) | Protocol buffer support |

## Performance

L8topology is designed for enterprise-scale network visualization:

- **Nodes**: Tested with 30,000+ nodes
- **Links**: Tested with 300,000+ links
- **Rendering**: WebGL provides 10-30x speedup over SVG
- **Memory**: Efficient in-memory caching with pagination support

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
- [probler](https://github.com/saichler/probler) - Network discovery
