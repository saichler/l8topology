/*
 * © 2025 Sharon Aicler (saichler@gmail.com)
 *
 * Layer 8 Ecosystem is licensed under the Apache License, Version 2.0.
 * You may obtain a copy of the License at:
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package tests

import (
	"github.com/saichler/l8pollaris/go/pollaris/targets"
	"github.com/saichler/l8srlz/go/serialize/object"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/probler/go/prob/common"
	"github.com/saichler/probler/go/types"
)

// InvServiceMock is a mock implementation of the inventory service interface.
// It provides predefined network device data for testing the topology discovery
// without requiring a real inventory backend.
type InvServiceMock struct {
}

// ActivateInv registers and activates the mock inventory service.
// It configures type registrations and decorators for NetworkDevice handling.
func ActivateInv(nic ifs.IVNic) {
	sn, sa := targets.Links.Cache(common.NetworkDevice_Links_ID)
	sla := ifs.NewServiceLevelAgreement(&InvServiceMock{}, sn, sa, true, nil)
	nic.Resources().Registry().Register(&types.NetworkDeviceList{})
	nic.Resources().Introspector().Decorators().AddPrimaryKeyDecorator(&types.NetworkDevice{}, "Id")
	nic.Resources().Services().Activate(sla, nic)
}

// NewInvServiceMock creates a new instance of the mock inventory service.
func NewInvServiceMock() *InvServiceMock {
	return &InvServiceMock{}
}

// Activate initializes the mock service. No initialization required for the mock.
func (i *InvServiceMock) Activate(sla *ifs.ServiceLevelAgreement, vnic ifs.IVNic) error {
	return nil
}

// DeActivate cleans up the mock service. No cleanup required for the mock.
func (i *InvServiceMock) DeActivate() error {
	return nil
}

// Post handles create requests. Returns empty response for the mock.
func (i *InvServiceMock) Post(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return object.New(nil, nil)
}

// Put handles update requests. Returns empty response for the mock.
func (i *InvServiceMock) Put(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return object.New(nil, nil)
}

// Patch handles partial update requests. Returns empty response for the mock.
func (i *InvServiceMock) Patch(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return object.New(nil, nil)
}

// Delete handles delete requests. Returns empty response for the mock.
func (i *InvServiceMock) Delete(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return object.New(nil, nil)
}

// Get handles read requests and returns the predefined mock network device list.
// This provides test data for topology discovery.
func (i *InvServiceMock) Get(elements ifs.IElements, vnic ifs.IVNic) ifs.IElements {
	return object.New(nil, Nodes())
}

// Failed handles failed operation callbacks. Returns empty response for the mock.
func (i *InvServiceMock) Failed(elements ifs.IElements, vnic ifs.IVNic, msg *ifs.Message) ifs.IElements {
	return object.New(nil, nil)
}

// TransactionConfig returns nil as the mock does not use transactions.
func (i *InvServiceMock) TransactionConfig() ifs.ITransactionConfig {
	return nil
}

// WebService returns nil as the mock does not expose web endpoints.
func (i *InvServiceMock) WebService() ifs.IWebService {
	return nil
}
