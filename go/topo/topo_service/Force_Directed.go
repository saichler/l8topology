/*
 * © 2025 Sharon Aicler (saichler@gmail.com)
 *
 * Layer 8 Ecosystem is licensed under the Apache License, Version 2.0.
 * You may obtain a copy of the License at:
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package topo_service

import (
	"math"
	"math/rand"

	"github.com/saichler/l8topology/go/types/l8topo"
)

// Physics simulation constants for force-directed layout
const (
	forceIterations  = 300     // Maximum simulation iterations
	forceRepulsion   = 5000.0  // Coulomb's law constant for node repulsion
	forceAttraction  = 0.01    // Hooke's law spring constant for link attraction
	forceDamping     = 0.85    // Velocity damping factor to ensure convergence
	forceMinMovement = 0.5     // Stop simulation when max movement falls below this
	forcePadding     = 80.0    // Minimum padding from SVG edges in pixels
	forceIdealLength = 100.0   // Ideal spring length for connected nodes
)

// forceNode represents a node in the force simulation with position and velocity.
type forceNode struct {
	x, y   float64  // Current position coordinates
	vx, vy float64  // Current velocity components
	nodeId string   // Reference to the topology node
}

// Force_Directed arranges topology nodes using a physics-based simulation.
// The algorithm models the graph as a physical system where:
//   - All nodes repel each other (like electrically charged particles)
//   - Connected nodes attract each other (like springs)
//
// The simulation runs iteratively, applying forces and updating positions
// until the system reaches equilibrium or the maximum iterations are reached.
//
// Physics model:
//   - Repulsion: Coulomb's law (F = k / d²) pushes nodes apart
//   - Attraction: Hooke's law (F = k * (d - idealLength)) pulls connected nodes together
//   - Damping: Velocity is reduced each iteration to ensure convergence
//
// The layout process:
//  1. Initialize nodes in a circular pattern with random perturbation
//  2. Run simulation loop:
//     a. Calculate repulsive forces between all node pairs
//     b. Calculate attractive forces for connected nodes (springs)
//     c. Apply velocities with damping and boundary constraints
//     d. Check for convergence (movement below threshold)
//  3. Center the final graph in the SVG canvas
//  4. Update node locations with calculated coordinates
//
// This layout is effective for visualizing graph structure as it naturally
// separates clusters and keeps connected nodes close together.
func Force_Directed(topology *l8topo.L8Topology) {
	nodes := topology.GetNodes()
	links := topology.GetLinks()

	nodeCount := len(nodes)
	if nodeCount == 0 {
		return
	}

	// Calculate center point and boundaries
	centerX := float64(svgWidth) / 2
	centerY := float64(svgHeight) / 2
	maxX := float64(svgWidth) - forcePadding
	maxY := float64(svgHeight) - forcePadding

	// Build adjacency list for force calculations
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

	// Initialize node positions in a circular pattern with random perturbation
	// This provides a reasonable starting configuration for the simulation
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
		// Using Coulomb's law: F = k / d² (inverse square law)
		for i := 0; i < len(nodeList); i++ {
			for j := i + 1; j < len(nodeList); j++ {
				n1 := nodeList[i]
				n2 := nodeList[j]

				dx := n2.x - n1.x
				dy := n2.y - n1.y
				dist := math.Sqrt(dx*dx + dy*dy)
				if dist < 1 {
					dist = 1 // Prevent division by zero
				}

				// Coulomb's law: F = k / d^2
				force := forceRepulsion / (dist * dist)

				// Normalize direction and apply force (equal and opposite)
				fx := (dx / dist) * force
				fy := (dy / dist) * force

				n1.vx -= fx
				n1.vy -= fy
				n2.vx += fx
				n2.vy += fy
			}
		}

		// Calculate attractive forces for connected nodes (springs)
		// Using Hooke's law: F = k * (d - idealLength)
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
				dist = 1 // Prevent division by zero
			}

			// Hooke's law: F = k * (d - idealLength)
			displacement := dist - forceIdealLength
			force := forceAttraction * displacement

			// Normalize direction and apply force
			fx := (dx / dist) * force
			fy := (dy / dist) * force

			n1.vx += fx
			n1.vy += fy
			n2.vx -= fx
			n2.vy -= fy
		}

		// Apply velocities with damping and boundary constraints
		for _, fn := range nodeList {
			// Apply damping to ensure convergence
			fn.vx *= forceDamping
			fn.vy *= forceDamping

			// Update position based on velocity
			fn.x += fn.vx
			fn.y += fn.vy

			// Track maximum movement for convergence check
			movement := math.Sqrt(fn.vx*fn.vx + fn.vy*fn.vy)
			if movement > maxMovement {
				maxMovement = movement
			}

			// Keep within bounds (elastic collision with walls)
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

		// Check for convergence - stop if movement is negligible
		if maxMovement < forceMinMovement {
			break
		}
	}

	// Center the graph in the SVG canvas
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

	// Calculate offset to center the graph
	graphWidth := graphMaxX - minX
	graphHeight := graphMaxY - minY
	offsetX := centerX - (minX + graphWidth/2)
	offsetY := centerY - (minY + graphHeight/2)

	// Apply centering offset with final bounds check
	for _, fn := range nodeList {
		fn.x += offsetX
		fn.y += offsetY

		// Final bounds check after centering
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

	// Update location SvgX and SvgY for each node
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
