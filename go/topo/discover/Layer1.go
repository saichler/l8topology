package discover

import (
	"github.com/saichler/l8reflect/go/reflect/introspecting"
	"github.com/saichler/l8topology/go/topo/service"
	"github.com/saichler/l8topology/go/types/l8topo"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/probler/go/prob/common"
	"github.com/saichler/probler/go/types"
)

type Layer1 struct {
}

func ActivateLayer1(nic ifs.IVNic) {
	sla := ifs.NewServiceLevelAgreement(&service.TopoService{}, "L1", 1, true, nil)
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

func (this *Layer1) IsConnected(aside, zside interface{}) (bool, bool) {
	return true, true
}
