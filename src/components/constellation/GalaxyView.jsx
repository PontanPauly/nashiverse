import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { forceSimulation, forceManyBody, forceCenter, forceCollide } from 'd3-force-3d';
import { StarInstanced } from './Star';
import HouseholdCluster, { HOUSEHOLD_COLORS } from './HouseholdCluster';
import { generateRandomStarProfile } from '@/lib/starConfig';
import { ChevronRight, ZoomIn, ZoomOut, RotateCcw, ArrowLeft, Home } from 'lucide-react';

const seededRandom = (seed) => {
  let hash = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
};

function useHouseholdForceLayout(households, people) {
  return useMemo(() => {
    if (!households || households.length === 0) return new Map();
    
    const householdMemberCounts = new Map();
    people.forEach(person => {
      if (person.household_id) {
        householdMemberCounts.set(
          person.household_id,
          (householdMemberCounts.get(person.household_id) || 0) + 1
        );
      }
    });
    
    const nodes = households.map((household) => {
      const seed = household.id;
      return {
        id: household.id,
        household,
        memberCount: householdMemberCounts.get(household.id) || 0,
        x: (seededRandom(seed + '-x') - 0.5) * 15,
        y: (seededRandom(seed + '-y') - 0.5) * 10,
        z: (seededRandom(seed + '-z') - 0.5) * 8,
      };
    });
    
    const simulation = forceSimulation(nodes, 3)
      .force('charge', forceManyBody().strength(-3))
      .force('center', forceCenter(0, 0, 0).strength(0.1))
      .force('collision', forceCollide().radius(3).strength(0.8))
      .stop();
    
    for (let i = 0; i < 200; i++) {
      simulation.tick();
    }
    
    const positions = new Map();
    nodes.forEach(node => {
      positions.set(node.id, {
        x: node.x,
        y: node.y,
        z: node.z,
        memberCount: node.memberCount,
      });
    });
    
    return positions;
  }, [households, people]);
}

function arrangeStarsInCircle(people, centerX = 0, centerY = 0, centerZ = 0) {
  const count = people.length;
  if (count === 0) return [];
  if (count === 1) {
    return [{
      ...people[0],
      position: [centerX, centerY, centerZ],
    }];
  }
  
  const radius = Math.max(1.5, count * 0.4);
  
  return people.map((person, index) => {
    const angle = (index / count) * Math.PI * 2;
    const layerOffset = (index % 2) * 0.3;
    
    return {
      ...person,
      position: [
        centerX + Math.cos(angle) * radius,
        centerY + layerOffset,
        centerZ + Math.sin(angle) * radius,
      ],
    };
  });
}

