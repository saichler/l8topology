package tests

import (
	"testing"
	"time"

	"github.com/saichler/l8topology/go/topo/discover"
)

func TestMain(m *testing.M) {
	setup()
	m.Run()
	tear()
}

func TestLayer1(t *testing.T) {
	nic1 := topo.VnicByVnetNum(1, 1)
	nic2 := topo.VnicByVnetNum(2, 1)
	ActivateInv(nic1)
	discover.ActivateLayer1(nic2)
	time.Sleep(time.Second * 6)
}
