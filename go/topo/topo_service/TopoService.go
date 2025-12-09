package topo_service

import (
	"errors"
	"time"

	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8topology/go/types/l8topo"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8utils/go/utils/cache"
	"github.com/saichler/l8utils/go/utils/web"
)

type TopoService struct {
	serviceName string
	serviceArea byte
	name        string
	nodes       *cache.Cache
	links       *cache.Cache
	locations   *cache.Cache
	discovery   ITopoDiscovery
}

type ITopoDiscovery interface {
	ServiceName() string
	ServiceArea() byte
	Query() string
	ModelTypeName() string
	IsConnected(aside, zside interface{}) (bool, l8topo.L8TopologyLinkDirection)
	ConvertToTopologyNode(elem interface{}) (*l8topo.L8TopologyNode, *l8topo.L8TopologyLocation)
	IdOf(elem interface{}) string
	LocationOf(elem interface{}) string
	NodeType(elem interface{}) l8topo.L8TopologyNodeType
}

func (this *TopoService) Activate(sla *ifs.ServiceLevelAgreement, vnic ifs.IVNic) error {
	this.serviceName = sla.ServiceName()
	this.serviceArea = sla.ServiceArea()
	this.name = this.serviceName
	this.discovery = sla.Args()[0].(ITopoDiscovery)

	vnic.Resources().Introspector().Decorators().AddPrimaryKeyDecorator(&l8topo.L8TopologyNode{}, "NodeId")
	vnic.Resources().Introspector().Decorators().AddPrimaryKeyDecorator(&l8topo.L8TopologyLink{}, "LinkId")
	vnic.Resources().Introspector().Decorators().AddPrimaryKeyDecorator(&l8topo.L8TopologyLocation{}, "Location")

	vnic.Resources().Registry().Register(&l8topo.L8TopologyQuery{})

	this.nodes = cache.NewCache(&l8topo.L8TopologyNode{}, nil, nil, vnic.Resources())
	this.links = cache.NewCache(&l8topo.L8TopologyLink{}, nil, nil, vnic.Resources())
	this.locations = cache.NewCache(&l8topo.L8TopologyLocation{}, nil, nil, vnic.Resources())

	go func() {
		time.Sleep(time.Second * 5)
		this.DiscoverNodes(vnic)
	}()

	return nil
}

func (this *TopoService) DeActivate() error {
	return nil
}

func (this *TopoService) do(action ifs.Action, elements ifs.IElements) error {
	for _, elem := range elements.Elements() {
		node, ok := elem.(*l8topo.L8TopologyNode)
		if ok {
			err := this.doNodes(action, node)
			if err != nil {
				return err
			}
			continue
		}
		link, ok := elem.(*l8topo.L8TopologyLink)
		if ok {
			err := this.doLinks(action, link)
			if err != nil {
				return err
			}
		}
		location, ok := elem.(*l8topo.L8TopologyLocation)
		if ok {
			err := this.doLocations(action, location)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (this *TopoService) doNodes(action ifs.Action, node *l8topo.L8TopologyNode) error {
	var err error
	switch action {
	case ifs.POST:
		_, err = this.nodes.Post(node, false)
	case ifs.PUT:
		_, err = this.nodes.Put(node, false)
	case ifs.DELETE:
		_, err = this.nodes.Delete(node, false)
	case ifs.PATCH:
		_, err = this.nodes.Patch(node, false)
	default:
		return errors.New("unknown action for topology nodes")
	}
	return err
}

func (this *TopoService) doLinks(action ifs.Action, link *l8topo.L8TopologyLink) error {
	var err error
	switch action {
	case ifs.POST:
		_, err = this.links.Post(link, false)
	case ifs.PUT:
		_, err = this.links.Put(link, false)
	case ifs.DELETE:
		_, err = this.links.Delete(link, false)
	case ifs.PATCH:
		_, err = this.links.Patch(link, false)
	default:
		return errors.New("unknown action for topology links")
	}
	return err
}

func (this *TopoService) doLocations(action ifs.Action, location *l8topo.L8TopologyLocation) error {
	var err error
	switch action {
	case ifs.POST:
		_, err = this.locations.Post(location, false)
	case ifs.PUT:
		_, err = this.locations.Put(location, false)
	case ifs.DELETE:
		_, err = this.locations.Delete(location, false)
	case ifs.PATCH:
		_, err = this.locations.Patch(location, false)
	default:
		return errors.New("unknown action for topology location")
	}
	return err
}

func (this *TopoService) Post(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	err := this.do(ifs.POST, elements)
	if err != nil {
		return object.NewError(err.Error())
	}
	return nil
}

func (this *TopoService) Put(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	err := this.do(ifs.PUT, elements)
	if err != nil {
		return object.NewError(err.Error())
	}
	return nil
}

func (this *TopoService) Patch(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	err := this.do(ifs.PATCH, elements)
	if err != nil {
		return object.NewError(err.Error())
	}
	return nil
}

func (this *TopoService) Delete(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	err := this.do(ifs.DELETE, elements)
	if err != nil {
		return object.NewError(err.Error())
	}
	return nil
}

func (this *TopoService) Failed(elements ifs.IElements, vnic ifs.IVNic, msg *ifs.Message) ifs.IElements {
	return nil
}

func (this *TopoService) TransactionConfig() ifs.ITransactionConfig {
	return nil
}

func (this *TopoService) WebService() ifs.IWebService {
	return web.New(this.serviceName, this.serviceArea,
		nil, nil,
		nil, nil,
		nil, nil,
		nil, nil,
		&l8topo.L8TopologyQuery{}, &l8topo.L8Topology{})
}

/*
func (this *TopoService) Merge(results map[string]ifs.IElements) ifs.IElements {
	fmt.Println("Merge Log files called with ", len(results))
	result := &l8logf.L8File{}
	result.Files = make([]*l8logf.L8File, 0)
	for _, elems := range results {
		for _, elem := range elems.Elements() {
			l := elem.(*l8logf.L8File)
			if l.Files != nil {
				for _, file := range l.Files {
					result.Files = append(result.Files, file)
				}
			}
			if l.Data != nil && l.Data.Content != "" {
				result.Data = l.Data
			}
		}
	}
	return object.New(nil, result)
}*/
