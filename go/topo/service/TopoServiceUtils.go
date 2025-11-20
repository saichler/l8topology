package service

import (
	"bytes"
	"fmt"
	"reflect"

	"github.com/saichler/l8reflect/go/reflect/properties"
	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8topology/go/types/l8topo"
	"github.com/saichler/l8types/go/ifs"
)

func (this *TopoService) DiscoverNodes(vnic ifs.IVNic) {
	resp := vnic.LeaderRequest(this.discovery.ServiceName(), this.discovery.ServiceArea(),
		ifs.GET, this.discovery.Query(), 30)
	this.discoverNodes(resp, vnic)
}

func (this *TopoService) discoverNodes(elements ifs.IElements, vnic ifs.IVNic) {
	v := reflect.ValueOf(elements.Element())
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	nodes := []interface{}{}
	topoNodes := []*l8topo.L8TopologyNode{}
	fldList := v.FieldByName("List")
	if !fldList.IsValid() {
		vnic.Resources().Logger().Error("[DiscoverNodes] Nodes List Element does not contain the List attribute")
		return
	}

	for i := 0; i < fldList.Len(); i++ {
		item := fldList.Index(i)
		nodes = append(nodes, item.Interface())
		topoNodes = append(topoNodes, this.discovery.ConvertToTopologyNode(item.Interface()))
	}

	this.Post(object.New(nil, topoNodes), vnic)
	this.discoverLinks(nodes, vnic)
}

func (this *TopoService) discoverLinks(nodes []interface{}, vnic ifs.IVNic) {
	maps := make(map[string]map[string]interface{})
	for _, node := range nodes {
		nodeElems := properties.Collect(node, vnic.Resources(), this.discovery.ModelTypeName())
		idof := this.discovery.IdOf(node)
		maps[idof] = make(map[string]interface{})
		for k, p := range nodeElems {
			maps[idof][k] = p
		}
	}

	links := this.matchLinks(maps)
	fmt.Println("number of links:", len(links))
	this.Post(object.New(nil, links), vnic)
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

func (this *TopoService) matchLinks(maps map[string]map[string]interface{}) []*l8topo.L8TopologyLink {
	links := make([]*l8topo.L8TopologyLink, 0)
	alreadyConnected := make(map[string]bool)

	// Flatten the nested map into a list of port entries for more efficient iteration
	type elemEntry struct {
		nodeId string
		elemId string
		elem   interface{}
	}

	list := make([]*elemEntry, 0)
	for nodeId, elems := range maps {
		for elemId, elem := range elems {
			list = append(list, &elemEntry{
				nodeId: nodeId,
				elemId: elemId,
				elem:   elem,
			})
		}
	}

	// Iterate through port pairs more efficiently
	// Only check each pair once (i,j where j > i) instead of both (i,j) and (j,i)
	for i := 0; i < len(list); i++ {
		aSideEntry := list[i]

		// Skip if this port is already connected - check once at outer loop
		if alreadyConnected[aSideEntry.elemId] {
			continue
		}

		// Only check ports that come after this one to avoid duplicate comparisons
		for j := i + 1; j < len(list); j++ {
			zSideEntry := list[j]

			// Skip ports from the same device
			if aSideEntry.nodeId == zSideEntry.nodeId {
				continue
			}

			// Skip if Z-side port is already connected
			if alreadyConnected[zSideEntry.elemId] {
				continue
			}

			connected, biDirectional := this.discovery.IsConnected(aSideEntry.elem, zSideEntry.elem)
			if connected {
				alreadyConnected[aSideEntry.elemId] = true
				alreadyConnected[zSideEntry.elemId] = true
				newLink := createLink(aSideEntry.nodeId, zSideEntry.nodeId,
					aSideEntry.nodeId, zSideEntry.nodeId, biDirectional)
				links = append(links, newLink)
				break // A-side port is now matched, move to next A-side port
			}
		}
	}

	return links
}
