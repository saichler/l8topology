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
	"os"
	"os/exec"
	"testing"
	"time"

	"github.com/saichler/l8topology/go/topo/discover"
	"github.com/saichler/l8topology/go/topo/topo_list"
)

// TestMain is the test entry point that sets up and tears down the test environment.
// It initializes the virtual network topology before running tests and cleans up afterward.
func TestMain(m *testing.M) {
	setup()
	m.Run()
	tear()
}

// TestLayer1 tests the complete Layer 1 topology discovery and visualization workflow.
// It sets up:
//   - A mock inventory service to provide network device data
//   - The topology list service for topology registration
//   - The Layer 1 discovery service to convert devices to topology
//   - A web server to serve the topology visualization UI
//
// The test copies the web UI assets, activates all services, and starts a web server
// on port 9092 for manual verification of the topology visualization.
func TestLayer1(t *testing.T) {
	// Clean up any existing web directory and copy fresh UI assets
	exec.Command("rm", "-rf", "./web").Run()
	time.Sleep(time.Second * 1)
	os.CopyFS("./web", os.DirFS("../topo/webui/web"))
	defer exec.Command("rm", "-rf", "./web").Run()

	// Get virtual NICs from different virtual networks
	nic1 := topo.VnicByVnetNum(1, 1)
	nic2 := topo.VnicByVnetNum(2, 1)

	// Activate services: inventory mock on network 1, topology services on network 2
	ActivateInv(nic1)
	topo_list.Activate(nic2)
	discover.ActivateLayer1(nic2)

	// Start web server for topology visualization
	startWebServer(9092, "test")
}