function SystemConnectionLines({ people, relationships }) {
  const lines = useMemo(() => {
    const peopleMap = new Map(people.map(p => [p.id, p]));
    const connections = [];
    
    relationships.forEach(rel => {
      const source = peopleMap.get(rel.person_id);
      const target = peopleMap.get(rel.related_person_id);
      
      if (source && target && source.position && target.position) {
        let color = '#FBBF24';
        let opacity = 0.3;
        
        if (rel.relationship_type === 'partner' || rel.relationship_type === 'spouse') {
          color = '#EC4899';
          opacity = 0.5;
        } else if (rel.relationship_type === 'parent') {
          color = '#60A5FA';
          opacity = 0.4;
        } else if (rel.relationship_type === 'sibling') {
          color = '#34D399';
          opacity = 0.35;
        }
        
        connections.push({
          source: source.position,
          target: target.position,
          color,
          opacity,
        });
      }
    });
    
    return connections;
  }, [people, relationships]);
  
  return (
    <group>
      {lines.map((line, i) => {
        const points = [
          new THREE.Vector3(...line.source),
          new THREE.Vector3(...line.target),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        return (
          <line key={i} geometry={geometry}>
            <lineBasicMaterial
              color={line.color}
              transparent
              opacity={line.opacity}
              blending={THREE.AdditiveBlending}
            />
          </line>
        );
      })}
    </group>
  );
}

function HouseholdLabel({ position, name, visible }) {
  if (!visible) return null;
  
  return (
    <Html
      position={[position.x, position.y + 1.5, position.z]}
      center
      style={{ pointerEvents: 'none' }}
    >
      <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-600/50 backdrop-blur-md shadow-xl whitespace-nowrap">
        <div className="text-sm font-medium text-white">{name}</div>
      </div>
    </Html>
  );
}

function CameraController({ 
  level, 
  targetPosition, 
  controlsRef,
  onTransitionComplete 
}) {
  const { camera } = useThree();
  const targetCamPos = useRef(new THREE.Vector3(0, 0, 20));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const isAnimating = useRef(false);
  const animationProgress = useRef(0);
  
  useEffect(() => {
    if (level === 'galaxy') {
      targetCamPos.current.set(0, 5, 25);
      targetLookAt.current.set(0, 0, 0);
    } else if (level === 'system' && targetPosition) {
      targetCamPos.current.set(
        targetPosition.x,
        targetPosition.y + 3,
        targetPosition.z + 8
      );
      targetLookAt.current.set(
        targetPosition.x,
        targetPosition.y,
        targetPosition.z
      );
    }
    isAnimating.current = true;
    animationProgress.current = 0;
  }, [level, targetPosition]);
  
  useFrame(() => {
    if (isAnimating.current) {
      animationProgress.current += 0.02;
      
      camera.position.lerp(targetCamPos.current, 0.04);
      
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetLookAt.current, 0.04);
      }
      
      const distance = camera.position.distanceTo(targetCamPos.current);
      if (distance < 0.1) {
        isAnimating.current = false;
        onTransitionComplete?.();
      }
    }
  });
  
  return null;
}

function GalaxyLevelScene({
  households,
  householdPositions,
  hoveredHouseholdId,
  onHouseholdClick,
  onHouseholdHover,
}) {
  return (
    <group>
      {households.map((household, index) => {
        const pos = householdPositions.get(household.id);
        if (!pos) return null;
        
        return (
          <React.Fragment key={household.id}>
            <HouseholdCluster
              position={[pos.x, pos.y, pos.z]}
              household={household}
              memberCount={pos.memberCount}
              colorIndex={index}
              isHovered={hoveredHouseholdId === household.id}
              onClick={() => onHouseholdClick(household)}
              onPointerOver={() => onHouseholdHover(household.id)}
              onPointerOut={() => onHouseholdHover(null)}
            />
            <HouseholdLabel
              position={pos}
              name={household.name}
              visible={true}
            />
          </React.Fragment>
        );
      })}
    </group>
  );
}

function SystemLevelScene({
  household,
  people,
  relationships,
  hoveredStarId,
  focusedStarId,
  onStarClick,
  onStarHover,
}) {
  const householdPeople = useMemo(() => {
    return people.filter(p => p.household_id === household?.id);
  }, [people, household]);
  
  const householdRelationships = useMemo(() => {
    const peopleIds = new Set(householdPeople.map(p => p.id));
    return relationships.filter(r => 
      peopleIds.has(r.person_id) && peopleIds.has(r.related_person_id)
    );
  }, [householdPeople, relationships]);
  
  const arrangedPeople = useMemo(() => {
    return arrangeStarsInCircle(householdPeople);
  }, [householdPeople]);
  
  const stars = useMemo(() => {
    return arrangedPeople.map(person => ({
      id: person.id,
      person,
      position: person.position,
      starProfile: person.star_profile || generateRandomStarProfile(person.id),
    }));
  }, [arrangedPeople]);
  
  return (
    <group>
      <SystemConnectionLines
        people={arrangedPeople}
        relationships={householdRelationships}
      />
      
      <StarInstanced
        stars={stars}
        onStarClick={onStarClick}
        onStarHover={onStarHover}
        hoveredId={hoveredStarId}
        focusedId={focusedStarId}
      />
      
      {stars.map(star => (
        <Html
          key={star.id}
          position={[star.position[0], star.position[1] + 0.6, star.position[2]]}
          center
          style={{ 
            pointerEvents: 'none',
            opacity: hoveredStarId === star.id || focusedStarId === star.id ? 1 : 0.7,
            transition: 'opacity 0.2s',
          }}
        >
          <div className="px-2 py-1 rounded bg-slate-900/80 border border-slate-600/30 backdrop-blur-sm whitespace-nowrap">
            <div className="text-xs font-medium text-white">{star.person.name}</div>
          </div>
        </Html>
      ))}
    </group>
  );
}

