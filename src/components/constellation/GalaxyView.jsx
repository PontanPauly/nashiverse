import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import HouseholdCluster, { HOUSEHOLD_COLORS } from './HouseholdCluster';
import { ChevronRight, ZoomIn, ZoomOut, RotateCcw, Home } from 'lucide-react';
import { generateRandomStarProfile } from '@/lib/starConfig';
import { StarInstanced } from './Star';

function useQualityTier() {
  return useMemo(() => {
    const cores = navigator.hardwareConcurrency || 4;
    const screenPixels = window.innerWidth * window.innerHeight * (window.devicePixelRatio || 1);
    
    const isHighEnd = cores >= 8 && screenPixels < 4000000;
    const isLowEnd = cores <= 4 || screenPixels > 6000000;
    
    if (isHighEnd) {
      return { tier: 'high', starCount: 18000, gasCount: 4000 };
    } else if (isLowEnd) {
      return { tier: 'low', starCount: 6000, gasCount: 1000 };
    } else {
      return { tier: 'medium', starCount: 10000, gasCount: 2000 };
    }
  }, []);
}

const NEBULA_COLORS = {
  deepPurple: '#1e1b4b',
  vibrantPurple: '#7c3aed',
  teal: '#0891b2',
  cyan: '#22d3d8',
  blue: '#3b82f6',
  deepBlue: '#1e40af',
  warmOrange: '#f97316',
  warmPink: '#ec4899',
};

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

