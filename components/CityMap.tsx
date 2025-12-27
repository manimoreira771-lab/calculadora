
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface CityMapProps {
  lat: number;
  lng: number;
  cityName: string;
}

const CityMap: React.FC<CityMapProps> = ({ lat, lng, cityName }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map if not already initialized
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 12, // Slightly tighter zoom for city context
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false, // Prevent scroll hijacking on desktop
        tap: true, // Specifically for mobile browsers
        touchZoom: 'center',
        bounceAtZoomLimits: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Larger zoom controls for easier touch access
      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
    } else {
      // Update map position on coordinate change
      mapRef.current.setView([lat, lng], 12, { animate: true });
    }

    // Update or create marker
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      // Create a custom icon that's highly visible on mobile using brand amber color
      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="w-10 h-10 bg-amber-500 rounded-full border-4 border-white shadow-2xl flex items-center justify-center animate-bounce-short">
                <div class="w-2.5 h-2.5 bg-white rounded-full"></div>
                <div class="absolute -bottom-1 w-2 h-2 bg-amber-700 rotate-45 -z-10"></div>
               </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      });

      markerRef.current = L.marker([lat, lng], { icon: customIcon }).addTo(mapRef.current);
    }

    return () => {
      // Cleanup is usually handled by Leaflet, but we could destroy here if needed
    };
  }, [lat, lng]);

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) mapRef.current.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-200 group">
      <div ref={mapContainerRef} className="w-full h-full z-0 cursor-grab active:cursor-grabbing" />
      
      {/* Overlay controls */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none">
        <div className="bg-white/95 backdrop-blur shadow-lg px-3 py-1.5 rounded-xl border border-slate-100 text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
          {cityName}
        </div>
      </div>
      
      {/* Interaction tip - disappears on interaction (simplistic approach via CSS hover) */}
      <div className="absolute bottom-3 left-3 z-10 opacity-60 group-hover:opacity-0 transition-opacity pointer-events-none hidden sm:block">
        <div className="bg-slate-900/40 text-white px-2 py-1 rounded-md text-[9px] font-medium backdrop-blur-sm">
          Scroll to zoom
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-short {
          animation: bounce-short 2s ease-in-out infinite;
        }
      `}} />
    </div>
  );
};

export default CityMap;
