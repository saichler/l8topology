package topo_service

import (
	"errors"
	"sync"
	"time"

	"github.com/saichler/l8reflect/go/reflect/introspecting"
	"github.com/saichler/l8reflect/go/reflect/properties"
	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8topology/go/types/l8topo"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8types/go/types/l8web"
	"github.com/saichler/l8utils/go/utils/cache"
	"github.com/saichler/l8utils/go/utils/web"
)

type TopoService struct {
	serviceName string
	serviceArea byte
	name        string
	nodes       *cache.Cache
	links       *cache.Cache
	mtx         *sync.RWMutex
	discovery   ITopoDiscovery
}

type ITopoDiscovery interface {
	ServiceName() string
	ServiceArea() byte
	Query() string
	ModelTypeName() string
	IsConnected(aside, zside interface{}) (bool, l8topo.L8TopologyLinkDirection)
	ConvertToTopologyNode(elem interface{}) *l8topo.L8TopologyNode
	IdOf(elem interface{}) string
}

func (this *TopoService) Activate(sla *ifs.ServiceLevelAgreement, vnic ifs.IVNic) error {
	this.serviceName = sla.ServiceName()
	this.serviceArea = sla.ServiceArea()
	this.name = this.serviceName
	this.mtx = &sync.RWMutex{}
	this.discovery = sla.Args()[0].(ITopoDiscovery)

	node, _ := vnic.Resources().Introspector().Inspect(&l8topo.L8TopologyNode{})
	introspecting.AddPrimaryKeyDecorator(node, "NodeId")

	node, _ = vnic.Resources().Introspector().Inspect(&l8topo.L8TopologyLink{})
	introspecting.AddPrimaryKeyDecorator(node, "LinkId")

	this.nodes = cache.NewCache(&l8topo.L8TopologyNode{}, nil, nil, vnic.Resources())
	this.links = cache.NewCache(&l8topo.L8TopologyLink{}, nil, nil, vnic.Resources())

	go func() {
		time.Sleep(time.Second * 2)
		this.DiscoverNodes(vnic)
	}()

	return nil
}

func (this *TopoService) DeActivate() error {
	return nil
}

func (this *TopoService) do(action ifs.Action, elements ifs.IElements) error {
	this.mtx.Lock()
	defer this.mtx.Unlock()
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

func (this *TopoService) Get(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	this.mtx.Lock()
	defer this.mtx.Unlock()

	topology := &l8topo.L8Topology{Name: this.name}
	allNodes := this.nodes.Collect(func(i interface{}) (bool, interface{}) {
		return true, i
	})
	topology.Nodes = make(map[string]*l8topo.L8TopologyNode)
	for _, n := range allNodes {
		node := n.(*l8topo.L8TopologyNode)
		topology.Nodes[node.NodeId] = node
	}

	allLinks := this.links.Collect(func(i interface{}) (bool, interface{}) {
		return true, i
	})
	topology.Links = make(map[string]*l8topo.L8TopologyLink)
	for _, l := range allLinks {
		link := l.(*l8topo.L8TopologyLink)
		for _, agg := range link.Aggregated {
			ap, err := properties.PropertyOf(agg.Aside, vnic.Resources())
			if err != nil {
				panic(err)
			}
			zp, err := properties.PropertyOf(agg.Zside, vnic.Resources())
			if err != nil {
				panic(err)
			}
			agg.Aside = ap.PropertyDisplayId()
			agg.Zside = zp.PropertyDisplayId()
		}
		topology.Links[link.LinkId] = link
	}
	return object.New(nil, topology)
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
		&l8web.L8Empty{}, &l8topo.L8Topology{})
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
