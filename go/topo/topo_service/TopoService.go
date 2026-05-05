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

// Package topo_service provides the core topology service implementation
// for the Layer 8 Ecosystem. It manages network topology data including
// nodes, links, and locations, supporting multiple visualization layouts
// such as hierarchical, circular, radial, and force-directed algorithms.
//
// The package implements a discovery mechanism that can integrate with
// external inventory services to automatically populate topology data.
package topo_service

import (
	"errors"
	"time"

	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8topology/go/types/l8topo"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8utils/go/utils/cache"
	"github.com/saichler/l8utils/go/utils/web"
)

// TopoService is the main service implementation for managing network topology.
// It maintains caches for nodes, links, and locations, and provides CRUD
// operations through the standard Layer 8 service interface.
type TopoService struct {
	serviceName string          // The registered name of this service
	serviceArea byte            // The service area/region identifier
	name        string          // Display name for the topology
	nodes       *cache.Cache    // Cache storing L8TopologyNode instances
	links       *cache.Cache    // Cache storing L8TopologyLink instances
	locations   *cache.Cache    // Cache storing L8TopologyLocation instances
	discovery   ITopoDiscovery  // Discovery interface for populating topology
}

// ITopoDiscovery defines the interface for topology discovery providers.
// Implementations of this interface allow the topology service to discover
// and convert network elements from external inventory systems into
// topology nodes and links.
type ITopoDiscovery interface {
	// ServiceName returns the name of the inventory service to query.
	ServiceName() string
	// ServiceArea returns the area code of the inventory service.
	ServiceArea() byte
	// Query returns the query string to send to the inventory service.
	Query() string
	// ModelTypeName returns the type name of the model being discovered.
	ModelTypeName() string
	// IsConnected determines if two elements are connected and returns
	// the connection status and link direction.
	IsConnected(aside, zside interface{}) (bool, l8topo.L8TopologyLinkDirection)
	// ConvertToTopologyNode converts an inventory element to a topology node
	// and its associated location.
	ConvertToTopologyNode(elem interface{}) (*l8topo.L8TopologyNode, *l8topo.L8TopologyLocation)
	// IdOf extracts the unique identifier from an inventory element.
	IdOf(elem interface{}) string
	// LocationOf extracts the location identifier from an inventory element.
	LocationOf(elem interface{}) string
	// NodeType determines the topology node type for an inventory element.
	NodeType(elem interface{}) l8topo.L8TopologyNodeType
}

// Activate initializes the topology service with the given service level agreement
// and virtual network interface. It sets up caches, registers type decorators,
// and starts background node discovery after a 5-second delay.
func (this *TopoService) Activate(sla *ifs.ServiceLevelAgreement, vnic ifs.IVNic) error {
	this.serviceName = sla.ServiceName()
	this.serviceArea = sla.ServiceArea()
	this.name = this.serviceName
	this.discovery = sla.Args()[0].(ITopoDiscovery)

	vnic.Resources().Introspector().Decorators().AddPrimaryKeyDecorator(&l8topo.L8TopologyNode{}, "NodeId")
	vnic.Resources().Introspector().Decorators().AddPrimaryKeyDecorator(&l8topo.L8TopologyLink{}, "LinkId")
	vnic.Resources().Introspector().Decorators().AddPrimaryKeyDecorator(&l8topo.L8TopologyLocation{}, "Location")

	vnic.Resources().Registry().Register(&l8topo.L8TopologyQuery{})

	this.nodes = cache.NewCache(&l8topo.L8TopologyNode{}, nil, nil, vnic.Resources())
	this.links = cache.NewCache(&l8topo.L8TopologyLink{}, nil, nil, vnic.Resources())
	this.locations = cache.NewCache(&l8topo.L8TopologyLocation{}, nil, nil, vnic.Resources())

	go func() {
		time.Sleep(time.Second * 5)
		this.DiscoverNodes(vnic)
	}()

	return nil
}

// DeActivate performs cleanup when the service is being shut down.
// Currently performs no cleanup operations.
func (this *TopoService) DeActivate() error {
	return nil
}

