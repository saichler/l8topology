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

// Package discover provides topology discovery implementations for the Layer 8 Ecosystem.
// It includes discovery providers that can query external inventory systems and convert
// network device data into topology nodes, links, and locations.
//
// The package also provides geographic utilities for converting location names to
// coordinates and projecting those coordinates onto SVG map visualizations.
package discover

import (
	"fmt"
	"github.com/saichler/l8pollaris/go/pollaris/targets"

	"github.com/saichler/l8topology/go/topo/topo_list"
	"github.com/saichler/l8topology/go/topo/topo_service"
	"github.com/saichler/l8topology/go/types/l8topo"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/probler/go/prob/common"
	"github.com/saichler/probler/go/types"
)

// Layer1 implements the ITopoDiscovery interface for Layer 1 (physical) network discovery.
// It discovers network devices from the Probler inventory service and converts them
// into topology nodes with geographic location data.
type Layer1 struct {
}

// Service registration constants for Layer 1 topology
const (
	Layer1Name        = "Network Layer 1"  // Display name for the topology
	Layer1ServiceName = "L1"               // Internal service identifier
	Layer1ServiceArea = byte(1)            // Service area code
)

// ActivateLayer1 registers and activates the Layer 1 topology service.
// It registers the topology in the topology list, configures type decorators,
// and activates the topology service with the Layer1 discovery provider.
func ActivateLayer1(nic ifs.IVNic) {
	topo_list.AddTopology(Layer1Name, Layer1ServiceName, Layer1ServiceArea, nic)
	sla := ifs.NewServiceLevelAgreement(&topo_service.TopoService{}, Layer1ServiceName, Layer1ServiceArea, true, nil)
	sla.SetArgs(&Layer1{})
	nic.Resources().Registry().Register(&types.NetworkDeviceList{})
	nic.Resources().Introspector().Decorators().AddPrimaryKeyDecorator(&types.NetworkDevice{}, "Id")
	nic.Resources().Services().Activate(sla, nic)
}

// ServiceName returns the name of the inventory service to query for network devices.
func (this *Layer1) ServiceName() string {
	sn, _ := targets.Links.Cache(common.NetworkDevice_Links_ID)
	return sn
}

// ServiceArea returns the area code of the inventory service.
func (this *Layer1) ServiceArea() byte {
	_, sa := targets.Links.Cache(common.NetworkDevice_Links_ID)
	return sa
}

// Query returns the SQL-like query string to retrieve all network devices.
func (this *Layer1) Query() string {
	return "select * from NetworkDevice"
}

// ModelTypeName returns the type name used for property collection.
// Port properties are collected for link matching between devices.
func (this *Layer1) ModelTypeName() string {
	return "Port"
}

// IdOf extracts the unique device ID from a NetworkDevice element.
func (this *Layer1) IdOf(elem interface{}) string {
	device := elem.(*types.NetworkDevice)
	return device.Id
}

// LocationOf extracts the location name from a NetworkDevice element.
func (this *Layer1) LocationOf(elem interface{}) string {
	device := elem.(*types.NetworkDevice)
	return device.Equipmentinfo.Location
}

// ConvertToTopologyNode converts a NetworkDevice into a topology node and location.
// It extracts device information, determines the node type, and creates location
// data with SVG coordinates calculated from geographic position.
func (this *Layer1) ConvertToTopologyNode(elem interface{}) (*l8topo.L8TopologyNode, *l8topo.L8TopologyLocation) {
	node := &l8topo.L8TopologyNode{}
	device := elem.(*types.NetworkDevice)
	node.Location = device.Equipmentinfo.Location
	node.NodeId = device.Id
	node.Name = device.Equipmentinfo.SysName
	node.Type = this.NodeType(device)
	location := createLocation(node.Location, float32(device.Equipmentinfo.Latitude), float32(device.Equipmentinfo.Longitude))
	return node, location
}

// NodeType maps a Probler DeviceType to the corresponding L8TopologyNodeType.
// Returns Generic for unrecognized device types.
func (this *Layer1) NodeType(elem interface{}) l8topo.L8TopologyNodeType {
	device := elem.(*types.NetworkDevice)
	switch device.Equipmentinfo.DeviceType {
	case types.DeviceType_DEVICE_TYPE_ROUTER:
		return l8topo.L8TopologyNodeType_ROUTER
	case types.DeviceType_DEVICE_TYPE_SWITCH:
		return l8topo.L8TopologyNodeType_SWITCH
	case types.DeviceType_DEVICE_TYPE_FIREWALL:
		return l8topo.L8TopologyNodeType_FIREWALL
	case types.DeviceType_DEVICE_TYPE_LOAD_BALANCER:
		return l8topo.L8TopologyNodeType_LOAD_BALANCER
	case types.DeviceType_DEVICE_TYPE_ACCESS_POINT:
		return l8topo.L8TopologyNodeType_ACCESS_POINT
	case types.DeviceType_DEVICE_TYPE_SERVER:
		return l8topo.L8TopologyNodeType_SERVER
	case types.DeviceType_DEVICE_TYPE_STORAGE:
		return l8topo.L8TopologyNodeType_STORAGE
	case types.DeviceType_DEVICE_TYPE_GATEWAY:
		return l8topo.L8TopologyNodeType_GATEWAY
	}
	return l8topo.L8TopologyNodeType_Generic
}

