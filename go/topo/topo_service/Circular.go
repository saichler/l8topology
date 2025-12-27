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
	"sort"

	"github.com/saichler/l8topology/go/types/l8topo"
)

// Layout constants for circular positioning
const (
	circularPadding float32 = 80  // Minimum padding from SVG edges in pixels
)

// Circular arranges topology nodes in a circular or concentric ring layout.
// Nodes are sorted by connection count (most connected first) and distributed
// around circles centered in the SVG canvas.
//
// The layout adapts based on node count:
//   - Single node: placed at the center
//   - 2-6 nodes: single circle at 60% of max radius
//   - 7+ nodes: concentric rings with the most connected node at center
//
// For larger networks, nodes are distributed across rings with increasing
// capacity: 1 node at center, then rings of 6, 12, 18, 24 nodes.
// This places hub nodes (with more connections) closer to the center,
// creating a natural visual hierarchy.
func Circular(topology *l8topo.L8Topology) {
	nodes := topology.GetNodes()
	links := topology.GetLinks()

	nodeCount := len(nodes)
	if nodeCount == 0 {
		return
	}

	// Calculate center point and maximum radius
	centerX := svgWidth / 2
	centerY := svgHeight / 2
	maxRadius := float32(math.Min(float64(svgWidth), float64(svgHeight)))/2 - circularPadding

	// Build adjacency list for sorting nodes by connectivity
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

	// Create sorted node list by connection count (most connected first)
	// This ensures hub nodes are placed in more central positions
	nodeList := make([]*l8topo.L8TopologyNode, 0, nodeCount)
	for _, node := range nodes {
		nodeList = append(nodeList, node)
	}
	sort.Slice(nodeList, func(i, j int) bool {
		return len(adjacency[nodeList[i].NodeId]) > len(adjacency[nodeList[j].NodeId])
	})

	positions := make(map[string]struct{ x, y float32 })

	if nodeCount == 1 {
		// Single node at center
		positions[nodeList[0].NodeId] = struct{ x, y float32 }{x: centerX, y: centerY}
	} else if nodeCount <= 6 {
		// Small number of nodes: single circle layout
		radius := maxRadius * 0.6
		for index, node := range nodeList {
			// Distribute evenly around circle, starting from top (-π/2)
			angle := (2*math.Pi*float64(index)/float64(nodeCount)) - math.Pi/2
			positions[node.NodeId] = struct{ x, y float32 }{
				x: centerX + float32(float64(radius)*math.Cos(angle)),
				y: centerY + float32(float64(radius)*math.Sin(angle)),
			}
		}
	} else {
		// Larger networks: concentric circles based on connectivity
		// Most connected node at center, then rings outward
		nodesPerRing := []int{1, 6, 12, 18, 24}

		// Distribute nodes into rings
		var rings [][]*l8topo.L8TopologyNode
		nodeIndex := 0
		ringIndex := 0
		for nodeIndex < nodeCount {
			nodesInThisRing := nodesPerRing[min(ringIndex, len(nodesPerRing)-1)]
			endIndex := min(nodeIndex+nodesInThisRing, nodeCount)
			ringNodes := nodeList[nodeIndex:endIndex]
			rings = append(rings, ringNodes)
			nodeIndex = endIndex
			ringIndex++
		}

		// Position nodes in each ring
		for rIndex, ringNodes := range rings {
			if rIndex == 0 && len(ringNodes) == 1 {
				// Center node (most connected hub)
				positions[ringNodes[0].NodeId] = struct{ x, y float32 }{x: centerX, y: centerY}
			} else {
				// Calculate ring radius with offset to prevent overlap
				ringRadius := (float32(rIndex)/float32(len(rings)))*maxRadius + (maxRadius * 0.2)
				for nIndex, node := range ringNodes {
					// Distribute evenly around ring, starting from top
					angle := (2*math.Pi*float64(nIndex)/float64(len(ringNodes))) - math.Pi/2
					positions[node.NodeId] = struct{ x, y float32 }{
						x: centerX + float32(float64(ringRadius)*math.Cos(angle)),
						y: centerY + float32(float64(ringRadius)*math.Sin(angle)),
					}
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