// do performs the specified action on a collection of topology elements.
// It dispatches to the appropriate handler based on element type (node, link, or location).
func (this *TopoService) do(action ifs.Action, elements ifs.IElements) error {
	for _, elem := range elements.Elements() {
		node, ok := elem.(*l8topo.L8TopologyNode)
		if ok {
			err := this.doNodes(action, node)
			if err != nil {
				return err
			}
			continue
		}
		link, ok := elem.(*l8topo.L8TopologyLink)
		if ok {
			err := this.doLinks(action, link)
			if err != nil {
				return err
			}
		}
		location, ok := elem.(*l8topo.L8TopologyLocation)
		if ok {
			err := this.doLocations(action, location)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// doNodes performs a CRUD action on a single topology node.
func (this *TopoService) doNodes(action ifs.Action, node *l8topo.L8TopologyNode) error {
	var err error
	switch action {
	case ifs.POST:
		_, _, err = this.nodes.Post(node, false)
	case ifs.PUT:
		_, _, err = this.nodes.Put(node, false)
	case ifs.DELETE:
		_, _, err = this.nodes.Delete(node, false)
	case ifs.PATCH:
		_, _, err = this.nodes.Patch(node, false)
	default:
		return errors.New("unknown action for topology nodes")
	}
	return err
}

// doLinks performs a CRUD action on a single topology link.
func (this *TopoService) doLinks(action ifs.Action, link *l8topo.L8TopologyLink) error {
	var err error
	switch action {
	case ifs.POST:
		_, _, err = this.links.Post(link, false)
	case ifs.PUT:
		_, _, err = this.links.Put(link, false)
	case ifs.DELETE:
		_, _, err = this.links.Delete(link, false)
	case ifs.PATCH:
		_, _, err = this.links.Patch(link, false)
	default:
		return errors.New("unknown action for topology links")
	}
	return err
}

// doLocations performs a CRUD action on a single topology location.
func (this *TopoService) doLocations(action ifs.Action, location *l8topo.L8TopologyLocation) error {
	var err error
	switch action {
	case ifs.POST:
		_, _, err = this.locations.Post(location, false)
	case ifs.PUT:
		_, _, err = this.locations.Put(location, false)
	case ifs.DELETE:
		_, _, err = this.locations.Delete(location, false)
	case ifs.PATCH:
		_, _, err = this.locations.Patch(location, false)
	default:
		return errors.New("unknown action for topology location")
	}
	return err
}

// Post creates new topology elements (nodes, links, or locations).
// Returns nil on success or an error element on failure.
func (this *TopoService) Post(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	err := this.do(ifs.POST, elements)
	if err != nil {
		return object.NewError(err.Error())
	}
	return nil
}

// Put replaces existing topology elements with new data.
// Returns nil on success or an error element on failure.
func (this *TopoService) Put(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	err := this.do(ifs.PUT, elements)
	if err != nil {
		return object.NewError(err.Error())
	}
	return nil
}

// Patch partially updates existing topology elements.
// Returns nil on success or an error element on failure.
func (this *TopoService) Patch(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	err := this.do(ifs.PATCH, elements)
	if err != nil {
		return object.NewError(err.Error())
	}
	return nil
}

// Delete removes topology elements from the cache.
// Returns nil on success or an error element on failure.
func (this *TopoService) Delete(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	err := this.do(ifs.DELETE, elements)
	if err != nil {
		return object.NewError(err.Error())
	}
	return nil
}

// Failed handles failed operations. Currently returns nil without action.
func (this *TopoService) Failed(elements ifs.IElements, vnic ifs.IVNic, msg *ifs.Message) ifs.IElements {
	return nil
}

// TransactionConfig returns the transaction configuration for this service.
// Currently returns nil indicating no special transaction handling.
func (this *TopoService) TransactionConfig() ifs.ITransactionConfig {
	return nil
}

// WebService creates and returns the web service configuration for this
// topology service. It exposes a GET endpoint that accepts L8TopologyQuery
// and returns L8Topology data.
func (this *TopoService) WebService() ifs.IWebService {
	ws := web.New(this.serviceName, this.serviceArea, 0)
	ws.AddEndpoint(&l8topo.L8TopologyQuery{}, ifs.GET, &l8topo.L8Topology{})
	return ws
}
