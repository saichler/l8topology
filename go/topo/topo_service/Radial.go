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

	"github.com/saichler/l8topology/go/types/l8topo"
)

// Layout constants for radial positioning
const (
	radialPadding        float32 = 80  // Minimum padding from SVG edges in pixels
	radialMinRingSpacing float32 = 60  // Minimum spacing between concentric rings
)

// Radial arranges topology nodes in a radial layout with the most connected
// node at the center and other nodes placed in concentric rings based on
// their hop distance from the center node.
//
// The layout process:
//  1. Build an adjacency list from the topology links
//  2. Find the most connected node to use as the center (root)
//  3. Use BFS to assign each node to a ring based on hop distance from root
//  4. Distribute nodes evenly around their assigned ring
//  5. Update node locations with calculated SVG coordinates
//
// Unlike the Circular layout which groups by connectivity, Radial uses
// network distance - nodes directly connected to the center are in ring 1,
// nodes two hops away are in ring 2, etc. This makes the layout useful for
// visualizing network topology and understanding hop distances.
//
// Disconnected nodes are placed in the outermost ring.
func Radial(topology *l8topo.L8Topology) {
	nodes := topology.GetNodes()
	links := topology.GetLinks()

	if len(nodes) == 0 {
		return
	}

	// Calculate center point and maximum radius
	centerX := svgWidth / 2
	centerY := svgHeight / 2
	maxRadius := float32(math.Min(float64(svgWidth), float64(svgHeight)))/2 - radialPadding

	// Build adjacency list representing node connectivity
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

	// Find node with most connections as root (center hub)
	var rootNode *l8topo.L8TopologyNode
	maxConnections := 0
	for _, node := range nodes {
		connCount := len(adjacency[node.NodeId])
		if connCount > maxConnections || rootNode == nil {
			maxConnections = connCount
			rootNode = node
		}
	}

	// BFS to assign levels (distance from root) - determines ring placement
	levels := make(map[string]int)
	visited := make(map[string]bool)

	// queueItem holds node ID and its assigned level for BFS traversal
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

	// Group nodes by level for ring assignment
	levelGroups := make(map[int][]string)
	for nodeId, level := range levels {
		levelGroups[level] = append(levelGroups[level], nodeId)
	}

	// Calculate positions - radial layout with root at center
	positions := make(map[string]struct{ x, y float32 })

	// Calculate ring spacing, ensuring minimum spacing is maintained
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
			// Nodes at this level form a ring at proportional radius
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

	// Update location SvgX and SvgY for each node
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
