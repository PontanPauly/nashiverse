import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
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
        x: (seededRandom(seed + '-x') - 0.5) * 8,
        y: (seededRandom(seed + '-y') - 0.5) * 5,
        z: (seededRandom(seed + '-z') - 0.5) * 6,
      };
    });
    
    const simulation = forceSimulation(nodes, 3)
      .force('charge', forceManyBody().strength(-8))
      .force('center', forceCenter(0, 0, 0).strength(0.15))
      .force('collision', forceCollide().radius(4).strength(0.9))
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

function arrangeStarsInSpiral(people, centerX = 0, centerY = 0, centerZ = 0) {
  const count = people.length;
  if (count === 0) return [];
  if (count === 1) {
    return [{
      ...people[0],
      position: [centerX + 1.5, centerY, centerZ],
    }];
  }
  
  const baseRadius = 2;
  const spiralTightness = 0.4;
  const verticalSpread = 0.3;
  
  return people.map((person, index) => {
    const angle = (index / count) * Math.PI * 2 * 1.5;
    const radiusOffset = index * spiralTightness;
    const radius = baseRadius + radiusOffset;
    const yOffset = Math.sin(angle * 0.5) * verticalSpread + (index % 2) * 0.2;
    
    return {
      ...person,
      position: [
        centerX + Math.cos(angle) * radius,
        centerY + yOffset,
        centerZ + Math.sin(angle) * radius,
      ],
    };
  });
}

function GalaxyBackground() {
  const meshRef = useRef();
  
  const gradientMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec3 vPosition;
        
        float hash(vec3 p) {
          return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        }
        
        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          
          float a = hash(i);
          float b = hash(i + vec3(1.0, 0.0, 0.0));
          float c = hash(i + vec3(0.0, 1.0, 0.0));
          float d = hash(i + vec3(1.0, 1.0, 0.0));
          float e = hash(i + vec3(0.0, 0.0, 1.0));
          float f1 = hash(i + vec3(1.0, 0.0, 1.0));
          float g = hash(i + vec3(0.0, 1.0, 1.0));
          float h = hash(i + vec3(1.0, 1.0, 1.0));
          
          return mix(
            mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
            mix(mix(e, f1, f.x), mix(g, h, f.x), f.y),
            f.z
          );
        }
        
        void main() {
          vec3 dir = normalize(vPosition);
          
          float n1 = noise(dir * 3.0 + time * 0.02);
          float n2 = noise(dir * 5.0 - time * 0.01);
          float n3 = noise(dir * 8.0 + time * 0.015);
          
          vec3 deepBlue = vec3(0.02, 0.02, 0.08);
          vec3 purple = vec3(0.1, 0.02, 0.15);
          vec3 magenta = vec3(0.15, 0.02, 0.1);
          vec3 darkTeal = vec3(0.01, 0.05, 0.08);
          
          float yFactor = (dir.y + 1.0) * 0.5;
          vec3 baseColor = mix(deepBlue, purple, yFactor);
          baseColor = mix(baseColor, darkTeal, n1 * 0.4);
          baseColor = mix(baseColor, magenta, n2 * 0.2);
          
          float nebulaIntensity = pow(n3, 2.0) * 0.15;
          vec3 nebulaColor = vec3(0.2, 0.1, 0.3);
          baseColor += nebulaColor * nebulaIntensity;
          
          gl_FragColor = vec4(baseColor, 1.0);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
      side: THREE.BackSide,
    });
  }, []);
  
  useFrame((state) => {
    gradientMaterial.uniforms.time.value = state.clock.elapsedTime;
  });
  
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[200, 64, 64]} />
      <primitive object={gradientMaterial} attach="material" />
    </mesh>
  );
}

