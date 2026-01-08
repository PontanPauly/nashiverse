import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Star = ({ person, x, y, size, isActive, onHover, onLeave, onClick }) => {
  return (
    <div 
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        cursor: 'pointer',
        zIndex: 10
      }}
      onMouseEnter={() => onHover?.(person.id)}
      onMouseLeave={() => onLeave?.()}
      onClick={() => onClick?.(person.id)}
    >
      {/* Visible star dot */}
      <div style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: 'white',
        boxShadow: '0 0 10px rgba(255,255,255,0.8), 0 0 20px rgba(255,255,255,0.5)',
      }} />
    </div>
  );
};

export default function FamilyConstellation({ people, households, relationships }) {
  const [activeStarId, setActiveStarId] = useState(null);
  const [hoveredStarId, setHoveredStarId] = useState(null);

  const stars = useMemo(() => {
    if (!people || people.length === 0) return [];
    
    return people.map((person, index) => {
      const angle = (index / people.length) * Math.PI * 2;
      const radius = 30;
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;
      
      return {
        person,
        x,
        y,
        size: 12
      };
    });
  }, [people]);

  const activeStar = stars.find(s => s.person.id === activeStarId);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: 'calc(100vh - 200px)',
      minHeight: '600px',
      background: '#0a0e1a',
      borderRadius: '16px',
      overflow: 'hidden'
    }}>
      {/* Debug info */}
      <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', zIndex: 100 }}>
        Stars: {stars.length}
      </div>

      {/* Stars */}
      {stars.map((star) => (
        <Star
          key={star.person.id}
          person={star.person}
          x={star.x}
          y={star.y}
          size={star.size}
          isActive={star.person.id === activeStarId}
          onHover={setHoveredStarId}
          onLeave={() => setHoveredStarId(null)}
          onClick={setActiveStarId}
        />
      ))}

      {/* Context Panel */}
      {activeStar && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          width: '300px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '16px',
          padding: '20px',
          color: 'white',
          zIndex: 100
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>{activeStar.person.name}</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveStarId(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          {activeStar.person.nickname && (
            <p style={{ margin: '4px 0', fontSize: '13px', color: '#fbbf24' }}>"{activeStar.person.nickname}"</p>
          )}
          <div style={{ marginTop: '12px', fontSize: '14px' }}>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: '#94a3b8' }}>Role: </span>
              <span>{activeStar.person.role_type}</span>
            </div>
            {activeStar.person.household_id && (
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Household: </span>
                <span>{households?.find(h => h.id === activeStar.person.household_id)?.name || 'Unknown'}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}