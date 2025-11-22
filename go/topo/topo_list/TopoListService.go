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

const (
	ServiceName = "TopoList"
	ServiceArea = byte(0)
)

func Activate(vnic ifs.IVNic) {
	serviceConfig := ifs.NewServiceLevelAgreement(&base.BaseService{}, ServiceName, ServiceArea, true, nil)

	services := &l8services.L8Services{}
	services.ServiceToAreas = make(map[string]*l8services.L8ServiceAreas)
	services.ServiceToAreas[ServiceName] = &l8services.L8ServiceAreas{}
	services.ServiceToAreas[ServiceName].Areas = make(map[int32]bool)
	services.ServiceToAreas[ServiceName].Areas[int32(ServiceArea)] = true

	serviceConfig.SetServiceItem(&l8topo.L8TopologyMetadata{})
	serviceConfig.SetServiceItemList(&l8topo.L8TopologyMetadataList{})

	serviceConfig.SetVoter(true)
	serviceConfig.SetTransactional(false)
	serviceConfig.SetPrimaryKeys("ServiceName", "ServiceArea")
	serviceConfig.SetWebService(web.New(ServiceName, ServiceArea,
		nil, nil,
		nil, nil,
		nil, nil,
		nil, nil,
		&l8api.L8Query{}, &l8topo.L8TopologyMetadataList{}))
	base.Activate(serviceConfig, vnic)
}

func AddTopology(name, servicename string, area byte, vnic ifs.IVNic) {
	tm := &l8topo.L8TopologyMetadata{Name: name, ServiceName: servicename, ServiceArea: int32(area)}
	tmService, ok := vnic.Resources().Services().ServiceHandler(ServiceName, ServiceArea)
	if ok {
		tmService.Post(object.New(nil, tm), vnic)
	}
}
