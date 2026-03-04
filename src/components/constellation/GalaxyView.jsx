import React, { useMemo, useState, useRef, useCallback, useEffect, Suspense, createContext, useContext } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import HouseholdCluster, { HOUSEHOLD_COLORS, StarMapCluster } from './HouseholdCluster';
import { classifyHousehold, computeHouseholdEdges } from '@/lib/starClassification';
import { ChevronRight, ZoomIn, ZoomOut, RotateCcw, Home, Sparkles, Cloud, Eye, EyeOff } from 'lucide-react';
import { generateRandomStarProfile } from '@/lib/starConfig';
import { StarInstanced } from './Star';

const TransitionContext = createContext({
  progress: 0,
  isActive: false,
  direction: null,
});

function useTransitionProgress() {
  return useContext(TransitionContext);
}

function useQualityTier() {
  return useMemo(() => {
    const cores = navigator.hardwareConcurrency || 4;
    const screenPixels = window.innerWidth * window.innerHeight * (window.devicePixelRatio || 1);
    
    const isHighEnd = cores >= 8 && screenPixels < 4000000;
    const isLowEnd = cores <= 4 || screenPixels > 6000000;
    
    if (isHighEnd) {
      return { tier: 'high', starCount: 70000, gasCount: 2000, useGlb: true };
    } else if (isLowEnd) {
      return { tier: 'low', starCount: 40000, gasCount: 600, useGlb: false };
    } else {
      return { tier: 'medium', starCount: 55000, gasCount: 1000, useGlb: true };
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

function useOrganicClusterLayout(households, people, viewMode = 'nebula', relationships = []) {
  return useMemo(() => {
    if (!households || households.length === 0) return new Map();
    
    const householdMemberCounts = new Map();
    const householdMembers = new Map();
    people.forEach(person => {
      if (person.household_id) {
        householdMemberCounts.set(
          person.household_id,
          (householdMemberCounts.get(person.household_id) || 0) + 1
        );
        if (!householdMembers.has(person.household_id)) {
          householdMembers.set(person.household_id, []);
        }
        householdMembers.get(person.household_id).push(person);
      }
    });
    
    const personToHousehold = new Map();
    people.forEach(p => {
      if (p.household_id) personToHousehold.set(p.id, p.household_id);
    });
    
    const parentOf = new Map();
    const childOf = new Map();
    relationships.forEach(rel => {
      if (rel.relationship_type !== 'parent') return;
      const parentId = rel.person_id || rel.person1_id;
      const childId = rel.related_person_id || rel.person2_id;
      const parentHH = personToHousehold.get(parentId);
      const childHH = personToHousehold.get(childId);
      if (parentHH && childHH && parentHH !== childHH) {
        if (!parentOf.has(parentHH)) parentOf.set(parentHH, new Set());
        parentOf.get(parentHH).add(childHH);
        if (!childOf.has(childHH)) childOf.set(childHH, new Set());
        childOf.get(childHH).add(parentHH);
      }
    });
    
    const generation = new Map();
    const roots = [];
    households.forEach(h => {
      if (!childOf.has(h.id)) {
        roots.push(h.id);
        generation.set(h.id, 0);
      }
    });
    
    if (roots.length === 0) {
      const hhAges = new Map();
      households.forEach(h => {
        const members = householdMembers.get(h.id) || [];
        const ages = members
          .map(m => m.birth_date ? (new Date().getFullYear() - new Date(m.birth_date).getFullYear()) : 0)
          .filter(a => a > 0);
        const maxAge = ages.length > 0 ? Math.max(...ages) : 30;
        hhAges.set(h.id, maxAge);
      });
      
      const sorted = [...households].sort((a, b) => (hhAges.get(b.id) || 0) - (hhAges.get(a.id) || 0));
      const third = Math.max(1, Math.ceil(sorted.length / 3));
      sorted.forEach((h, i) => {
        if (i < third) {
          generation.set(h.id, 0);
        } else if (i < third * 2) {
          generation.set(h.id, 1);
        } else {
          generation.set(h.id, 2);
        }
      });
    } else {
      const queue = [...roots];
      while (queue.length > 0) {
        const hhId = queue.shift();
        const gen = generation.get(hhId) || 0;
        const children = parentOf.get(hhId);
        if (children) {
          children.forEach(childHH => {
            if (!generation.has(childHH) || generation.get(childHH) < gen + 1) {
              generation.set(childHH, gen + 1);
              queue.push(childHH);
            }
          });
        }
      }
    }
    
    households.forEach(h => {
      if (!generation.has(h.id)) generation.set(h.id, 1);
    });
    
    const genGroups = new Map();
    households.forEach(h => {
      const gen = generation.get(h.id) || 0;
      if (!genGroups.has(gen)) genGroups.set(gen, []);
      genGroups.get(gen).push(h);
    });
    
    const genRadii = [0, 25, 45, 65];
    const minSeparation = 15.0;
    
    const positions = new Map();
    const placedPositions = [];
    
    const sortedGens = [...genGroups.keys()].sort((a, b) => a - b);
    
    sortedGens.forEach(gen => {
      const group = genGroups.get(gen);
      const baseRadius = genRadii[Math.min(gen, genRadii.length - 1)];
      
      group.forEach((household, idx) => {
        const seed = household.id;
        const angleOffset = seededRandom(seed + '-angle') * Math.PI * 2;
        const angle = (idx / group.length) * Math.PI * 2 + angleOffset * 0.3;
        
        const radiusJitter = (seededRandom(seed + '-rjit') - 0.5) * (gen === 0 ? 5 : 10);
        const radius = baseRadius + radiusJitter;
        
        let x = Math.cos(angle) * radius;
        let z = Math.sin(angle) * radius;
        let y = (seededRandom(seed + '-y') - 0.5) * 8;
        
        let attempts = 0;
        while (attempts < 30) {
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
          x += (seededRandom(seed + '-ax-' + attempts) - 0.5) * 8;
          y += (seededRandom(seed + '-ay-' + attempts) - 0.5) * 4;
          z += (seededRandom(seed + '-az-' + attempts) - 0.5) * 8;
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
    });
    
    return positions;
  }, [households, people, viewMode, relationships]);
}

function NebulaModel({ url, position, scale, rotation, opacity = 0.15 }) {
  const gltf = useGLTF(url);
  const scene = gltf.scene;
  const ref = useRef(null);
  
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = opacity;
        child.material.depthWrite = false;
        child.material.blending = THREE.AdditiveBlending;
      }
    });
    return clone;
  }, [scene, opacity]);
  
  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.y += 0.0002;
    }
  });
  
  return (
    <primitive 
      ref={ref}
      object={clonedScene} 
      position={position} 
      scale={scale}
      rotation={rotation}
    />
  );
}

