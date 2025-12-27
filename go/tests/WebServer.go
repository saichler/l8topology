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
	"github.com/saichler/l8bus/go/overlay/health"
	"github.com/saichler/l8topology/go/types/l8topo"
	"github.com/saichler/l8types/go/ifs"
	"github.com/saichler/l8utils/go/utils/ipsegment"
	"github.com/saichler/l8web/go/web/server"
	"github.com/saichler/probler/go/prob/common"
)

// startWebServer initializes and starts a REST server for serving the topology web UI.
// It configures the server to listen on the specified port, registers necessary types
// and web service endpoints, and starts serving HTTP requests.
//
// Parameters:
//   - port: The TCP port number to listen on
//   - cert: The certificate name for TLS (if authentication is enabled)
//
// The server exposes endpoints for:
//   - Health service status
//   - Topology metadata queries
//   - Topology data retrieval with layout options
func startWebServer(port int, cert string) {
	// Configure the REST server
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

	// Get a virtual NIC from network 3 for the web server
	nic := topo.VnicByVnetNum(3, 1)

	// Register topology-related types for serialization
	nic.Resources().Registry().Register(&l8topo.L8Topology{})
	nic.Resources().Introspector().Decorators().AddPrimaryKeyDecorator(&l8topo.L8TopologyMetadata{}, "ServiceName", "ServiceArea")
	nic.Resources().Registry().Register(&l8topo.L8TopologyMetadataList{})
	nic.Resources().Registry().Register(&l8topo.L8TopologyMetadata{})
	nic.Resources().Registry().Register(&l8topo.L8TopologyQuery{})

	// Register the health service web endpoints
	hs, ok := nic.Resources().Services().ServiceHandler(health.ServiceName, 0)
	if ok {
		ws := hs.WebService()
		svr.RegisterWebService(ws, nic)
	}

	// Activate the web service handler
	sla := ifs.NewServiceLevelAgreement(&server.WebService{}, ifs.WebService, 0, false, nil)
	sla.SetArgs(svr)
	nic.Resources().Services().Activate(sla, nic)

	nic.Resources().Logger().Info("Web Server Started!")

	// Start serving requests (blocking call)
	svr.Start()
}
