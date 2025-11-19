package discover

import (
	"fmt"

	"github.com/saichler/l8reflect/go/reflect/introspecting"
	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8topology/go/topo/service"
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

func (this *Layer1) Discover(elements ifs.IElements, topo *service.TopoService, vnic ifs.IVNic) {
	fmt.Println("Discovering nodes")
	deviceList := elements.Element().(*types.NetworkDeviceList)
	topo.Post(object.New(nil, deviceList.List), vnic)
	this.discoverLinks(deviceList.List, topo, vnic)
}

func (this *Layer1) discoverLinks(deviceList []*types.NetworkDevice, topo *service.TopoService, vnic ifs.IVNic) {
	fmt.Println("Discovering links")
	discoverLayer1Links(deviceList, vnic, topo)
}

func (this *Layer1) Query() string {
	return "select * from NetworkDevice"
}
