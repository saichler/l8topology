package discover

import (
	"bytes"
	"fmt"

	"github.com/saichler/l8reflect/go/reflect/properties"
	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8topology/go/topo/service"
	"github.com/saichler/l8topology/go/types/l8topo"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/probler/go/types"
)

func discoverLayer1Links(devices []*types.NetworkDevice, vnic ifs.IVNic, topo *service.TopoService) {
	portMap := make(map[string]map[string]*types.Port)
	for _, device := range devices {
		ports := properties.Collect(device, vnic.Resources(), "Port")
		portMap[device.Id] = make(map[string]*types.Port)
		for k, p := range ports {
			portMap[device.Id][k] = p.(*types.Port)
		}
	}

	links := matchLinks(portMap)
	fmt.Println("number of links:", len(links))
	topo.Post(object.New(nil, links), vnic)
}

func createLink(aSideNodeId, zSideNodeId, asidePropertyId, zsidePropertyId string, biDirection bool) *l8topo.L8TopologyLink {
	link := &l8topo.L8TopologyLink{}
	link.AsideNodeId = aSideNodeId
	link.ZsideNodeId = zSideNodeId
	link.AsidePropertyId = asidePropertyId
	link.ZsidePropertyId = zsidePropertyId
	link.LinkId = createLinkId(asidePropertyId, zsidePropertyId, biDirection)
	link.BiDirection = biDirection
	return link
}

func createLinkId(aSidePropertyId, zSidePropertyId string, biDirectional bool) string {
	buff := bytes.Buffer{}
	buff.WriteString(aSidePropertyId)
	if biDirectional {
		buff.WriteString("<->")
	} else {
		buff.WriteString("->")
	}
	buff.WriteString(zSidePropertyId)
	return buff.String()
}

func matchLinks(portMap map[string]map[string]*types.Port) []*l8topo.L8TopologyLink {
	links := make([]*l8topo.L8TopologyLink, 0)
	alreadyConnected := make(map[string]bool)

	// Flatten the nested map into a list of port entries for more efficient iteration
	type portEntry struct {
		deviceId string
		portId   string
		port     *types.Port
	}

	portList := make([]*portEntry, 0)
	for deviceId, ports := range portMap {
		for portId, port := range ports {
			portList = append(portList, &portEntry{
				deviceId: deviceId,
				portId:   portId,
				port:     port,
			})
		}
	}

	// Iterate through port pairs more efficiently
	// Only check each pair once (i,j where j > i) instead of both (i,j) and (j,i)
	for i := 0; i < len(portList); i++ {
		aSideEntry := portList[i]

		// Skip if this port is already connected - check once at outer loop
		if alreadyConnected[aSideEntry.portId] {
			continue
		}

		// Only check ports that come after this one to avoid duplicate comparisons
		for j := i + 1; j < len(portList); j++ {
			zSideEntry := portList[j]

			// Skip ports from the same device
			if aSideEntry.deviceId == zSideEntry.deviceId {
				continue
			}

			// Skip if Z-side port is already connected
			if alreadyConnected[zSideEntry.portId] {
				continue
			}

			connected, biDirectional := isConnected(aSideEntry.port, zSideEntry.port)
			if connected {
				alreadyConnected[aSideEntry.portId] = true
				alreadyConnected[zSideEntry.portId] = true
				newLink := createLink(aSideEntry.deviceId, zSideEntry.deviceId,
					aSideEntry.portId, zSideEntry.portId, biDirectional)
				links = append(links, newLink)
				break // A-side port is now matched, move to next A-side port
			}
		}
	}

	return links
}

func isConnected(port1, port2 *types.Port) (bool, bool) {
	return true, true
}