function useOrganicClusterLayout(households, people) {
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
    const minSeparation = 5.0;
    const nebulaRadius = 25;
    
    households.forEach((household, index) => {
      const seed = household.id;
      
      const clusterIndex = Math.floor(seededRandom(seed + '-cluster') * 5);
      const clusterCenters = [
        { x: 0, y: 0, z: 0 },
        { x: -12, y: 3, z: 8 },
        { x: 10, y: -2, z: -10 },
        { x: -8, y: -4, z: -12 },
        { x: 15, y: 5, z: 5 },
      ];
      const cluster = clusterCenters[clusterIndex];
      
      const spreadX = (seededRandom(seed + '-spreadX') - 0.5) * 12;
      const spreadY = (seededRandom(seed + '-spreadY') - 0.5) * 8;
      const spreadZ = (seededRandom(seed + '-spreadZ') - 0.5) * 12;
      
      let x = cluster.x + spreadX;
      let y = cluster.y + spreadY;
      let z = cluster.z + spreadZ;
      
      let attempts = 0;
      const maxAttempts = 20;
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
        
        x += (seededRandom(seed + '-adj-x-' + attempts) - 0.5) * 4;
        y += (seededRandom(seed + '-adj-y-' + attempts) - 0.5) * 3;
        z += (seededRandom(seed + '-adj-z-' + attempts) - 0.5) * 4;
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

function NebulaBackground() {
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
        
        float fbm(vec3 p) {
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
          vec3 dir = normalize(vPosition);
          
          float n1 = fbm(dir * 2.0 + time * 0.002);
          float n2 = fbm(dir * 3.0 - time * 0.001);
          float n3 = fbm(dir * 4.0 + time * 0.003);
          
          vec3 deepPurple = vec3(0.118, 0.106, 0.294);
          vec3 deepBlue = vec3(0.118, 0.251, 0.424);
          vec3 teal = vec3(0.035, 0.569, 0.698);
          vec3 deepSpace = vec3(0.01, 0.01, 0.03);
          vec3 vibrantPurple = vec3(0.486, 0.227, 0.929);
          
          float yFactor = (dir.y + 1.0) * 0.5;
          vec3 baseColor = mix(deepSpace, deepPurple, yFactor * 0.6);
          baseColor = mix(baseColor, deepBlue, n1 * 0.4);
          baseColor = mix(baseColor, teal, n2 * 0.15);
          
          float nebulaIntensity = pow(n3, 2.0) * 0.2;
          vec3 nebulaGlow = mix(vibrantPurple, teal, n1);
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
      <sphereGeometry args={[300, 64, 64]} />
      <primitive object={gradientMaterial} attach="material" />
    </mesh>
  );
}

function DenseStarField({ count = 55000 }) {
  const pointsRef = useRef(null);
  
  const { positions, colors, sizes, twinklePhases, brightStars } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const phases = new Float32Array(count);
    const bright = new Float32Array(count);
    
    const starColors = [
      [1.0, 1.0, 1.0],
      [0.9, 0.95, 1.0],
      [1.0, 0.95, 0.9],
      [0.85, 0.9, 1.0],
      [1.0, 0.9, 0.95],
      [0.95, 0.98, 1.0],
      [0.486, 0.227, 0.929],
      [0.035, 0.569, 0.698],
    ];
    
    const farCount = Math.floor(count * 0.6);
    const midCount = Math.floor(count * 0.3);
    const closeCount = count - farCount - midCount;
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      let radius;
      if (i < farCount) {
        radius = 150 + Math.random() * 100;
      } else if (i < farCount + midCount) {
        radius = 80 + Math.random() * 70;
      } else {
        radius = 40 + Math.random() * 40;
      }
      
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
      
      const colorIndex = Math.floor(Math.random() * starColors.length);
      const brightness = 0.4 + Math.random() * 0.6;
      col[i * 3] = starColors[colorIndex][0] * brightness;
      col[i * 3 + 1] = starColors[colorIndex][1] * brightness;
      col[i * 3 + 2] = starColors[colorIndex][2] * brightness;
      
      const sizeFactor = Math.pow(Math.random(), 2.5);
      if (i < farCount) {
        siz[i] = 0.3 + sizeFactor * 0.6;
      } else if (i < farCount + midCount) {
        siz[i] = 0.5 + sizeFactor * 1.0;
      } else {
        siz[i] = 0.8 + sizeFactor * 1.5;
      }
      
      phases[i] = Math.random() * Math.PI * 2;
      bright[i] = Math.random() < 0.008 ? 1.0 : 0.0;
    }
    
    return { 
      positions: pos, 
      colors: col, 
      sizes: siz, 
      twinklePhases: phases, 
      brightStars: bright 
    };
  }, [count]);
  
  const starMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 starColor;
        attribute float size;
        attribute float twinklePhase;
        attribute float isBright;
        uniform float time;
        varying vec3 vColor;
        varying float vBrightness;
        varying float vIsBright;
        
        void main() {
          vColor = starColor;
          vIsBright = isBright;
          
          float t1 = sin(time * 0.8 + twinklePhase) * 0.5 + 0.5;
          float t2 = sin(time * 1.3 + twinklePhase * 1.5) * 0.5 + 0.5;
          float twinkle = mix(t1, t2, 0.5);
          vBrightness = 0.6 + twinkle * 0.4;
          
          float sizeMultiplier = isBright > 0.5 ? 2.2 : 1.0;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * sizeMultiplier * (250.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 0.5, 12.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vBrightness;
        varying float vIsBright;
        
        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          
          float core = 1.0 - smoothstep(0.0, 0.3, dist);
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          glow = pow(glow, 2.0);
          
          float alpha = core + glow * 0.5;
          
          float spike = 0.0;
          if (vIsBright > 0.5) {
            float angle = atan(center.y, center.x);
            float spike4 = pow(abs(sin(angle * 2.0)), 12.0);
            float spike6 = pow(abs(sin(angle * 3.0 + 0.5)), 10.0);
            float spikeFalloff = exp(-dist * 3.0);
            spike = (spike4 * 0.7 + spike6 * 0.3) * spikeFalloff * 0.8;
            alpha += spike;
          }
          
          if (alpha < 0.01) discard;
          
          vec3 finalColor = vColor * vBrightness;
          if (vIsBright > 0.5) {
            finalColor += vec3(1.0, 1.0, 1.0) * spike * 0.5;
          }
          
          gl_FragColor = vec4(finalColor, alpha * vBrightness);
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
    <points ref={pointsRef} material={starMaterial} frustumCulled={true}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-starColor" count={count} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-twinklePhase" count={count} array={twinklePhases} itemSize={1} />
        <bufferAttribute attach="attributes-isBright" count={count} array={brightStars} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function NebulaGasCloud({ count = 8000 }) {
  const pointsRef = useRef(null);
  
  const { positions, colors, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const pha = new Float32Array(count);
    
    const nebulaColors = [
      new THREE.Color(NEBULA_COLORS.vibrantPurple),
      new THREE.Color(NEBULA_COLORS.teal),
      new THREE.Color(NEBULA_COLORS.cyan),
      new THREE.Color(NEBULA_COLORS.deepBlue),
      new THREE.Color(NEBULA_COLORS.warmPink),
    ];
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const radius = Math.pow(Math.random(), 0.5) * 50;
      const height = (Math.random() - 0.5) * 25;
      
      pos[i * 3] = Math.cos(theta) * radius + (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = height + (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = Math.sin(theta) * radius + (Math.random() - 0.5) * 10;
      
      const colorIndex = Math.floor(Math.random() * nebulaColors.length);
      const c = nebulaColors[colorIndex];
      const brightness = 0.3 + Math.random() * 0.4;
      col[i * 3] = c.r * brightness;
      col[i * 3 + 1] = c.g * brightness;
      col[i * 3 + 2] = c.b * brightness;
      
      siz[i] = 2 + Math.random() * 4;
      pha[i] = Math.random() * Math.PI * 2;
    }
    
    return { positions: pos, colors: col, sizes: siz, phases: pha };
  }, [count]);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 gasColor;
        attribute float size;
        attribute float phase;
        uniform float time;
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vColor = gasColor;
          
          float drift = sin(time * 0.1 + phase) * 0.3;
          vAlpha = 0.15 + drift * 0.1;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 30.0);
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
          alpha = pow(alpha, 3.0);
          alpha *= vAlpha;
          
          if (alpha < 0.005) discard;
          
          gl_FragColor = vec4(vColor, alpha);
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
      pointsRef.current.rotation.y += 0.00015;
    }
  });
  
  return (
    <points ref={pointsRef} material={material} frustumCulled={true}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-gasColor" count={count} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-phase" count={count} array={phases} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function VignetteOverlay() {
  return (
    <div 
      className="absolute inset-0 pointer-events-none z-10"
      style={{
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
      }}
    />
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
  const targetCamPos = useRef(new THREE.Vector3(25, 20, 50));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const isAnimating = useRef(false);
  
  useEffect(() => {
    if (level === 'galaxy') {
      targetCamPos.current.set(25, 20, 50);
      targetLookAt.current.set(0, 0, 0);
    } else if (level === 'system' && targetPosition) {
      targetCamPos.current.set(
        targetPosition.x + 8,
        targetPosition.y + 5,
        targetPosition.z + 12
      );
      targetLookAt.current.set(targetPosition.x, targetPosition.y, targetPosition.z);
    }
    isAnimating.current = true;
    
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
      controlsRef.current.autoRotate = false;
    }
  }, [level, targetPosition]);
  
  useFrame(() => {
    if (isAnimating.current) {
      camera.position.lerp(targetCamPos.current, 0.035);
      
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetLookAt.current, 0.035);
        controlsRef.current.update();
      }
      
      const distance = camera.position.distanceTo(targetCamPos.current);
      if (distance < 0.5) {
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

function arrangeStarsInCluster(people, centerX = 0, centerY = 0, centerZ = 0) {
  const count = people.length;
  if (count === 0) return [];
  if (count === 1) {
    return [{
      ...people[0],
      position: [centerX + 1.5, centerY, centerZ],
    }];
  }
  
  return people.map((person, index) => {
    const seed = person.id || index;
    const angle = seededRandom(seed + '-angle') * Math.PI * 2;
    const radius = 1.5 + seededRandom(seed + '-radius') * 3;
    const yOffset = (seededRandom(seed + '-y') - 0.5) * 1.5;
    
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
    return people.filter(p => p.household_id === household.id);
  }, [people, household.id]);
  
  const positionedPeople = useMemo(() => {
    return arrangeStarsInCluster(householdPeople);
  }, [householdPeople]);
  
  const starsWithProfiles = useMemo(() => {
    return positionedPeople.map(person => ({
      id: person.id,
      position: person.position,
      starProfile: person.star_profile || generateRandomStarProfile(person.id),
      person,
    }));
  }, [positionedPeople]);
  
  const colors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[8, 32, 32]} />
        <meshBasicMaterial 
          color={colors.primary} 
          transparent 
          opacity={0.03} 
          side={THREE.BackSide}
        />
      </mesh>
      
      <StarInstanced
        stars={starsWithProfiles}
        onStarClick={onStarClick}
        onStarHover={onStarHover}
        hoveredId={hoveredStarId}
        focusedId={focusedStarId}
      />
    </group>
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
            onClick={() => onHouseholdClick(household)}
            onPointerOver={() => onHouseholdHover(household.id)}
            onPointerOut={() => onHouseholdHover(null)}
          />
        );
      })}
    </group>
  );
}

