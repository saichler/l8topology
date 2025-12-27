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

// Package topo_list provides a registry service for available topology views.
// It maintains a list of registered topologies that clients can query to
// discover available topology services and their configurations.
//
// The service allows dynamic registration of new topology providers and
// exposes a web endpoint for clients to enumerate available topologies.
package topo_list

import (
	"github.com/saichler/l8services/go/services/base"
	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8topology/go/types/l8topo"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8types/go/types/l8api"
	"github.com/saichler/l8types/go/types/l8services"
	"github.com/saichler/l8utils/go/utils/web"
)

// Service registration constants for the topology list service
const (
	ServiceName = "TopoList"  // Service identifier used for registration and discovery
	ServiceArea = byte(0)     // Service area code (0 = global/default)
)

// Activate registers and starts the topology list service.
// This service maintains a registry of available topology views and
// exposes them through a web endpoint. It uses the base service
// implementation for standard CRUD operations on topology metadata.
func Activate(vnic ifs.IVNic) {
	serviceConfig := ifs.NewServiceLevelAgreement(&base.BaseService{}, ServiceName, ServiceArea, true, nil)

	// Configure service area registration
	services := &l8services.L8Services{}
	services.ServiceToAreas = make(map[string]*l8services.L8ServiceAreas)
	services.ServiceToAreas[ServiceName] = &l8services.L8ServiceAreas{}
	services.ServiceToAreas[ServiceName].Areas = make(map[int32]bool)
	services.ServiceToAreas[ServiceName].Areas[int32(ServiceArea)] = true

	// Configure data types for the service
	serviceConfig.SetServiceItem(&l8topo.L8TopologyMetadata{})
	serviceConfig.SetServiceItemList(&l8topo.L8TopologyMetadataList{})

	// Configure service behavior
	serviceConfig.SetVoter(true)
	serviceConfig.SetTransactional(false)
	serviceConfig.SetPrimaryKeys("ServiceName", "ServiceArea")

	// Configure web endpoint for topology enumeration
	ws := web.New(ServiceName, ServiceArea, 0)
	ws.AddEndpoint(&l8api.L8Query{}, ifs.GET, &l8topo.L8TopologyMetadataList{})
	serviceConfig.SetWebService(ws)

	base.Activate(serviceConfig, vnic)
}

// AddTopology registers a new topology in the topology list service.
// This should be called by topology providers when they activate to make
// themselves discoverable to clients.
//
// Parameters:
//   - name: Human-readable display name for the topology
//   - servicename: Internal service identifier for the topology service
//   - area: Service area code where the topology is registered
//   - vnic: Virtual network interface for service communication
func AddTopology(name, servicename string, area byte, vnic ifs.IVNic) {
	tm := &l8topo.L8TopologyMetadata{Name: name, ServiceName: servicename, ServiceArea: int32(area)}
	tmService, ok := vnic.Resources().Services().ServiceHandler(ServiceName, ServiceArea)
	if ok {
		tmService.Post(object.New(nil, tm), vnic)
	}
}
