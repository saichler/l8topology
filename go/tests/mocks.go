package tests

import (
	"fmt"

	"github.com/saichler/probler/go/types"
)

func Nodes() *types.NetworkDeviceList {
	devices := make([]*types.NetworkDevice, 0)

	// Create diverse network devices with real world city locations (from worldcities.csv)
	devices = append(devices, createRouter("R1", "192.168.1.1", 1, "Tokyo, Japan", 139.7495, 35.6870))
	devices = append(devices, createRouter("R2", "192.168.1.2", 2, "New York, United States", -73.9249, 40.6943))
	devices = append(devices, createSwitch("SW1", "192.168.2.1", 3, "London, United Kingdom", -0.1275, 51.5072))
	devices = append(devices, createSwitch("SW2", "192.168.2.2", 4, "São Paulo, Brazil", -46.6339, -23.5504))
	devices = append(devices, createFirewall("FW1", "192.168.3.1", 5, "Mumbai, India", 72.8775, 19.0761))

	// Additional devices across the globe
	devices = append(devices, createRouter("R3", "192.168.1.3", 6, "Sydney, Australia", 151.2000, -33.8667))
	devices = append(devices, createRouter("R4", "192.168.1.4", 7, "Paris, France", 2.3522, 48.8567))
	devices = append(devices, createSwitch("SW3", "192.168.2.3", 8, "Singapore, Singapore", 103.8000, 1.3000))
	devices = append(devices, createSwitch("SW4", "192.168.2.4", 9, "Dubai, United Arab Emirates", 55.2972, 25.2631))
	devices = append(devices, createFirewall("FW2", "192.168.3.2", 10, "Toronto, Canada", -79.3733, 43.7417))
	devices = append(devices, createRouter("R5", "192.168.1.5", 11, "Berlin, Germany", 13.4050, 52.5200))
	devices = append(devices, createRouter("R6", "192.168.1.6", 12, "Moscow, Russia", 37.6175, 55.7506))
	devices = append(devices, createSwitch("SW5", "192.168.2.5", 13, "Hong Kong, Hong Kong", 114.2000, 22.3000))
	devices = append(devices, createSwitch("SW6", "192.168.2.6", 14, "Amsterdam, Netherlands", 4.8936, 52.3728))
	devices = append(devices, createFirewall("FW3", "192.168.3.3", 15, "Seoul, Korea, South", 126.9833, 37.5667))
	devices = append(devices, createRouter("R7", "192.168.1.7", 16, "Los Angeles, United States", -118.4068, 34.1141))
	devices = append(devices, createRouter("R8", "192.168.1.8", 17, "Cape Town, South Africa", 18.4239, -33.9253))
	devices = append(devices, createSwitch("SW7", "192.168.2.7", 18, "Bangkok, Thailand", 100.4942, 13.7525))
	devices = append(devices, createSwitch("SW8", "192.168.2.8", 19, "Mexico City, Mexico", -99.1333, 19.4333))
	devices = append(devices, createFirewall("FW4", "192.168.3.4", 20, "Cairo, Egypt", 31.2358, 30.0444))

	deviceList := &types.NetworkDeviceList{List: devices}

	return deviceList
}

// createPorts generates a topo_list of ports with interfaces
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
func createRouter(name, ipAddress string, deviceId uint32, location string, longitude, latitude float64) *types.NetworkDevice {
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
			Location:        location,
			Latitude:        latitude,
			Longitude:       longitude,
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
func createSwitch(name, ipAddress string, deviceId uint32, location string, longitude, latitude float64) *types.NetworkDevice {
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
			Location:        location,
			Latitude:        latitude,
			Longitude:       longitude,
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
func createFirewall(name, ipAddress string, deviceId uint32, location string, longitude, latitude float64) *types.NetworkDevice {
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
			Location:        location,
			Latitude:        latitude,
			Longitude:       longitude,
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
