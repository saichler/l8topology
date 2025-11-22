package discover

import (
	"encoding/csv"
	"os"
	"strconv"
	"strings"
	"sync"
)

var (
	cityCoordinates map[string][2]float64
	cityMutex       sync.RWMutex
	citiesLoaded    bool
)

func loadCities() error {
	cityMutex.Lock()
	defer cityMutex.Unlock()

	if citiesLoaded {
		return nil
	}

	cityCoordinates = make(map[string][2]float64)

	file, err := os.Open("worldcities.csv")
	if err != nil {
		return err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return err
	}

	// CSV format: "city","city_ascii","lat","lng","country","iso2","iso3","admin_name","capital","population","id"
	// Key format: "City, AdminName, Country" (e.g., "Bozova, Şanlıurfa, Turkey")
	for i, record := range records {
		if i == 0 {
			continue // skip header
		}
		if len(record) < 8 {
			continue
		}

		city := strings.TrimSpace(record[0])
		country := strings.TrimSpace(record[4])
		adminName := strings.TrimSpace(record[7])
		key := city + ", " + adminName + ", " + country

		lat, errLat := strconv.ParseFloat(strings.TrimSpace(record[2]), 64)
		lon, errLon := strconv.ParseFloat(strings.TrimSpace(record[3]), 64)
		if errLon == nil && errLat == nil {
			cityCoordinates[key] = [2]float64{lon, lat}
		}
	}

	citiesLoaded = true
	return nil
}

func GetCityCoordinates(cityName string) (longitude, latitude float64, found bool) {
	cityMutex.RLock()
	if !citiesLoaded {
		cityMutex.RUnlock()
		if err := loadCities(); err != nil {
			return 0, 0, false
		}
		cityMutex.RLock()
	}
	defer cityMutex.RUnlock()

	coords, ok := cityCoordinates[cityName]
	if !ok {
		return 0, 0, false
	}
	return coords[0], coords[1], true
}
