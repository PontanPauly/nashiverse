import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { StarInstanced } from './Star';
import HouseholdCluster, { HOUSEHOLD_COLORS } from './HouseholdCluster';
import { generateRandomStarProfile } from '@/lib/starConfig';
import { ChevronRight, ZoomIn, ZoomOut, RotateCcw, Home } from 'lucide-react';

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

function generateUniquenessProfile(seed) {
  return {
    wispiness: 1.5 + seededRandom(seed + '-wisp') * 2.0,
    turbulence: 0.5 + seededRandom(seed + '-turb') * 1.0,
    layerCount: Math.floor(3 + seededRandom(seed + '-layers') * 2.99),
    colorShift: seededRandom(seed + '-colorShift'),
    glowIntensity: 0.8 + seededRandom(seed + '-glow') * 0.5,
    rotationSpeed: 0.2 + seededRandom(seed + '-rotSpeed') * 0.6,
  };
}

function useSpiralGalaxyLayout(households, people) {
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
    
    const positions = new Map();
    const placedPositions = [];
    const count = households.length;
    const galaxyRadius = 18;
    const spiralTurns = 1.5;
    const armCount = 2;
    const minSeparation = 4.5;
    
    households.forEach((household, index) => {
      const seed = household.id;
      const t = index / Math.max(count - 1, 1);
      
      const armIndex = index % armCount;
      const armOffset = (armIndex / armCount) * Math.PI * 2;
      
      const angle = t * Math.PI * 2 * spiralTurns + armOffset;
      const radius = 1.5 + t * galaxyRadius;
      
      let jitterX = (seededRandom(seed + '-jx') - 0.5) * 2.5;
      let jitterZ = (seededRandom(seed + '-jz') - 0.5) * 2.5;
      const jitterY = (seededRandom(seed + '-jy') - 0.5) * 1.0;
      
      let x = Math.cos(angle) * radius + jitterX;
      let z = Math.sin(angle) * radius + jitterZ;
      let y = jitterY * (1 - t * 0.5);
      
      let attempts = 0;
      const maxAttempts = 10;
      while (attempts < maxAttempts) {
        let tooClose = false;
        for (const placed of placedPositions) {
          const dx = x - placed.x;
          const dy = y - placed.y;
          const dz = z - placed.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < minSeparation) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) break;
        
        jitterX = (seededRandom(seed + '-jx-' + attempts) - 0.5) * 3.0;
        jitterZ = (seededRandom(seed + '-jz-' + attempts) - 0.5) * 3.0;
        x = Math.cos(angle) * (radius + attempts * 0.5) + jitterX;
        z = Math.sin(angle) * (radius + attempts * 0.5) + jitterZ;
        attempts++;
      }
      
      placedPositions.push({ x, y, z });
      
      const uniqueness = generateUniquenessProfile(seed);
      
      positions.set(household.id, {
        x,
        y,
        z,
        memberCount: householdMemberCounts.get(household.id) || 0,
        uniqueness,
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
          
          float n1 = noise(dir * 2.5 + time * 0.003);
          float n2 = noise(dir * 4.0 - time * 0.002);
          float n3 = noise(dir * 6.0 + time * 0.004);
          
          vec3 deepSpace = vec3(0.01, 0.01, 0.04);
          vec3 deepIndigo = vec3(0.05, 0.02, 0.12);
          vec3 darkPurple = vec3(0.08, 0.02, 0.1);
          vec3 deepTeal = vec3(0.01, 0.04, 0.08);
          
          float yFactor = (dir.y + 1.0) * 0.5;
          vec3 baseColor = mix(deepSpace, deepIndigo, yFactor);
          baseColor = mix(baseColor, deepTeal, n1 * 0.35);
          baseColor = mix(baseColor, darkPurple, n2 * 0.25);
          
          float nebulaIntensity = pow(n3, 2.5) * 0.12;
          vec3 nebulaGlow = vec3(0.15, 0.08, 0.2);
          baseColor += nebulaGlow * nebulaIntensity;
          
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

function ColorfulStarfield({ count = 4000 }) {
  const pointsRef = useRef();
  
  const { positions, colors, sizes, twinkleData } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const twinkle = new Float32Array(count * 2);
    
    const starColors = [
      [1.0, 0.98, 0.95],
      [0.9, 0.95, 1.0],
      [1.0, 0.9, 0.8],
      [0.95, 0.85, 1.0],
      [0.8, 0.95, 1.0],
      [1.0, 1.0, 1.0],
    ];
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 120 + Math.random() * 80;
      
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
      
      const colorIndex = Math.floor(Math.random() * starColors.length);
      const brightness = 0.5 + Math.random() * 0.5;
      col[i * 3] = starColors[colorIndex][0] * brightness;
      col[i * 3 + 1] = starColors[colorIndex][1] * brightness;
      col[i * 3 + 2] = starColors[colorIndex][2] * brightness;
      
      const sizeFactor = Math.pow(Math.random(), 2);
      siz[i] = 0.4 + sizeFactor * 1.2;
      
      twinkle[i * 2] = Math.random() * 100;
      twinkle[i * 2 + 1] = 0.02 + Math.random() * 0.06;
    }
    
    return { positions: pos, colors: col, sizes: siz, twinkleData: twinkle };
  }, [count]);
  
  const starMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 color;
        attribute float size;
        attribute vec2 twinkleData;
        uniform float time;
        varying vec3 vColor;
        varying float vBrightness;
        
        float rand(float n) {
          return fract(sin(n) * 43758.5453);
        }
        
        void main() {
          vColor = color;
          
          float phase = twinkleData.x;
          float speed = twinkleData.y;
          
          float t1 = sin(time * speed + phase) * 0.5 + 0.5;
          float t2 = sin(time * speed * 0.7 + phase * 1.3) * 0.5 + 0.5;
          float twinkle = mix(t1, t2, 0.5);
          
          vBrightness = 0.7 + twinkle * 0.3;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vBrightness;
        
        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha = pow(alpha, 2.0);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(vColor * vBrightness, alpha * vBrightness);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);
  
  useFrame((state) => {
    starMaterial.uniforms.time.value = state.clock.elapsedTime;
  });
  
  return (
    <points ref={pointsRef} material={starMaterial}>
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
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-twinkleData"
          count={count}
          array={twinkleData}
          itemSize={2}
        />
      </bufferGeometry>
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


function CameraController({ 
  level, 
  targetPosition, 
  controlsRef,
  onTransitionComplete,
  setAutoRotateEnabled
}) {
  const { camera } = useThree();
  const targetCamPos = useRef(new THREE.Vector3(20, 25, 45));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const isAnimating = useRef(false);
  
  useEffect(() => {
    if (level === 'galaxy') {
      targetCamPos.current.set(20, 25, 45);
      targetLookAt.current.set(0, 0, 0);
    } else if (level === 'system') {
      targetCamPos.current.set(0, 5, 15);
      targetLookAt.current.set(0, 0, 0);
    }
    isAnimating.current = true;
    
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
      controlsRef.current.autoRotate = false;
    }
  }, [level, targetPosition]);
  
  useFrame(() => {
    if (isAnimating.current) {
      camera.position.lerp(targetCamPos.current, 0.04);
      
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetLookAt.current, 0.04);
        controlsRef.current.update();
      }
      
      const distance = camera.position.distanceTo(targetCamPos.current);
      if (distance < 0.3) {
        isAnimating.current = false;
        
        if (controlsRef.current) {
          controlsRef.current.target.copy(targetLookAt.current);
          controlsRef.current.enabled = true;
          if (level === 'galaxy') {
            controlsRef.current.autoRotate = true;
          }
          controlsRef.current.update();
        }
        
        if (level === 'galaxy') {
          setAutoRotateEnabled?.(true);
        }
        
        onTransitionComplete?.();
      }
    } else if (controlsRef.current) {
      controlsRef.current.update();
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
          
          float n = noise(vUv * 8.0 + time * 0.02);
          
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
          <HouseholdCluster
            key={household.id}
            position={[pos.x, pos.y, pos.z]}
            household={household}
            memberCount={pos.memberCount}
            colorIndex={index}
            isHovered={hoveredHouseholdId === household.id}
            uniqueness={pos.uniqueness}
            onClick={() => onHouseholdClick(household)}
            onPointerOver={() => onHouseholdHover(household.id)}
            onPointerOut={() => onHouseholdHover(null)}
          />
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
  
  if (householdPeople.length === 0) {
    return (
      <group>
        <SystemNebulaBackdrop colors={colors} scale={8} />
        <Html center>
          <div className="px-8 py-6 rounded-2xl bg-slate-900/95 border border-purple-500/30 backdrop-blur-lg shadow-2xl text-center max-w-xs">
            <div className="text-4xl mb-3">✨</div>
            <div className="text-lg font-semibold text-white mb-2">
              Empty Household
            </div>
            <div className="text-sm text-slate-400">
              No family members have been added to {household?.name || 'this household'} yet.
            </div>
          </div>
        </Html>
      </group>
    );
  }
  
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

function VolumetricDustLayer({ yOffset, scale, opacity, rotationSpeed, colorShift }) {
  const meshRef = useRef();
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float layerOpacity;
        uniform float colorShift;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        
        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < 5; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }
        
        void main() {
          vec2 centered = vUv - 0.5;
          float dist = length(centered);
          float angle = atan(centered.y, centered.x);
          
          float spiral = sin(angle * 2.0 - dist * 4.0 + time * 0.008) * 0.5 + 0.5;
          spiral = pow(spiral, 2.5);
          
          float n = fbm(vUv * 6.0 + time * 0.005 + colorShift * 10.0);
          float n2 = fbm(vUv * 12.0 - time * 0.003);
          
          float dustDensity = spiral * (0.5 + n * 0.5);
          dustDensity *= smoothstep(0.5, 0.15, dist);
          dustDensity *= (0.6 + n2 * 0.4);
          
          vec3 dustColor1 = vec3(0.25, 0.15, 0.45);
          vec3 dustColor2 = vec3(0.15, 0.25, 0.5);
          vec3 dustColor3 = vec3(0.35, 0.2, 0.55);
          
          vec3 color = mix(dustColor1, dustColor2, n + colorShift);
          color = mix(color, dustColor3, n2 * 0.5);
          
          float alpha = dustDensity * layerOpacity;
          alpha *= smoothstep(0.52, 0.35, dist);
          
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.25));
        }
      `,
      uniforms: {
        time: { value: 0 },
        layerOpacity: { value: opacity },
        colorShift: { value: colorShift },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [opacity, colorShift]);
  
  useFrame((state) => {
    material.uniforms.time.value = state.clock.elapsedTime;
    if (meshRef.current) {
      meshRef.current.rotation.z += rotationSpeed * 0.0001;
    }
  });
  
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, yOffset, 0]}>
      <planeGeometry args={[scale, scale, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function AmbientDustParticles({ count = 2000, radius = 30 }) {
  const pointsRef = useRef();
  
  const { positions, colors, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const pha = new Float32Array(count);
    
    const dustColors = [
      [0.4, 0.25, 0.6],
      [0.25, 0.35, 0.55],
      [0.5, 0.3, 0.65],
      [0.3, 0.4, 0.6],
    ];
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.5) * radius;
      const heightSpread = 8;
      const y = (Math.random() - 0.5) * heightSpread * (1 - r / radius * 0.7);
      
      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(theta) * r;
      
      const colorIndex = Math.floor(Math.random() * dustColors.length);
      const brightness = 0.4 + Math.random() * 0.4;
      col[i * 3] = dustColors[colorIndex][0] * brightness;
      col[i * 3 + 1] = dustColors[colorIndex][1] * brightness;
      col[i * 3 + 2] = dustColors[colorIndex][2] * brightness;
      
      siz[i] = 0.8 + Math.random() * 1.5;
      pha[i] = Math.random() * Math.PI * 2;
    }
    
    return { positions: pos, colors: col, sizes: siz, phases: pha };
  }, [count, radius]);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 particleColor;
        attribute float size;
        attribute float phase;
        uniform float time;
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vColor = particleColor;
          float drift = sin(time * 0.2 + phase) * 0.3;
          vAlpha = 0.3 + drift * 0.2;
          
          vec3 pos = position;
          pos.y += sin(time * 0.1 + phase) * 0.2;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (150.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha = pow(alpha, 1.5);
          gl_FragColor = vec4(vColor, alpha * vAlpha * 0.4);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);
  
  useFrame((state) => {
    material.uniforms.time.value = state.clock.elapsedTime;
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0002;
    }
  });
  
  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-particleColor" count={count} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-phase" count={count} array={phases} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function GalacticCore() {
  const coreRef = useRef();
  
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
        uniform float time;
        varying vec2 vUv;
        
        void main() {
          vec2 centered = vUv - 0.5;
          float dist = length(centered);
          
          float core = smoothstep(0.5, 0.0, dist);
          core = pow(core, 1.8);
          
          float pulse = sin(time * 0.3) * 0.08 + 0.92;
          core *= pulse;
          
          vec3 coreColor = mix(
            vec3(1.0, 0.95, 1.0),
            vec3(0.7, 0.5, 0.95),
            pow(dist * 2.0, 0.8)
          );
          
          float outerGlow = smoothstep(0.5, 0.0, dist) * 0.4;
          
          float alpha = core * 0.8 + outerGlow * 0.3;
          
          gl_FragColor = vec4(coreColor, alpha);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, []);
  
  useFrame((state) => {
    material.uniforms.time.value = state.clock.elapsedTime;
    if (coreRef.current) {
      coreRef.current.lookAt(state.camera.position);
    }
  });
  
  return (
    <mesh ref={coreRef} position={[0, 0, 0]}>
      <planeGeometry args={[12, 12]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function ImmersiveGalaxy() {
  return (
    <group>
      <VolumetricDustLayer yOffset={-3} scale={70} opacity={0.3} rotationSpeed={0.3} colorShift={0.0} />
      <VolumetricDustLayer yOffset={-1.5} scale={60} opacity={0.35} rotationSpeed={0.4} colorShift={0.2} />
      <VolumetricDustLayer yOffset={0} scale={55} opacity={0.4} rotationSpeed={0.5} colorShift={0.4} />
      <VolumetricDustLayer yOffset={1.5} scale={60} opacity={0.35} rotationSpeed={0.45} colorShift={0.6} />
      <VolumetricDustLayer yOffset={3} scale={70} opacity={0.3} rotationSpeed={0.35} colorShift={0.8} />
      
      <AmbientDustParticles count={2500} radius={35} />
      
      <GalacticCore />
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
  autoRotateEnabled,
  setAutoRotateEnabled,
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
        setAutoRotateEnabled={setAutoRotateEnabled}
      />
      
      <ambientLight intensity={0.15} />
      <pointLight position={[30, 30, 30]} intensity={0.25} color="#ffffff" />
      <pointLight position={[-20, -10, -20]} intensity={0.15} color="#8B5CF6" />
      <pointLight position={[0, 40, 0]} intensity={0.1} color="#3B82F6" />
      
      <GalaxyBackground />
      <ColorfulStarfield count={3500} />
      
      {level === 'galaxy' && <ImmersiveGalaxy />}
      
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
        dampingFactor={0.06}
        minDistance={level === 'system' ? 6 : 25}
        maxDistance={level === 'system' ? 30 : 100}
        autoRotate={autoRotateEnabled && level === 'galaxy' && !hoveredHouseholdId}
        autoRotateSpeed={0.08}
        rotateSpeed={0.35}
        zoomSpeed={0.5}
        panSpeed={0.35}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.8}
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
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(true);
  const controlsRef = useRef(null);
  
  const householdPositions = useSpiralGalaxyLayout(households, people);
  
  const handleHouseholdClick = useCallback((household) => {
    setSelectedHousehold(household);
    setLevel('system');
    setFocusedStarId(null);
    setAutoRotateEnabled(false);
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
        camera={{ position: [20, 25, 45], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#030308' }}
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
          autoRotateEnabled={autoRotateEnabled}
          setAutoRotateEnabled={setAutoRotateEnabled}
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
