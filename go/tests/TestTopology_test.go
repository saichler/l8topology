package tests

import (
	"os"
	"os/exec"
	"testing"
	"time"

	"github.com/saichler/l8topology/go/topo/discover"
	"github.com/saichler/l8topology/go/topo/topo_list"
)

func TestMain(m *testing.M) {
	setup()
	m.Run()
	tear()
}

func TestLayer1(t *testing.T) {
	exec.Command("rm", "-rf", "./web").Run()
	time.Sleep(time.Second * 1)
	os.CopyFS("./web", os.DirFS("../topo/webui/web"))
	defer exec.Command("rm", "-rf", "./web").Run()
	nic1 := topo.VnicByVnetNum(1, 1)
	nic2 := topo.VnicByVnetNum(2, 1)
	ActivateInv(nic1)
	topo_list.Activate(nic2)
	discover.ActivateLayer1(nic2)
	startWebServer(9092, "test")
}