function GalaxyScene({
  level,
  households,
  people,
  relationships,
  selectedHousehold,
  householdPositions,
  hoveredHouseholdId,
  hoveredStarId,
  focusedStarId,
  onHouseholdClick,
  onHouseholdHover,
  onStarClick,
  onStarHover,
  onBackgroundClick,
  controlsRef,
  zoomIn,
  zoomOut,
}) {
  const selectedHouseholdPosition = useMemo(() => {
    if (!selectedHousehold) return null;
    return householdPositions.get(selectedHousehold.id);
  }, [selectedHousehold, householdPositions]);
  
  return (
    <>
      <CameraController
        level={level}
        targetPosition={selectedHouseholdPosition}
        controlsRef={controlsRef}
      />
      
      <ambientLight intensity={0.15} />
      <pointLight position={[10, 10, 10]} intensity={0.4} />
      <pointLight position={[-10, -10, -10]} intensity={0.2} color="#4060ff" />
      
      <Stars
        radius={150}
        depth={60}
        count={3000}
        factor={4}
        saturation={0}
        fade
        speed={0.3}
      />
      
      {level === 'galaxy' && (
        <GalaxyLevelScene
          households={households}
          householdPositions={householdPositions}
          hoveredHouseholdId={hoveredHouseholdId}
          onHouseholdClick={onHouseholdClick}
          onHouseholdHover={onHouseholdHover}
        />
      )}
      
      {level === 'system' && selectedHousehold && (
        <SystemLevelScene
          household={selectedHousehold}
          people={people}
          relationships={relationships}
          hoveredStarId={hoveredStarId}
          focusedStarId={focusedStarId}
          onStarClick={onStarClick}
          onStarHover={onStarHover}
        />
      )}
      
      <mesh
        visible={false}
        onClick={onBackgroundClick}
      >
        <sphereGeometry args={[200, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>
      
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        enableDamping={true}
        dampingFactor={0.05}
        minDistance={level === 'system' ? 3 : 8}
        maxDistance={level === 'system' ? 20 : 60}
        autoRotate={level === 'galaxy' && !hoveredHouseholdId}
        autoRotateSpeed={0.15}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        panSpeed={0.5}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.9}
      />
    </>
  );
}

function NavigationUI({
  level,
  selectedHousehold,
  onBackToGalaxy,
  onResetView,
  onZoomIn,
  onZoomOut,
}) {
  return (
    <>
      <div className="absolute top-4 left-4 z-50">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700/50 backdrop-blur-md">
          <button
            onClick={onBackToGalaxy}
            className={`flex items-center gap-1 text-sm transition-colors ${
              level === 'galaxy' 
                ? 'text-amber-400 font-medium' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            Galaxy
          </button>
          
          {level === 'system' && selectedHousehold && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-600" />
              <span className="text-sm text-amber-400 font-medium">
                {selectedHousehold.name}
              </span>
            </>
          )}
        </div>
      </div>
      
      {level === 'system' && (
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={onBackToGalaxy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/90 border border-slate-600/50 backdrop-blur-md text-white hover:bg-slate-700/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Galaxy
          </button>
        </div>
      )}
      
      <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2">
        <button
          onClick={onZoomIn}
          className="p-3 rounded-lg bg-slate-800/90 border border-slate-600/50 backdrop-blur-md text-white hover:bg-slate-700/90 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={onZoomOut}
          className="p-3 rounded-lg bg-slate-800/90 border border-slate-600/50 backdrop-blur-md text-white hover:bg-slate-700/90 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={onResetView}
          className="p-3 rounded-lg bg-slate-800/90 border border-slate-600/50 backdrop-blur-md text-white hover:bg-slate-700/90 transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>
    </>
  );
}

function PersonDetailPanel({ person, household, onClose }) {
  if (!person) return null;
  
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[480px] max-w-[calc(100vw-2rem)] glass-card rounded-2xl p-6 border border-amber-500/30 z-50 animate-in slide-in-from-bottom duration-300">
      <div className="flex justify-between items-start">
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-amber-500/30">
            {person.photo_url ? (
              <img src={person.photo_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <span className="text-xl text-slate-400">{person.name?.charAt(0)}</span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{person.name}</h3>
            {person.nickname && (
              <p className="text-sm text-amber-400 mt-0.5">"{person.nickname}"</p>
            )}
            <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {person.role_type}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {person.about && (
        <p className="text-sm text-slate-400 mt-4 leading-relaxed">{person.about}</p>
      )}
      
      {household && (
        <p className="text-xs text-slate-500 mt-3">{household.name}</p>
      )}
    </div>
  );
}

export default function GalaxyView({ people = [], relationships = [], households = [], onPersonClick }) {
  const [level, setLevel] = useState('galaxy');
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [hoveredHouseholdId, setHoveredHouseholdId] = useState(null);
  const [hoveredStarId, setHoveredStarId] = useState(null);
  const [focusedStarId, setFocusedStarId] = useState(null);
  const controlsRef = useRef(null);
  
  const householdPositions = useHouseholdForceLayout(households, people);
  
  const handleHouseholdClick = useCallback((household) => {
    setSelectedHousehold(household);
    setLevel('system');
    setFocusedStarId(null);
  }, []);
  
  const handleBackToGalaxy = useCallback(() => {
    setLevel('galaxy');
    setSelectedHousehold(null);
    setFocusedStarId(null);
    setHoveredStarId(null);
  }, []);
  
  const handleStarClick = useCallback((star) => {
    if (focusedStarId === star.id) {
      onPersonClick?.(star.person);
    } else {
      setFocusedStarId(star.id);
    }
  }, [focusedStarId, onPersonClick]);
  
  const handleBackgroundClick = useCallback(() => {
    setFocusedStarId(null);
  }, []);
  
  const handleZoomIn = useCallback(() => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      camera.position.addScaledVector(direction, 2);
    }
  }, []);
  
  const handleZoomOut = useCallback(() => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      camera.position.addScaledVector(direction, -2);
    }
  }, []);
  
  const handleResetView = useCallback(() => {
    if (level === 'system') {
      handleBackToGalaxy();
    } else {
      if (controlsRef.current) {
        controlsRef.current.reset();
      }
    }
  }, [level, handleBackToGalaxy]);
  
  const focusedPerson = useMemo(() => {
    if (!focusedStarId) return null;
    return people.find(p => p.id === focusedStarId);
  }, [focusedStarId, people]);
  
  if (!people || people.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#000000] via-[#020206] to-[#030308]">
        <p className="text-slate-500">No family members yet</p>
      </div>
    );
  }
  
  if (!households || households.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#000000] via-[#020206] to-[#030308]">
        <p className="text-slate-500">No households created yet. Add households to see the galaxy view.</p>
      </div>
    );
  }
  
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 5, 25], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'linear-gradient(to bottom, #000000, #020206, #030308)' }}
      >
        <GalaxyScene
          level={level}
          households={households}
          people={people}
          relationships={relationships}
          selectedHousehold={selectedHousehold}
          householdPositions={householdPositions}
          hoveredHouseholdId={hoveredHouseholdId}
          hoveredStarId={hoveredStarId}
          focusedStarId={focusedStarId}
          onHouseholdClick={handleHouseholdClick}
          onHouseholdHover={setHoveredHouseholdId}
          onStarClick={handleStarClick}
          onStarHover={setHoveredStarId}
          onBackgroundClick={handleBackgroundClick}
          controlsRef={controlsRef}
          zoomIn={handleZoomIn}
          zoomOut={handleZoomOut}
        />
      </Canvas>
      
      <NavigationUI
        level={level}
        selectedHousehold={selectedHousehold}
        onBackToGalaxy={handleBackToGalaxy}
        onResetView={handleResetView}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />
      
      {level === 'system' && (
        <PersonDetailPanel
          person={focusedPerson}
          household={selectedHousehold}
          onClose={() => setFocusedStarId(null)}
        />
      )}
    </div>
  );
}