function ColorfulStarfield({ count = 8000 }) {
  const pointsRef = useRef();
  
  const { positions, colors, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    
    const starColors = [
      [1.0, 0.95, 0.8],
      [0.8, 0.85, 1.0],
      [1.0, 0.8, 0.6],
      [0.9, 0.7, 1.0],
      [0.7, 0.9, 1.0],
      [1.0, 1.0, 1.0],
    ];
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 80 + Math.random() * 100;
      
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
      
      const colorIndex = Math.floor(Math.random() * starColors.length);
      const brightness = 0.5 + Math.random() * 0.5;
      col[i * 3] = starColors[colorIndex][0] * brightness;
      col[i * 3 + 1] = starColors[colorIndex][1] * brightness;
      col[i * 3 + 2] = starColors[colorIndex][2] * brightness;
      
      const sizeFactor = Math.pow(Math.random(), 3);
      siz[i] = 0.5 + sizeFactor * 2.5;
    }
    
    return { positions: pos, colors: col, sizes: siz };
  }, [count]);
  
  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.005;
    }
  });
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={1.2}
        transparent
        opacity={0.9}
        vertexColors
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
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
        let opacity = 0.4;
        
        if (rel.relationship_type === 'partner' || rel.relationship_type === 'spouse') {
          color = '#EC4899';
          opacity = 0.6;
        } else if (rel.relationship_type === 'parent') {
          color = '#60A5FA';
          opacity = 0.5;
        } else if (rel.relationship_type === 'sibling') {
          color = '#34D399';
          opacity = 0.45;
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
              linewidth={2}
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
      position={[position.x, position.y + 3, position.z]}
      center
      style={{ pointerEvents: 'none' }}
    >
      <div className="px-4 py-2 rounded-xl bg-slate-900/90 border border-purple-500/30 backdrop-blur-md shadow-2xl whitespace-nowrap">
        <div className="text-sm font-medium text-white drop-shadow-lg">{name}</div>
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
  const targetCamPos = useRef(new THREE.Vector3(0, 15, 50));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const isAnimating = useRef(false);
  
  useEffect(() => {
    if (level === 'galaxy') {
      targetCamPos.current.set(0, 15, 50);
      targetLookAt.current.set(0, 0, 0);
    } else if (level === 'system' && targetPosition) {
      targetCamPos.current.set(
        targetPosition.x,
        targetPosition.y + 4,
        targetPosition.z + 10
      );
      targetLookAt.current.set(
        targetPosition.x,
        targetPosition.y,
        targetPosition.z
      );
    }
    isAnimating.current = true;
  }, [level, targetPosition]);
  
  useFrame(() => {
    if (isAnimating.current) {
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

function SystemNebulaBackdrop({ colors, scale }) {
  const meshRef = useRef();
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color1;
        uniform vec3 color2;
        uniform float time;
        varying vec2 vUv;
        
        float noise(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          
          float n = noise(vUv * 10.0 + time * 0.1);
          
          float alpha = smoothstep(0.5, 0.0, dist) * 0.3;
          alpha *= (0.7 + n * 0.3);
          
          vec3 color = mix(color1, color2, dist * 2.0);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      uniforms: {
        color1: { value: new THREE.Color(colors.primary) },
        color2: { value: new THREE.Color(colors.secondary) },
        time: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors]);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
    material.uniforms.time.value = state.clock.elapsedTime;
  });
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[scale * 3, scale * 3]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
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
  colorIndex = 0,
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
    return arrangeStarsInSpiral(householdPeople);
  }, [householdPeople]);
  
  const stars = useMemo(() => {
    return arrangedPeople.map(person => ({
      id: person.id,
      person,
      position: person.position,
      starProfile: person.star_profile || generateRandomStarProfile(person.id),
    }));
  }, [arrangedPeople]);
  
  const colors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  
  return (
    <group>
      <SystemNebulaBackdrop colors={colors} scale={12} />
      
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
          position={[star.position[0], star.position[1] + 0.8, star.position[2]]}
          center
          style={{ 
            pointerEvents: 'none',
            opacity: hoveredStarId === star.id || focusedStarId === star.id ? 1 : 0.8,
            transition: 'opacity 0.2s',
          }}
        >
          <div className="px-3 py-1.5 rounded-lg bg-slate-900/85 border border-slate-500/40 backdrop-blur-sm whitespace-nowrap shadow-lg">
            <div className="text-sm font-medium text-white">{star.person.name}</div>
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
}) {
  const selectedHouseholdPosition = useMemo(() => {
    if (!selectedHousehold) return null;
    return householdPositions.get(selectedHousehold.id);
  }, [selectedHousehold, householdPositions]);
  
  const selectedColorIndex = useMemo(() => {
    if (!selectedHousehold) return 0;
    return households.findIndex(h => h.id === selectedHousehold.id);
  }, [selectedHousehold, households]);
  
  return (
    <>
      <CameraController
        level={level}
        targetPosition={selectedHouseholdPosition}
        controlsRef={controlsRef}
      />
      
      <ambientLight intensity={0.1} />
      <pointLight position={[20, 20, 20]} intensity={0.3} color="#ffffff" />
      <pointLight position={[-20, -10, -20]} intensity={0.2} color="#8B5CF6" />
      <pointLight position={[0, 30, 0]} intensity={0.15} color="#3B82F6" />
      
      <GalaxyBackground />
      <ColorfulStarfield count={10000} />
      
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
          colorIndex={selectedColorIndex}
        />
      )}
      
      <mesh
        visible={false}
        onClick={onBackgroundClick}
      >
        <sphereGeometry args={[250, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>
      
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        enableDamping={true}
        dampingFactor={0.05}
        minDistance={level === 'system' ? 5 : 15}
        maxDistance={level === 'system' ? 25 : 80}
        autoRotate={level === 'galaxy' && !hoveredHouseholdId}
        autoRotateSpeed={0.1}
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
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/90 border border-purple-500/30 backdrop-blur-md">
          <button
            onClick={onBackToGalaxy}
            className={`flex items-center gap-1 text-sm transition-colors ${
              level === 'galaxy' 
                ? 'text-purple-400 font-medium' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            Galaxy
          </button>
          
          {level === 'system' && selectedHousehold && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-600" />
              <span className="text-sm text-purple-400 font-medium">
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/90 border border-purple-500/30 backdrop-blur-md text-white hover:bg-slate-700/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Galaxy
          </button>
        </div>
      )}
      
      <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2">
        <button
          onClick={onZoomIn}
          className="p-3 rounded-lg bg-slate-800/90 border border-purple-500/30 backdrop-blur-md text-white hover:bg-slate-700/90 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={onZoomOut}
          className="p-3 rounded-lg bg-slate-800/90 border border-purple-500/30 backdrop-blur-md text-white hover:bg-slate-700/90 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={onResetView}
          className="p-3 rounded-lg bg-slate-800/90 border border-purple-500/30 backdrop-blur-md text-white hover:bg-slate-700/90 transition-colors"
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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[480px] max-w-[calc(100vw-2rem)] glass-card rounded-2xl p-6 border border-purple-500/30 z-50 animate-in slide-in-from-bottom duration-300 bg-slate-900/95 backdrop-blur-xl">
      <div className="flex justify-between items-start">
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-purple-500/30">
            {person.photo_url ? (
              <img src={person.photo_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <span className="text-xl text-slate-400">{person.name?.charAt(0)}</span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{person.name}</h3>
            {person.nickname && (
              <p className="text-sm text-purple-400 mt-0.5">"{person.nickname}"</p>
            )}
            <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
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
      camera.position.addScaledVector(direction, 3);
    }
  }, []);
  
  const handleZoomOut = useCallback(() => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      camera.position.addScaledVector(direction, -3);
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
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#0a0a15] via-[#0d0820] to-[#080510]">
        <p className="text-slate-500">No family members yet</p>
      </div>
    );
  }
  
  if (!households || households.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#0a0a15] via-[#0d0820] to-[#080510]">
        <p className="text-slate-500">No households created yet. Add households to see the galaxy view.</p>
      </div>
    );
  }
  
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 15, 50], fov: 55 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#050510' }}
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
