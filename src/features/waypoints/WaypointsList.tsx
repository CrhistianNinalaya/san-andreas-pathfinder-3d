import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import type { Waypoint } from '../../map-bridge/useWaypointMarkers';

interface WaypointsListProps {
  waypoints: Waypoint[];
  onRemove: (index: number) => void;
}

export const WaypointsList: React.FC<WaypointsListProps> = ({ waypoints, onRemove }) => {
  const { t } = useTranslation();
  const total = waypoints.length;

  if (total === 0) {
    return (
      <div style={{
        padding: '12px',
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#94a3b8',
        textAlign: 'center',
        border: '1px dashed rgba(255,255,255,0.1)'
      }}>
        💡 {t('addWaypointHint')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
      {waypoints.map((wp, idx) => {
        let indBg = '#38bdf8';
        let roleText = t('stop', { label: wp.label });

        if (idx === 0) {
          indBg = '#10b981';
          roleText = t('origin');
        } else if (idx === total - 1 && total > 1) {
          indBg = '#ef4444';
          roleText = t('destination');
        }

        return (
          <div
            key={wp.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: indBg,
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 8px ${indBg}88`
                }}
              >
                {wp.label}
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#f8fafc' }}>
                  {roleText}
                </span>
                <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8' }}>
                  X: {wp.snapNode.x}, Y: {wp.snapNode.y}
                </span>
              </div>
            </div>

            <button
              onClick={() => onRemove(idx)}
              title="Remove"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '4px 6px',
                borderRadius: '4px'
              }}
            >
              ✖
            </button>
          </div>
        );
      })}
    </div>
  );
};
