package tests

import (
	"fmt"

	"github.com/saichler/probler/go/types"
)

func Nodes() *types.NetworkDeviceList {
	devices := make([]*types.NetworkDevice, 0)

	// Create diverse network devices
	devices = append(devices, createRouter("R1", "192.168.1.1", 1))
	devices = append(devices, createRouter("R2", "192.168.1.2", 2))
	devices = append(devices, createSwitch("SW1", "192.168.2.1", 3))
	devices = append(devices, createSwitch("SW2", "192.168.2.2", 4))
	devices = append(devices, createFirewall("FW1", "192.168.3.1", 5))

	deviceList := &types.NetworkDeviceList{List: devices}

	return deviceList
}

// createPorts generates a list of ports with interfaces
func createPorts(count int, ipAddress string, interfacePrefix string) []*types.Port {
	ports := make([]*types.Port, count)
	for i := 0; i < count; i++ {
		ports[i] = &types.Port{
			Id: fmt.Sprintf("port-%d", i+1),
			Interfaces: []*types.Interface{
				createInterface(fmt.Sprintf("%s%d", interfacePrefix, i), ipAddress, i+1),
			},
		}
	}
	return ports
}

// createRouter creates a router network device with varied physical and logical inventory
func createRouter(name, ipAddress string, deviceId uint32) *types.NetworkDevice {
	return &types.NetworkDevice{
		Id: name,
		Equipmentinfo: &types.EquipmentInfo{
			Vendor:          "Cisco",
			Series:          "ASR",
			Family:          "ASR 9000",
			Software:        "IOS-XR",
			Hardware:        "ASR-9010",
			Version:         "7.3.2",
			SysName:         name,
			SysOid:          "1.3.6.1.4.1.9.1.1234",
			Model:           "ASR-9010-AC",
			SerialNumber:    fmt.Sprintf("SN-%s-%d", name, deviceId),
			FirmwareVersion: "7.3.2",
			IpAddress:       ipAddress,
			DeviceType:      types.DeviceType_DEVICE_TYPE_ROUTER,
			Location:        fmt.Sprintf("DataCenter-%d", deviceId),
			Latitude:        37.7749 + float64(deviceId)*0.1,
			Longitude:       -122.4194 + float64(deviceId)*0.1,
			DeviceStatus:    types.DeviceStatus_DEVICE_STATUS_ONLINE,
			LastSeen:        "2025-11-11T10:00:00Z",
			Uptime:          "45 days, 12 hours",
			DeviceId:        deviceId,
			InterfaceCount:  24,
		},
		Physicals: map[string]*types.Physical{
			"physical-1": {
				Id: "physical-1",
				Chassis: []*types.Chassis{
					{
						Id:           "chassis-1",
						SerialNumber: fmt.Sprintf("CHASSIS-%s-001", name),
						Model:        "ASR-9010-CHASSIS",
						Description:  "Main chassis",
						Status:       types.ComponentStatus_COMPONENT_STATUS_OK,
						Temperature:  45.5,
					},
				},
				Ports: createPorts(24, ipAddress, "TenGigE0/0/0/"),
				PowerSupplies: []*types.PowerSupply{
					{
						Id:           "psu-1",
						Name:         "PowerSupply-1",
						Model:        "PSU-1500W",
						SerialNumber: fmt.Sprintf("PSU-%s-001", name),
						Wattage:      1500,
						PowerType:    types.PowerType_POWER_TYPE_AC,
						Status:       types.ComponentStatus_COMPONENT_STATUS_OK,
						Temperature:  42.3,
						LoadPercent:  65.5,
						Voltage:      220.0,
						Current:      6.8,
					},
					{
						Id:           "psu-2",
						Name:         "PowerSupply-2",
						Model:        "PSU-1500W",
						SerialNumber: fmt.Sprintf("PSU-%s-002", name),
						Wattage:      1500,
						PowerType:    types.PowerType_POWER_TYPE_AC,
						Status:       types.ComponentStatus_COMPONENT_STATUS_OK,
						Temperature:  43.1,
						LoadPercent:  67.2,
						Voltage:      220.0,
						Current:      7.0,
					},
				},
				Fans: []*types.Fan{
					{
						Id:            "fan-1",
						Name:          "Fan-Module-1",
						Description:   "Front fan tray",
						Status:        types.ComponentStatus_COMPONENT_STATUS_OK,
						SpeedRpm:      3500,
						MaxSpeedRpm:   5000,
						Temperature:   38.5,
						VariableSpeed: true,
					},
					{
						Id:            "fan-2",
						Name:          "Fan-Module-2",
						Description:   "Rear fan tray",
						Status:        types.ComponentStatus_COMPONENT_STATUS_OK,
						SpeedRpm:      3600,
						MaxSpeedRpm:   5000,
						Temperature:   39.2,
						VariableSpeed: true,
					},
				},
				PhysicalClass: types.PhysicalClass_PHYSICAL_CLASS_CHASSIS,
			},
		},
		Logicals: map[string]*types.Logical{
			"logical-1": {
				Id: "logical-1",
				Interfaces: []*types.Interface{
					createInterface("TenGigE0/0/0/0", ipAddress, 1),
					createInterface("TenGigE0/0/0/1", ipAddress, 2),
					createInterface("TenGigE0/0/0/2", ipAddress, 3),
					createInterface("TenGigE0/0/0/3", ipAddress, 4),
					createInterface("MgmtEth0/0/CPU0/0", ipAddress, 5),
				},
			},
		},
	}
}

