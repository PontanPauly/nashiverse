import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force-3d';
import { StarInstanced } from './Star';
import { DEFAULT_STAR_PROFILE, generateRandomStarProfile } from '@/lib/starConfig';

const seededRandom = (seed) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
};

function useForceLayout(people, relationships, households) {
  return useMemo(() => {
    if (!people || people.length === 0) return [];
    
    const nodes = people.map((person) => {
      const seed = person.id;
      return {
        id: person.id,
        person,
        x: (seededRandom(seed + '-x') - 0.5) * 10,
        y: (seededRandom(seed + '-y') - 0.5) * 10,
        z: (seededRandom(seed + '-z') - 0.5) * 10,
        fx: null,
        fy: null,
        fz: null,
      };
    });
    
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    const links = [];
    
    const partnerPairs = new Set();
    relationships.forEach(rel => {
      if (rel.relationship_type === 'partner' || rel.relationship_type === 'spouse') {
        const pairKey = [rel.person_id, rel.related_person_id].sort().join('-');
        if (!partnerPairs.has(pairKey) && nodeMap.has(rel.person_id) && nodeMap.has(rel.related_person_id)) {
          partnerPairs.add(pairKey);
          links.push({
            source: rel.person_id,
            target: rel.related_person_id,
            type: 'partner',
            strength: 2.0,
            distance: 0.8,
          });
        }
      }
    });
    
    relationships.forEach(rel => {
      if (rel.relationship_type === 'parent' && nodeMap.has(rel.person_id) && nodeMap.has(rel.related_person_id)) {
        links.push({
          source: rel.person_id,
          target: rel.related_person_id,
          type: 'parent-child',
          strength: 1.0,
          distance: 2.0,
        });
      }
    });
    
    const householdGroups = new Map();
    people.forEach(person => {
      if (person.household_id) {
        if (!householdGroups.has(person.household_id)) {
          householdGroups.set(person.household_id, []);
        }
        householdGroups.get(person.household_id).push(person.id);
      }
    });
    
    householdGroups.forEach((memberIds) => {
      for (let i = 0; i < memberIds.length; i++) {
        for (let j = i + 1; j < memberIds.length; j++) {
          const existingLink = links.find(l => 
            (l.source === memberIds[i] && l.target === memberIds[j]) ||
            (l.source === memberIds[j] && l.target === memberIds[i])
          );
          if (!existingLink && nodeMap.has(memberIds[i]) && nodeMap.has(memberIds[j])) {
            links.push({
              source: memberIds[i],
              target: memberIds[j],
              type: 'household',
              strength: 0.8,
              distance: 1.5,
            });
          }
        }
      }
    });
    
    const simulation = forceSimulation(nodes, 3)
      .force('charge', forceManyBody().strength(-0.5))
      .force('link', forceLink(links)
        .id(d => d.id)
        .strength(d => d.strength * 0.3)
        .distance(d => d.distance)
      )
      .force('center', forceCenter(0, 0, 0).strength(0.05))
      .force('collision', forceCollide().radius(0.5).strength(0.8))
      .stop();
    
    for (let i = 0; i < 300; i++) {
      simulation.tick();
    }
    
    const positions = new Map();
    nodes.forEach(node => {
      positions.set(node.id, {
        x: node.x,
        y: node.y,
        z: node.z,
      });
    });
    
    return { positions, links };
  }, [people, relationships, households]);
}

function ConnectionLines({ links, positions, focusedId, hoveredId }) {
  const linesRef = useRef();
  
  const visibleLinks = useMemo(() => {
    if (!focusedId && !hoveredId) return [];
    
    const activeId = focusedId || hoveredId;
    return links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return sourceId === activeId || targetId === activeId;
    });
  }, [links, focusedId, hoveredId]);
  
  if (visibleLinks.length === 0) return null;
  
  return (
    <group ref={linesRef}>
      {visibleLinks.map((link, i) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        const sourcePos = positions.get(sourceId);
        const targetPos = positions.get(targetId);
        
        if (!sourcePos || !targetPos) return null;
        
        const points = [
          new THREE.Vector3(sourcePos.x, sourcePos.y, sourcePos.z),
          new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z),
        ];
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        let color = '#FBBF24';
        let opacity = 0.3;
        
        if (link.type === 'partner') {
          color = '#EC4899';
          opacity = 0.5;
        } else if (link.type === 'parent-child') {
          color = '#60A5FA';
          opacity = 0.4;
        } else if (link.type === 'household') {
          color = '#34D399';
          opacity = 0.25;
        }
        
        return (
          <line key={i} geometry={geometry}>
            <lineBasicMaterial 
              color={color} 
              transparent 
              opacity={opacity}
              blending={THREE.AdditiveBlending}
            />
          </line>
        );
      })}
    </group>
  );
}

function CameraController({ focusedPosition, resetTrigger }) {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));
  const positionRef = useRef(new THREE.Vector3(0, 0, 15));
  
  useEffect(() => {
    if (focusedPosition) {
      targetRef.current.set(focusedPosition.x, focusedPosition.y, focusedPosition.z);
      positionRef.current.set(
        focusedPosition.x + 2,
        focusedPosition.y + 1,
        focusedPosition.z + 5
      );
    } else {
      targetRef.current.set(0, 0, 0);
      positionRef.current.set(0, 0, 15);
    }
  }, [focusedPosition, resetTrigger]);
  
  useFrame(() => {
    camera.position.lerp(positionRef.current, 0.05);
    
    const currentTarget = new THREE.Vector3();
    camera.getWorldDirection(currentTarget);
    currentTarget.multiplyScalar(10).add(camera.position);
    currentTarget.lerp(targetRef.current, 0.05);
  });
  
  return null;
}

