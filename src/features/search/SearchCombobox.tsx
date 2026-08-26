import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import type { GtaCoords } from '../../engine/types';

interface POI {
  id: string;
  name: { en: string; es: string };
  aliases: string[];
  x: number;
  y: number;
  z: number;
  city: string;
  kind: string;
}

interface SearchComboboxProps {
  onSelectPlace: (coords: GtaCoords, name: string) => void;
}

export const SearchCombobox: React.FC<SearchComboboxProps> = ({ onSelectPlace }) => {
  const { t, lang } = useTranslation();
  const [query, setQuery] = useState('');
  const [pois, setPois] = useState<POI[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('data/pois.json')
      .then(res => res.json())
      .then((data: POI[]) => setPois(data))
      .catch(err => console.warn('Could not load POIs:', err));
  }, []);

  const filteredPois = query.trim() === '' ? [] : pois.filter(p => {
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nameEs = (p.name.es || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nameEn = (p.name.en || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const city = (p.city || '').toLowerCase();
    const aliases = (p.aliases || []).join(' ').toLowerCase();

    return nameEs.includes(q) || nameEn.includes(q) || city.includes(q) || aliases.includes(q);
  }).slice(0, 5);

  const handleSelect = (poi: POI) => {
    const placeName = poi.name[lang] || poi.name.en;
    onSelectPlace({ x: poi.x, y: poi.y, z: poi.z }, placeName);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredPois.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredPois.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredPois.length) % filteredPois.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = filteredPois[selectedIndex];
      if (chosen) handleSelect(chosen);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setIsOpen(true);
          setSelectedIndex(0);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={t('searchPlaceholder')}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '8px 12px',
          color: '#f8fafc',
          fontSize: '12.5px',
          outline: 'none',
          backdropFilter: 'blur(8px)'
        }}
      />

      {isOpen && filteredPois.length > 0 && (
        <ul
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            listStyle: 'none',
            padding: '4px 0',
            margin: 0,
            zIndex: 1000,
            maxHeight: '180px',
            overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}
        >
          {filteredPois.map((poi, idx) => {
            const isSelected = idx === selectedIndex;
            const displayName = poi.name[lang] || poi.name.en;
            return (
              <li
                key={poi.id}
                onClick={() => handleSelect(poi)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  color: isSelected ? '#38bdf8' : '#f8fafc',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div>
                  <strong>{displayName}</strong>
                  <span style={{ display: 'block', fontSize: '10.5px', color: '#94a3b8' }}>
                    {poi.city} · {poi.kind}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>📍</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