// createSwitch creates a switch network device with varied physical and logical inventory
func createSwitch(name, ipAddress string, deviceId uint32) *types.NetworkDevice {
	return &types.NetworkDevice{
		Id: name,
		Equipmentinfo: &types.EquipmentInfo{
			Vendor:          "Juniper",
			Series:          "EX",
			Family:          "EX 4600",
			Software:        "Junos",
			Hardware:        "EX4600-40F",
			Version:         "20.4R3",
			SysName:         name,
			SysOid:          "1.3.6.1.4.1.2636.1.1.1.2.111",
			Model:           "EX4600-40F",
			SerialNumber:    fmt.Sprintf("SN-%s-%d", name, deviceId),
			FirmwareVersion: "20.4R3",
			IpAddress:       ipAddress,
			DeviceType:      types.DeviceType_DEVICE_TYPE_SWITCH,
			Location:        fmt.Sprintf("DataCenter-%d", deviceId),
			Latitude:        37.7749 + float64(deviceId)*0.1,
			Longitude:       -122.4194 + float64(deviceId)*0.1,
			DeviceStatus:    types.DeviceStatus_DEVICE_STATUS_ONLINE,
			LastSeen:        "2025-11-11T10:00:00Z",
			Uptime:          "30 days, 8 hours",
			DeviceId:        deviceId,
			InterfaceCount:  48,
		},
		Physicals: map[string]*types.Physical{
			"physical-1": {
				Id: "physical-1",
				Chassis: []*types.Chassis{
					{
						Id:           "chassis-1",
						SerialNumber: fmt.Sprintf("CHASSIS-%s-001", name),
						Model:        "EX4600-CHASSIS",
						Description:  "Main chassis",
						Status:       types.ComponentStatus_COMPONENT_STATUS_OK,
						Temperature:  38.2,
					},
				},
				Ports: createPorts(48, ipAddress, "ge-0/0/"),
				PowerSupplies: []*types.PowerSupply{
					{
						Id:           "psu-1",
						Name:         "PowerSupply-1",
						Model:        "PSU-1100W",
						SerialNumber: fmt.Sprintf("PSU-%s-001", name),
						Wattage:      1100,
						PowerType:    types.PowerType_POWER_TYPE_AC,
						Status:       types.ComponentStatus_COMPONENT_STATUS_OK,
						Temperature:  40.5,
						LoadPercent:  55.3,
						Voltage:      220.0,
						Current:      5.0,
					},
				},
				Fans: []*types.Fan{
					{
						Id:            "fan-1",
						Name:          "Fan-Tray-1",
						Description:   "System fan tray",
						Status:        types.ComponentStatus_COMPONENT_STATUS_OK,
						SpeedRpm:      4000,
						MaxSpeedRpm:   6000,
						Temperature:   36.8,
						VariableSpeed: true,
					},
				},
				PhysicalClass: types.PhysicalClass_PHYSICAL_CLASS_CHASSIS,
			},
		},
		Logicals: map[string]*types.Logical{
			"logical-1": {
				Id: "logical-1",
				Interfaces: []*types.Interface{
					createInterface("ge-0/0/0", ipAddress, 1),
					createInterface("ge-0/0/1", ipAddress, 2),
					createInterface("ge-0/0/2", ipAddress, 3),
					createInterface("xe-0/0/40", ipAddress, 4),
					createInterface("xe-0/0/41", ipAddress, 5),
					createInterface("me0", ipAddress, 6),
				},
			},
		},
	}
}

