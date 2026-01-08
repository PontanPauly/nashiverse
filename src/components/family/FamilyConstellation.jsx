import React, { useMemo, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Star Component - Performance-disciplined, static by default
const Star = ({ 
  id,
  data,
  x, 
  y, 
  size = 1, 
  isActive,
  isConnected,
  onHover,
  onLeave,
  onClick 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getStarColors = (householdId) => {
    if (!householdId) return { r: 240, g: 245, b: 255 };
    const palettes = [
      { r: 254, g: 243, b: 199 },
      { r: 219, g: 234, b: 254 },
      { r: 243, g: 232, b: 255 },
      { r: 252, g: 231, b: 243 },
      { r: 209, g: 250, b: 229 },
      { r: 254, g: 215, b: 170 },
    ];
    const hash = householdId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return palettes[hash % palettes.length];
  };

  // Static optical imperfections (calculated once per star)
  const optics = useMemo(() => ({
    driftX: (Math.random() - 0.5) * 2,
    driftY: (Math.random() - 0.5) * 2,
    blur: (Math.random() * 0.4 + 0.3).toFixed(2)
  }), [id]);

  const color = getStarColors(data.household_id);
  const baseSize = 8 + (size * 8);
  const glowSize = baseSize * 2.5;
  const intensity = (data.star_intensity || 5) / 10;

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
      
      {data.is_deceased && (
        <div className="star__deceased" />
      )}
      
      {(isHovered || isActive) && (
        <div className="star__label">
          <p className="star__label-name">{data.name}</p>
          {data.nickname && <p className="star__label-nickname">"{data.nickname}"</p>}
        </div>
      )}
    </div>
  );
};

// Constellation Lines Component
const ConstellationLines = ({ connections, stars, activeStarId, hoveredStarId }) => {
  if (!connections || connections.length === 0) return null;

  return (
    <svg className="constellation-lines" style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%',
      pointerEvents: 'none',
      zIndex: 1
    }}>
      {connections.map(({ from, to }, idx) => {
        const starFrom = stars.find(s => s.id === from);
        const starTo = stars.find(s => s.id === to);
        
        if (!starFrom || !starTo) return null;

        const isHighlighted = hoveredStarId === from || hoveredStarId === to || 
                             activeStarId === from || activeStarId === to;

        return (
          <line
            key={`${from}-${to}-${idx}`}
            x1={`${starFrom.x}%`}
            y1={`${starFrom.y}%`}
            x2={`${starTo.x}%`}
            y2={`${starTo.y}%`}
            className={`constellation-line ${isHighlighted ? 'constellation-line--highlight' : ''}`}
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

  // Transform people data into star positions
  const stars = useMemo(() => {
    const householdGroups = {};
    
    // Group people by household
    people.forEach(person => {
      const householdId = person.household_id || 'unassigned';
      if (!householdGroups[householdId]) {
        householdGroups[householdId] = [];
      }
      householdGroups[householdId].push(person);
    });

    const starsArray = [];
    const totalGroups = Object.keys(householdGroups).length;

    // Create organic constellation clusters
    Object.entries(householdGroups).forEach(([householdId, groupPeople], groupIndex) => {
      // Position household clusters in a spiral galaxy pattern
      const spiralAngle = groupIndex * 1.618 * Math.PI; // Golden angle
      const spiralRadius = 15 + groupIndex * 12;
      
      const clusterCenterX = 50 + Math.cos(spiralAngle) * spiralRadius;
      const clusterCenterY = 50 + Math.sin(spiralAngle) * spiralRadius;

      // Create constellation shape for each household
      groupPeople.forEach((person, index) => {
        let x, y;
        
        if (groupPeople.length === 1) {
          x = clusterCenterX;
          y = clusterCenterY;
        } else if (groupPeople.length === 2) {
          const offset = 6;
          x = clusterCenterX + (index === 0 ? -offset : offset);
          y = clusterCenterY;
        } else if (groupPeople.length <= 5) {
          const angle = (index / groupPeople.length) * Math.PI * 2 - Math.PI / 2;
          const radius = 8;
          x = clusterCenterX + Math.cos(angle) * radius;
          y = clusterCenterY + Math.sin(angle) * radius;
        } else {
          const ring = Math.floor(index / 6);
          const posInRing = index % 6;
          const totalInRing = Math.min(6, groupPeople.length - ring * 6);
          const angle = (posInRing / totalInRing) * Math.PI * 2;
          const radius = 8 + ring * 6;
          x = clusterCenterX + Math.cos(angle) * radius;
          y = clusterCenterY + Math.sin(angle) * radius;
        }
        
        // Add slight organic variation
        x += (Math.random() - 0.5) * 2;
        y += (Math.random() - 0.5) * 2;
        
        // Get size based on role
        const sizeMap = { 'adult': 1, 'teen': 0.85, 'child': 0.7, 'ancestor': 1.2 };
        const size = sizeMap[person.role_type] || 1;
        
        starsArray.push({
          id: person.id,
          data: person,
          x: Math.max(5, Math.min(95, x)),
          y: Math.max(5, Math.min(95, y)),
          size,
        });
      });
    });

    return starsArray;
  }, [people, households]);

  // Create connections for constellation lines
  const connections = useMemo(() => {
    const conns = [];
    
    // Household connections
    const householdGroups = {};
    people.forEach(person => {
      const householdId = person.household_id || 'unassigned';
      if (!householdGroups[householdId]) {
        householdGroups[householdId] = [];
      }
      householdGroups[householdId].push(person);
    });
    
    Object.values(householdGroups).forEach(groupPeople => {
      if (groupPeople.length > 1) {
        for (let i = 0; i < groupPeople.length; i++) {
          for (let j = i + 1; j < groupPeople.length; j++) {
            conns.push({
              from: groupPeople[i].id,
              to: groupPeople[j].id,
              type: 'household'
            });
          }
        }
      }
    });
    
    // Relationship connections
    relationships.forEach(rel => {
      conns.push({
        from: rel.person_id,
        to: rel.related_person_id,
        type: rel.relationship_type
      });
    });

    return conns;
  }, [relationships, people]);

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
    <div className="nashiverse">
      {/* Deep space background */}
      <div className="nashiverse__background" />
      
      {/* Distant stars */}
      <div className="nashiverse__distant-stars" />
      
      {/* Nebula clouds */}
      <div className="nashiverse__nebula">
        <div className="nashiverse__nebula-cloud nashiverse__nebula-cloud--1" />
        <div className="nashiverse__nebula-cloud nashiverse__nebula-cloud--2" />
        <div className="nashiverse__nebula-cloud nashiverse__nebula-cloud--3" />
      </div>

      <ConstellationLines 
        connections={connections} 
        stars={stars}
        activeStarId={activeStarId}
        hoveredStarId={hoveredStarId}
      />
      
      {stars.map(star => (
        <Star
          key={star.id}
          {...star}
          isActive={star.id === activeStarId}
          isConnected={connections.some(c => c.from === star.id || c.to === star.id)}
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