import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Star Component - Static by default, event-driven only
const Star = ({ 
  person,
  x, 
  y, 
  size,
  colorTemp,
  intensity,
  isActive,
  isConnected,
  onHover,
  onLeave,
  onClick 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Color temperature mapping (telescope view)
  const getStarColor = (temp) => {
    if (temp < 4000) return { r: 255, g: 200, b: 150 }; // Warm
    if (temp < 6000) return { r: 255, g: 240, b: 220 }; // Yellow-white
    if (temp < 8000) return { r: 240, g: 245, b: 255 }; // White
    return { r: 200, g: 220, b: 255 }; // Blue-white
  };

  // Static optical imperfections per star
  const optics = useMemo(() => ({
    driftX: (Math.random() - 0.5) * 2,
    driftY: (Math.random() - 0.5) * 2,
    blur: (Math.random() * 0.4 + 0.3).toFixed(2)
  }), [person.id]);

  const color = getStarColor(colorTemp);
  const baseSize = 8 + (size * 12);
  const glowSize = baseSize * 2.5;

  const starStyle = {
    left: `${x}%`,
    top: `${y}%`,
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
    onHover?.(person.id);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    onLeave?.();
  };

  return (
    <div 
      className={`star ${isHovered ? 'star--hovered' : ''} ${isActive ? 'star--active' : ''} ${isConnected ? 'star--connected' : ''}`}
      style={starStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onClick?.(person.id)}
    >
      <div className="star__core" />
      <div className="star__aberration star__aberration--red" />
      <div className="star__aberration star__aberration--blue" />
      <div className="star__glow" />
      
      {person.is_deceased && (
        <div className="star__halo" />
      )}
      
      {isHovered && (
        <div className="star__label">
          {person.name}
          {person.nickname && <span className="star__label-nickname"> "{person.nickname}"</span>}
        </div>
      )}
    </div>
  );
};

// Constellation Lines - Only shown on interaction
const ConstellationLines = ({ connections, stars }) => {
  if (!connections || connections.length === 0) return null;

  return (
    <svg className="constellation-lines" style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%',
      pointerEvents: 'none',
      zIndex: 5
    }}>
      {connections.map(({ from, to }, idx) => {
        const starFrom = stars.find(s => s.person.id === from);
        const starTo = stars.find(s => s.person.id === to);
        
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

  // Create stars with natural scattered positioning
  const stars = useMemo(() => {
    // Separate deceased (ancestors) from living
    const deceased = people.filter(p => p.is_deceased);
    const living = people.filter(p => !p.is_deceased);

    const starsArray = [];

    // Place ancestors in center area
    deceased.forEach((person, index) => {
      const angle = (index / deceased.length) * Math.PI * 2;
      const radius = 8 + Math.random() * 12; // Tighter center cluster
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;

      starsArray.push({
        person,
        x: x + (Math.random() - 0.5) * 3,
        y: y + (Math.random() - 0.5) * 3,
        size: 1.2, // Ancestors slightly larger
        colorTemp: 7500, // Cooler, bluer
        intensity: 0.9
      });
    });

    // Scatter living family across the sky
    living.forEach((person, index) => {
      const angle = (index / living.length) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 25 + Math.random() * 35; // Spread across sky
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;

      const sizeMap = { adult: 1, teen: 0.85, child: 0.7 };
      const size = sizeMap[person.role_type] || 1;

      // Color temperature based on household for subtle variety
      const hash = (person.household_id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const tempOptions = [5500, 6000, 5800, 6200, 6500];
      const colorTemp = tempOptions[hash % tempOptions.length];

      const intensity = (person.star_intensity || 5) / 10;

      starsArray.push({
        person,
        x: Math.max(5, Math.min(95, x)),
        y: Math.max(5, Math.min(95, y)),
        size,
        colorTemp,
        intensity
      });
    });

    return starsArray;
  }, [people]);

  // Build connections only for active/hovered star
  const activeConnections = useMemo(() => {
    const targetId = activeStarId || hoveredStarId;
    if (!targetId) return [];

    const conns = [];
    const activePerson = people.find(p => p.id === targetId);

    // Household connections
    if (activePerson?.household_id) {
      people.forEach(p => {
        if (p.household_id === activePerson.household_id && p.id !== targetId) {
          conns.push({ from: targetId, to: p.id });
        }
      });
    }

    // Relationship connections
    relationships.forEach(rel => {
      if (rel.person_id === targetId) {
        conns.push({ from: targetId, to: rel.related_person_id });
      } else if (rel.related_person_id === targetId) {
        conns.push({ from: targetId, to: rel.person_id });
      }
    });

    return conns;
  }, [activeStarId, hoveredStarId, people, relationships]);

  const activeStar = stars.find(s => s.person.id === activeStarId);

  return (
    <div className="nashiverse">
      {/* Deep space background */}
      <div className="nashiverse__background" />
      
      {/* Distant stars backdrop */}
      <div className="nashiverse__distant-stars" />
      
      {/* Nebula clouds */}
      <div className="nashiverse__nebula">
        <div className="nashiverse__nebula-cloud nashiverse__nebula-cloud--1" />
        <div className="nashiverse__nebula-cloud nashiverse__nebula-cloud--2" />
        <div className="nashiverse__nebula-cloud nashiverse__nebula-cloud--3" />
      </div>

      {/* Constellation lines - only on interaction */}
      <ConstellationLines connections={activeConnections} stars={stars} />

      {/* Stars - people */}
      {stars.map((star) => (
        <Star
          key={star.person.id}
          person={star.person}
          x={star.x}
          y={star.y}
          size={star.size}
          colorTemp={star.colorTemp}
          intensity={star.intensity}
          isActive={star.person.id === activeStarId}
          isConnected={activeConnections.some(c => c.from === star.person.id || c.to === star.person.id)}
          onHover={setHoveredStarId}
          onLeave={() => setHoveredStarId(null)}
          onClick={setActiveStarId}
        />
      ))}

      {/* Context Panel */}
      {activeStar && (
        <div className="context-panel">
          <div className="context-panel__header">
            <div className="context-panel__avatar">
              {activeStar.person.photo_url ? (
                <img src={activeStar.person.photo_url} alt="" />
              ) : (
                <span>{activeStar.person.name?.charAt(0)}</span>
              )}
            </div>
            <div className="flex-1">
              <h3>{activeStar.person.name}</h3>
              {activeStar.person.nickname && (
                <p className="context-panel__nickname">"{activeStar.person.nickname}"</p>
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
              <span className="capitalize">{activeStar.person.role_type}</span>
            </div>

            {activeStar.person.household_id && households && (
              <div className="context-panel__field">
                <span>Household:</span>
                <span>{households.find(h => h.id === activeStar.person.household_id)?.name || 'Unknown'}</span>
              </div>
            )}
            
            {activeStar.person.birth_date && (
              <div className="context-panel__field">
                <span>Birth Date:</span>
                <span>{activeStar.person.birth_date}</span>
              </div>
            )}

            {activeStar.person.allergies?.length > 0 && (
              <div className="context-panel__field context-panel__field--full">
                <p className="context-panel__label">Allergies:</p>
                <p className="text-red-400">{activeStar.person.allergies.join(', ')}</p>
              </div>
            )}

            {activeStar.person.dietary_preferences?.length > 0 && (
              <div className="context-panel__field context-panel__field--full">
                <p className="context-panel__label">Dietary:</p>
                <p>{activeStar.person.dietary_preferences.join(', ')}</p>
              </div>
            )}

            {activeStar.person.about && (
              <div className="context-panel__field context-panel__field--full">
                <p className="context-panel__label">About:</p>
                <p>{activeStar.person.about}</p>
              </div>
            )}

            {activeStar.person.is_deceased && (
              <div className="context-panel__memorial">
                ⭐ In loving memory
                {activeStar.person.death_date && ` • ${activeStar.person.death_date}`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}