function FogController() {
  const { scene } = useThree();
  
  useEffect(() => {
    scene.fog = new THREE.FogExp2('#050510', 0.006);
    return () => {
      scene.fog = null;
    };
  }, [scene]);
  
  return null;
}

function NebulaScene({
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
  qualityTier,
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
        onTransitionComplete={() => {}}
        setAutoRotateEnabled={setAutoRotateEnabled}
      />
      
      <FogController />
      
      <ambientLight intensity={0.1} />
      <pointLight position={[40, 30, 40]} intensity={0.2} color="#ffffff" />
      <pointLight position={[-30, -10, -30]} intensity={0.15} color={NEBULA_COLORS.vibrantPurple} />
      <pointLight position={[0, 50, 0]} intensity={0.1} color={NEBULA_COLORS.cyan} />
      <pointLight position={[20, -20, 30]} intensity={0.08} color={NEBULA_COLORS.warmPink} />
      
      <NebulaBackground />
      <DenseStarField count={qualityTier.starCount} />
      
      {level === 'galaxy' && (
        <>
          <NebulaGasCloud count={qualityTier.gasCount} />
          <GalaxyLevelScene
            households={households}
            householdPositions={householdPositions}
            hoveredHouseholdId={hoveredHouseholdId}
            onHouseholdClick={onHouseholdClick}
            onHouseholdHover={onHouseholdHover}
          />
        </>
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
      
      <mesh visible={false} onClick={onBackgroundClick}>
        <sphereGeometry args={[350, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>
      
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        enableDamping={true}
        dampingFactor={0.05}
        minDistance={level === 'system' ? 6 : 20}
        maxDistance={level === 'system' ? 35 : 120}
        autoRotate={autoRotateEnabled && level === 'galaxy' && !hoveredHouseholdId}
        autoRotateSpeed={0.06}
        rotateSpeed={0.4}
        zoomSpeed={0.6}
        panSpeed={0.4}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.85}
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
            Nebula
          </button>
          
          {level === 'system' && selectedHousehold && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-600" />
              <span className="text-sm text-cyan-400 font-medium">
                {selectedHousehold.name}
              </span>
            </>
          )}
        </div>
      </div>
      
      <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2">
        <button
          onClick={onZoomIn}
          className="p-3 rounded-lg bg-slate-800/90 border border-cyan-500/30 backdrop-blur-md text-white hover:bg-slate-700/90 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={onZoomOut}
          className="p-3 rounded-lg bg-slate-800/90 border border-cyan-500/30 backdrop-blur-md text-white hover:bg-slate-700/90 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={onResetView}
          className="p-3 rounded-lg bg-slate-800/90 border border-cyan-500/30 backdrop-blur-md text-white hover:bg-slate-700/90 transition-colors"
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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[480px] max-w-[calc(100vw-2rem)] glass-card rounded-2xl p-6 border border-cyan-500/30 z-50 animate-in slide-in-from-bottom duration-300 bg-slate-900/95 backdrop-blur-xl">
      <div className="flex justify-between items-start">
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-cyan-500/30">
            {person.photo_url ? (
              <img src={person.photo_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <span className="text-xl text-slate-400">{person.name?.charAt(0)}</span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{person.name}</h3>
            {person.nickname && (
              <p className="text-sm text-cyan-400 mt-0.5">"{person.nickname}"</p>
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
  const [contextLost, setContextLost] = useState(false);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  
  const qualityTier = useQualityTier();
  const householdPositions = useOrganicClusterLayout(households, people);
  
  const handleCanvasCreated = useCallback(({ gl }) => {
    rendererRef.current = gl;
    const canvas = gl.domElement;
    
    const handleContextLost = (event) => {
      event.preventDefault();
      setContextLost(true);
      console.warn('WebGL context lost. Attempting recovery...');
    };
    
    const handleContextRestored = () => {
      setContextLost(false);
      console.log('WebGL context restored.');
    };
    
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
    
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, []);
  
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
      camera.position.addScaledVector(direction, 5);
    }
  }, []);
  
  const handleZoomOut = useCallback(() => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      camera.position.addScaledVector(direction, -5);
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
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#050510] via-[#0d0820] to-[#080510]">
        <p className="text-slate-500">No family members yet</p>
      </div>
    );
  }
  
  if (!households || households.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#050510] via-[#0d0820] to-[#080510]">
        <p className="text-slate-500">No households created yet. Add households to see the nebula view.</p>
      </div>
    );
  }
  
  return (
    <div className="absolute inset-0">
      {contextLost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/90">
          <div className="text-center">
            <p className="text-white text-lg mb-2">Recovering graphics...</p>
            <p className="text-slate-400 text-sm">Please wait a moment</p>
          </div>
        </div>
      )}
      <Canvas
        camera={{ position: [25, 20, 50], fov: 55 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        style={{ background: '#020208' }}
        dpr={[1, 1.5]}
        onCreated={handleCanvasCreated}
      >
        <NebulaScene
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
          qualityTier={qualityTier}
        />
      </Canvas>
      
      <VignetteOverlay />
      
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
