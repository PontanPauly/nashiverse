import React, { useMemo, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Star Component from Nashiverse v2.1 reference
const Star = ({ 
  id,
  x, 
  y, 
  size = 1, 
  colorTemp = 6000,
  intensity = 1,
  label,
  isActive,
  isConnected,
  onHover,
  onLeave,
  onClick 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getStarColor = (temp) => {
    if (temp < 4000) return { r: 255, g: 200, b: 150 };
    if (temp < 6000) return { r: 255, g: 240, b: 220 };
    if (temp < 8000) return { r: 240, g: 245, b: 255 };
    return { r: 200, g: 220, b: 255 };
  };

  // Static optical imperfections (calculated once per star)
  const optics = useMemo(() => ({
    driftX: (Math.random() - 0.5) * 2,
    driftY: (Math.random() - 0.5) * 2,
    blur: (Math.random() * 0.4 + 0.3).toFixed(2)
  }), [id]);

  const color = getStarColor(colorTemp);
  const baseSize = 8 + (size * 12);
  const glowSize = baseSize * 2.5;

  const starStyle = {
    '--star-x': `${x}%`,
    '--star-y': `${y}%`,
    '--star-size': `${baseSize}px`,
    '--glow-size': `${glowSize}px`,
    '--star-r': color.r,
    '--star-g': color.g,
    '--star-b': color.b,
    '--intensity': intensity,
    '--drift-x': `${optics.driftX}px`,
    '--drift-y': `${optics.driftY}px`,
    '--star-blur': `${optics.blur}px`,
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    onHover?.(id);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    onLeave?.();
  };

  const handleClick = () => {
    onClick?.(id);
  };

  return (
    <div 
      className={`star ${isHovered ? 'star--hovered' : ''} ${isActive ? 'star--active' : ''} ${isConnected ? 'star--connected' : ''}`}
      style={starStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div className="star__core" />
      <div className="star__aberration star__aberration--red" />
      <div className="star__aberration star__aberration--blue" />
      <div className="star__glow" />
      
      {label && isHovered && (
        <div className="star__label">{label}</div>
      )}
    </div>
  );
};

// Constellation Lines from Nashiverse v2.1 reference
const ConstellationLines = ({ connections, stars }) => {
  if (!connections || connections.length === 0) return null;

  return (
    <svg className="constellation-lines" style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%',
      pointerEvents: 'none'
    }}>
      {connections.map(({ from, to }, idx) => {
        const starFrom = stars.find(s => s.id === from);
        const starTo = stars.find(s => s.id === to);
        
        if (!starFrom || !starTo) return null;

        return (
          <line
            key={`${from}-${to}-${idx}`}
            x1={`${starFrom.x}%`}
            y1={`${starFrom.y}%`}
            x2={`${starTo.x}%`}
            y2={`${starTo.y}%`}
            className="constellation-line"
            style={{ '--line-delay': `${idx * 60}ms` }}
          />
        );
      })}
    </svg>
  );
};

export default function FamilyConstellation({ people, households, relationships }) {
  const [activeStarId, setActiveStarId] = useState(null);
  const [hoveredStarId, setHoveredStarId] = useState(null);

  // Transform people into stars with simple scattered positioning
  const stars = useMemo(() => {
    return people.map((person, index) => {
      // Simple scattered positioning across the sky
      const angle = (index / people.length) * Math.PI * 2;
      const radius = 20 + (Math.random() * 30);
      const x = 50 + Math.cos(angle) * radius + (Math.random() - 0.5) * 10;
      const y = 50 + Math.sin(angle) * radius + (Math.random() - 0.5) * 10;
      
      // Size based on role
      const sizeMap = { 'adult': 1, 'teen': 0.85, 'child': 0.7, 'ancestor': 1.2 };
      const size = sizeMap[person.role_type] || 1;
      
      // Color temp based on household for variety
      const tempMap = [5500, 6000, 5800, 6200, 7000, 6500];
      const hash = (person.household_id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const colorTemp = tempMap[hash % tempMap.length];
      
      const intensity = (person.star_intensity || 5) / 10;
      
      return {
        id: person.id,
        x: Math.max(10, Math.min(90, x)),
        y: Math.max(10, Math.min(90, y)),
        size,
        colorTemp,
        intensity,
        label: person.name + (person.nickname ? ` "${person.nickname}"` : ''),
        data: person
      };
    });
  }, [people]);

  // Only show connections for active/hovered star
  const activeConnections = useMemo(() => {
    const starId = activeStarId || hoveredStarId;
    if (!starId) return [];
    
    const conns = [];
    
    // Find household members
    const activePerson = people.find(p => p.id === starId);
    if (activePerson?.household_id) {
      people.forEach(person => {
        if (person.household_id === activePerson.household_id && person.id !== starId) {
          conns.push({ from: starId, to: person.id });
        }
      });
    }
    
    // Find relationships
    relationships.forEach(rel => {
      if (rel.person_id === starId) {
        conns.push({ from: starId, to: rel.related_person_id });
      } else if (rel.related_person_id === starId) {
        conns.push({ from: starId, to: rel.person_id });
      }
    });
    
    return conns;
  }, [activeStarId, hoveredStarId, people, relationships]);

  const handleStarClick = useCallback((starId) => {
    setActiveStarId(starId === activeStarId ? null : starId);
  }, [activeStarId]);

  const handleStarHover = useCallback((starId) => {
    setHoveredStarId(starId);
  }, []);

  const handleStarLeave = useCallback(() => {
    setHoveredStarId(null);
  }, []);

  const activeStar = stars.find(s => s.id === activeStarId);

  return (
    <div className="nashiverse" style={{ position: 'relative', minHeight: '600px', width: '100%' }}>
      {/* Deep space background */}
      <div className="nashiverse__background" style={{ position: 'absolute', inset: 0 }} />
      
      {/* Distant stars */}
      <div className="nashiverse__distant-stars" style={{ position: 'absolute', inset: 0 }} />
      
      {/* Nebula clouds */}
      <div className="nashiverse__nebula" style={{ position: 'absolute', inset: 0 }}>
        <div className="nashiverse__nebula-cloud nashiverse__nebula-cloud--1" />
        <div className="nashiverse__nebula-cloud nashiverse__nebula-cloud--2" />
        <div className="nashiverse__nebula-cloud nashiverse__nebula-cloud--3" />
      </div>

      <ConstellationLines 
        connections={activeConnections} 
        stars={stars}
      />
      
      {stars.map(star => (
        <Star
          key={star.id}
          id={star.id}
          x={star.x}
          y={star.y}
          size={star.size}
          colorTemp={star.colorTemp}
          intensity={star.intensity}
          label={star.label}
          isActive={star.id === activeStarId}
          isConnected={activeConnections.some(c => c.from === star.id || c.to === star.id)}
          onHover={handleStarHover}
          onLeave={handleStarLeave}
          onClick={handleStarClick}
        />
      ))}

      {activeStar && (
        <div className="context-panel">
          <div className="context-panel__header">
            <div className="context-panel__avatar">
              {activeStar.data.photo_url ? (
                <img src={activeStar.data.photo_url} alt="" />
              ) : (
                <span>{activeStar.data.name?.charAt(0)}</span>
              )}
            </div>
            <div>
              <h3>{activeStar.data.name}</h3>
              {activeStar.data.nickname && (
                <p className="context-panel__nickname">"{activeStar.data.nickname}"</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveStarId(null)}
              className="context-panel__close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="context-panel__content">
            <div className="context-panel__field">
              <span>Role:</span>
              <span className="capitalize">{activeStar.data.role_type}</span>
            </div>
            
            {activeStar.data.birth_date && (
              <div className="context-panel__field">
                <span>Birth Date:</span>
                <span>{activeStar.data.birth_date}</span>
              </div>
            )}

            {activeStar.data.about && (
              <div className="context-panel__field context-panel__field--full">
                <p className="context-panel__label">About:</p>
                <p>{activeStar.data.about}</p>
              </div>
            )}

            {activeStar.data.is_deceased && (
              <div className="context-panel__memorial">
                In loving memory
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}