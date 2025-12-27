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
	"bytes"

	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8topology/go/types/l8topo"
	"github.com/saichler/l8types/go/ifs"
)

// nodeL8Location retrieves the L8TopologyLocation for a given location name.
// If the location is not found in the cache, returns a new location with
// only the location name populated.
func (this *TopoService) nodeL8Location(location string) *l8topo.L8TopologyLocation {
	filter := &l8topo.L8TopologyLocation{}
	filter.Location = location
	l, err := this.locations.Get(filter)
	if err == nil {
		return l.(*l8topo.L8TopologyLocation)
	}
	return &l8topo.L8TopologyLocation{Location: location}
}

// createViewNode creates a view-specific node representation based on the query layout.
// For Location layout, nodes are grouped by their location. For other layouts, each
// node maintains its individual identity. Returns the view node, its location, and
// a location key, or nil values if the node is outside the viewport boundaries.
func (this *TopoService) createViewNode(node *l8topo.L8TopologyNode, tq *l8topo.L8TopologyQuery, nodeIds map[string]bool) (*l8topo.L8TopologyNode, *l8topo.L8TopologyLocation, string) {
	nodeLocation := this.nodeL8Location(node.Location)
	if tq.X != 0 || tq.Y != 0 || tq.X1 != 0 || tq.Y1 != 0 {
		if nodeLocation.SvgX < tq.X || nodeLocation.SvgX > tq.X1 ||
			nodeLocation.SvgY < tq.Y || nodeLocation.SvgY > tq.Y1 {
			return nil, nil, ""
		}
	}
	viewNode := &l8topo.L8TopologyNode{}
	if tq.Layout == l8topo.L8TopologyLayout_Location {
		viewNode.NodeId = node.Location
		viewNode.Name = node.Location
		viewNode.Location = node.Location
	} else {
		viewNode.NodeId = node.NodeId
		viewNode.Name = node.Name
		viewNode.Location = node.NodeId
		nodeLocation = &l8topo.L8TopologyLocation{}
		nodeLocation.Location = node.NodeId
	}
	viewNode.Type = node.Type
	nodeIds[node.NodeId] = true
	return viewNode, nodeLocation, viewNode.Location
}

// collectNodes gathers all topology nodes from the cache, applies viewport filtering,
// and populates the topology with view-appropriate node representations.
// For Location layout, multiple nodes at the same location are aggregated.
func (this *TopoService) collectNodes(topology *l8topo.L8Topology, tq *l8topo.L8TopologyQuery, nodeIds map[string]bool) {
	allNodes := this.nodes.Collect(func(i interface{}) (bool, interface{}) {
		return true, i
	})
	topology.Nodes = make(map[string]*l8topo.L8TopologyNode)
	topology.Locations = make(map[string]*l8topo.L8TopologyLocation)
	for _, n := range allNodes {
		node := n.(*l8topo.L8TopologyNode)
		viewNode, viewLocation, viewKey := this.createViewNode(node, tq, nodeIds)
		if viewNode != nil {
			exist, ok := topology.Nodes[viewKey]
			if !ok {
				topology.Nodes[viewKey] = viewNode
				viewNode.Count = 1
			} else {
				exist.Count += 1
				exist.Type = l8topo.L8TopologyNodeType_NETWORK_AGGREGATION
			}
			topology.Locations[viewLocation.Location] = viewLocation
		}
	}
}

// collectLinks gathers all topology links from the cache and creates view-appropriate
// link representations. For Location layout, links are aggregated between locations.
// Links connecting nodes at the same location are excluded. Bidirectional links are
// merged when duplicate links in opposite directions are detected.
func (this *TopoService) collectLinks(topology *l8topo.L8Topology, tq *l8topo.L8TopologyQuery, nodeIds map[string]bool) {
	allLinks := this.links.Collect(func(i interface{}) (bool, interface{}) {
		return true, i
	})
	topology.Links = make(map[string]*l8topo.L8TopologyLink)
	for _, l := range allLinks {
		topolink := l.(*l8topo.L8TopologyLink)
		aside := rootIdOf(topolink.Aside, nodeIds)
		zside := rootIdOf(topolink.Zside, nodeIds)
		//one of the nodes is not in query
		if aside == "" || zside == "" {
			continue
		}
		laside := aside
		lzside := zside
		if tq.Layout == l8topo.L8TopologyLayout_Location {
			laside = this.locationOf(aside)
			lzside = this.locationOf(zside)
		}
		// the nodes have the same location
		if laside == lzside {
			continue
		}
		buff := bytes.Buffer{}
		buff.WriteString(laside)
		buff.WriteString(lzside)
		viewLink := createLink(laside, lzside, topolink.Direction)
		viewLink.LinkId = buff.String()
		exist, ok := topology.Links[viewLink.LinkId]
		if ok {
			if exist.Direction != topolink.Direction {
				exist.Direction = l8topo.L8TopologyLinkDirection_Bidirectional
			}
		} else {
			topology.Links[viewLink.LinkId] = viewLink
		}
	}
}

// Get retrieves topology data based on the query parameters.
// It collects nodes and links within the specified viewport, then applies
// the requested layout algorithm (Hierarchical, Circular, Radial, or Force_Directed)
// to calculate node positions. Returns the complete topology structure.
func (this *TopoService) Get(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	tq := elements.Element().(*l8topo.L8TopologyQuery)
	topology := &l8topo.L8Topology{Name: this.name}
	nodeIds := make(map[string]bool)
	this.collectNodes(topology, tq, nodeIds)
	this.collectLinks(topology, tq, nodeIds)
	if tq.Layout != l8topo.L8TopologyLayout_Location {
		switch tq.Layout {
		case l8topo.L8TopologyLayout_Hierarchical:
			Hierarchical(topology)
		case l8topo.L8TopologyLayout_Circular:
			Circular(topology)
		case l8topo.L8TopologyLayout_Radial:
			Radial(topology)
		case l8topo.L8TopologyLayout_Force_Directed:
			Force_Directed(topology)
		}
	}
	return object.New(nil, topology)
}
