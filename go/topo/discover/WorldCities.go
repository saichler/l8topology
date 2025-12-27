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

package discover

import (
	"encoding/csv"
	"os"
	"strconv"
	"strings"
	"sync"
)

// Module-level state for city coordinates lookup.
// The data is lazily loaded from CSV on first access and cached for subsequent lookups.
var (
	cityCoordinates map[string][2]float64  // Maps city name to [longitude, latitude]
	cityMutex       sync.RWMutex           // Protects concurrent access to cityCoordinates
	citiesLoaded    bool                   // Indicates if the CSV has been loaded
)

// loadCities reads the worldcities.csv file and populates the cityCoordinates map.
// The function is idempotent - it only loads data once and subsequent calls return immediately.
// Thread-safe through mutex protection.
//
// The CSV format is expected to be:
// "city","city_ascii","lat","lng","country","iso2","iso3","admin_name","capital","population","id"
//
// Cities are indexed by two key formats:
//   - Full format: "City, AdminName, Country" (e.g., "Bozova, Şanlıurfa, Turkey")
//   - Short format: "City, Country" (e.g., "Tokyo, Japan")
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

	// Parse CSV records, skipping header row
	for i, record := range records {
		if i == 0 {
			continue // skip header
		}
		if len(record) < 8 {
			continue // skip malformed rows
		}

		city := strings.TrimSpace(record[0])
		country := strings.TrimSpace(record[4])
		adminName := strings.TrimSpace(record[7])

		lat, errLat := strconv.ParseFloat(strings.TrimSpace(record[2]), 64)
		lon, errLon := strconv.ParseFloat(strings.TrimSpace(record[3]), 64)
		if errLon == nil && errLat == nil {
			coords := [2]float64{lon, lat}
			// Add with full format: "City, AdminName, Country"
			fullKey := city + ", " + adminName + ", " + country
			cityCoordinates[fullKey] = coords
			// Add with short format: "City, Country"
			shortKey := city + ", " + country
			cityCoordinates[shortKey] = coords
		}
	}

	citiesLoaded = true
	return nil
}

// GetCityCoordinates looks up geographic coordinates for a city by name.
// The city name should be formatted as either:
//   - "City, AdminName, Country" (e.g., "Bozova, Şanlıurfa, Turkey")
//   - "City, Country" (e.g., "Tokyo, Japan")
//
// Returns longitude, latitude, and a boolean indicating if the city was found.
// The function is thread-safe and lazily loads the city database on first call.
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
