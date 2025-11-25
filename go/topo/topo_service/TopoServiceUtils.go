package topo_service

import (
	"bytes"
	"fmt"
	"reflect"
	"strings"

	"github.com/saichler/l8reflect/go/reflect/properties"
	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8topology/go/types/l8topo"
	"github.com/saichler/l8types/go/ifs"
)

func (this *TopoService) DiscoverNodes(vnic ifs.IVNic) {
	fmt.Println("DiscoverNodes")
	query := this.discovery.Query() + " limit 500 page 0"
	resp := vnic.LeaderRequest(this.discovery.ServiceName(), this.discovery.ServiceArea(),
		ifs.GET, query, 30)
	fmt.Println("Received Response")
	if resp == nil {
		fmt.Println("received nil response")
	} else if resp.Error() != nil {
		fmt.Println("Received error response ", resp.Error().Error())
	}

	this.discoverNodes(resp, vnic)
}

func (this *TopoService) discoverNodes(elements ifs.IElements, vnic ifs.IVNic) {
	nodes := []interface{}{}
	topoNodes := []*l8topo.L8TopologyNode{}
	topoLocations := map[string]*l8topo.L8TopologyLocation{}

	if len(elements.Elements()) > 1 {
		fmt.Println("Element list size=", len(elements.Elements()))
		for _, elem := range elements.Elements() {
			nodes = append(nodes, elem)
			topoNode, topoLocation := this.discovery.ConvertToTopologyNode(elem)
			topoNodes = append(topoNodes, topoNode)
			topoLocations[topoLocation.Location] = topoLocation
		}
	} else {
		v := reflect.ValueOf(elements.Element())
		if v.Kind() == reflect.Ptr {
			v = v.Elem()
		}
		if !v.IsValid() {
			return
		}
		fldList := v.FieldByName("List")
		if !fldList.IsValid() {
			vnic.Resources().Logger().Error("[DiscoverNodes] Nodes List Element does not contain the List attribute:", v.Type().Name())
			return
		}

		for i := 0; i < fldList.Len(); i++ {
			item := fldList.Index(i)
			nodes = append(nodes, item.Interface())
			topoNode, topoLocation := this.discovery.ConvertToTopologyNode(item.Interface())
			topoNodes = append(topoNodes, topoNode)
			topoLocations[topoLocation.Location] = topoLocation
		}
	}

	this.Post(object.New(nil, topoNodes), vnic)
	this.Post(object.New(nil, topoLocations), vnic)
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

func createLink(aside, zside string, direction l8topo.L8TopologyLinkDirection) *l8topo.L8TopologyLink {
	link := &l8topo.L8TopologyLink{}
	link.LinkId = createLinkId(aside, zside, direction)
	link.Aside = aside
	link.Zside = zside
	link.Direction = direction
	link.Status = l8topo.L8TopologyLinkStatus_Up
	return link
}

func rootIdOf(side string) string {
	index1 := strings.Index(side, "<")
	index2 := strings.Index(side, ">")
	rootID := side[index1+1 : index2]
	index3 := strings.LastIndex(rootID, "}")
	return rootID[index3+1:]
}

func createLinkId(aSidePropertyId, zSidePropertyId string, direction l8topo.L8TopologyLinkDirection) string {
	buff := bytes.Buffer{}
	buff.WriteString(aSidePropertyId)
	switch direction {
	case l8topo.L8TopologyLinkDirection_AsideToZside:
		buff.WriteString("->")
	case l8topo.L8TopologyLinkDirection_ZsideToAside:
		buff.WriteString("<-")
	case l8topo.L8TopologyLinkDirection_Bidirectional:
		buff.WriteString("<->")
	default:
		buff.WriteString("-")
	}
	buff.WriteString(zSidePropertyId)
	return buff.String()
}

func (this *TopoService) matchLinks(maps map[string]map[string]interface{}) []*l8topo.L8TopologyLink {
	links := make([]*l8topo.L8TopologyLink, 0)
	alreadyConnected := make(map[string]bool)

	// Flatten the nested map into a topo_list of port entries for more efficient iteration
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

			var aside, zside *elemEntry
			if strings.Compare(aSideEntry.nodeId, zSideEntry.nodeId) < 0 {
				aside = aSideEntry
				zside = zSideEntry
			} else {
				aside = zSideEntry
				zside = aSideEntry
			}

			connected, direction := this.discovery.IsConnected(aside.elem, zside.elem)
			if connected {
				alreadyConnected[aside.elemId] = true
				alreadyConnected[zside.elemId] = true
				link := createLink(aside.elemId, zside.elemId, direction)
				links = append(links, link)
				break // A-side port is now matched, move to next A-side port
			}
		}
	}

	return links
}

func (this *TopoService) locationOf(nodeid string) string {
	filter := &l8topo.L8TopologyNode{NodeId: nodeid}
	tpnode, err := this.nodes.Get(filter)
	if err != nil {
		panic(err)
	}
	return tpnode.(*l8topo.L8TopologyNode).Location
}