// createLocation builds an L8TopologyLocation with geographic and SVG coordinates.
// If latitude/longitude are not provided, it attempts to look up coordinates
// from the world cities database. SVG coordinates are calculated using
// Robinson projection for accurate map visualization.
func createLocation(nodeLocation string, latitude, longitude float32) *l8topo.L8TopologyLocation {
	location := &l8topo.L8TopologyLocation{}
	location.Location = nodeLocation
	location.Latitude = latitude
	location.Longitude = longitude

	if location.Latitude == 0 || location.Longitude == 0 {
		log, lat, ok := GetCityCoordinates(nodeLocation)
		if !ok {
			fmt.Println("Error getting log/lat for ", nodeLocation)
		} else {
			location.Latitude = float32(lat)
			location.Longitude = float32(log)
		}
	}

	// Calculate SVG coordinates using Robinson projection
	location.SvgX, location.SvgY = latLongToSVG(location.Latitude, location.Longitude)

	return location
}

// robinsonTable contains the Robinson projection lookup table.
// Each entry maps a latitude to its corresponding parallel length (plen)
// and proportional distance from equator (pdfe). Values between entries
// are linearly interpolated for smooth projection.
var robinsonTable = []struct {
	lat  float32  // Latitude in degrees (0-90)
	plen float32  // Parallel length factor (1.0 at equator)
	pdfe float32  // Proportional distance from equator (0.0-1.0)
}{
	{0, 1.0000, 0.0000},
	{5, 0.9986, 0.0620},
	{10, 0.9954, 0.1240},
	{15, 0.9900, 0.1860},
	{20, 0.9822, 0.2480},
	{25, 0.9730, 0.3100},
	{30, 0.9600, 0.3720},
	{35, 0.9427, 0.4340},
	{40, 0.9216, 0.4958},
	{45, 0.8962, 0.5571},
	{50, 0.8679, 0.6176},
	{55, 0.8350, 0.6769},
	{60, 0.7986, 0.7346},
	{65, 0.7597, 0.7903},
	{70, 0.7186, 0.8435},
	{75, 0.6732, 0.8936},
	{80, 0.6213, 0.9394},
	{85, 0.5722, 0.9761},
	{90, 0.5322, 1.0000},
}

// SVG calibration constants for Simplemaps 2000x857 Robinson projection map.
// These values are calibrated for the specific map image to ensure accurate
// geographic placement of topology nodes.
const (
	svgCenterX    = float32(986)  // X coordinate of longitude 0 (prime meridian)
	svgEquatorY   = float32(497)  // Y coordinate of equator
	svgEastScale  = float32(1020) // Pixels from centerX to 180°E at plen=1
	svgWestScale  = float32(1000) // Pixels from centerX to 180°W at plen=1
	svgNorthScale = float32(511)  // Pixels from equator to ~83°N
	svgSouthScale = float32(528)  // Pixels from equator to ~55°S
)

// latLongToSVG converts latitude/longitude coordinates to SVG pixel coordinates
// using the Robinson projection. This pseudo-cylindrical projection provides
// a visually balanced representation of the world map with minimal distortion.
func latLongToSVG(lat, lon float32) (float32, float32) {
	// Get absolute latitude for table lookup
	absLat := lat
	if absLat < 0 {
		absLat = -absLat
	}

	// Interpolate Robinson parameters from lookup table
	var plen, pdfe float32
	if absLat >= 90 {
		plen = 0.5322
		pdfe = 1.0000
	} else {
		idx := int(absLat / 5)
		t := (absLat - float32(idx)*5) / 5
		row1 := robinsonTable[idx]
		nextIdx := idx + 1
		if nextIdx > 18 {
			nextIdx = 18
		}
		row2 := robinsonTable[nextIdx]
		plen = row1.plen + t*(row2.plen-row1.plen)
		pdfe = row1.pdfe + t*(row2.pdfe-row1.pdfe)
	}

	// Calculate X coordinate based on longitude and parallel length
	var xScale float32
	if lon >= 0 {
		xScale = svgEastScale
	} else {
		xScale = svgWestScale
	}
	x := svgCenterX + (lon/180)*xScale*plen

	// Calculate Y coordinate based on latitude and distance from equator
	var scale float32
	var sign float32
	if lat >= 0 {
		scale = svgNorthScale
		sign = 1
	} else {
		scale = svgSouthScale
		sign = -1
	}
	y := svgEquatorY - sign*pdfe*scale

	return x, y
}

// IsConnected determines if two ports are connected and the direction of the link.
// This is a stub implementation that uses a deterministic hash to simulate
// connection discovery. In a production system, this would query actual
// network discovery data (LLDP, CDP, etc.) to determine real connections.
func (this *Layer1) IsConnected(aside, zside interface{}) (bool, l8topo.L8TopologyLinkDirection) {
	// Cast to Port type
	asidePort := aside.(*types.Port)
	zsidePort := zside.(*types.Port)

	// Create a hash based on port ID strings to arbitrarily determine the result
	// This ensures the same port pair always returns the same result
	hash := simpleHash(asidePort.Id + zsidePort.Id)

	// Use hash to determine if connected (about 75% of ports will be connected)
	if hash%4 == 0 {
		// Not connected
		return false, l8topo.L8TopologyLinkDirection_InvalidDirection
	}

	// If connected, arbitrarily choose a direction based on hash
	// Using modulo 3 to cycle through the 3 valid direction types
	direction := hash % 3
	switch direction {
	case 0:
		return true, l8topo.L8TopologyLinkDirection_AsideToZside
	case 1:
		return true, l8topo.L8TopologyLinkDirection_ZsideToAside
	case 2:
		return true, l8topo.L8TopologyLinkDirection_Bidirectional
	}

	// Fallback (should never reach here)
	return false, l8topo.L8TopologyLinkDirection_InvalidDirection
}

// simpleHash creates a simple deterministic hash from a string.
// Used for consistent pseudo-random decisions in the IsConnected stub.
func simpleHash(s string) int {
	hash := 0
	for i := 0; i < len(s); i++ {
		hash = 31*hash + int(s[i])
	}
	if hash < 0 {
		hash = -hash
	}
	return hash
}
