package tests

import (
	"github.com/saichler/l8bus/go/overlay/health"
	"github.com/saichler/l8reflect/go/reflect/helping"
	"github.com/saichler/l8topology/go/types/l8topo"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8utils/go/utils/ipsegment"
	"github.com/saichler/l8web/go/web/server"
	"github.com/saichler/probler/go/prob/common"
)

func startWebServer(port int, cert string) {
	serverConfig := &server.RestServerConfig{
		Host:           ipsegment.MachineIP,
		Port:           port,
		Authentication: false,
		CertName:       cert,
		Prefix:         common.PREFIX,
	}
	svr, err := server.NewRestServer(serverConfig)
	if err != nil {
		panic(err)
	}

	nic := topo.VnicByVnetNum(3, 1)
	nic.Resources().Registry().Register(&l8topo.L8Topology{})
	node, _ := nic.Resources().Introspector().Inspect(&l8topo.L8TopologyMetadata{})
	helping.AddPrimaryKeyDecorator(node, "ServiceName", "ServiceArea")
	nic.Resources().Registry().Register(&l8topo.L8TopologyMetadataList{})
	nic.Resources().Registry().Register(&l8topo.L8TopologyMetadata{})
	nic.Resources().Registry().Register(&l8topo.L8TopologyQuery{})

	hs, ok := nic.Resources().Services().ServiceHandler(health.ServiceName, 0)
	if ok {
		ws := hs.WebService()
		svr.RegisterWebService(ws, nic)
	}

	//Activate the webpoints topo_service
	sla := ifs.NewServiceLevelAgreement(&server.WebService{}, ifs.WebService, 0, false, nil)
	sla.SetArgs(svr)
	nic.Resources().Services().Activate(sla, nic)

	nic.Resources().Logger().Info("Web Server Started!")

	svr.Start()
}