function StarLabel({ person, position, visible }) {
  if (!visible) return null;
  
  return (
    <Html
      position={[position.x, position.y + 0.5, position.z]}
      center
      style={{
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s',
      }}
    >
      <div className="px-3 py-1.5 rounded-lg bg-slate-900/95 border border-amber-500/30 backdrop-blur-md shadow-xl whitespace-nowrap">
        <div className="text-sm font-medium text-white">{person.name}</div>
        {person.nickname && (
          <div className="text-xs text-amber-400">"{person.nickname}"</div>
        )}
      </div>
    </Html>
  );
}

function GalaxyScene({ 
  people, 
  relationships, 
  households,
  hoveredId,
  focusedId,
  onStarClick,
  onStarHover,
  onBackgroundClick,
  resetTrigger,
}) {
  const { positions, links } = useForceLayout(people, relationships, households);
  
  const stars = useMemo(() => {
    return people.map(person => {
      const pos = positions.get(person.id) || { x: 0, y: 0, z: 0 };
      return {
        id: person.id,
        person,
        position: [pos.x, pos.y, pos.z],
        starProfile: person.star_profile || generateRandomStarProfile(person.id),
      };
    });
  }, [people, positions]);
  
  const focusedPosition = useMemo(() => {
    if (!focusedId) return null;
    return positions.get(focusedId);
  }, [focusedId, positions]);
  
  const handleBackgroundClick = useCallback((e) => {
    if (e.object?.type === 'Mesh') return;
    onBackgroundClick?.();
  }, [onBackgroundClick]);
  
  return (
    <>
      <CameraController 
        focusedPosition={focusedPosition}
        resetTrigger={resetTrigger}
      />
      
      <ambientLight intensity={0.1} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      
      <Stars
        radius={100}
        depth={50}
        count={2000}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />
      
      <ConnectionLines 
        links={links}
        positions={positions}
        focusedId={focusedId}
        hoveredId={hoveredId}
      />
      
      <StarInstanced
        stars={stars}
        onStarClick={onStarClick}
        onStarHover={onStarHover}
        hoveredId={hoveredId}
        focusedId={focusedId}
      />
      
      {stars.map(star => {
        const pos = positions.get(star.id);
        if (!pos) return null;
        return (
          <StarLabel
            key={star.id}
            person={star.person}
            position={pos}
            visible={hoveredId === star.id || focusedId === star.id}
          />
        );
      })}
      
      <mesh 
        visible={false}
        onClick={handleBackgroundClick}
      >
        <sphereGeometry args={[100, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>
      
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={50}
        autoRotate={!focusedId && !hoveredId}
        autoRotateSpeed={0.2}
      />
    </>
  );
}

export default function GalaxyView({ people = [], relationships = [], households = [] }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const [resetTrigger, setResetTrigger] = useState(0);
  
  const handleStarClick = useCallback((star) => {
    setFocusedId(prev => prev === star.id ? null : star.id);
  }, []);
  
  const handleStarHover = useCallback((id) => {
    setHoveredId(id);
  }, []);
  
  const handleBackgroundClick = useCallback(() => {
    setFocusedId(null);
    setResetTrigger(prev => prev + 1);
  }, []);
  
  const focusedPerson = useMemo(() => {
    if (!focusedId) return null;
    return people.find(p => p.id === focusedId);
  }, [focusedId, people]);
  
  if (!people || people.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#000000] via-[#020206] to-[#030308]">
        <p className="text-slate-500">No family members yet</p>
      </div>
    );
  }
  
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 15], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'linear-gradient(to bottom, #000000, #020206, #030308)' }}
      >
        <GalaxyScene
          people={people}
          relationships={relationships}
          households={households}
          hoveredId={hoveredId}
          focusedId={focusedId}
          onStarClick={handleStarClick}
          onStarHover={handleStarHover}
          onBackgroundClick={handleBackgroundClick}
          resetTrigger={resetTrigger}
        />
      </Canvas>
      
      {focusedPerson && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[480px] max-w-[calc(100vw-2rem)] glass-card rounded-2xl p-6 border border-amber-500/30 z-50 animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-amber-500/30">
                {focusedPerson.photo_url ? (
                  <img src={focusedPerson.photo_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <span className="text-xl text-slate-400">{focusedPerson.name?.charAt(0)}</span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{focusedPerson.name}</h3>
                {focusedPerson.nickname && (
                  <p className="text-sm text-amber-400 mt-0.5">"{focusedPerson.nickname}"</p>
                )}
                <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {focusedPerson.role_type}
                </span>
              </div>
            </div>
            <button 
              onClick={handleBackgroundClick}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {focusedPerson.about && (
            <p className="text-sm text-slate-400 mt-4 leading-relaxed">{focusedPerson.about}</p>
          )}
          
          {focusedPerson.household_id && households && (
            <p className="text-xs text-slate-500 mt-3">
              {households.find(h => h.id === focusedPerson.household_id)?.name}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