function ImmersiveNebulaVolume({ qualityTier }) {
  const { camera } = useThree();
  
  const isHigh = qualityTier.tier === 'high';
  const isMedium = qualityTier.tier === 'medium';
  const raySteps = isHigh ? 32 : (isMedium ? 24 : 16);
  const octaves = isHigh ? 4 : (isMedium ? 3 : 2);
  
  const volumeMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vRayOrigin;
        varying vec3 vRayDir;
        
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          vRayOrigin = cameraPosition;
          vRayDir = normalize(vWorldPos - cameraPosition);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float volumeRadius;
        
        varying vec3 vWorldPos;
        varying vec3 vRayOrigin;
        varying vec3 vRayDir;
        
        const int RAY_STEPS = ${raySteps};
        const int OCTAVES = ${octaves};
        
        vec3 deepPurple = vec3(0.08, 0.04, 0.18);
        vec3 vibrantPurple = vec3(0.35, 0.12, 0.65);
        vec3 teal = vec3(0.02, 0.25, 0.35);
        vec3 cyan = vec3(0.08, 0.35, 0.45);
        vec3 warmPink = vec3(0.55, 0.15, 0.35);
        vec3 deepBlue = vec3(0.05, 0.08, 0.25);
        vec3 warmOrange = vec3(0.65, 0.35, 0.1);
        
        float hash(vec3 p) {
          p = fract(p * vec3(443.897, 441.423, 437.195));
          p += dot(p, p.yxz + 19.19);
          return fract((p.x + p.y) * p.z);
        }
        
        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          
          float n = mix(
            mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
          return n;
        }
        
        float fbm(vec3 p) {
          float value = 0.0;
          float amp = 0.5;
          float freq = 1.0;
          for (int i = 0; i < OCTAVES; i++) {
            value += amp * noise(p * freq);
            freq *= 2.0;
            amp *= 0.5;
          }
          return value;
        }
        
        float ridgedNoise(vec3 p) {
          return 1.0 - abs(noise(p) * 2.0 - 1.0);
        }
        
        float ridgedFbm(vec3 p, float t) {
          float value = 0.0;
          float amp = 0.5;
          float freq = 1.0;
          float weight = 1.0;
          
          for (int i = 0; i < 4; i++) {
            float n = ridgedNoise(p * freq + t * 0.01);
            n = pow(n, 2.0);
            n *= weight;
            weight = clamp(n * 2.0, 0.0, 1.0);
            value += n * amp;
            freq *= 2.0;
            amp *= 0.5;
          }
          return value;
        }
        
        vec2 raySphereIntersect(vec3 ro, vec3 rd, float radius) {
          float b = dot(ro, rd);
          float c = dot(ro, ro) - radius * radius;
          float h = b * b - c;
          if (h < 0.0) return vec2(-1.0);
          h = sqrt(h);
          return vec2(-b - h, -b + h);
        }
        
        float nebulaStructure(vec3 p, float t) {
          vec3 stretched = p * vec3(1.0, 0.6, 1.0);
          
          float largeClouds = fbm(stretched * 0.03 + t * 0.002);
          float mediumDetail = ridgedFbm(stretched * 0.08, t);
          float fineDetail = fbm(p * 0.2 + t * 0.005);
          
          float filaments = ridgedFbm(p * 0.05 + vec3(0.0, t * 0.003, 0.0), t * 0.5);
          filaments = pow(filaments, 1.5);
          
          float combined = largeClouds * 0.5 + mediumDetail * 0.3 + filaments * 0.4;
          combined += fineDetail * 0.15;
          
          float dist = length(p);
          float coreFalloff = smoothstep(0.0, 40.0, dist);
          float edgeFalloff = 1.0 - smoothstep(60.0, 120.0, dist);
          
          float density = combined * edgeFalloff;
          density *= mix(1.0, 0.3, coreFalloff * 0.5);
          
          density = pow(max(density - 0.25, 0.0), 1.5);
          
          return density * 0.18;
        }
        
        vec3 nebulaColor(vec3 p, float density, float t) {
          float n1 = fbm(p * 0.04 + t * 0.001);
          float n2 = fbm(p * 0.06 - t * 0.002);
          float n3 = fbm(p * 0.08 + vec3(t * 0.001));
          
          float dist = length(p);
          float distFactor = smoothstep(0.0, 80.0, dist);
          
          vec3 coreColor = mix(warmOrange, warmPink, n1);
          vec3 midColor = mix(vibrantPurple, teal, n2);
          vec3 edgeColor = mix(deepBlue, cyan, n3);
          
          vec3 color = mix(coreColor, midColor, smoothstep(0.0, 0.5, distFactor));
          color = mix(color, edgeColor, smoothstep(0.4, 0.9, distFactor));
          
          color = mix(color, vibrantPurple, smoothstep(0.6, 0.9, n1) * 0.4);
          color = mix(color, cyan, smoothstep(0.5, 0.85, n2 * n3) * 0.3);
          
          float emissive = pow(density, 0.5) * 1.5;
          
          return color * (0.6 + emissive);
        }
        
        void main() {
          vec3 ro = vRayOrigin;
          vec3 rd = normalize(vRayDir);
          
          vec2 t = raySphereIntersect(ro, rd, volumeRadius);
          
          if (t.y < 0.0) {
            discard;
          }
          
          float tNear = max(t.x, 0.0);
          float tFar = t.y;
          float rayLen = tFar - tNear;
          float stepSize = rayLen / float(RAY_STEPS);
          
          float jitter = hash(vWorldPos + time * 0.1) * stepSize * 0.5;
          
          vec3 totalColor = vec3(0.0);
          float totalAlpha = 0.0;
          
          for (int i = 0; i < RAY_STEPS; i++) {
            float tCurrent = tNear + stepSize * float(i) + jitter;
            vec3 samplePos = ro + rd * tCurrent;
            
            float density = nebulaStructure(samplePos, time);
            
            if (density > 0.001) {
              vec3 sampleColor = nebulaColor(samplePos, density, time);
              
              float sampleAlpha = density * stepSize * 0.15;
              sampleAlpha = 1.0 - exp(-sampleAlpha * 3.0);
              
              totalColor += sampleColor * sampleAlpha * (1.0 - totalAlpha);
              totalAlpha += sampleAlpha * (1.0 - totalAlpha);
              
              if (totalAlpha > 0.95) break;
            }
          }
          
          totalColor = pow(totalColor, vec3(0.85));
          
          gl_FragColor = vec4(totalColor, totalAlpha * 0.5);
        }
      `,
      uniforms: {
        time: { value: 0 },
        volumeRadius: { value: 120.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
  }, [raySteps, octaves]);
  
  useFrame((state) => {
    volumeMaterial.uniforms.time.value = state.clock.elapsedTime;
  });
  
  return (
    <mesh>
      <sphereGeometry args={[120, 64, 64]} />
      <primitive object={volumeMaterial} attach="material" />
    </mesh>
  );
}

function NebulaFilaments({ count = 800, qualityTier }) {
  const pointsRef = useRef();
  
  const isHigh = qualityTier.tier === 'high';
  const isMedium = qualityTier.tier === 'medium';
  const particleCount = isHigh ? 400 : (isMedium ? 250 : 150);
  
  const { positions, colors, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const siz = new Float32Array(particleCount);
    const pha = new Float32Array(particleCount);
    
    const nebulaColors = [
      new THREE.Color(0x7c3aed),
      new THREE.Color(0x0891b2),
      new THREE.Color(0x22d3d8),
      new THREE.Color(0xec4899),
      new THREE.Color(0x1e40af),
      new THREE.Color(0xf97316),
    ];
    
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 10 + Math.pow(Math.random(), 0.4) * 90;
      
      const wispOffset = Math.sin(theta * 3 + phi * 2) * 15;
      const finalR = r + wispOffset;
      
      pos[i * 3] = finalR * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = finalR * Math.sin(phi) * Math.sin(theta) * 0.6;
      pos[i * 3 + 2] = finalR * Math.cos(phi);
      
      const colorIdx = Math.floor(Math.random() * nebulaColors.length);
      const c = nebulaColors[colorIdx];
      const brightness = 0.4 + Math.random() * 0.6;
      col[i * 3] = c.r * brightness;
      col[i * 3 + 1] = c.g * brightness;
      col[i * 3 + 2] = c.b * brightness;
      
      siz[i] = 2 + Math.random() * 5;
      pha[i] = Math.random() * Math.PI * 2;
    }
    
    return { positions: pos, colors: col, sizes: siz, phases: pha };
  }, [particleCount]);
  
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
          
          float drift = sin(time * 0.15 + phase) * 0.2 + 0.8;
          vAlpha = 0.06 * drift;
          
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (150.0 / -mvPos.z);
          gl_PointSize = clamp(gl_PointSize, 2.0, 40.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha = pow(alpha, 2.5);
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
      pointsRef.current.rotation.y += 0.00008;
    }
  });
  
  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-particleColor" count={particleCount} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={particleCount} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-phase" count={particleCount} array={phases} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function TieredNebulaBackdrop({ qualityTier }) {
  return (
    <group>
      <ImmersiveNebulaVolume qualityTier={qualityTier} />
      <NebulaFilaments qualityTier={qualityTier} />
    </group>
  );
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
          
          float n1 = fbm(dir * 2.0 + time * 0.001);
          float n2 = fbm(dir * 3.0 - time * 0.0008);
          float n3 = fbm(dir * 1.5 + time * 0.0005);
          float n4 = fbm(dir * 0.8 + time * 0.0003);
          
          vec3 deepSpace = vec3(0.06, 0.08, 0.05);
          vec3 warmGold = vec3(0.5, 0.4, 0.08);
          vec3 emeraldGreen = vec3(0.1, 0.5, 0.2);
          vec3 deepPurple = vec3(0.2, 0.08, 0.35);
          vec3 coolBlue = vec3(0.06, 0.18, 0.4);
          vec3 amber = vec3(0.45, 0.28, 0.05);
          
          vec3 baseColor = deepSpace;
          
          float zone1 = smoothstep(0.25, 0.55, n3);
          float zone2 = smoothstep(0.25, 0.55, n4);
          float zone3 = smoothstep(0.3, 0.6, fbm(dir * 1.2 - time * 0.0004));
          float zone4 = smoothstep(0.25, 0.55, n1);
          float zone5 = smoothstep(0.3, 0.6, n2);
          
          baseColor = mix(baseColor, warmGold, zone1 * 0.6);
          baseColor = mix(baseColor, emeraldGreen, zone2 * 0.65);
          baseColor = mix(baseColor, deepPurple, zone3 * 0.5);
          baseColor = mix(baseColor, coolBlue, zone4 * 0.45);
          baseColor = mix(baseColor, amber, zone5 * 0.4);
          
          float yFactor = (dir.y + 1.0) * 0.5;
          baseColor = mix(baseColor, deepPurple * 0.8, yFactor * 0.15);
          
          baseColor *= 1.4;
          
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

function DenseStarField({ count = 70000 }) {
  const { positions, colors, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    
    const starColors = [
      [1.0, 1.0, 1.0],
      [0.9, 0.95, 1.0],
      [1.0, 0.95, 0.9],
      [0.85, 0.9, 1.0],
      [1.0, 0.9, 0.85],
      [0.95, 0.98, 1.0],
    ];
    
    const farCount = Math.floor(count * 0.75);
    const midCount = Math.floor(count * 0.2);
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      let radius;
      if (i < farCount) {
        radius = 160 + Math.random() * 140;
      } else if (i < farCount + midCount) {
        radius = 90 + Math.random() * 70;
      } else {
        radius = 45 + Math.random() * 45;
      }
      
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
      
      const colorIndex = Math.floor(Math.random() * starColors.length);
      const dimFactor = Math.pow(Math.random(), 2.5);
      const brightness = 0.08 + dimFactor * 0.25;
      col[i * 3] = starColors[colorIndex][0] * brightness;
      col[i * 3 + 1] = starColors[colorIndex][1] * brightness;
      col[i * 3 + 2] = starColors[colorIndex][2] * brightness;
      
      const sizeFactor = Math.pow(Math.random(), 4.0);
      if (i < farCount) {
        siz[i] = 0.04 + sizeFactor * 0.08;
      } else if (i < farCount + midCount) {
        siz[i] = 0.06 + sizeFactor * 0.12;
      } else {
        siz[i] = 0.08 + sizeFactor * 0.18;
      }
    }
    
    return { positions: pos, colors: col, sizes: siz };
  }, [count]);
  
  const starMaterial = useMemo(() => {
    const dpr = window.devicePixelRatio || 1;
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 starColor;
        attribute float size;
        uniform float pixelRatio;
        varying vec3 vColor;
        
        void main() {
          vColor = starColor;
          float dpiScale = 1.0 / max(pixelRatio, 1.0);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * dpiScale * (150.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 0.3, 2.5);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        
        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha *= alpha;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      uniforms: {
        pixelRatio: { value: dpr },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);
  
  return (
    <points material={starMaterial} frustumCulled={true}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-starColor" count={count} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} />
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
      new THREE.Color('#2a4a2a'),
      new THREE.Color('#3a5520'),
      new THREE.Color('#4a4020'),
      new THREE.Color('#254535'),
      new THREE.Color('#35302a'),
      new THREE.Color('#203550'),
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
      const brightness = 0.4 + Math.random() * 0.3;
      col[i * 3] = c.r * brightness;
      col[i * 3 + 1] = c.g * brightness;
      col[i * 3 + 2] = c.b * brightness;
      
      siz[i] = 2.5 + Math.random() * 5;
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
          
          float drift = sin(time * 0.08 + phase) * 0.2;
          vAlpha = 0.08 + drift * 0.03;
          
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

function WarpOverlay({ active, direction }) {
  const [phase, setPhase] = useState('idle');
  const timerRef = useRef(null);

  useEffect(() => {
    if (active && direction === 'zoom-in') {
      setPhase('warping');
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setPhase('flash'), 1100);
    } else if (!active && phase !== 'idle') {
      setPhase('fading');
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setPhase('idle'), 600);
    }
    return () => clearTimeout(timerRef.current);
  }, [active, direction]);

  if (phase === 'idle') return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[45]">
      {phase === 'warping' && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 5%, transparent 20%, rgba(140,180,255,0.06) 35%, rgba(80,140,255,0.12) 55%, rgba(40,80,200,0.18) 75%, rgba(10,20,60,0.5) 100%)',
            animation: 'warpStreaks 1.2s ease-in forwards',
          }}
        />
      )}
      {phase === 'warping' && (
        <div
          className="absolute inset-0"
          style={{
            background: `
              repeating-conic-gradient(
                from 0deg at 50% 50%,
                transparent 0deg,
                rgba(180,220,255,0.04) 1.5deg,
                transparent 3deg,
                transparent 7deg,
                rgba(120,180,255,0.03) 8.5deg,
                transparent 10deg
              )
            `,
            animation: 'warpRotate 1.2s linear forwards',
            filter: 'blur(1px)',
          }}
        />
      )}
      {phase === 'warping' && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, transparent 60%, rgba(0,0,0,0.6) 100%)',
            animation: 'warpTunnel 1.2s ease-in forwards',
          }}
        />
      )}
      {(phase === 'flash' || phase === 'fading') && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(200,230,255,0.9) 0%, rgba(100,160,255,0.4) 30%, transparent 70%)',
            animation: 'warpFlash 0.5s ease-out forwards',
          }}
        />
      )}
      <style>{`
        @keyframes warpStreaks {
          0% { opacity: 0; transform: scale(1); filter: blur(0px); }
          30% { opacity: 1; transform: scale(1.02); filter: blur(0px); }
          70% { opacity: 1; transform: scale(1.05); filter: blur(2px); }
          100% { opacity: 1; transform: scale(1.15); filter: blur(6px); }
        }
        @keyframes warpRotate {
          0% { opacity: 0; transform: rotate(0deg) scale(1); }
          20% { opacity: 0.6; }
          60% { opacity: 1; transform: rotate(15deg) scale(1.3); }
          100% { opacity: 0.8; transform: rotate(40deg) scale(2); }
        }
        @keyframes warpTunnel {
          0% { opacity: 0; }
          40% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        @keyframes warpFlash {
          0% { opacity: 1; }
          30% { opacity: 0.6; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function CameraController({ 
  level, 
  targetPosition, 
  controlsRef,
  onTransitionComplete,
  setAutoRotateEnabled,
  onProgressUpdate
}) {
  const { camera, gl } = useThree();
  const startCamPos = useRef(new THREE.Vector3());
  const startLookAt = useRef(new THREE.Vector3());
  const targetCamPos = useRef(new THREE.Vector3(25, 20, 50));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const isAnimating = useRef(false);
  const animationPhase = useRef('idle');
  const elapsedTime = useRef(0);
  const arcOffset = useRef(new THREE.Vector3());
  const originalDpr = useRef(1);
  
  const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
  
  useEffect(() => {
    startCamPos.current.copy(camera.position);
    if (controlsRef.current) {
      startLookAt.current.copy(controlsRef.current.target);
    } else {
      startLookAt.current.set(0, 0, 0);
    }
    
    if (level === 'galaxy') {
      targetCamPos.current.set(25, 20, 50);
      targetLookAt.current.set(0, 0, 0);
      animationPhase.current = 'zoom-out';
    } else if (level === 'system' && targetPosition) {
      const hx = targetPosition.x || 0;
      const hy = targetPosition.y || 0;
      const hz = targetPosition.z || 0;
      
      targetLookAt.current.set(hx, hy, hz);
      targetCamPos.current.set(hx + 4, hy + 3, hz + 8);
      animationPhase.current = 'zoom-in';
    }
    
    const direction = new THREE.Vector3().subVectors(targetCamPos.current, startCamPos.current).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    arcOffset.current.crossVectors(direction, worldUp).normalize().multiplyScalar(3);
    
    isAnimating.current = true;
    elapsedTime.current = 0;
    
    originalDpr.current = gl.getPixelRatio();
    gl.setPixelRatio(Math.min(originalDpr.current, 1));
    
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
      controlsRef.current.autoRotate = false;
    }
  }, [level, targetPosition]);
  
  useFrame((state, delta) => {
    if (isAnimating.current) {
      elapsedTime.current += delta;
      
      const duration = 1.6;
      const progress = Math.min(elapsedTime.current / duration, 1);
      
      const eased = easeInOutCubic(progress);
      
      onProgressUpdate?.(eased, animationPhase.current);
      
      const arcStrength = 4 * eased * (1 - eased);
      
      const interpolatedPos = new THREE.Vector3().lerpVectors(startCamPos.current, targetCamPos.current, eased);
      interpolatedPos.add(arcOffset.current.clone().multiplyScalar(arcStrength));
      
      camera.position.copy(interpolatedPos);
      
      if (controlsRef.current) {
        const interpolatedLookAt = new THREE.Vector3().lerpVectors(startLookAt.current, targetLookAt.current, eased);
        controlsRef.current.target.copy(interpolatedLookAt);
        controlsRef.current.update();
      }
      
      if (progress >= 1) {
        isAnimating.current = false;
        gl.setPixelRatio(originalDpr.current);
        
        onProgressUpdate?.(1, 'idle');
        animationPhase.current = 'idle';
        
        camera.position.copy(targetCamPos.current);
        
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

function arrangeStarsInCluster(people, centerX = 0, centerY = 0, centerZ = 0, relationships = []) {
  const count = people.length;
  if (count === 0) return [];
  if (count === 1) {
    return [{
      ...people[0],
      position: [centerX, centerY, centerZ],
      isParent: true,
    }];
  }
  
  const personIds = new Set(people.map(p => p.id));
  const householdRelationships = relationships.filter(r => 
    personIds.has(r.person1_id) && personIds.has(r.person2_id)
  );
  
  const partners = new Set();
  const parents = new Set();
  const childrenIds = new Set();
  
  householdRelationships.forEach(rel => {
    const type = (rel.relationship_type || '').toLowerCase();
    if (type === 'partner' || type === 'spouse' || type === 'married') {
      partners.add(rel.person1_id);
      partners.add(rel.person2_id);
    }
    if (type === 'parent') {
      parents.add(rel.person1_id);
      childrenIds.add(rel.person2_id);
    }
    if (type === 'child') {
      parents.add(rel.person2_id);
      childrenIds.add(rel.person1_id);
    }
  });
  
  let parentPair = [];
  let childrenList = [];
  
  if (partners.size >= 2) {
    parentPair = people.filter(p => partners.has(p.id)).slice(0, 2);
    childrenList = people.filter(p => !parentPair.includes(p));
  } else if (parents.size > 0) {
    parentPair = people.filter(p => parents.has(p.id)).slice(0, 2);
    childrenList = people.filter(p => !parentPair.includes(p));
  } else {
    const adults = people.filter(p => {
      const roleType = (p.role_type || '').toLowerCase();
      return roleType.includes('parent') || roleType.includes('adult') || 
             roleType.includes('head') || roleType.includes('grandparent');
    });
    
    if (adults.length >= 2) {
      parentPair = adults.slice(0, 2);
      childrenList = people.filter(p => !parentPair.includes(p));
    } else if (adults.length === 1) {
      parentPair = adults;
      childrenList = people.filter(p => !parentPair.includes(p));
    } else {
      parentPair = people.slice(0, Math.min(2, count));
      childrenList = people.slice(parentPair.length);
    }
  }
  
  const positioned = [];
  
  const parentOrbitRadius = 1.2;
  const parentOrbitAngle = Math.PI / 6;
  
  if (parentPair.length >= 2) {
    positioned.push({
      ...parentPair[0],
      position: [
        centerX + Math.cos(parentOrbitAngle) * parentOrbitRadius,
        centerY + 0.3,
        centerZ + Math.sin(parentOrbitAngle) * parentOrbitRadius
      ],
      isParent: true,
    });
    positioned.push({
      ...parentPair[1],
      position: [
        centerX + Math.cos(parentOrbitAngle + Math.PI) * parentOrbitRadius,
        centerY - 0.3,
        centerZ + Math.sin(parentOrbitAngle + Math.PI) * parentOrbitRadius
      ],
      isParent: true,
    });
  } else if (parentPair.length === 1) {
    positioned.push({
      ...parentPair[0],
      position: [centerX, centerY, centerZ],
      isParent: true,
    });
  }
  
  const childOrbitRadius = 5.0;
  const childCount = childrenList.length;
  
  childrenList.forEach((child, index) => {
    const angleSpread = Math.PI * 2;
    const startAngle = -Math.PI / 2;
    const angle = startAngle + (index / Math.max(1, childCount)) * angleSpread;
    
    const seed = child.id || index;
    const radiusVariation = seededRandom(seed + '-rad') * 0.8 - 0.4;
    const yVariation = seededRandom(seed + '-y') * 0.6 - 0.3;
    
    const finalRadius = childOrbitRadius + radiusVariation;
    
    positioned.push({
      ...child,
      position: [
        centerX + Math.cos(angle) * finalRadius,
        centerY + yVariation,
        centerZ + Math.sin(angle) * finalRadius
      ],
      isParent: false,
    });
  });
  
  return positioned;
}

function TransitioningNebula({ household, householdPositions, households, opacity = 1, onFadeComplete }) {
  const groupRef = useRef();
  const lastOpacity = useRef(opacity);
  
  const pos = householdPositions.get(household.id);
  const colorIndex = households.findIndex(h => h.id === household.id);
  
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.traverse((child) => {
        if (child.material) {
          child.material.opacity = opacity;
          child.material.transparent = true;
        }
      });
    }
    
    if (lastOpacity.current > 0.01 && opacity <= 0.01) {
      onFadeComplete?.();
    }
    lastOpacity.current = opacity;
  });
  
  if (!pos) return null;
  
  return (
    <group ref={groupRef}>
      <HouseholdCluster
        position={[pos.x, pos.y, pos.z]}
        household={household}
        memberCount={pos.memberCount}
        colorIndex={colorIndex}
        isHovered={false}
        onClick={() => {}}
        onPointerOver={() => {}}
        onPointerOut={() => {}}
      />
    </group>
  );
}

function BloomingStars({ children, duration = 1.6 }) {
  const startTime = useRef(null);
  const [progress, setProgress] = useState(0);
  
  useFrame((state) => {
    if (startTime.current === null) {
      startTime.current = state.clock.elapsedTime;
    }
    
    const elapsed = state.clock.elapsedTime - startTime.current;
    const rawProgress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - rawProgress, 3);
    setProgress(eased);
  });
  
  return (
    <>
      {React.Children.map(children, child => 
        React.cloneElement(child, { 
          fadeOpacity: progress,
          bloomScale: 0.15 + progress * 0.85
        })
      )}
    </>
  );
}

function TransitionController({ 
  isTransitioning, 
  transitionDirection,
  onProgress 
}) {
  const startTime = useRef(null);
  const duration = 1.6;
  
  useFrame((state) => {
    if (!isTransitioning) {
      startTime.current = null;
      return;
    }
    
    if (startTime.current === null) {
      startTime.current = state.clock.elapsedTime;
    }
    
    const elapsed = state.clock.elapsedTime - startTime.current;
    const progress = Math.min(elapsed / duration, 1);
    const eased = progress < 0.5 
      ? 4 * progress * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    
    onProgress(eased, progress >= 1);
  });
  
  return null;
}

function FadeInGroup({ children, duration = 1.4, delay = 0.3 }) {
  const groupRef = useRef();
  const startTime = useRef(null);
  const [opacity, setOpacity] = useState(0);
  
  useFrame((state) => {
    if (startTime.current === null) {
      startTime.current = state.clock.elapsedTime;
    }
    
    const elapsed = state.clock.elapsedTime - startTime.current;
    const delayedElapsed = Math.max(0, elapsed - delay);
    const progress = Math.min(delayedElapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    
    if (groupRef.current) {
      groupRef.current.traverse((child) => {
        if (child.material) {
          child.material.opacity = eased;
          child.material.transparent = true;
        }
      });
    }
    setOpacity(eased);
  });
  
  return (
    <group ref={groupRef}>
      {React.Children.map(children, child => 
        React.cloneElement(child, { fadeOpacity: opacity })
      )}
    </group>
  );
}

function SystemCenterGlow({ position, color, intensity = 0.4 }) {
  const spriteRef = useRef();
  
  const glowTex = useMemo(() => {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    const center = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - center) / center;
        const dy = (y - center) / center;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const alpha = Math.pow(Math.max(0, 1 - dist), 3);
        const i = (y * size + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = Math.floor(alpha * 255);
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <sprite ref={spriteRef} position={position} scale={[2.5, 2.5, 1]}>
      <spriteMaterial
        map={glowTex}
        color={color}
        transparent
        opacity={intensity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </sprite>
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
  householdPosition,
  fadeOpacity = 1,
  bloomScale = 1,
}) {
  const householdPeople = useMemo(() => {
    return people.filter(p => p.household_id === household.id);
  }, [people, household.id]);
  
  const centerX = householdPosition?.x || 0;
  const centerY = householdPosition?.y || 0;
  const centerZ = householdPosition?.z || 0;
  
  const positionedPeople = useMemo(() => {
    return arrangeStarsInCluster(householdPeople, centerX, centerY, centerZ);
  }, [householdPeople, centerX, centerY, centerZ]);
  
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
      <SystemCenterGlow
        position={[centerX, centerY, centerZ]}
        color={colors.glow}
        intensity={0.25 * fadeOpacity}
      />
      <StarInstanced
        stars={starsWithProfiles}
        onStarClick={onStarClick}
        onStarHover={onStarHover}
        hoveredId={hoveredStarId}
        focusedId={focusedStarId}
        globalOpacity={fadeOpacity}
        globalScale={bloomScale}
      />
    </group>
  );
}

function AnimatedHouseholdGroup({ 
  household, 
  basePosition, 
  colorIndex, 
  isHovered, 
  isFocused,
  focusProgress,
  focusedHouseholdId,
  hoveredPos,
  stars,
  relationships = [],
  onStarClick,
  onStarHover,
  hoveredStarId,
  focusedStarId,
  onClick, 
  onPointerOver, 
  onPointerOut,
  viewMode = 'nebula',
  memberCount = 0,
  starClass,
  showLabels = true,
}) {
  const groupRef = useRef();
  const { camera } = useThree();
  const currentState = useRef({
    offsetX: 0, offsetY: 0, offsetZ: 0,
    scale: 1, opacity: 0.8, starOpacity: 1
  });
  const [renderOpacity, setRenderOpacity] = useState(0.8);
  const [starRenderOpacity, setStarRenderOpacity] = useState(1);
  
  const localStars = useMemo(() => {
    return stars.map(star => ({
      ...star,
      position: [
        star.position[0] - basePosition.x,
        star.position[1] - basePosition.y,
        star.position[2] - basePosition.z
      ]
    }));
  }, [stars, basePosition]);
  
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    const cameraForward = new THREE.Vector3();
    camera.getWorldDirection(cameraForward);
    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(camera.up, cameraForward).normalize();
    const cameraUp = new THREE.Vector3();
    cameraUp.crossVectors(cameraForward, cameraRight).normalize();
    
    let targetOffsetX = 0, targetOffsetY = 0, targetOffsetZ = 0;
    let targetScale = 1;
    let targetOpacity = 0.8;
    let targetStarOpacity = 1;
    
    if (isFocused) {
      targetScale = 1 + focusProgress * 0.5;
      targetOpacity = Math.max(0.05, 1 - focusProgress * 1.2);
      targetStarOpacity = 1;
    } else if (focusedHouseholdId) {
      const fadeAmount = Math.min(1, focusProgress * 2);
      targetOpacity = 0.8 - fadeAmount * 0.7;
      targetStarOpacity = 1 - fadeAmount * 0.85;
      targetScale = 1 - fadeAmount * 0.15;
    } else if (isHovered) {
      const towardCamera = cameraForward.clone().multiplyScalar(-6);
      targetOffsetX = towardCamera.x;
      targetOffsetY = towardCamera.y;
      targetOffsetZ = towardCamera.z;
      targetScale = 1.5;
      targetOpacity = 1;
      targetStarOpacity = 1;
    } else if (hoveredPos) {
      const dx = basePosition.x - hoveredPos.x;
      const dy = basePosition.y - hoveredPos.y;
      const dz = basePosition.z - hoveredPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      if (dist < 30 && dist > 0) {
        const worldPush = new THREE.Vector3(dx, dy, dz).normalize();
        const forwardComponent = worldPush.dot(cameraForward);
        worldPush.sub(cameraForward.clone().multiplyScalar(forwardComponent));
        worldPush.normalize();
        
        const pushStrength = Math.pow(1 - dist / 30, 1.8) * 6;
        targetOffsetX = worldPush.x * pushStrength;
        targetOffsetY = worldPush.y * pushStrength;
        targetOffsetZ = worldPush.z * pushStrength;
        targetOpacity = 0.6;
        targetStarOpacity = 0.8;
        targetScale = 0.95;
      }
    }
    
    const lerpSpeed = 4.5 * delta;
    const curr = currentState.current;
    curr.offsetX += (targetOffsetX - curr.offsetX) * lerpSpeed;
    curr.offsetY += (targetOffsetY - curr.offsetY) * lerpSpeed;
    curr.offsetZ += (targetOffsetZ - curr.offsetZ) * lerpSpeed;
    curr.scale += (targetScale - curr.scale) * lerpSpeed;
    curr.opacity += (targetOpacity - curr.opacity) * lerpSpeed;
    curr.starOpacity += (targetStarOpacity - curr.starOpacity) * lerpSpeed;
    
    groupRef.current.position.set(
      basePosition.x + curr.offsetX,
      basePosition.y + curr.offsetY,
      basePosition.z + curr.offsetZ
    );
    groupRef.current.scale.setScalar(curr.scale);
    
    if (Math.abs(curr.opacity - renderOpacity) > 0.01) {
      setRenderOpacity(curr.opacity);
    }
    if (Math.abs(curr.starOpacity - starRenderOpacity) > 0.01) {
      setStarRenderOpacity(curr.starOpacity);
    }
  });
  
  return (
    <group ref={groupRef}>
      <StarMapCluster
        position={[0, 0, 0]}
        household={household}
        memberCount={memberCount}
        starClass={starClass}
        isHovered={isHovered && !focusedHouseholdId}
        isSystemView={!!focusedHouseholdId}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        showLabels={showLabels}
      />
      <ConstellationLines
        stars={localStars}
        relationships={relationships}
        colorIndex={colorIndex}
        opacity={starRenderOpacity * (isFocused ? 0.8 : 0.5)}
      />
      <StarInstanced
        stars={localStars}
        onStarClick={focusedHouseholdId ? onStarClick : (star) => onClick()}
        onStarHover={focusedHouseholdId ? onStarHover : () => {}}
        hoveredId={focusedHouseholdId ? hoveredStarId : null}
        focusedId={focusedHouseholdId ? focusedStarId : null}
        globalOpacity={starRenderOpacity}
        globalScale={1}
        animated={isFocused}
      />
    </group>
  );
}

function FamilyOrbitRing({ center, radius, colorIndex, opacity = 0.3 }) {
  const ringRef = useRef();
  
  const { points, dashPoints } = useMemo(() => {
    const segments = 128;
    const pts = [];
    const dPts = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = center[0] + Math.cos(angle) * radius;
      const y = center[1];
      const z = center[2] + Math.sin(angle) * radius;
      pts.push(new THREE.Vector3(x, y, z));
      const tickRadius = radius + 0.08;
      dPts.push(new THREE.Vector3(
        center[0] + Math.cos(angle) * tickRadius,
        y,
        center[2] + Math.sin(angle) * tickRadius
      ));
    }
    return { points: pts, dashPoints: dPts };
  }, [center, radius]);
  
  const baseColors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  const ringColor = new THREE.Color(baseColors.glow);
  
  return (
    <group>
      <line ref={ringRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={ringColor}
          transparent
          opacity={opacity * 1.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={dashPoints.length}
            array={new Float32Array(dashPoints.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={ringColor}
          transparent
          opacity={opacity * 0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>
    </group>
  );
}

function ParentOrbitRing({ center, radius, colorIndex, opacity = 0.5 }) {
  const ringRef = useRef();
  
  const points = useMemo(() => {
    const segments = 48;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        center[0] + Math.cos(angle) * radius,
        center[1],
        center[2] + Math.sin(angle) * radius
      ));
    }
    return pts;
  }, [center, radius]);
  
  const baseColors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  const ringColor = new THREE.Color(baseColors.primary);
  
  return (
    <group>
      <line ref={ringRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={ringColor}
          transparent
          opacity={opacity * 1.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>
      <mesh position={[center[0], center[1], center[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.02, radius + 0.02, 48]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={opacity * 0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function ConstellationLines({ stars, relationships, colorIndex, opacity = 0.6 }) {
  const lineRef = useRef();
  
  const { positions, colors, familyCenter, hasParents, hasChildren } = useMemo(() => {
    if (!stars || stars.length < 2) {
      return { positions: new Float32Array(0), colors: new Float32Array(0), familyCenter: [0,0,0], hasParents: false, hasChildren: false };
    }
    
    const starMap = new Map();
    stars.forEach(star => {
      starMap.set(star.id, { position: star.position, isParent: star.isParent });
    });
    
    const parentStars = stars.filter(s => s.isParent);
    const childStars = stars.filter(s => !s.isParent);
    
    let centerX = 0, centerY = 0, centerZ = 0;
    if (parentStars.length > 0) {
      centerX = parentStars.reduce((sum, s) => sum + s.position[0], 0) / parentStars.length;
      centerY = parentStars.reduce((sum, s) => sum + s.position[1], 0) / parentStars.length;
      centerZ = parentStars.reduce((sum, s) => sum + s.position[2], 0) / parentStars.length;
    }
    
    const starIds = new Set(stars.map(s => s.id));
    const lines = [];
    
    if (parentStars.length >= 2) {
      lines.push({ 
        from: parentStars[0].position, 
        to: parentStars[1].position, 
        type: 'partner',
        isPartnerLine: true
      });
    }
    
    const parentIds = new Set(parentStars.map(p => p.id));
    const mainParent = parentStars[0];
    
    if (mainParent && childStars.length > 0) {
      const parentCenter = [centerX, centerY, centerZ];
      childStars.forEach(child => {
        lines.push({
          from: parentCenter,
          to: child.position,
          type: 'parent',
          isPartnerLine: false
        });
      });
    }
    
    if (lines.length === 0 && relationships) {
      relationships.forEach(rel => {
        if (starIds.has(rel.person1_id) && starIds.has(rel.person2_id)) {
          const star1 = starMap.get(rel.person1_id);
          const star2 = starMap.get(rel.person2_id);
          if (star1 && star2) {
            lines.push({ from: star1.position, to: star2.position, type: rel.relationship_type });
          }
        }
      });
    }
    
    const pos = new Float32Array(lines.length * 6);
    const col = new Float32Array(lines.length * 6);
    
    const baseColors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
    const lineColor = new THREE.Color(baseColors.glow);
    
    lines.forEach((line, i) => {
      pos[i * 6] = line.from[0];
      pos[i * 6 + 1] = line.from[1];
      pos[i * 6 + 2] = line.from[2];
      pos[i * 6 + 3] = line.to[0];
      pos[i * 6 + 4] = line.to[1];
      pos[i * 6 + 5] = line.to[2];
      
      const normalizedType = (line.type || '').toLowerCase();
      const isPartner = line.isPartnerLine || normalizedType === 'partner' || normalizedType === 'spouse' || normalizedType === 'married';
      const brightness = isPartner ? 1.2 : 0.5;
      col[i * 6] = lineColor.r * brightness;
      col[i * 6 + 1] = lineColor.g * brightness;
      col[i * 6 + 2] = lineColor.b * brightness;
      col[i * 6 + 3] = lineColor.r * brightness * 0.3;
      col[i * 6 + 4] = lineColor.g * brightness * 0.3;
      col[i * 6 + 5] = lineColor.b * brightness * 0.3;
    });
    
    return { 
      positions: pos, 
      colors: col, 
      familyCenter: [centerX, centerY, centerZ],
      hasParents: parentStars.length > 0,
      hasChildren: childStars.length > 0
    };
  }, [stars, relationships, colorIndex]);
  
  if (positions.length === 0) return null;
  
  return (
    <group>
      {hasParents && (
        <ParentOrbitRing 
          center={familyCenter} 
          radius={0.8} 
          colorIndex={colorIndex} 
          opacity={0.55}
        />
      )}
      {hasParents && hasChildren && (
        <FamilyOrbitRing 
          center={familyCenter} 
          radius={3.0} 
          colorIndex={colorIndex} 
          opacity={0.35}
        />
      )}
      <lineSegments ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial 
          vertexColors 
          transparent 
          opacity={opacity} 
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          linewidth={1}
        />
      </lineSegments>
    </group>
  );
}

function HouseholdConnectionLines({ edges, householdPositions, hoveredHouseholdId }) {
  const linesRef = useRef();

  const { positions, colors, hoverMask } = useMemo(() => {
    if (!edges || edges.length === 0) {
      return { positions: new Float32Array(0), colors: new Float32Array(0), hoverMask: [] };
    }

    const pos = new Float32Array(edges.length * 6);
    const col = new Float32Array(edges.length * 6);
    const mask = [];

    edges.forEach((edge, i) => {
      const fromPos = householdPositions.get(edge.from);
      const toPos = householdPositions.get(edge.to);
      if (!fromPos || !toPos) {
        pos[i * 6] = 0; pos[i * 6 + 1] = 0; pos[i * 6 + 2] = 0;
        pos[i * 6 + 3] = 0; pos[i * 6 + 4] = 0; pos[i * 6 + 5] = 0;
        col[i * 6] = 0; col[i * 6 + 1] = 0; col[i * 6 + 2] = 0;
        col[i * 6 + 3] = 0; col[i * 6 + 4] = 0; col[i * 6 + 5] = 0;
        mask.push({ from: null, to: null });
        return;
      }

      pos[i * 6] = fromPos.x;
      pos[i * 6 + 1] = fromPos.y;
      pos[i * 6 + 2] = fromPos.z;
      pos[i * 6 + 3] = toPos.x;
      pos[i * 6 + 4] = toPos.y;
      pos[i * 6 + 5] = toPos.z;

      const baseColor = 0.25;
      col[i * 6] = baseColor;
      col[i * 6 + 1] = baseColor;
      col[i * 6 + 2] = baseColor;
      col[i * 6 + 3] = baseColor;
      col[i * 6 + 4] = baseColor;
      col[i * 6 + 5] = baseColor;

      mask.push({ from: edge.from, to: edge.to });
    });

    return { positions: pos, colors: col, hoverMask: mask };
  }, [edges, householdPositions]);

  useFrame(() => {
    if (!linesRef.current || !linesRef.current.geometry) return;
    const colorAttr = linesRef.current.geometry.getAttribute('color');
    if (!colorAttr) return;

    let needsUpdate = false;
    for (let i = 0; i < hoverMask.length; i++) {
      const edge = hoverMask[i];
      if (!edge.from) continue;

      const isHighlighted = hoveredHouseholdId && (edge.from === hoveredHouseholdId || edge.to === hoveredHouseholdId);
      const r = isHighlighted ? 0.7 : 0.25;
      const g = isHighlighted ? 0.8 : 0.25;
      const b = isHighlighted ? 1.0 : 0.25;

      const ci = i * 6;
      if (colorAttr.array[ci] !== r || colorAttr.array[ci + 1] !== g || colorAttr.array[ci + 2] !== b) {
        colorAttr.array[ci] = r;
        colorAttr.array[ci + 1] = g;
        colorAttr.array[ci + 2] = b;
        colorAttr.array[ci + 3] = r;
        colorAttr.array[ci + 4] = g;
        colorAttr.array[ci + 5] = b;
        needsUpdate = true;
      }
    }
    if (needsUpdate) {
      colorAttr.needsUpdate = true;
    }

    linesRef.current.material.opacity = hoveredHouseholdId ? 0.5 : 0.15;
  });

  if (positions.length === 0) return null;

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.15}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        linewidth={1}
      />
    </lineSegments>
  );
}

function UnifiedGalaxyScene({
  households,
  householdPositions,
  people,
  relationships = [],
  focusedHouseholdId,
  hoveredHouseholdId,
  hoveredStarId,
  focusedStarId,
  onHouseholdClick,
  onHouseholdHover,
  onStarClick,
  onStarHover,
  focusProgress = 0,
  viewMode = 'nebula',
  filters = {},
}) {
  const starsByHousehold = useMemo(() => {
    const map = new Map();
    households.forEach((household, householdIndex) => {
      const pos = householdPositions.get(household.id);
      if (!pos) return;
      
      const householdPeople = people.filter(p => p.household_id === household.id);
      const positionedPeople = arrangeStarsInCluster(householdPeople, pos.x, pos.y, pos.z, relationships);
      
      const stars = positionedPeople.map(person => ({
        id: person.id,
        householdId: household.id,
        household,
        householdIndex,
        position: person.position,
        starProfile: person.star_profile || generateRandomStarProfile(person.id),
        person,
      }));
      
      map.set(household.id, stars);
    });
    return map;
  }, [households, householdPositions, people, relationships]);
  
  const householdEdges = useMemo(() => {
    return computeHouseholdEdges(relationships, people);
  }, [relationships, people]);

  const hoveredPos = useMemo(() => {
    if (!hoveredHouseholdId) return null;
    return householdPositions.get(hoveredHouseholdId);
  }, [hoveredHouseholdId, householdPositions]);
  
  return (
    <group>
      {!focusedHouseholdId && filters.showLines !== false && (
        <HouseholdConnectionLines
          edges={householdEdges}
          householdPositions={householdPositions}
          hoveredHouseholdId={hoveredHouseholdId}
        />
      )}
      {households.map((household, index) => {
        const pos = householdPositions.get(household.id);
        if (!pos) return null;
        
        const isFocused = household.id === focusedHouseholdId;
        const isHovered = household.id === hoveredHouseholdId;
        const householdStars = starsByHousehold.get(household.id) || [];
        
        const mc = pos.memberCount || 0;
        const sc = classifyHousehold(mc);

        return (
          <AnimatedHouseholdGroup
            key={`household-${household.id}`}
            household={household}
            basePosition={pos}
            colorIndex={index}
            isHovered={isHovered}
            isFocused={isFocused}
            focusProgress={focusProgress}
            focusedHouseholdId={focusedHouseholdId}
            hoveredPos={hoveredPos}
            stars={householdStars}
            relationships={relationships}
            onStarClick={onStarClick}
            onStarHover={onStarHover}
            hoveredStarId={hoveredStarId}
            focusedStarId={focusedStarId}
            onClick={() => !focusedHouseholdId && onHouseholdClick(household)}
            onPointerOver={() => !focusedHouseholdId && onHouseholdHover(household.id)}
            onPointerOut={() => onHouseholdHover(null)}
            viewMode={viewMode}
            memberCount={mc}
            starClass={sc}
            showLabels={filters.showLabels !== false}
          />
        );
      })}
    </group>
  );
}

const createNebulaTexture = (colorHex, seed = 0, style = 'cloud') => {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const center = size / 2;
  
  const color = new THREE.Color(colorHex);
  const r = Math.floor(color.r * 255);
  const g = Math.floor(color.g * 255);
  const b = Math.floor(color.b * 255);
  
  const hash = (n) => {
    let x = Math.sin(n + seed) * 43758.5453;
    return x - Math.floor(x);
  };
  
  const noise2d = (px, py) => {
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    const fx = px - ix;
    const fy = py - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix + iy * 57);
    const b = hash(ix + 1 + iy * 57);
    const c = hash(ix + (iy + 1) * 57);
    const d = hash(ix + 1 + (iy + 1) * 57);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  
  const fbm = (px, py, octaves) => {
    let val = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      val += noise2d(px * freq, py * freq) * amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return val;
  };
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      const nx = x / size * 4 + seed * 0.1;
      const ny = y / size * 4 + seed * 0.13;
      
      let density;
      if (style === 'wispy') {
        const warp = fbm(nx * 0.5, ny * 0.5, 3) * 2;
        const filament = fbm(nx + warp, ny + warp, 4);
        const ridged = 1 - Math.abs(filament * 2 - 1);
        density = ridged * ridged;
      } else if (style === 'core') {
        const core = fbm(nx * 1.5, ny * 1.5, 5);
        const bright = Math.pow(core, 0.7);
        density = bright * (1 - dist * 0.8);
      } else {
        const cloud = fbm(nx, ny, 4);
        const detail = fbm(nx * 2, ny * 2, 3) * 0.3;
        density = cloud + detail;
      }
      
      const edgeNoise = fbm(angle * 3 + seed, dist * 2, 3) * 0.25;
      const irregularEdge = 0.85 + edgeNoise;
      const falloff = Math.max(0, 1 - Math.pow(dist / irregularEdge, 2.5));
      
      const alpha = Math.pow(density * falloff, 1.2) * 0.9;
      
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.floor(Math.min(1, Math.max(0, alpha)) * 255);
    }
  }
  
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
};

function HouseholdLabel({ name, isVisible, color }) {
  if (!isVisible || !name) return null;
  
  return (
    <Html
      center
      position={[0, 0, 0]}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div style={{
        background: `linear-gradient(135deg, ${color}22 0%, ${color}44 100%)`,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${color}66`,
        borderRadius: '12px',
        padding: '8px 16px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '500',
        letterSpacing: '0.5px',
        textShadow: `0 0 10px ${color}, 0 0 20px ${color}88`,
        boxShadow: `0 0 20px ${color}33, 0 4px 12px rgba(0,0,0,0.3)`,
        whiteSpace: 'nowrap',
        animation: 'fadeIn 0.2s ease-out',
      }}>
        {name}
      </div>
    </Html>
  );
}

function HouseholdAtmosphere({ position, colorIndex, opacity, scale = 1, isHovered = false, householdName = '', onClick, onPointerOver, onPointerOut, isFocusedView = false }) {
  const colors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  
  const textures = useMemo(() => ({
    core: createNebulaTexture(colors.primary, colorIndex * 7, 'core'),
    cloud: createNebulaTexture(colors.secondary, colorIndex * 11 + 3, 'cloud'),
    wispy: createNebulaTexture(colors.glow, colorIndex * 13 + 7, 'wispy'),
    outer: createNebulaTexture(colors.primary, colorIndex * 17 + 11, 'cloud'),
  }), [colors, colorIndex]);
  
  const stretch1 = 1.3 + (colorIndex % 3) * 0.2;
  const stretch2 = 0.8 + (colorIndex % 4) * 0.15;
  const baseRotation = (colorIndex * 0.7) % (Math.PI * 2);
  
  const hitboxRadius = scale * 5;
  
  return (
    <group position={position}>
      <HouseholdLabel name={householdName} isVisible={isHovered} color={colors.primary} />
      
      {/* 3D sphere hitbox for better raycasting from any angle */}
      <mesh
        visible={false}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
          onPointerOver?.(e);
        }}
        onPointerOut={(e) => {
          document.body.style.cursor = 'default';
          onPointerOut?.(e);
        }}
      >
        <sphereGeometry args={[hitboxRadius, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      <sprite 
        scale={[scale * 6 * stretch1, scale * 5, 1]}
        rotation={[0, 0, baseRotation]}
      >
        <spriteMaterial
          map={textures.core}
          transparent
          opacity={opacity * 0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <sprite 
        scale={[scale * 9 * stretch2, scale * 7, 1]} 
        rotation={[0, 0, baseRotation + 0.5]}
      >
        <spriteMaterial
          map={textures.cloud}
          transparent
          opacity={opacity * 0.38}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <sprite 
        scale={[scale * 11, scale * 8 * stretch1, 1]} 
        rotation={[0, 0, baseRotation - 0.4]}
      >
        <spriteMaterial
          map={textures.wispy}
          transparent
          opacity={opacity * 0.25}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <sprite 
        scale={[scale * 14 * stretch2, scale * 12, 1]} 
        rotation={[0, 0, baseRotation + 0.8]}
      >
        <spriteMaterial
          map={textures.outer}
          transparent
          opacity={opacity * 0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <pointLight 
        color={colors.primary} 
        intensity={opacity * (isHovered ? 0.3 : 0.18)} 
        distance={isHovered ? 12 : 9}
        decay={2}
      />
    </group>
  );
}

function MotionTrailEffect() {
  const { camera } = useThree();
  const prevPos = useRef(new THREE.Vector3());
  const trailRef = useRef();
  const velocitySmooth = useRef(0);
  
  const trailMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float intensity;
        uniform vec3 trailColor;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float glow = exp(-dist * 3.0) * intensity;
          if (glow < 0.005) discard;
          gl_FragColor = vec4(trailColor * glow, glow * 0.4);
        }
      `,
      uniforms: {
        intensity: { value: 0 },
        trailColor: { value: new THREE.Color(0.3, 0.5, 0.8) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, []);
  
  useFrame(() => {
    const dx = camera.position.x - prevPos.current.x;
    const dy = camera.position.y - prevPos.current.y;
    const dz = camera.position.z - prevPos.current.z;
    const velocity = Math.sqrt(dx * dx + dy * dy + dz * dz);
    prevPos.current.copy(camera.position);
    
    const target = Math.min(velocity * 1.5, 0.6);
    velocitySmooth.current += (target - velocitySmooth.current) * 0.08;
    
    trailMaterial.uniforms.intensity.value = velocitySmooth.current;
    
    if (trailRef.current) {
      trailRef.current.visible = velocitySmooth.current > 0.01;
      trailRef.current.position.copy(camera.position);
      trailRef.current.lookAt(
        camera.position.x + dx * 10,
        camera.position.y + dy * 10,
        camera.position.z + dz * 10
      );
    }
  });
  
  return (
    <mesh ref={trailRef} visible={false} raycast={() => null}>
      <planeGeometry args={[400, 400]} />
      <primitive object={trailMaterial} attach="material" />
    </mesh>
  );
}

function FogController() {
  const { scene } = useThree();
  
  useEffect(() => {
    scene.fog = new THREE.FogExp2('#1a2a1a', 0.0015);
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
  isTransitioning,
  transitioningHousehold,
  onTransitionComplete,
  viewMode = 'nebula',
  filters = {},
}) {
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [transitionDirection, setTransitionDirection] = useState(null);
  
  const handleProgressUpdate = useCallback((progress, direction) => {
    setTransitionProgress(progress);
    setTransitionDirection(direction);
  }, []);
  
  const selectedHouseholdPosition = useMemo(() => {
    if (!selectedHousehold) return null;
    return householdPositions.get(selectedHousehold.id);
  }, [selectedHousehold, householdPositions]);
  
  const transitioningHouseholdPosition = useMemo(() => {
    if (!transitioningHousehold) return null;
    return householdPositions.get(transitioningHousehold.id);
  }, [transitioningHousehold, householdPositions]);
  
  const cameraTargetPosition = transitioningHouseholdPosition || selectedHouseholdPosition;
  
  const selectedColorIndex = useMemo(() => {
    if (!selectedHousehold) return 0;
    return households.findIndex(h => h.id === selectedHousehold.id);
  }, [selectedHousehold, households]);
  
  const effectiveFocusProgress = useMemo(() => {
    if (transitionDirection === 'zoom-in') {
      return transitionProgress;
    } else if (transitionDirection === 'zoom-out') {
      return 1 - transitionProgress;
    } else if (transitionDirection === 'idle' || transitionDirection === null) {
      return level === 'system' ? 1 : 0;
    }
    return 0;
  }, [transitionProgress, transitionDirection, level]);
  
  const nebulaOpacity = useMemo(() => {
    if (transitionDirection === 'zoom-in') {
      return Math.max(0, 1 - transitionProgress * 1.2);
    }
    return 1;
  }, [transitionProgress, transitionDirection]);
  
  const starBloom = useMemo(() => {
    if (transitionDirection === 'zoom-in') {
      const delayed = Math.max(0, (transitionProgress - 0.15) / 0.85);
      return 0.1 + delayed * 0.9;
    }
    return 1;
  }, [transitionProgress, transitionDirection]);
  
  const effectiveFocusedId = useMemo(() => {
    if (transitionDirection === 'zoom-out') {
      return transitioningHousehold?.id;
    } else if (transitionDirection === 'idle' || transitionDirection === null) {
      return selectedHousehold?.id || null;
    }
    return selectedHousehold?.id || transitioningHousehold?.id;
  }, [selectedHousehold, transitioningHousehold, transitionDirection]);
  
  return (
    <>
      <CameraController
        level={isTransitioning ? 'system' : level}
        targetPosition={cameraTargetPosition}
        controlsRef={controlsRef}
        onTransitionComplete={onTransitionComplete}
        setAutoRotateEnabled={setAutoRotateEnabled}
        onProgressUpdate={handleProgressUpdate}
      />
      
      <FogController />
      <MotionTrailEffect />
      
      <ambientLight intensity={0.1} />
      <pointLight position={[40, 30, 40]} intensity={0.2} color="#ffffff" />
      <pointLight position={[-30, -10, -30]} intensity={0.15} color={NEBULA_COLORS.vibrantPurple} />
      <pointLight position={[0, 50, 0]} intensity={0.1} color={NEBULA_COLORS.cyan} />
      <pointLight position={[20, -20, 30]} intensity={0.08} color={NEBULA_COLORS.warmPink} />
      
      <NebulaBackground />
      
      <NebulaGasCloud count={qualityTier.gasCount} />
      
      <UnifiedGalaxyScene
        households={households}
        householdPositions={householdPositions}
        people={people}
        relationships={relationships}
        focusedHouseholdId={effectiveFocusedId}
        hoveredHouseholdId={hoveredHouseholdId}
        hoveredStarId={hoveredStarId}
        focusedStarId={focusedStarId}
        onHouseholdClick={onHouseholdClick}
        onHouseholdHover={onHouseholdHover}
        onStarClick={onStarClick}
        onStarHover={onStarHover}
        focusProgress={effectiveFocusProgress}
        viewMode={viewMode}
        filters={filters}
      />
      
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

function CameraTracker({ onCameraUpdate }) {
  const { camera } = useThree();
  
  useFrame(() => {
    onCameraUpdate?.({
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    });
  });
  
  return null;
}

function ScanlineOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none z-[1]"
      style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.015) 2px, rgba(0,255,255,0.015) 4px)',
        mixBlendMode: 'overlay',
      }}
    />
  );
}

function CornerBrackets({ children, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-400/60" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-400/60" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-400/60" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-400/60" />
      {children}
      <ScanlineOverlay />
    </div>
  );
}

function HoverTooltip({ household, memberCount, starClass, mousePos }) {
  if (!household || !mousePos) return null;

  return (
    <div
      className="fixed z-[60] pointer-events-none"
      style={{ left: mousePos.x + 16, top: mousePos.y - 12 }}
    >
      <CornerBrackets className="bg-slate-950/90 backdrop-blur-md px-3 py-2 min-w-[140px]">
        <div className="text-[11px] uppercase tracking-[0.15em] text-cyan-400/70 mb-1">System Detected</div>
        <div className="text-sm font-semibold text-slate-100 tracking-wide">{household.name}</div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-xs text-slate-400">{memberCount} {memberCount === 1 ? 'body' : 'bodies'}</span>
          <span className="flex items-center gap-1 text-xs">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: starClass?.colors?.inner || '#fff' }}
            />
            <span className="text-slate-300">{starClass?.label || 'Unknown'}</span>
          </span>
        </div>
      </CornerBrackets>
    </div>
  );
}

function SystemInfoPanel({ household, memberCount, starClass, people, onClose }) {
  if (!household) return null;

  const members = people.filter(p => p.household_id === household.id);

  return (
    <div className="absolute bottom-6 left-6 z-50 w-[320px] max-w-[calc(100vw-3rem)]">
      <CornerBrackets className="bg-slate-950/90 backdrop-blur-xl p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/60 mb-1">System Overview</div>
            <h3 className="text-lg font-bold text-slate-100 tracking-wide">{household.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent mb-3" />

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-slate-800/40 rounded px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-widest text-slate-500">Star Class</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="w-2.5 h-2.5 rounded-full shadow-lg"
                style={{
                  backgroundColor: starClass?.colors?.inner || '#fff',
                  boxShadow: `0 0 6px ${starClass?.colors?.glow || '#fff'}`,
                }}
              />
              <span className="text-sm font-medium text-slate-200">{starClass?.label}</span>
            </div>
          </div>
          <div className="bg-slate-800/40 rounded px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-widest text-slate-500">Bodies</div>
            <div className="text-sm font-medium text-slate-200 mt-0.5">{memberCount}</div>
          </div>
        </div>

        {starClass?.description && (
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">{starClass.description}</div>
        )}

        {members.length > 0 && (
          <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-1 h-1 rounded-full bg-cyan-400/50" />
                <span className="text-slate-300">{m.name}</span>
                {m.role_type && <span className="text-slate-600">· {m.role_type}</span>}
              </div>
            ))}
          </div>
        )}
      </CornerBrackets>
    </div>
  );
}

function TopBar({ level, selectedHousehold, cameraPos, onBackToGalaxy }) {
  const coordStr = cameraPos
    ? `${cameraPos.x.toFixed(1)} · ${cameraPos.y.toFixed(1)} · ${cameraPos.z.toFixed(1)}`
    : '0.0 · 0.0 · 0.0';

  return (
    <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            onClick={onBackToGalaxy}
            className="flex items-center gap-2 group"
          >
            <Home className="w-4 h-4 text-cyan-400/70 group-hover:text-cyan-300 transition-colors" />
            <span
              className={`text-xs uppercase tracking-[0.2em] font-medium transition-colors ${
                level === 'galaxy' ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'
              }`}
            >
              Galaxy Map
            </span>
          </button>
          {level === 'system' && selectedHousehold && (
            <>
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <span className="text-xs uppercase tracking-[0.2em] font-medium text-cyan-400">
                System Map
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-[10px] font-mono tracking-wider text-slate-500">
            <span className="text-slate-600 mr-1">POS</span>
            {coordStr}
          </div>
          {level === 'system' && selectedHousehold && (
            <span className="text-[10px] uppercase tracking-[0.15em] text-cyan-400/50 border border-cyan-400/20 px-2 py-0.5 rounded">
              {selectedHousehold.name}
            </span>
          )}
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent" />
    </div>
  );
}

function FilterToggles({
  viewMode,
  onToggleViewMode,
  filters,
  onToggleFilter,
}) {
  const classButtons = [
    { key: 'F', label: 'F', color: '#FFD700', desc: 'Yellow' },
    { key: 'K', label: 'K', color: '#FF6B4A', desc: 'Red' },
    { key: 'E', label: 'E', color: '#50C878', desc: 'Green' },
    { key: 'O', label: 'O', color: '#4DA6FF', desc: 'Blue' },
  ];

  return (
    <div className="absolute top-16 left-4 z-50">
      <CornerBrackets className="bg-slate-950/80 backdrop-blur-md p-2.5 space-y-2.5">
        <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 px-1">Filters</div>

        <div className="flex gap-1">
          {classButtons.map(cls => {
            const active = filters.starClasses[cls.key];
            return (
              <button
                key={cls.key}
                onClick={() => onToggleFilter('starClass', cls.key)}
                className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold border transition-all ${
                  active
                    ? 'border-current'
                    : 'border-slate-700 opacity-30'
                }`}
                style={{ color: cls.color, borderColor: active ? cls.color + '66' : undefined }}
                title={`${cls.desc} Stars (${cls.label})`}
              >
                {cls.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-1">
          <button
            onClick={() => onToggleFilter('showLines')}
            className={`flex items-center gap-2 text-[10px] uppercase tracking-wider px-1 py-0.5 w-full rounded transition-colors ${
              filters.showLines ? 'text-cyan-400' : 'text-slate-600'
            }`}
          >
            {filters.showLines ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            Lines
          </button>
          <button
            onClick={() => onToggleFilter('showLabels')}
            className={`flex items-center gap-2 text-[10px] uppercase tracking-wider px-1 py-0.5 w-full rounded transition-colors ${
              filters.showLabels ? 'text-cyan-400' : 'text-slate-600'
            }`}
          >
            {filters.showLabels ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            Labels
          </button>
        </div>

        <div className="h-px bg-slate-700/50" />

        <button
          onClick={onToggleViewMode}
          className="flex items-center gap-2 px-1 py-0.5 text-[10px] uppercase tracking-wider text-slate-400 hover:text-white transition-colors w-full"
          title={viewMode === 'nebula' ? 'Switch to Star Map' : 'Switch to Nebula Mode'}
        >
          {viewMode === 'nebula' ? (
            <>
              <Sparkles className="w-3 h-3 text-cyan-400" />
              Star Map
            </>
          ) : (
            <>
              <Cloud className="w-3 h-3 text-purple-400" />
              Nebula
            </>
          )}
        </button>
      </CornerBrackets>
    </div>
  );
}

function Minimap({ cameraPos, householdPositions, households }) {
  const size = 80;
  const mapRange = 100;

  const toMapCoord = (worldX, worldZ) => ({
    x: ((worldX + mapRange) / (mapRange * 2)) * size,
    y: ((worldZ + mapRange) / (mapRange * 2)) * size,
  });

  const cam = cameraPos ? toMapCoord(cameraPos.x, cameraPos.z) : { x: size / 2, y: size / 2 };

  return (
    <div className="absolute bottom-6 right-6 z-50">
      <CornerBrackets className="bg-slate-950/80 backdrop-blur-md p-1">
        <svg width={size} height={size} className="block">
          <rect width={size} height={size} fill="transparent" />
          {households.map(h => {
            const pos = householdPositions.get(h.id);
            if (!pos) return null;
            const pt = toMapCoord(pos.x, pos.z);
            return (
              <circle
                key={h.id}
                cx={Math.max(2, Math.min(size - 2, pt.x))}
                cy={Math.max(2, Math.min(size - 2, pt.y))}
                r={1.5}
                fill="rgba(100,200,255,0.5)"
              />
            );
          })}
          <rect
            x={Math.max(0, cam.x - 4)}
            y={Math.max(0, cam.y - 4)}
            width={8}
            height={8}
            fill="none"
            stroke="rgba(0,255,255,0.7)"
            strokeWidth={1}
          />
          <circle
            cx={cam.x}
            cy={cam.y}
            r={1.5}
            fill="#00ffff"
          />
        </svg>
      </CornerBrackets>
    </div>
  );
}

function ZoomControls({ onZoomIn, onZoomOut, onResetView }) {
  return (
    <div className="absolute bottom-24 right-6 z-50 flex flex-col gap-1.5">
      <button
        onClick={onZoomIn}
        className="p-2 bg-slate-950/70 border border-cyan-500/20 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors rounded"
        title="Zoom In"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <button
        onClick={onZoomOut}
        className="p-2 bg-slate-950/70 border border-cyan-500/20 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors rounded"
        title="Zoom Out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
      <button
        onClick={onResetView}
        className="p-2 bg-slate-950/70 border border-cyan-500/20 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors rounded"
        title="Reset View"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [transitioningHousehold, setTransitioningHousehold] = useState(null);
  const [warpDirection, setWarpDirection] = useState(null);
  const [viewMode, setViewMode] = useState('starmap');
  const [cameraPos, setCameraPos] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [filters, setFilters] = useState({
    starClasses: { F: true, K: true, E: true, O: true },
    showLines: true,
    showLabels: true,
  });
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraPosRef = useRef(null);
  
  const qualityTier = useQualityTier();
  const householdPositions = useOrganicClusterLayout(households, people, viewMode, relationships);

  const handleCameraUpdate = useCallback((pos) => {
    cameraPosRef.current = pos;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (cameraPosRef.current) {
        setCameraPos({ ...cameraPosRef.current });
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const handleToggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'nebula' ? 'starmap' : 'nebula');
  }, []);

  const handleToggleFilter = useCallback((type, value) => {
    setFilters(prev => {
      if (type === 'starClass') {
        return { ...prev, starClasses: { ...prev.starClasses, [value]: !prev.starClasses[value] } };
      }
      return { ...prev, [type]: !prev[type] };
    });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (hoveredHouseholdId) {
      setMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [hoveredHouseholdId]);

  const hoveredHousehold = useMemo(() => {
    if (!hoveredHouseholdId) return null;
    return households.find(h => h.id === hoveredHouseholdId);
  }, [hoveredHouseholdId, households]);

  const hoveredHouseholdInfo = useMemo(() => {
    if (!hoveredHouseholdId) return null;
    const pos = householdPositions.get(hoveredHouseholdId);
    const mc = pos?.memberCount || 0;
    return { memberCount: mc, starClass: classifyHousehold(mc) };
  }, [hoveredHouseholdId, householdPositions]);

  const selectedHouseholdInfo = useMemo(() => {
    if (!selectedHousehold) return null;
    const pos = householdPositions.get(selectedHousehold.id);
    const mc = pos?.memberCount || 0;
    return { memberCount: mc, starClass: classifyHousehold(mc) };
  }, [selectedHousehold, householdPositions]);
  
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
    setTransitioningHousehold(household);
    setIsTransitioning(true);
    setTransitionProgress(0);
    setFocusedStarId(null);
    setAutoRotateEnabled(false);
    setWarpDirection('zoom-in');
  }, []);
  
  const handleBackToGalaxy = useCallback(() => {
    setIsTransitioning(true);
    setTransitionProgress(0);
    setLevel('galaxy');
    setFocusedStarId(null);
    setHoveredStarId(null);
    setWarpDirection('zoom-out');
    setTimeout(() => {
      setSelectedHousehold(null);
      setTransitioningHousehold(null);
      setIsTransitioning(false);
      setWarpDirection(null);
    }, 1200);
  }, []);
  
  const handleTransitionComplete = useCallback(() => {
    setIsTransitioning(false);
    setWarpDirection(null);
    if (transitioningHousehold) {
      setSelectedHousehold(transitioningHousehold);
      setLevel('system');
    }
    setTransitioningHousehold(null);
  }, [transitioningHousehold]);
  
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
    <div className="absolute inset-0" onMouseMove={handleMouseMove}>
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
        <CameraTracker onCameraUpdate={handleCameraUpdate} />
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
          isTransitioning={isTransitioning}
          transitioningHousehold={transitioningHousehold}
          onTransitionComplete={handleTransitionComplete}
          viewMode={viewMode}
          filters={filters}
        />
      </Canvas>
      
      <VignetteOverlay />
      <WarpOverlay active={isTransitioning} direction={warpDirection} />
      
      <TopBar
        level={level}
        selectedHousehold={selectedHousehold}
        cameraPos={cameraPos}
        onBackToGalaxy={handleBackToGalaxy}
      />

      {level === 'galaxy' && (
        <FilterToggles
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewMode}
          filters={filters}
          onToggleFilter={handleToggleFilter}
        />
      )}

      <ZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
      />

      <Minimap
        cameraPos={cameraPos}
        householdPositions={householdPositions}
        households={households}
      />

      {level === 'galaxy' && hoveredHousehold && hoveredHouseholdInfo && (
        <HoverTooltip
          household={hoveredHousehold}
          memberCount={hoveredHouseholdInfo.memberCount}
          starClass={hoveredHouseholdInfo.starClass}
          mousePos={mousePos}
        />
      )}

      {level === 'system' && selectedHousehold && selectedHouseholdInfo && (
        <SystemInfoPanel
          household={selectedHousehold}
          memberCount={selectedHouseholdInfo.memberCount}
          starClass={selectedHouseholdInfo.starClass}
          people={people}
          onClose={handleBackToGalaxy}
        />
      )}
      
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

useGLTF.preload('/attached_assets/gjptsjoamukljk6vxhg5_1767941334938.glb');
