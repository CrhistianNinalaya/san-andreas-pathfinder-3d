/**
 * GTA San Andreas Map Configuration for Leaflet
 * Powered by the Official Ultra HD Radar (6144x6144 px) stitched from 144 game TXD files.
 * 
 * Official GTA San Andreas World Coordinate Space:
 * X: [-3000, 3000] (West to East)
 * Y: [-3000, 3000] (South to North)
 * 
 * In Leaflet L.CRS.Simple:
 * lat -> GTA San Andreas Y coordinate
 * lng -> GTA San Andreas X coordinate
 */

const GTA_MAP_CONFIG = {
  bounds: [
    [-3000, -3000], // South-West [min_y, min_x]
    [3000, 3000]    // North-East [max_y, max_x]
  ],
  defaultView: {
    center: [0, 0], // Center of entire San Andreas [Y, X]
    zoom: -1,
    minZoom: -2,
    maxZoom: 4
  },
  sanFierroView: {
    center: [200, -2000], // Center of San Fierro [Y, X]
    zoom: 0,
    minZoom: -2,
    maxZoom: 4
  },
  imagePath: 'mapa-gta-sa-hd.webp',

  // Converts Leaflet latlng to GTA {x, y} coordinate object
  latLngToGta(latlng) {
    return {
      x: Math.round(latlng.lng),
      y: Math.round(latlng.lat)
    };
  },

  // Converts GTA {x, y} coordinates to Leaflet [lat, lng] format
  gtaToLatLng(x, y) {
    return [y, x];
  }
};
