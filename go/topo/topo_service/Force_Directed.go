package topo_service

import (
	"math"
	"math/rand"

	"github.com/saichler/l8topology/go/types/l8topo"
)

const (
	forceIterations     = 300
	forceRepulsion      = 5000.0  // Repulsion constant between nodes
	forceAttraction     = 0.01   // Spring constant for links
	forceDamping        = 0.85   // Velocity damping factor
	forceMinMovement    = 0.5    // Stop if max movement is below this
	forcePadding        = 80.0
	forceIdealLength    = 100.0  // Ideal spring length
)

type forceNode struct {
	x, y   float64
	vx, vy float64
	nodeId string
}

func Force_Directed(topology *l8topo.L8Topology) {
	nodes := topology.GetNodes()
	links := topology.GetLinks()

	nodeCount := len(nodes)
	if nodeCount == 0 {
		return
	}

	centerX := float64(svgWidth) / 2
	centerY := float64(svgHeight) / 2
	maxX := float64(svgWidth) - forcePadding
	maxY := float64(svgHeight) - forcePadding

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

	// Initialize node positions randomly around center
	forceNodes := make(map[string]*forceNode)
	nodeList := make([]*forceNode, 0, nodeCount)

	i := 0
	for _, node := range nodes {
		// Start with a circular distribution plus some randomness
		angle := 2 * math.Pi * float64(i) / float64(nodeCount)
		radius := 100.0 + rand.Float64()*100.0
		fn := &forceNode{
			x:      centerX + radius*math.Cos(angle) + (rand.Float64()-0.5)*50,
			y:      centerY + radius*math.Sin(angle) + (rand.Float64()-0.5)*50,
			vx:     0,
			vy:     0,
			nodeId: node.NodeId,
		}
		forceNodes[node.NodeId] = fn
		nodeList = append(nodeList, fn)
		i++
	}

	// Run force simulation
	for iter := 0; iter < forceIterations; iter++ {
		maxMovement := 0.0

		// Calculate repulsive forces between all pairs of nodes
		for i := 0; i < len(nodeList); i++ {
			for j := i + 1; j < len(nodeList); j++ {
				n1 := nodeList[i]
				n2 := nodeList[j]

				dx := n2.x - n1.x
				dy := n2.y - n1.y
				dist := math.Sqrt(dx*dx + dy*dy)
				if dist < 1 {
					dist = 1
				}

				// Coulomb's law: F = k / d^2
				force := forceRepulsion / (dist * dist)

				// Normalize and apply force
				fx := (dx / dist) * force
				fy := (dy / dist) * force

				n1.vx -= fx
				n1.vy -= fy
				n2.vx += fx
				n2.vy += fy
			}
		}

		// Calculate attractive forces for connected nodes (springs)
		for _, link := range links {
			n1 := forceNodes[link.Aside]
			n2 := forceNodes[link.Zside]
			if n1 == nil || n2 == nil {
				continue
			}

			dx := n2.x - n1.x
			dy := n2.y - n1.y
			dist := math.Sqrt(dx*dx + dy*dy)
			if dist < 1 {
				dist = 1
			}

			// Hooke's law: F = k * (d - idealLength)
			displacement := dist - forceIdealLength
			force := forceAttraction * displacement

			// Normalize and apply force
			fx := (dx / dist) * force
			fy := (dy / dist) * force

			n1.vx += fx
			n1.vy += fy
			n2.vx -= fx
			n2.vy -= fy
		}

		// Apply velocities and damping
		for _, fn := range nodeList {
			// Apply damping
			fn.vx *= forceDamping
			fn.vy *= forceDamping

			// Update position
			fn.x += fn.vx
			fn.y += fn.vy

			// Track maximum movement
			movement := math.Sqrt(fn.vx*fn.vx + fn.vy*fn.vy)
			if movement > maxMovement {
				maxMovement = movement
			}

			// Keep within bounds
			if fn.x < forcePadding {
				fn.x = forcePadding
				fn.vx = 0
			}
			if fn.x > maxX {
				fn.x = maxX
				fn.vx = 0
			}
			if fn.y < forcePadding {
				fn.y = forcePadding
				fn.vy = 0
			}
			if fn.y > maxY {
				fn.y = maxY
				fn.vy = 0
			}
		}

		// Check for convergence
		if maxMovement < forceMinMovement {
			break
		}
	}

	// Center the graph
	minX, minY := math.MaxFloat64, math.MaxFloat64
	graphMaxX, graphMaxY := -math.MaxFloat64, -math.MaxFloat64
	for _, fn := range nodeList {
		if fn.x < minX {
			minX = fn.x
		}
		if fn.x > graphMaxX {
			graphMaxX = fn.x
		}
		if fn.y < minY {
			minY = fn.y
		}
		if fn.y > graphMaxY {
			graphMaxY = fn.y
		}
	}

	graphWidth := graphMaxX - minX
	graphHeight := graphMaxY - minY
	offsetX := centerX - (minX + graphWidth/2)
	offsetY := centerY - (minY + graphHeight/2)

	// Apply centering offset
	for _, fn := range nodeList {
		fn.x += offsetX
		fn.y += offsetY

		// Final bounds check
		if fn.x < forcePadding {
			fn.x = forcePadding
		}
		if fn.x > maxX {
			fn.x = maxX
		}
		if fn.y < forcePadding {
			fn.y = forcePadding
		}
		if fn.y > maxY {
			fn.y = maxY
		}
	}

	// Update location SvgX and SvgY for each node (key is nodeId)
	for nodeId, node := range nodes {
		fn, ok := forceNodes[node.NodeId]
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
		location.SvgX = float32(fn.x)
		location.SvgY = float32(fn.y)
	}
}
