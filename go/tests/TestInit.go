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

// Package tests provides integration tests for the Layer 8 topology service.
// It creates a simulated network topology with multiple virtual nodes and
// network interfaces to test topology discovery, layout algorithms, and
// web service functionality.
package tests

import (
	"github.com/saichler/l8bus/go/overlay/protocol"
	. "github.com/saichler/l8test/go/infra/t_resources"
	. "github.com/saichler/l8test/go/infra/t_topology"
	. "github.com/saichler/l8types/go/ifs"
)

// topo holds the test topology instance used across all test functions.
var topo *TestTopology

// init configures the logger to trace level for detailed test output.
func init() {
	Log.SetLogLevel(Trace_Level)
}

// setup initializes the test environment by creating the virtual network topology.
func setup() {
	setupTopology()
}

// tear cleans up the test environment by shutting down the virtual network.
func tear() {
	shutdownTopology()
}

// reset cleans up after a test case by logging completion and resetting handlers.
func reset(name string) {
	Log.Info("*** ", name, " end ***")
	topo.ResetHandlers()
}

// setupTopology creates a test topology with 4 virtual nodes and 3 virtual networks.
// The networks are configured on ports 20000, 30000, and 40000.
// Message logging is enabled for debugging purposes.
func setupTopology() {
	protocol.MessageLog = true
	topo = NewTestTopology(4, []int{20000, 30000, 40000}, Info_Level)
}

// shutdownTopology gracefully terminates all virtual nodes and networks.
func shutdownTopology() {
	topo.Shutdown()
}
