/**
 * Configuración del Mapa de GTA San Andreas para Leaflet
 * Utilizando el Radar Oficial Ultra HD (6144x6144 px) extraído de los 144 TXD del juego.
 * 
 * En GTA San Andreas el sistema de coordenadas oficial es:
 * X: [-3000, 3000] (Oeste a Este)
 * Y: [-3000, 3000] (Sur a Norte)
 * 
 * Con Leaflet L.CRS.Simple:
 * lat -> Coordenada Y de GTA San Andreas
 * lng -> Coordenada X de GTA San Andreas
 */

const GTA_MAP_CONFIG = {
  bounds: [
    [-3000, -3000], // Suroeste [min_y, min_x]
    [3000, 3000]    // Noreste  [max_y, max_x]
  ],
  defaultView: {
    center: [0, 0], // Centro de todo San Andreas [Y, X]
    zoom: -1,
    minZoom: -2,
    maxZoom: 4
  },
  imagePath: 'mapa-gta-sa-hd.webp',

  // Convierte coordenadas de Leaflet (latlng) a objeto {x, y}
  latLngToGta(latlng) {
    return {
      x: Math.round(latlng.lng),
      y: Math.round(latlng.lat)
    };
  },

  // Convierte coordenadas {x, y} a formato Leaflet [lat, lng]
  gtaToLatLng(x, y) {
    return [y, x];
  }
};