// createFirewall creates a firewall network device with varied physical and logical inventory
func createFirewall(name, ipAddress string, deviceId uint32) *types.NetworkDevice {
	return &types.NetworkDevice{
		Id: name,
		Equipmentinfo: &types.EquipmentInfo{
			Vendor:          "Palo Alto Networks",
			Series:          "PA",
			Family:          "PA-5000",
			Software:        "PAN-OS",
			Hardware:        "PA-5220",
			Version:         "10.2.3",
			SysName:         name,
			SysOid:          "1.3.6.1.4.1.25461.2.3.21",
			Model:           "PA-5220",
			SerialNumber:    fmt.Sprintf("SN-%s-%d", name, deviceId),
			FirmwareVersion: "10.2.3",
			IpAddress:       ipAddress,
			DeviceType:      types.DeviceType_DEVICE_TYPE_FIREWALL,
			Location:        fmt.Sprintf("DataCenter-%d", deviceId),
			Latitude:        37.7749 + float64(deviceId)*0.1,
			Longitude:       -122.4194 + float64(deviceId)*0.1,
			DeviceStatus:    types.DeviceStatus_DEVICE_STATUS_ONLINE,
			LastSeen:        "2025-11-11T10:00:00Z",
			Uptime:          "60 days, 5 hours",
			DeviceId:        deviceId,
			InterfaceCount:  24,
		},
		Physicals: map[string]*types.Physical{
			"physical-1": {
				Id: "physical-1",
				Chassis: []*types.Chassis{
					{
						Id:           "chassis-1",
						SerialNumber: fmt.Sprintf("CHASSIS-%s-001", name),
						Model:        "PA-5220-CHASSIS",
						Description:  "Main chassis",
						Status:       types.ComponentStatus_COMPONENT_STATUS_OK,
						Temperature:  41.8,
					},
				},
				Ports: createPorts(24, ipAddress, "ethernet1/"),
				PowerSupplies: []*types.PowerSupply{
					{
						Id:           "psu-1",
						Name:         "PowerSupply-1",
						Model:        "PSU-950W",
						SerialNumber: fmt.Sprintf("PSU-%s-001", name),
						Wattage:      950,
						PowerType:    types.PowerType_POWER_TYPE_AC,
						Status:       types.ComponentStatus_COMPONENT_STATUS_OK,
						Temperature:  44.2,
						LoadPercent:  72.1,
						Voltage:      220.0,
						Current:      4.3,
					},
					{
						Id:           "psu-2",
						Name:         "PowerSupply-2",
						Model:        "PSU-950W",
						SerialNumber: fmt.Sprintf("PSU-%s-002", name),
						Wattage:      950,
						PowerType:    types.PowerType_POWER_TYPE_AC,
						Status:       types.ComponentStatus_COMPONENT_STATUS_WARNING,
						Temperature:  48.5,
						LoadPercent:  75.3,
						Voltage:      218.0,
						Current:      4.5,
					},
				},
				Fans: []*types.Fan{
					{
						Id:            "fan-1",
						Name:          "Fan-1",
						Description:   "Left fan",
						Status:        types.ComponentStatus_COMPONENT_STATUS_OK,
						SpeedRpm:      4200,
						MaxSpeedRpm:   6500,
						Temperature:   40.1,
						VariableSpeed: true,
					},
					{
						Id:            "fan-2",
						Name:          "Fan-2",
						Description:   "Right fan",
						Status:        types.ComponentStatus_COMPONENT_STATUS_OK,
						SpeedRpm:      4300,
						MaxSpeedRpm:   6500,
						Temperature:   40.8,
						VariableSpeed: true,
					},
				},
				PhysicalClass: types.PhysicalClass_PHYSICAL_CLASS_CHASSIS,
			},
		},
		Logicals: map[string]*types.Logical{
			"logical-1": {
				Id: "logical-1",
				Interfaces: []*types.Interface{
					createInterface("ethernet1/1", ipAddress, 1),
					createInterface("ethernet1/2", ipAddress, 2),
					createInterface("ethernet1/3", ipAddress, 3),
					createInterface("management", ipAddress, 4),
				},
			},
		},
	}
}

// createInterface is a helper function to create network interfaces with varied configurations
func createInterface(name, baseIP string, index int) *types.Interface {
	// Vary interface types based on name patterns
	var ifType types.InterfaceType
	var speed uint64

	if name[:2] == "Te" || name[:2] == "xe" {
		ifType = types.InterfaceType_INTERFACE_TYPE_10GIGE
		speed = 10000000000
	} else if name[:2] == "ge" || name[:2] == "Gi" {
		ifType = types.InterfaceType_INTERFACE_TYPE_GIGABIT_ETHERNET
		speed = 1000000000
	} else if name[:2] == "Mg" || name[:2] == "me" || name == "management" {
		ifType = types.InterfaceType_INTERFACE_TYPE_MANAGEMENT
		speed = 1000000000
	} else {
		ifType = types.InterfaceType_INTERFACE_TYPE_ETHERNET
		speed = 100000000
	}

	return &types.Interface{
		Id:            fmt.Sprintf("%s-%d", name, index),
		Name:          name,
		Status:        "up",
		Description:   fmt.Sprintf("Interface %s", name),
		InterfaceType: ifType,
		Speed:         speed,
		MacAddress:    fmt.Sprintf("00:1a:2b:3c:4d:%02x", index),
		IpAddress:     fmt.Sprintf("%s.%d", baseIP, 10+index),
		Mtu:           1500,
		AdminStatus:   true,
	}
}
