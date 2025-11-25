package topo_service

import (
	"math"

	"github.com/saichler/l8topology/go/types/l8topo"
)

const (
	radialPadding float32 = 80
	radialMinRingSpacing float32 = 60
)

func Radial(topology *l8topo.L8Topology) {
	nodes := topology.GetNodes()
	links := topology.GetLinks()

	if len(nodes) == 0 {
		return
	}

	centerX := svgWidth / 2
	centerY := svgHeight / 2
	maxRadius := float32(math.Min(float64(svgWidth), float64(svgHeight)))/2 - radialPadding

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

	// BFS to assign levels (distance from root)
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

	// Handle disconnected nodes - place them in outermost ring
	maxLevel := 0
	for _, level := range levels {
		if level > maxLevel {
			maxLevel = level
		}
	}
	for _, node := range nodes {
		if !visited[node.NodeId] {
			levels[node.NodeId] = maxLevel + 1
		}
	}

	// Recalculate max level after adding disconnected nodes
	for _, level := range levels {
		if level > maxLevel {
			maxLevel = level
		}
	}

	// Group nodes by level
	levelGroups := make(map[int][]string)
	for nodeId, level := range levels {
		levelGroups[level] = append(levelGroups[level], nodeId)
	}

	// Calculate positions - radial layout with root at center
	positions := make(map[string]struct{ x, y float32 })

	// Calculate ring spacing
	ringSpacing := maxRadius / float32(maxLevel+1)
	if ringSpacing < radialMinRingSpacing && maxLevel > 0 {
		ringSpacing = radialMinRingSpacing
	}

	for level, nodesAtLevel := range levelGroups {
		if level == 0 {
			// Root node at center
			for _, nodeId := range nodesAtLevel {
				positions[nodeId] = struct{ x, y float32 }{x: centerX, y: centerY}
			}
		} else {
			// Nodes at this level form a ring
			radius := ringSpacing * float32(level)
			if radius > maxRadius {
				radius = maxRadius
			}

			nodeCountAtLevel := len(nodesAtLevel)
			for index, nodeId := range nodesAtLevel {
				// Distribute nodes evenly around the ring, starting from top (-π/2)
				angle := (2*math.Pi*float64(index)/float64(nodeCountAtLevel)) - math.Pi/2
				positions[nodeId] = struct{ x, y float32 }{
					x: centerX + float32(float64(radius)*math.Cos(angle)),
					y: centerY + float32(float64(radius)*math.Sin(angle)),
				}
			}
		}
	}

	// Update location SvgX and SvgY for each node (key is nodeId)
	for nodeId, node := range nodes {
		pos, ok := positions[node.NodeId]
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
