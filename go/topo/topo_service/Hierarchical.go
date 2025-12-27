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

import "github.com/saichler/l8topology/go/types/l8topo"

// Layout constants for hierarchical positioning
const (
	hierarchicalPadding      = 50   // Minimum padding from SVG edges in pixels
	hierarchicalNodeSpacingX = 150  // Horizontal spacing between nodes in pixels
	hierarchicalNodeSpacingY = 100  // Vertical spacing between hierarchy levels in pixels
	svgWidth                 float32 = 2000  // Default SVG canvas width
	svgHeight                float32 = 857   // Default SVG canvas height
)

// Hierarchical arranges topology nodes in a tree-like hierarchical layout.
// The algorithm uses BFS (Breadth-First Search) to assign nodes to levels
// based on their distance from a root node. The node with the most connections
// is selected as the root and placed at the top level (level 0).
//
// The layout process:
//  1. Build an adjacency list from the topology links
//  2. Find the most connected node to use as root
//  3. Use BFS to assign each node to a level based on hop distance from root
//  4. Group nodes by level and distribute them horizontally within each level
//  5. Update node locations with calculated SVG coordinates
//
// Disconnected nodes (not reachable from root) are placed at level 0.
// Nodes at each level are centered horizontally within the SVG canvas.
func Hierarchical(topology *l8topo.L8Topology) {
	nodes := topology.GetNodes()
	links := topology.GetLinks()

	if len(nodes) == 0 {
		return
	}

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

	// Find node with most connections as root (hub node)
	var rootNode *l8topo.L8TopologyNode
	maxConnections := 0
	for _, node := range nodes {
		connCount := len(adjacency[node.NodeId])
		if connCount > maxConnections || rootNode == nil {
			maxConnections = connCount
			rootNode = node
		}
	}

	// BFS to assign levels - each level represents hop distance from root
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

	// Handle disconnected nodes - assign them to level 0
	for _, node := range nodes {
		if !visited[node.NodeId] {
			levels[node.NodeId] = 0
		}
	}

	// Group nodes by level for horizontal distribution
	levelGroups := make(map[int][]string)
	for nodeId, level := range levels {
		levelGroups[level] = append(levelGroups[level], nodeId)
	}

	// Calculate positions - nodes at each level are centered horizontally
	nodePositions := make(map[string]struct{ x, y float32 })

	for level, nodesAtLevel := range levelGroups {
		// Calculate Y position based on level, with padding constraints
		y := float32(hierarchicalPadding) + float32(level)*float32(hierarchicalNodeSpacingY)
		if y > svgHeight-float32(hierarchicalPadding) {
			y = svgHeight - float32(hierarchicalPadding)
		}

		// Center nodes horizontally within the level
		levelWidth := float32(len(nodesAtLevel)-1) * float32(hierarchicalNodeSpacingX)
		startX := (svgWidth - levelWidth) / 2

		for index, nodeId := range nodesAtLevel {
			x := startX + float32(index)*float32(hierarchicalNodeSpacingX)
			nodePositions[nodeId] = struct{ x, y float32 }{x: x, y: y}
		}
	}

	// Update location SvgX and SvgY for each node
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
