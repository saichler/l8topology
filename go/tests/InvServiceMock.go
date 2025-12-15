package tests

import (
	"github.com/saichler/l8pollaris/go/pollaris/targets"
	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/probler/go/prob/common"
	"github.com/saichler/probler/go/types"
)

type InvServiceMock struct {
}

func ActivateInv(nic ifs.IVNic) {
	sn, sa := targets.Links.Cache(common.NetworkDevice_Links_ID)
	sla := ifs.NewServiceLevelAgreement(&InvServiceMock{}, sn, sa, true, nil)
	nic.Resources().Registry().Register(&types.NetworkDeviceList{})
	nic.Resources().Introspector().Decorators().AddPrimaryKeyDecorator(&types.NetworkDevice{}, "Id")
	nic.Resources().Services().Activate(sla, nic)
}

func NewInvServiceMock() *InvServiceMock {
	return &InvServiceMock{}
}

func (i *InvServiceMock) Activate(sla *ifs.ServiceLevelAgreement, vnic ifs.IVNic) error {
	return nil
}

func (i *InvServiceMock) DeActivate() error {
	return nil
}

func (i *InvServiceMock) Post(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return object.New(nil, nil)
}

func (i *InvServiceMock) Put(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return object.New(nil, nil)
}

func (i *InvServiceMock) Patch(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return object.New(nil, nil)
}

func (i *InvServiceMock) Delete(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return object.New(nil, nil)
}

func (i *InvServiceMock) Get(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return object.New(nil, Nodes())
}

func (i *InvServiceMock) Failed(elements ifs.IElements, vnic ifs.IVNic, msg *ifs.Message) ifs.IElements {
	return object.New(nil, nil)
}

func (i *InvServiceMock) TransactionConfig() ifs.ITransactionConfig {
	return nil
}

func (i *InvServiceMock) WebService() ifs.IWebService {
	return nil
}
