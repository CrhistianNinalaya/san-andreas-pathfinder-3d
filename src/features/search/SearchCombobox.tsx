import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import type { GtaCoords } from '../../engine/types';
import styles from './SearchCombobox.module.css';

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

export function SearchCombobox({ onSelectPlace }: Readonly<SearchComboboxProps>) {
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

  function handleSelect(poi: POI) {
    const placeName = poi.name[lang] || poi.name.en;
    onSelectPlace({ x: poi.x, y: poi.y, z: poi.z }, placeName);
    setQuery('');
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
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
  }

  return (
    <div ref={containerRef} className={styles.searchContainer}>
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
        className={styles.searchInput}
      />

      {isOpen && filteredPois.length > 0 && (
        <ul className={styles.dropdownMenu}>
          {filteredPois.map((poi, idx) => (
            <li
              key={poi.id}
              onClick={() => handleSelect(poi)}
              className={`${styles.dropdownItem} ${idx === selectedIndex ? styles.dropdownItemSelected : ''}`}
            >
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{poi.name[lang] || poi.name.en}</span>
                <span className={styles.itemCity}>{poi.city}</span>
              </div>
              <span className={styles.itemKind}>{poi.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
