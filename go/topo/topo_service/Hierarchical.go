package topo_service

import "github.com/saichler/l8topology/go/types/l8topo"

const (
	hierarchicalPadding              = 50
	hierarchicalNodeSpacingX         = 150
	hierarchicalNodeSpacingY         = 100
	svgWidth                 float32 = 2000
	svgHeight                float32 = 857
)

func Hierarchical(topology *l8topo.L8Topology) {
	nodes := topology.GetNodes()
	links := topology.GetLinks()

	if len(nodes) == 0 {
		return
	}

	// Build adjacency list
	adjacency := make(map[string]map[string]bool)
	for _, node := range nodes {
		adjacency[node.NodeId] = make(map[string]bool)
	}

	for _, link := range links {
		asideNode := nodes[link.Aside]
		zsideNode := nodes[link.Zside]
		if asideNode != nil && zsideNode != nil {
			adjacency[asideNode.NodeId][zsideNode.NodeId] = true
			adjacency[zsideNode.NodeId][asideNode.NodeId] = true
		}
	}

	// Find node with most connections as root
	var rootNode *l8topo.L8TopologyNode
	maxConnections := 0
	for _, node := range nodes {
		connCount := len(adjacency[node.NodeId])
		if connCount > maxConnections || rootNode == nil {
			maxConnections = connCount
			rootNode = node
		}
	}

	// BFS to assign levels
	levels := make(map[string]int)
	visited := make(map[string]bool)

	type queueItem struct {
		nodeId string
		level  int
	}

	queue := []queueItem{{nodeId: rootNode.NodeId, level: 0}}
	visited[rootNode.NodeId] = true
	levels[rootNode.NodeId] = 0

	for len(queue) > 0 {
		item := queue[0]
		queue = queue[1:]

		neighbors := adjacency[item.nodeId]
		for neighborId := range neighbors {
			if !visited[neighborId] {
				visited[neighborId] = true
				levels[neighborId] = item.level + 1
				queue = append(queue, queueItem{nodeId: neighborId, level: item.level + 1})
			}
		}
	}

	// Handle disconnected nodes - assign them to level 0
	for _, node := range nodes {
		if !visited[node.NodeId] {
			levels[node.NodeId] = 0
		}
	}

	// Group nodes by level
	levelGroups := make(map[int][]string)
	for nodeId, level := range levels {
		levelGroups[level] = append(levelGroups[level], nodeId)
	}

	// Calculate positions and update locations
	nodePositions := make(map[string]struct{ x, y float32 })

	for level, nodesAtLevel := range levelGroups {
		y := float32(hierarchicalPadding) + float32(level)*float32(hierarchicalNodeSpacingY)
		if y > svgHeight-float32(hierarchicalPadding) {
			y = svgHeight - float32(hierarchicalPadding)
		}

		levelWidth := float32(len(nodesAtLevel)-1) * float32(hierarchicalNodeSpacingX)
		startX := (svgWidth - levelWidth) / 2

		for index, nodeId := range nodesAtLevel {
			x := startX + float32(index)*float32(hierarchicalNodeSpacingX)
			nodePositions[nodeId] = struct{ x, y float32 }{x: x, y: y}
		}
	}

	// Update location SvgX and SvgY for each node (key is nodeId)
	for nodeId, node := range nodes {
		pos, ok := nodePositions[node.NodeId]
		if !ok {
			continue
		}

		location := topology.Locations[nodeId]
		if location == nil {
			location = &l8topo.L8TopologyLocation{
				Location: node.Location,
			}
			if topology.Locations == nil {
				topology.Locations = make(map[string]*l8topo.L8TopologyLocation)
			}
			topology.Locations[nodeId] = location
		}
		location.SvgX = pos.x
		location.SvgY = pos.y
	}
}
