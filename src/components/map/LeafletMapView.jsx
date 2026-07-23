import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getClanColor } from '../../utils/formatters';

export function LeafletMapView({
  territories = [],
  runPath = [],
  userCoords = null,
  selectedTerritoryId = null,
  onSelectTerritory,
  guidanceLineCoords = null
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const runnerMarkerRef = useRef(null);
  const pathPolylineRef = useRef(null);
  const territoryLayersRef = useRef({});
  const guidancePolylineRef = useRef(null);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const defaultCenter = userCoords || [24.5854, 73.7125]; // Udaipur default coordinates
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView(defaultCenter, 14);

    // Dark high-contrast Leaflet Map Tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [userCoords]);

  // 2. User Coordinates Marker Update
  useEffect(() => {
    if (!mapInstanceRef.current || !userCoords) return;

    if (!runnerMarkerRef.current) {
      const runnerIcon = L.divIcon({
        className: 'custom-runner-icon',
        html: `<div style="background-color: #FC4C02; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px rgba(252,76,2,0.8);"></div>`,
        iconSize: [18, 18]
      });
      runnerMarkerRef.current = L.marker(userCoords, { icon: runnerIcon }).addTo(mapInstanceRef.current);
    } else {
      runnerMarkerRef.current.setLatLng(userCoords);
    }
  }, [userCoords]);

  // 3. Live Run Polyline Path Update
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (pathPolylineRef.current) {
      mapInstanceRef.current.removeLayer(pathPolylineRef.current);
      pathPolylineRef.current = null;
    }

    if (runPath && runPath.length > 1) {
      pathPolylineRef.current = L.polyline(runPath, {
        color: '#00F0FF',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(mapInstanceRef.current);
    }
  }, [runPath]);

  // 4. Territory Polygons Rendering & Selection
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing territory layers
    Object.values(territoryLayersRef.current).forEach((layer) => {
      mapInstanceRef.current.removeLayer(layer);
    });
    territoryLayersRef.current = {};

    territories.forEach((t) => {
      if (!t.coords || t.coords.length === 0) return;

      const isSelected = selectedTerritoryId === t.id;
      const color = getClanColor(t.clan);

      let layer;
      if (t.coords.length === 1) {
        // Point landmark marker
        const landmarkIcon = L.divIcon({
          className: 'landmark-icon',
          html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px ${color};"></div>`,
          iconSize: [14, 14]
        });
        layer = L.marker(t.coords[0], { icon: landmarkIcon });
      } else {
        // Polygon sector
        layer = L.polygon(t.coords, {
          color: isSelected ? '#FFFFFF' : color,
          fillColor: color,
          fillOpacity: isSelected ? 0.45 : 0.25,
          weight: isSelected ? 3 : 2,
          dashArray: isSelected ? '4, 4' : null
        });
      }

      layer.on('click', () => {
        if (onSelectTerritory) onSelectTerritory(t.id);
      });

      layer.addTo(mapInstanceRef.current);
      territoryLayersRef.current[t.id] = layer;
    });
  }, [territories, selectedTerritoryId, onSelectTerritory]);

  // 5. Guidance Line Rendering
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (guidancePolylineRef.current) {
      mapInstanceRef.current.removeLayer(guidancePolylineRef.current);
      guidancePolylineRef.current = null;
    }

    if (guidanceLineCoords && guidanceLineCoords.length === 2) {
      guidancePolylineRef.current = L.polyline(guidanceLineCoords, {
        color: '#FC4C02',
        weight: 3,
        dashArray: '6, 8',
        opacity: 0.8
      }).addTo(mapInstanceRef.current);
    }
  }, [guidanceLineCoords]);

  return (
    <div className="relative w-full h-full min-h-[350px]">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
    </div>
  );
}
