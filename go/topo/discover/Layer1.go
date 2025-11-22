package discover

import (
	"github.com/saichler/l8reflect/go/reflect/introspecting"
	"github.com/saichler/l8topology/go/topo/topo_list"
	"github.com/saichler/l8topology/go/topo/topo_service"
	"github.com/saichler/l8topology/go/types/l8topo"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/probler/go/prob/common"
	"github.com/saichler/probler/go/types"
)

type Layer1 struct {
}

const (
	Layer1Name        = "Network Layer 1"
	Layer1ServiceName = "L1"
	Layer1ServiceArea = byte(1)
)

func ActivateLayer1(nic ifs.IVNic) {
	topo_list.AddTopology(Layer1Name, Layer1ServiceName, Layer1ServiceArea, nic)
	sla := ifs.NewServiceLevelAgreement(&topo_service.TopoService{}, Layer1ServiceName, Layer1ServiceArea, true, nil)
	sla.SetArgs(&Layer1{})
	nic.Resources().Registry().Register(&types.NetworkDeviceList{})
	node, _ := nic.Resources().Introspector().Inspect(&types.NetworkDevice{})
	introspecting.AddPrimaryKeyDecorator(node, "Id")
	nic.Resources().Services().Activate(sla, nic)
}

func (this *Layer1) ServiceName() string {
	return common.INVENTORY_SERVICE_BOX
}

func (this *Layer1) ServiceArea() byte {
	return common.INVENTORY_AREA_BOX
}

func (this *Layer1) Query() string {
	return "select * from NetworkDevice"
}

func (this *Layer1) ModelTypeName() string {
	return "Port"
}

func (this *Layer1) IdOf(elem interface{}) string {
	device := elem.(*types.NetworkDevice)
	return device.Id
}

func (this *Layer1) ConvertToTopologyNode(elem interface{}) *l8topo.L8TopologyNode {
	node := &l8topo.L8TopologyNode{}
	device := elem.(*types.NetworkDevice)
	node.NodeId = device.Id
	node.GlobalL8Id = device.Id
	node.Latitude = float32(device.Equipmentinfo.Latitude)
	node.Longitude = float32(device.Equipmentinfo.Longitude)
	node.Location = device.Equipmentinfo.Location
	return node
}

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

// simpleHash creates a simple hash from a string
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
