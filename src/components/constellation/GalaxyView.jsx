import React, { useMemo, useState, useRef, useCallback, useEffect, Suspense, createContext, useContext } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import HouseholdCluster, { HOUSEHOLD_COLORS, StarMapCluster } from './HouseholdCluster';
import { classifyHousehold, computeHouseholdEdges } from '@/lib/starClassification';
import { ChevronRight, ZoomIn, ZoomOut, RotateCcw, Home, Sparkles, Cloud, Eye, EyeOff } from 'lucide-react';
import { generateRandomStarProfile } from '@/lib/starConfig';
import { StarInstanced } from './Star';

function createRadialGlowTexture(size = 128) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.15, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.15)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.03)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

let _glowTexture = null;
function getGlowTexture() {
  if (!_glowTexture) _glowTexture = createRadialGlowTexture(128);
  return _glowTexture;
}

const TransitionContext = createContext({
  progress: 0,
  isActive: false,
  direction: null,
});

function useTransitionProgress() {
  return useContext(TransitionContext);
}

const QUALITY_TIERS = {
  ultra: {
    tier: 'ultra', starCount: 70000, gasCount: 1200, filamentCount: 300,
    driftCount: 800, bgStarCount: 5000, curveSegments: 20, sphereSegments: 48,
    nebulaOctaves: 4, nebulaFbmCalls: 4, showFilaments: true, showGasCloud: true,
    showDrift: true, dpr: [1, 2], useGlb: true
  },
  high: {
    tier: 'high', starCount: 55000, gasCount: 800, filamentCount: 200,
    driftCount: 500, bgStarCount: 3500, curveSegments: 16, sphereSegments: 32,
    nebulaOctaves: 3, nebulaFbmCalls: 3, showFilaments: true, showGasCloud: true,
    showDrift: true, dpr: [1, 1.5], useGlb: true
  },
  medium: {
    tier: 'medium', starCount: 40000, gasCount: 500, filamentCount: 100,
    driftCount: 300, bgStarCount: 2000, curveSegments: 12, sphereSegments: 24,
    nebulaOctaves: 3, nebulaFbmCalls: 3, showFilaments: true, showGasCloud: true,
    showDrift: true, dpr: 1, useGlb: true
  },
  low: {
    tier: 'low', starCount: 25000, gasCount: 0, filamentCount: 0,
    driftCount: 0, bgStarCount: 1000, curveSegments: 8, sphereSegments: 16,
    nebulaOctaves: 2, nebulaFbmCalls: 2, showFilaments: false, showGasCloud: false,
    showDrift: false, dpr: 1, useGlb: false
  }
};

function detectQualityTier() {
  if (typeof window === 'undefined') return QUALITY_TIERS.medium;
  
  try {
    const saved = localStorage.getItem('nashiverse_quality_tier');
    if (saved && QUALITY_TIERS[saved]) {
      return QUALITY_TIERS[saved];
    }
  } catch (e) {}

  const cores = navigator.hardwareConcurrency || 4;
  const dpr = window.devicePixelRatio || 1;
  const screenPixels = window.innerWidth * window.innerHeight * dpr;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  let gpuTier = 'unknown';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL).toLowerCase();

        const isIntegrated = renderer.includes('intel') || renderer.includes('mesa') ||
          renderer.includes('llvmpipe') || renderer.includes('swiftshader') ||
          renderer.includes('software');
        const isHighEnd = renderer.includes('rtx') || renderer.includes('rx 7') ||
          renderer.includes('rx 6') || renderer.includes('m1') || renderer.includes('m2') ||
          renderer.includes('m3') || renderer.includes('m4') ||
          (renderer.includes('apple') && !isMobile);
        const isMidRange = renderer.includes('gtx') || renderer.includes('rx 5') ||
          renderer.includes('radeon pro') || renderer.includes('amd');

        if (isHighEnd) gpuTier = 'high';
        else if (isIntegrated) gpuTier = 'low';
        else if (isMidRange) gpuTier = 'mid';
        else gpuTier = 'mid';
      }
      const loseCtx = gl.getExtension('WEBGL_lose_context');
      if (loseCtx) loseCtx.loseContext();
    }
  } catch (e) {}

  let tier;
  if (isMobile) {
    tier = 'low';
  } else if (gpuTier === 'low' || cores <= 2) {
    tier = 'low';
  } else if (gpuTier === 'high' && cores >= 8 && screenPixels < 5000000) {
    tier = 'ultra';
  } else if ((gpuTier === 'high' || gpuTier === 'mid') && cores >= 6) {
    tier = 'high';
  } else if (cores >= 4) {
    tier = 'medium';
  } else {
    tier = 'low';
  }

  try { localStorage.setItem('nashiverse_quality_tier', tier); } catch (e) {}
  return QUALITY_TIERS[tier];
}

function useQualityTier() {
  const [qualityTier, setQualityTier] = useState(() => detectQualityTier());
  const fpsBuffer = useRef([]);
  const lastDowngrade = useRef(0);

  const downgrade = useCallback(() => {
    const order = ['ultra', 'high', 'medium', 'low'];
    const idx = order.indexOf(qualityTier.tier);
    if (idx < order.length - 1) {
      const newTier = order[idx + 1];
      try { localStorage.setItem('nashiverse_quality_tier', newTier); } catch (e) {}
      setQualityTier(QUALITY_TIERS[newTier]);
    }
  }, [qualityTier.tier]);

  const setTier = useCallback((tierName) => {
    if (QUALITY_TIERS[tierName]) {
      try { localStorage.setItem('nashiverse_quality_tier', tierName); } catch (e) {}
      setQualityTier(QUALITY_TIERS[tierName]);
    }
  }, []);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId;

    const measureFps = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 2000) {
        const fps = (frameCount / (now - lastTime)) * 1000;
        fpsBuffer.current.push(fps);
        if (fpsBuffer.current.length > 3) fpsBuffer.current.shift();

        const avgFps = fpsBuffer.current.reduce((a, b) => a + b, 0) / fpsBuffer.current.length;

        if (avgFps < 24 && fpsBuffer.current.length >= 2 && now - lastDowngrade.current > 10000) {
          lastDowngrade.current = now;
          downgrade();
        }

        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(measureFps);
    };

    animId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animId);
  }, [downgrade]);

  return { ...qualityTier, setTier };
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
    
    const minSeparation = 28.0;
    const GOLDEN_ANGLE = 2.399963229728653;
    const BRANCH_DISTANCE = 32;
    
    const positions = new Map();
    const placedPositions = [];
    
    const sortedGens = [...genGroups.keys()].sort((a, b) => a - b);
    
    function findParentPositions(hhId) {
      const parents = childOf.get(hhId);
      if (!parents || parents.size === 0) return null;
      const parentPositions = [];
      parents.forEach(pid => {
        const pos = positions.get(pid);
        if (pos) parentPositions.push(pos);
      });
      if (parentPositions.length === 0) return null;
      const avg = { x: 0, y: 0, z: 0 };
      parentPositions.forEach(p => { avg.x += p.x; avg.y += p.y; avg.z += p.z; });
      avg.x /= parentPositions.length;
      avg.y /= parentPositions.length;
      avg.z /= parentPositions.length;
      return avg;
    }
    
    sortedGens.forEach(gen => {
      const group = genGroups.get(gen);
      const n = group.length;
      
      group.forEach((household, idx) => {
        const seed = household.id;
        let x, y, z;
        
        if (gen === 0) {
          const phi = Math.acos(1 - 2 * (idx + 0.5) / Math.max(n, 3));
          const theta = GOLDEN_ANGLE * idx + seededRandom(seed + '-angle') * 0.6;
          const radius = 6 + seededRandom(seed + '-r0') * 8;
          x = radius * Math.sin(phi) * Math.cos(theta);
          y = radius * Math.cos(phi);
          z = radius * Math.sin(phi) * Math.sin(theta);
        } else {
          const parentPos = findParentPositions(household.id);
          
          if (parentPos) {
            const dist = Math.sqrt(parentPos.x * parentPos.x + parentPos.y * parentPos.y + parentPos.z * parentPos.z);
            const baseDist = BRANCH_DISTANCE + seededRandom(seed + '-bd') * 10;
            
            const randPhi = Math.acos(1 - 2 * seededRandom(seed + '-phi'));
            const randTheta = seededRandom(seed + '-theta') * Math.PI * 2;
            const offX = Math.sin(randPhi) * Math.cos(randTheta);
            const offY = Math.cos(randPhi);
            const offZ = Math.sin(randPhi) * Math.sin(randTheta);
            
            const radialX = dist > 1 ? parentPos.x / dist : 0;
            const radialY = dist > 1 ? parentPos.y / dist : 0;
            const radialZ = dist > 1 ? parentPos.z / dist : 0;
            
            const outwardBias = 0.4;
            x = parentPos.x + (offX * (1 - outwardBias) + radialX * outwardBias) * baseDist;
            y = parentPos.y + (offY * (1 - outwardBias) + radialY * outwardBias) * baseDist;
            z = parentPos.z + (offZ * (1 - outwardBias) + radialZ * outwardBias) * baseDist;
          } else {
            const phi = Math.acos(1 - 2 * (idx + 0.5) / Math.max(n, 3));
            const theta = GOLDEN_ANGLE * idx + seededRandom(seed + '-angle') * 0.6;
            const shellRadius = 35 + gen * 30 + seededRandom(seed + '-rs') * 15;
            x = shellRadius * Math.sin(phi) * Math.cos(theta);
            y = shellRadius * Math.cos(phi);
            z = shellRadius * Math.sin(phi) * Math.sin(theta);
          }
        }
        
        let attempts = 0;
        while (attempts < 60) {
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
          x += (seededRandom(seed + '-ax-' + attempts) - 0.5) * 20;
          y += (seededRandom(seed + '-ay-' + attempts) - 0.5) * 20;
          z += (seededRandom(seed + '-az-' + attempts) - 0.5) * 20;
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
          generation: generation.get(household.id) || 0,
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
        
        vec3 deepPurple = vec3(0.12, 0.06, 0.28);
        vec3 vibrantPurple = vec3(0.45, 0.15, 0.75);
        vec3 teal = vec3(0.04, 0.32, 0.42);
        vec3 cyan = vec3(0.12, 0.45, 0.55);
        vec3 warmPink = vec3(0.65, 0.2, 0.4);
        vec3 deepBlue = vec3(0.08, 0.12, 0.35);
        vec3 warmOrange = vec3(0.75, 0.45, 0.15);
        vec3 emeraldGreen = vec3(0.08, 0.45, 0.2);
        vec3 warmGold = vec3(0.7, 0.55, 0.15);
        
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
          
          return density * 0.28;
        }
        
        vec3 nebulaColor(vec3 p, float density, float t) {
          float n1 = fbm(p * 0.04 + t * 0.001);
          float n2 = fbm(p * 0.06 - t * 0.002);
          float n3 = fbm(p * 0.08 + vec3(t * 0.001));
          
          float dist = length(p);
          float distFactor = smoothstep(0.0, 80.0, dist);
          
          vec3 coreColor = mix(warmGold, warmPink, n1);
          vec3 midColor = mix(vibrantPurple, emeraldGreen, n2);
          vec3 edgeColor = mix(deepBlue, cyan, n3);
          
          vec3 color = mix(coreColor, midColor, smoothstep(0.0, 0.5, distFactor));
          color = mix(color, edgeColor, smoothstep(0.4, 0.9, distFactor));
          
          color = mix(color, vibrantPurple, smoothstep(0.5, 0.85, n1) * 0.5);
          color = mix(color, warmGold, smoothstep(0.4, 0.8, n2 * n3) * 0.4);
          color = mix(color, emeraldGreen, smoothstep(0.55, 0.85, n3) * 0.35);
          
          float emissive = pow(density, 0.5) * 2.0;
          
          return color * (0.8 + emissive);
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
          
          gl_FragColor = vec4(totalColor, totalAlpha * 0.7);
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
  
  const particleCount = qualityTier.filamentCount || 150;
  
  const { positions, colors, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const siz = new Float32Array(particleCount);
    const pha = new Float32Array(particleCount);
    
    const nebulaColors = [
      new THREE.Color(0x9b5de5),
      new THREE.Color(0x0db5d1),
      new THREE.Color(0x3de8e0),
      new THREE.Color(0xf472b6),
      new THREE.Color(0x2563eb),
      new THREE.Color(0xfbbf24),
      new THREE.Color(0x34d399),
      new THREE.Color(0xf59e0b),
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
          vAlpha = 0.04 * drift;
          
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
  return null;
}

function NebulaBackground({ qualityTier }) {
  const meshRef = useRef();
  const octaves = qualityTier?.nebulaOctaves || 3;
  const segments = qualityTier?.sphereSegments || 32;
  
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
        
        const int OCTAVES = ${octaves};
        
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
          for (int i = 0; i < OCTAVES; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }
        
        void main() {
          vec3 dir = normalize(vPosition);
          
          float n1 = fbm(dir * 2.0 + time * 0.003);
          float n2 = fbm(dir * 1.5 + time * 0.0015);
          float n3 = fbm(dir * 0.8 + time * 0.001);
          
          vec3 deepSpace = vec3(0.02, 0.02, 0.05);
          vec3 warmGold = vec3(0.08, 0.06, 0.02);
          vec3 emeraldGreen = vec3(0.02, 0.07, 0.03);
          vec3 deepPurple = vec3(0.06, 0.02, 0.12);
          vec3 coolBlue = vec3(0.02, 0.04, 0.1);
          vec3 amber = vec3(0.07, 0.04, 0.01);
          vec3 rosePink = vec3(0.06, 0.02, 0.04);
          
          vec3 baseColor = deepSpace;
          
          float zone1 = smoothstep(0.35, 0.65, n2);
          float zone2 = smoothstep(0.35, 0.65, n3);
          float zone3 = smoothstep(0.38, 0.68, n1);
          float zone4 = smoothstep(0.4, 0.7, n1 * n2);
          
          baseColor = mix(baseColor, warmGold, zone1 * 0.3);
          baseColor = mix(baseColor, emeraldGreen, zone2 * 0.2);
          baseColor = mix(baseColor, deepPurple, zone3 * 0.25);
          baseColor = mix(baseColor, coolBlue, zone4 * 0.2);
          baseColor = mix(baseColor, amber, smoothstep(0.25, 0.55, n2 * n3) * 0.2);
          baseColor = mix(baseColor, rosePink, smoothstep(0.35, 0.65, n3 * n1) * 0.15);
          
          float yFactor = (dir.y + 1.0) * 0.5;
          baseColor = mix(baseColor, deepPurple * 0.5, yFactor * 0.15);
          
          baseColor *= 0.7;
          
          gl_FragColor = vec4(baseColor, 1.0);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
      side: THREE.BackSide,
    });
  }, [octaves]);
  
  useFrame((state) => {
    gradientMaterial.uniforms.time.value = state.clock.elapsedTime;
  });
  
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[300, segments, segments]} />
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
      new THREE.Color('#1a2840'),
      new THREE.Color('#2a1545'),
      new THREE.Color('#0d2535'),
      new THREE.Color('#302818'),
      new THREE.Color('#152a20'),
      new THREE.Color('#251535'),
      new THREE.Color('#0d2030'),
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
      const brightness = 0.6 + Math.random() * 0.4;
      col[i * 3] = c.r * brightness;
      col[i * 3 + 1] = c.g * brightness;
      col[i * 3 + 2] = c.b * brightness;
      
      siz[i] = 1.0 + Math.random() * 2.5;
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
          
          float drift = sin(time * 0.08 + phase) * 0.3;
          vAlpha = 0.03 + drift * 0.01;
          
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
      targetCamPos.current.set(75, 140, 105);
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
  const householdRelationships = relationships.filter(r => {
    const idA = r.person_id || r.person1_id;
    const idB = r.related_person_id || r.person2_id;
    return personIds.has(idA) && personIds.has(idB);
  });
  
  const partners = new Set();
  const parents = new Set();
  const childrenIds = new Set();
  
  householdRelationships.forEach(rel => {
    const type = (rel.relationship_type || '').toLowerCase();
    const idA = rel.person_id || rel.person1_id;
    const idB = rel.related_person_id || rel.person2_id;
    if (type === 'partner' || type === 'spouse' || type === 'married') {
      partners.add(idA);
      partners.add(idB);
    }
    if (type === 'parent') {
      parents.add(idA);
      childrenIds.add(idB);
    }
    if (type === 'child') {
      parents.add(idB);
      childrenIds.add(idA);
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
        centerY,
        centerZ + Math.sin(parentOrbitAngle) * parentOrbitRadius
      ],
      isParent: true,
    });
    positioned.push({
      ...parentPair[1],
      position: [
        centerX + Math.cos(parentOrbitAngle + Math.PI) * parentOrbitRadius,
        centerY,
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
    const radiusVariation = seededRandom(seed + '-rad') * 1.6 - 0.8;
    const yVariation = seededRandom(seed + '-y') * 8.0 - 4.0;
    
    const finalRadius = childOrbitRadius + radiusVariation;
    const orbitalTilt = seededRandom(seed + '-tilt') * 0.6 - 0.3;
    
    positioned.push({
      ...child,
      position: [
        centerX + Math.cos(angle) * finalRadius,
        centerY + yVariation + Math.sin(angle) * finalRadius * orbitalTilt,
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

function SystemDustCloud({ center, color, count = 120, radius = 8, opacity = 0.3 }) {
  const pointsRef = useRef();
  const { positions, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.random() * radius;
      pos[i * 3] = center[0] + r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = center[1] + (Math.random() - 0.5) * radius * 0.4;
      pos[i * 3 + 2] = center[2] + r * Math.sin(phi) * Math.sin(theta);
      ph[i] = Math.random() * Math.PI * 2;
    }
    return { positions: pos, phases: ph };
  }, [count, radius, center]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.elapsedTime;
    const posArr = pointsRef.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const phase = phases[i];
      posArr[i * 3] += Math.sin(t * 0.15 + phase) * 0.002;
      posArr[i * 3 + 1] += Math.cos(t * 0.1 + phase * 1.3) * 0.001;
      posArr[i * 3 + 2] += Math.cos(t * 0.12 + phase * 0.7) * 0.002;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.08}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
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
    return arrangeStarsInCluster(householdPeople, centerX, centerY, centerZ, relationships);
  }, [householdPeople, centerX, centerY, centerZ, relationships]);
  
  const starsWithProfiles = useMemo(() => {
    return positionedPeople.map(person => ({
      id: person.id,
      position: person.position,
      starProfile: person.star_profile || generateRandomStarProfile(person.id),
      person,
    }));
  }, [positionedPeople]);
  
  const colors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  
  const systemGroupRef = useRef();
  useFrame((state) => {
    if (!systemGroupRef.current) return;
    const t = state.clock.elapsedTime;
    systemGroupRef.current.rotation.y = t * 0.003;
    systemGroupRef.current.position.y = Math.sin(t * 0.1) * 0.03;
  });
  
  return (
    <group ref={systemGroupRef}>
      <SystemCenterGlow
        position={[centerX, centerY, centerZ]}
        color={colors.glow}
        intensity={0.35 * fadeOpacity}
      />
      <SystemDustCloud
        center={[centerX, centerY, centerZ]}
        color={colors.glow}
        count={100}
        radius={9}
        opacity={0.25 * fadeOpacity}
      />
      <sprite position={[centerX, centerY, centerZ]} scale={[14, 14, 1]}>
        <spriteMaterial
          map={getGlowTexture()}
          color={colors.primary}
          transparent
          opacity={0.06 * fadeOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
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
  isConnectedToHovered = false,
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
  householdGroupRefs,
}) {
  const groupRef = useRef();
  const { camera } = useThree();
  const breathPhase = useMemo(() => (parseInt(household?.id, 10) || 0) * 1.7, [household?.id]);
  const currentState = useRef({
    offsetX: 0, offsetY: 0, offsetZ: 0,
    scale: 1, opacity: 1.0, starOpacity: 1
  });
  const [renderOpacity, setRenderOpacity] = useState(1.0);
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
    let targetOpacity = 1.0;
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
      if (isConnectedToHovered) {
        targetOpacity = 0.9;
        targetStarOpacity = 1;
        targetScale = 1.05;
      } else {
        targetOpacity = 0.25;
        targetStarOpacity = 0.35;
        targetScale = 0.92;
      }
    } else {
      const breathe = Math.sin(state.clock.elapsedTime * 0.8 + breathPhase) * 0.03;
      targetScale = 1.0 + breathe;
    }
    
    if (isNaN(targetScale)) targetScale = 1;
    if (isNaN(targetOpacity)) targetOpacity = 1;
    if (isNaN(targetStarOpacity)) targetStarOpacity = 1;
    
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
    
    if (householdGroupRefs) {
      householdGroupRefs.current.set(household.id, groupRef.current);
    }
    
    if (Math.abs(curr.opacity - renderOpacity) > 0.01) {
      setRenderOpacity(curr.opacity);
    }
    if (Math.abs(curr.starOpacity - starRenderOpacity) > 0.01) {
      setStarRenderOpacity(curr.starOpacity);
    }
  });
  
  const isOtherFocused = focusedHouseholdId && !isFocused;

  const galaxyCoupleRing = useMemo(() => {
    if (!localStars || localStars.length < 2) return null;
    const parentStars = localStars.filter(s => s.isParent);
    if (parentStars.length < 2) return null;
    return { center: [0, 0, 0], radius: 1.2 };
  }, [localStars]);

  const householdColor = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];

  return (
    <group ref={groupRef}>
      {!isOtherFocused && (
        <sprite position={[0, 0, 0]} scale={[8, 8, 1]}>
          <spriteMaterial
            map={getGlowTexture()}
            color={householdColor.primary}
            transparent
            opacity={isHovered && !focusedHouseholdId ? 0.2 : 0.08}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      )}
      {!isOtherFocused && !focusedHouseholdId && (
        <SystemNebulaCloud
          color={householdColor.primary}
          opacity={isHovered ? 0.25 : 0.12}
          starClass={starClass}
          memberCount={memberCount}
        />
      )}
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
      {showLabels && !focusedHouseholdId && !isHovered && (
        <Html position={[0, -2.5, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            color: householdColor.primary,
            fontSize: '9px',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            whiteSpace: 'nowrap',
            opacity: 0.6,
            textShadow: `0 0 6px ${householdColor.primary}44`,
          }}>
            {household?.name || ''}
          </div>
        </Html>
      )}
      {isFocused && (
        <ConstellationLines
          stars={localStars}
          relationships={relationships}
          colorIndex={colorIndex}
          opacity={starRenderOpacity * 0.8}
        />
      )}
      {!focusedHouseholdId && galaxyCoupleRing && (
        <GalaxyOutlineRing
          colorIndex={colorIndex}
          radius={GALAXY_RING_RADIUS}
        />
      )}
      {!focusedHouseholdId && isHovered && galaxyCoupleRing && (
        <HoverSphere
          colorIndex={colorIndex}
          radius={GALAXY_RING_RADIUS}
        />
      )}
      {!isOtherFocused && (
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
      )}
    </group>
  );
}

function SystemNebulaCloud({ color, opacity = 0.15, starClass, memberCount = 2 }) {
  const pointsRef = useRef();

  const classId = starClass?.id || 'F';
  const classConfig = useMemo(() => {
    switch (classId) {
      case 'O': return { count: 120, radius: 7.0, sizeBase: 2.0, sizeRange: 4.0, flatten: 0.4 };
      case 'E': return { count: 90, radius: 6.0, sizeBase: 1.8, sizeRange: 3.5, flatten: 0.45 };
      case 'K': return { count: 70, radius: 5.0, sizeBase: 1.5, sizeRange: 3.0, flatten: 0.5 };
      default:  return { count: 50, radius: 4.0, sizeBase: 1.2, sizeRange: 2.5, flatten: 0.55 };
    }
  }, [classId]);

  const particleCount = classConfig.count;

  const classColor = useMemo(() => {
    if (!starClass?.colors?.glow) return null;
    return new THREE.Color(starClass.colors.glow);
  }, [starClass]);

  const { positions, colors, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const siz = new Float32Array(particleCount);
    const pha = new Float32Array(particleCount);

    const primaryCol = new THREE.Color(color);
    const secondaryCol = classColor || primaryCol.clone();

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.3 + Math.pow(Math.random(), 0.5) * classConfig.radius;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * classConfig.flatten;
      pos[i * 3 + 2] = r * Math.cos(phi);

      const mix = Math.random();
      const c = primaryCol.clone().lerp(secondaryCol, mix * 0.4);
      const brightness = 0.5 + Math.random() * 0.5;
      col[i * 3] = c.r * brightness;
      col[i * 3 + 1] = c.g * brightness;
      col[i * 3 + 2] = c.b * brightness;

      siz[i] = classConfig.sizeBase + Math.random() * classConfig.sizeRange;
      pha[i] = Math.random() * Math.PI * 2;
    }

    return { positions: pos, colors: col, sizes: siz, phases: pha };
  }, [particleCount, color, classColor, classConfig]);

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
          float drift = sin(time * 0.2 + phase) * 0.3 + 0.7;
          float flicker = sin(time * 0.8 + phase * 3.0) * 0.15 + 0.85;
          vAlpha = drift * flicker;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (120.0 / -mvPos.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 25.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float baseOpacity;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha = pow(alpha, 1.8);
          alpha *= vAlpha * baseOpacity;
          if (alpha < 0.003) discard;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      uniforms: {
        time: { value: 0 },
        baseOpacity: { value: opacity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame((state) => {
    material.uniforms.time.value = state.clock.elapsedTime;
    material.uniforms.baseOpacity.value = opacity;
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

const GALAXY_RING_RADIUS = 2.0;

function GalaxyOutlineRing({ colorIndex, radius = GALAXY_RING_RADIUS }) {
  const ringGroupRef = useRef();
  const matRef = useRef();
  const baseColors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  const ringColor = useMemo(() => new THREE.Color(baseColors.primary), [baseColors]);
  const { camera } = useThree();

  const _worldPos = useMemo(() => new THREE.Vector3(), []);
  const _dir = useMemo(() => new THREE.Vector3(), []);
  const _right = useMemo(() => new THREE.Vector3(), []);
  const _up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const _corrUp = useMemo(() => new THREE.Vector3(), []);
  const _mat = useMemo(() => new THREE.Matrix4(), []);

  const ringPoints = useMemo(() => {
    const segments = 64;
    const pts = new Float32Array((segments + 1) * 3);
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts[i * 3] = Math.cos(angle) * radius;
      pts[i * 3 + 1] = Math.sin(angle) * radius;
      pts[i * 3 + 2] = 0;
    }
    return pts;
  }, [radius]);

  useFrame((state) => {
    if (ringGroupRef.current) {
      ringGroupRef.current.getWorldPosition(_worldPos);
      _dir.copy(camera.position).sub(_worldPos).normalize();
      const upVec = Math.abs(_dir.y) > 0.95 ? _up.set(1, 0, 0) : _up.set(0, 1, 0);
      _right.crossVectors(upVec, _dir).normalize();
      _corrUp.crossVectors(_dir, _right).normalize();
      _mat.makeBasis(_right, _corrUp, _dir);
      ringGroupRef.current.quaternion.setFromRotationMatrix(_mat);
    }
    if (matRef.current) {
      const t = state.clock.elapsedTime;
      matRef.current.opacity = 0.15 + Math.sin(t * 1.2) * 0.05;
    }
  });

  return (
    <group ref={ringGroupRef}>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={ringPoints.length / 3}
            array={ringPoints}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          ref={matRef}
          color={ringColor}
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>
    </group>
  );
}

function HoverSphere({ colorIndex, radius = 2.0 }) {
  const meshRef = useRef();
  const baseColors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  const sphereColor = useMemo(() => new THREE.Color(baseColors.primary), [baseColors]);

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime;
      const pulse = 1.0 + Math.sin(t * 1.5) * 0.08;
      meshRef.current.scale.setScalar(pulse);
      meshRef.current.material.opacity = 0.12 + Math.sin(t * 2.0) * 0.04;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshBasicMaterial
        color={sphereColor}
        transparent
        opacity={0.12}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function CoupleRing({ center, radius, colorIndex, opacity = 0.6 }) {
  const mainMatRef = useRef();
  const outerGlowMatRef = useRef();
  const innerFillMatRef = useRef();
  const pulseRingRef = useRef();
  const pulseMatRef = useRef();
  const sparkleRef = useRef();

  const baseColors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  const ringColor = new THREE.Color(baseColors.primary);
  const glowColor = new THREE.Color(baseColors.glow);

  const ringLines = useMemo(() => {
    const segments = 96;
    const layers = [
      { r: radius * 0.96, opacity: 0.12 },
      { r: radius, opacity: 1.0 },
      { r: radius * 1.04, opacity: 0.3 },
      { r: radius * 1.1, opacity: 0.08 },
    ];
    return layers.map(layer => {
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(
          Math.cos(angle) * layer.r,
          Math.sin(angle) * layer.r,
          0
        ));
      }
      return { points: pts, opacity: layer.opacity };
    });
  }, [radius]);

  const sparkleCount = 8;
  const sparkleData = useMemo(() => {
    const data = [];
    for (let i = 0; i < sparkleCount; i++) {
      data.push({
        phase: (i / sparkleCount) * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.2,
        size: 0.06 + Math.random() * 0.04,
        brightness: 0.5 + Math.random() * 0.5,
      });
    }
    return data;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const breathe = 0.65 + Math.sin(t * 0.9) * 0.2 + Math.sin(t * 1.7) * 0.1;
    const pulseWave = Math.max(0, Math.sin(t * 0.6));
    const pulseScale = 1.05 + pulseWave * 0.12;

    if (mainMatRef.current) {
      mainMatRef.current.opacity = opacity * breathe;
    }
    if (outerGlowMatRef.current) {
      outerGlowMatRef.current.opacity = opacity * 0.08 * breathe;
    }
    if (innerFillMatRef.current) {
      innerFillMatRef.current.opacity = opacity * 0.04 * breathe;
    }
    if (pulseRingRef.current) {
      pulseRingRef.current.scale.set(pulseScale, pulseScale, pulseScale);
    }
    if (pulseMatRef.current) {
      pulseMatRef.current.opacity = opacity * 0.1 * pulseWave;
    }

    if (sparkleRef.current) {
      const children = sparkleRef.current.children;
      for (let i = 0; i < children.length && i < sparkleData.length; i++) {
        const s = sparkleData[i];
        const angle = s.phase + t * s.speed;
        children[i].position.set(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          0
        );
        const flicker = 0.3 + Math.sin(t * 3 + s.phase) * 0.4 + Math.sin(t * 7.3 + s.phase * 2) * 0.3;
        children[i].material.opacity = opacity * s.brightness * Math.max(0, flicker);
      }
    }
  });

  const { camera } = useThree();
  const ringGroupRef = useRef();
  const _worldPos = useMemo(() => new THREE.Vector3(), []);
  const _dir = useMemo(() => new THREE.Vector3(), []);
  const _right = useMemo(() => new THREE.Vector3(), []);
  const _up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const _corrUp = useMemo(() => new THREE.Vector3(), []);
  const _mat = useMemo(() => new THREE.Matrix4(), []);

  useFrame(() => {
    if (ringGroupRef.current) {
      ringGroupRef.current.getWorldPosition(_worldPos);
      _dir.copy(camera.position).sub(_worldPos).normalize();
      const upVec = Math.abs(_dir.y) > 0.95 ? _up.set(1, 0, 0) : _up.set(0, 1, 0);
      _right.crossVectors(upVec, _dir).normalize();
      _corrUp.crossVectors(_dir, _right).normalize();
      _mat.makeBasis(_right, _corrUp, _dir);
      ringGroupRef.current.quaternion.setFromRotationMatrix(_mat);
    }
  });

  return (
    <group position={[center[0], center[1], center[2]]}>
      <group ref={ringGroupRef}>
        {ringLines.map((layer, li) => (
          <line key={`ring-layer-${li}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={layer.points.length}
                array={new Float32Array(layer.points.flatMap(p => [p.x, p.y, p.z]))}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial
              ref={li === 1 ? mainMatRef : (li === 3 ? outerGlowMatRef : undefined)}
              color={li === 0 ? glowColor : ringColor}
              transparent
              opacity={opacity * layer.opacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </line>
        ))}

        <mesh>
          <circleGeometry args={[radius * 0.9, 64]} />
          <meshBasicMaterial
            ref={innerFillMatRef}
            color={ringColor}
            transparent
            opacity={opacity * 0.04}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        <group ref={pulseRingRef}>
          <mesh>
            <ringGeometry args={[radius * 1.02, radius * 1.14, 64]} />
            <meshBasicMaterial
              ref={pulseMatRef}
              color={glowColor}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>

        <group ref={sparkleRef}>
          {sparkleData.map((s, i) => (
            <sprite key={`sparkle-${i}`} scale={[s.size, s.size, 1]}>
              <spriteMaterial
                map={getGlowTexture()}
                color={glowColor}
                transparent
                opacity={0}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </sprite>
          ))}
        </group>
      </group>
    </group>
  );
}

function SystemMeshLines({ lines, colorIndex, opacity = 0.6 }) {
  const meshRef = useRef();
  const timeUniform = useRef({ value: 0 });
  const resolutionUniform = useRef({ value: new THREE.Vector2(1920, 1080) });
  const lineWidthUniform = useRef({ value: 4.0 });

  const lineCount = lines.length;
  const totalVerts = lineCount * 4;
  const totalIndices = lineCount * 6;

  const { startPos, endPos, sides, tValues, colorValues, highlightValues, indices, dummyPositions } = useMemo(() => {
    const sp = new Float32Array(totalVerts * 3);
    const ep = new Float32Array(totalVerts * 3);
    const sd = new Float32Array(totalVerts);
    const t = new Float32Array(totalVerts);
    const col = new Float32Array(totalVerts * 3);
    const hl = new Float32Array(totalVerts);
    const dp = new Float32Array(totalVerts * 3);
    const idx = new Uint32Array(totalIndices);

    const baseColors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
    const lineColor = new THREE.Color(baseColors.glow);

    for (let e = 0; e < lineCount; e++) {
      const base = e * 4;
      sd[base] = -1; t[base] = 0;
      sd[base + 1] = 1; t[base + 1] = 0;
      sd[base + 2] = -1; t[base + 2] = 1;
      sd[base + 3] = 1; t[base + 3] = 1;

      const idxOff = e * 6;
      idx[idxOff] = base;
      idx[idxOff + 1] = base + 1;
      idx[idxOff + 2] = base + 2;
      idx[idxOff + 3] = base + 1;
      idx[idxOff + 4] = base + 3;
      idx[idxOff + 5] = base + 2;

      const line = lines[e];
      for (let v = 0; v < 4; v++) {
        const vi = (base + v) * 3;
        sp[vi] = line.from[0]; sp[vi + 1] = line.from[1]; sp[vi + 2] = line.from[2];
        ep[vi] = line.to[0]; ep[vi + 1] = line.to[1]; ep[vi + 2] = line.to[2];
        col[vi] = lineColor.r; col[vi + 1] = lineColor.g; col[vi + 2] = lineColor.b;
        hl[base + v] = 1.0;
      }
    }

    return { startPos: sp, endPos: ep, sides: sd, tValues: t, colorValues: col, highlightValues: hl, indices: idx, dummyPositions: dp };
  }, [lines, colorIndex, lineCount, totalVerts, totalIndices]);

  useFrame((state) => {
    timeUniform.current.value = state.clock.elapsedTime;
    const size = state.gl.getSize(new THREE.Vector2());
    resolutionUniform.current.value.set(size.x, size.y);
  });

  if (totalVerts === 0) return null;

  return (
    <mesh ref={meshRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={totalVerts} array={dummyPositions} itemSize={3} />
        <bufferAttribute attach="attributes-aStart" count={totalVerts} array={startPos} itemSize={3} />
        <bufferAttribute attach="attributes-aEnd" count={totalVerts} array={endPos} itemSize={3} />
        <bufferAttribute attach="attributes-aSide" count={totalVerts} array={sides} itemSize={1} />
        <bufferAttribute attach="attributes-aT" count={totalVerts} array={tValues} itemSize={1} />
        <bufferAttribute attach="attributes-aColor" count={totalVerts} array={colorValues} itemSize={3} />
        <bufferAttribute attach="attributes-aHighlight" count={totalVerts} array={highlightValues} itemSize={1} />
        <bufferAttribute attach="index" count={indices.length} array={indices} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={connectionLineShader.vertexShader}
        fragmentShader={connectionLineShader.fragmentShader}
        uniforms={{
          uTime: timeUniform.current,
          uResolution: resolutionUniform.current,
          uLineWidth: lineWidthUniform.current,
        }}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ConstellationLines({ stars, relationships, colorIndex, opacity = 0.6 }) {
  const { lines_data, coupleCenter, coupleRadius, hasCouple } = useMemo(() => {
    if (!stars || stars.length < 2) {
      return { lines_data: [], coupleCenter: [0,0,0], coupleRadius: 0, hasCouple: false };
    }

    const parentStars = stars.filter(s => s.isParent);
    const childStars = stars.filter(s => !s.isParent);

    let centerX = 0, centerY = 0, centerZ = 0;
    if (parentStars.length > 0) {
      centerX = parentStars.reduce((sum, s) => sum + s.position[0], 0) / parentStars.length;
      centerY = parentStars.reduce((sum, s) => sum + s.position[1], 0) / parentStars.length;
      centerZ = parentStars.reduce((sum, s) => sum + s.position[2], 0) / parentStars.length;
    }

    const ringRadius = 1.6;
    const parentStarIds = new Set(parentStars.map(s => s.id));

    const bioParentsOf = {};
    if (relationships) {
      for (const rel of relationships) {
        const type = (rel.relationship_type || '').toLowerCase();
        const subtype = (rel.subtype || 'biological').toLowerCase();
        if (type === 'parent' && subtype === 'biological') {
          const parentId = rel.person_id || rel.person1_id;
          const childId = rel.related_person_id || rel.person2_id;
          if (!bioParentsOf[childId]) bioParentsOf[childId] = [];
          bioParentsOf[childId].push(parentId);
        }
      }
    }

    const lines = [];

    if (childStars.length > 0 && parentStars.length > 0) {
      childStars.forEach(child => {
        const childBioParents = bioParentsOf[child.id] || [];
        const bothBioOnRing = parentStars.length >= 2 && childBioParents.length >= 2 &&
          childBioParents.every(bp => parentStarIds.has(bp));

        if (parentStars.length >= 2) {
          const dx = child.position[0] - centerX;
          const dz = child.position[2] - centerZ;
          const angle = Math.atan2(dz, dx);
          const ringX = centerX + Math.cos(angle) * ringRadius;
          const ringZ = centerZ + Math.sin(angle) * ringRadius;
          lines.push({ from: [ringX, centerY, ringZ], to: child.position });
        } else {
          const bioParentStar = parentStars.find(s => childBioParents.includes(s.id));
          const fromPos = bioParentStar ? bioParentStar.position : parentStars[0].position;
          lines.push({ from: fromPos, to: child.position });
        }
      });
    }

    return {
      lines_data: lines,
      coupleCenter: [centerX, centerY, centerZ],
      coupleRadius: ringRadius,
      hasCouple: parentStars.length >= 2,
    };
  }, [stars, relationships, colorIndex]);

  if (lines_data.length === 0 && !hasCouple) return null;

  return (
    <group>
      {hasCouple && (
        <CoupleRing
          center={coupleCenter}
          radius={coupleRadius}
          colorIndex={colorIndex}
          opacity={opacity * 0.85}
        />
      )}
      {lines_data.length > 0 && (
        <SystemMeshLines
          lines={lines_data}
          colorIndex={colorIndex}
          opacity={opacity}
        />
      )}
    </group>
  );
}

const connectionLineShader = {
  vertexShader: `
    attribute vec3 aStart;
    attribute vec3 aEnd;
    attribute float aSide;
    attribute float aT;
    attribute vec3 aColor;
    attribute float aHighlight;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uLineWidth;
    varying float vT;
    varying vec3 vColor;
    varying float vHighlight;
    varying float vSide;
    void main() {
      vec4 clipStart = projectionMatrix * modelViewMatrix * vec4(aStart, 1.0);
      vec4 clipEnd = projectionMatrix * modelViewMatrix * vec4(aEnd, 1.0);
      vec2 ndcStart = clipStart.xy / clipStart.w;
      vec2 ndcEnd = clipEnd.xy / clipEnd.w;
      vec2 screenStart = (ndcStart * 0.5 + 0.5) * uResolution;
      vec2 screenEnd = (ndcEnd * 0.5 + 0.5) * uResolution;
      vec2 dir = screenEnd - screenStart;
      float len = length(dir);
      vec2 perp = len > 0.001 ? vec2(-dir.y, dir.x) / len : vec2(0.0, 1.0);
      vec2 screenOffset = perp * aSide * uLineWidth * 0.5;
      vec2 ndcOffset = screenOffset / uResolution * 2.0;
      vec4 clipPos = mix(clipStart, clipEnd, aT);
      clipPos.xy += ndcOffset * clipPos.w;
      gl_Position = clipPos;
      vT = aT;
      vColor = aColor;
      vHighlight = aHighlight;
      vSide = aSide;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying float vT;
    varying vec3 vColor;
    varying float vHighlight;
    varying float vSide;
    void main() {
      float edge = abs(vSide);
      float edgeFalloff = 1.0 - smoothstep(0.3, 1.0, edge);
      float coreBright = smoothstep(0.6, 0.0, edge);
      float pulse = fract(uTime * 0.3 - vT);
      float pulseGlow = smoothstep(0.0, 0.08, pulse) * smoothstep(0.2, 0.08, pulse);
      float baseBrightness = mix(0.06, 0.7, vHighlight);
      float brightness = baseBrightness + pulseGlow * mix(0.1, 1.0, vHighlight);
      brightness *= (0.5 + coreBright * 0.5);
      float alpha = mix(0.015, 0.9, vHighlight) * edgeFalloff;
      if (alpha < 0.01) discard;
      vec3 col = vColor * brightness;
      col += vColor * coreBright * 0.3;
      gl_FragColor = vec4(col, alpha);
    }
  `
};

const _lineColor = new THREE.Color();

const _LINE_VERSION = 8;
const _ringDir = new THREE.Vector3();
const _ringRight = new THREE.Vector3();
const _ringUp = new THREE.Vector3();
const _ringCorrUp = new THREE.Vector3();
const _ringTarget = new THREE.Vector3();
const _ringFrom = new THREE.Vector3();

function HouseholdConnectionLines({ edges, householdPositions, hoveredHouseholdId, starsByHousehold, householdGroupRefs, coupleHouseholds }) {
  const meshRef = useRef();
  const timeUniform = useRef({ value: 0 });
  const resolutionUniform = useRef({ value: new THREE.Vector2(1920, 1080) });
  const lineWidthUniform = useRef({ value: 4.0 });

  const { edgeData, hoverMask } = useMemo(() => {
    if (!edges || edges.length === 0) {
      return { edgeData: [], hoverMask: [] };
    }

    const mask = [];
    const data = [];

    const findStarLocalPos = (hhId, personId, basePos) => {
      if (!starsByHousehold || !personId) return null;
      const stars = starsByHousehold.get(hhId) || starsByHousehold.get(String(hhId)) || starsByHousehold.get(Number(hhId));
      if (!stars) return null;
      const star = stars.find(s => String(s.id) === String(personId));
      if (!star || !star.position) return null;
      return {
        x: star.position[0] - basePos.x,
        y: star.position[1] - basePos.y,
        z: star.position[2] - basePos.z,
      };
    };

    edges.forEach((edge, i) => {
      if (edge.isIntraHousehold || String(edge.from) === String(edge.to)) return;

      const edgeFrom = edge.from;
      const edgeTo = edge.to;
      const fromPos = householdPositions.get(edgeFrom) || householdPositions.get(String(edgeFrom)) || householdPositions.get(Number(edgeFrom));
      const toPos = householdPositions.get(edgeTo) || householdPositions.get(String(edgeTo)) || householdPositions.get(Number(edgeTo));
      if (!fromPos || !toPos) {
        mask.push({ from: null, to: null });
        data.push(null);
        return;
      }

      let fromColorIndex = 0;
      if (starsByHousehold) {
        const fromStars = starsByHousehold.get(edgeFrom) || starsByHousehold.get(String(edgeFrom)) || starsByHousehold.get(Number(edgeFrom));
        if (fromStars && fromStars.length > 0) {
          fromColorIndex = fromStars[0].householdIndex || 0;
        }
      }

      const childStarLocal = findStarLocalPos(edgeTo, edge.childPersonId, toPos);

      data.push({
        fromHouseholdId: edge.from,
        toHouseholdId: edge.to,
        fromBase: { x: fromPos.x, y: fromPos.y, z: fromPos.z },
        toBase: { x: toPos.x, y: toPos.y, z: toPos.z },
        fromColorIndex,
        isIntraHousehold: edge.isIntraHousehold || false,
        fromRing: edge.fromRing || false,
        childStarLocal,
      });

      mask.push({ from: edge.from, to: edge.to });
    });

    return { edgeData: data, hoverMask: mask };
  }, [edges, householdPositions, starsByHousehold]);

  const validEdgeCount = useMemo(() => edgeData.filter(e => e !== null).length, [edgeData]);
  const totalVerts = validEdgeCount * 4;
  const totalIndices = validEdgeCount * 6;

  const { startPos, endPos, sides, tValues, colorValues, highlightValues, indices, dummyPositions } = useMemo(() => {
    const sp = new Float32Array(totalVerts * 3);
    const ep = new Float32Array(totalVerts * 3);
    const sd = new Float32Array(totalVerts);
    const t = new Float32Array(totalVerts);
    const col = new Float32Array(totalVerts * 3);
    const hl = new Float32Array(totalVerts);
    hl.fill(0.10);
    const dp = new Float32Array(totalVerts * 3);
    const idx = new Uint32Array(totalIndices);

    let vertOffset = 0;
    for (let e = 0; e < validEdgeCount; e++) {
      sd[vertOffset] = -1; t[vertOffset] = 0;
      sd[vertOffset + 1] = 1; t[vertOffset + 1] = 0;
      sd[vertOffset + 2] = -1; t[vertOffset + 2] = 1;
      sd[vertOffset + 3] = 1; t[vertOffset + 3] = 1;

      const idxOffset = e * 6;
      idx[idxOffset] = vertOffset;
      idx[idxOffset + 1] = vertOffset + 1;
      idx[idxOffset + 2] = vertOffset + 2;
      idx[idxOffset + 3] = vertOffset + 1;
      idx[idxOffset + 4] = vertOffset + 3;
      idx[idxOffset + 5] = vertOffset + 2;

      vertOffset += 4;
    }

    return { startPos: sp, endPos: ep, sides: sd, tValues: t, colorValues: col, highlightValues: hl, indices: idx, dummyPositions: dp };
  }, [totalVerts, totalIndices, validEdgeCount]);

  const nodeGlowCount = validEdgeCount * 2;
  const nodeGlowRef = useRef();

  const { nodePositions, nodeColors, nodeAlphas } = useMemo(() => {
    const np = new Float32Array(nodeGlowCount * 3);
    const nc = new Float32Array(nodeGlowCount * 3);
    const na = new Float32Array(nodeGlowCount);
    na.fill(0.2);
    return { nodePositions: np, nodeColors: nc, nodeAlphas: na };
  }, [nodeGlowCount]);

  const nodeGlowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 nodeColor;
        attribute float nodeAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = nodeColor;
          vAlpha = nodeAlpha;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 8.0 * (150.0 / -mvPos.z);
          gl_PointSize = clamp(gl_PointSize, 2.0, 16.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float alpha = 1.0 - smoothstep(0.0, 0.5, d);
          alpha = pow(alpha, 2.0) * vAlpha;
          if (alpha < 0.005) discard;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame((state) => {
    if (!meshRef.current || !meshRef.current.geometry) return;
    timeUniform.current.value = state.clock.elapsedTime;

    const renderer = state.gl;
    const size = renderer.getSize(new THREE.Vector2());
    resolutionUniform.current.value.set(size.x, size.y);

    const spAttr = meshRef.current.geometry.getAttribute('aStart');
    const epAttr = meshRef.current.geometry.getAttribute('aEnd');
    const hlAttr = meshRef.current.geometry.getAttribute('aHighlight');
    const colAttr = meshRef.current.geometry.getAttribute('aColor');
    if (!spAttr || !epAttr) return;

    const groupRefs = householdGroupRefs?.current;
    let edgeIdx = 0;

    for (let i = 0; i < edgeData.length; i++) {
      const edge = edgeData[i];
      if (!edge) continue;

      let fromX = edge.fromBase.x, fromY = edge.fromBase.y, fromZ = edge.fromBase.z;
      let toX = edge.toBase.x, toY = edge.toBase.y, toZ = edge.toBase.z;

      if (groupRefs) {
        const fhId = edge.fromHouseholdId;
        const fromGroup = groupRefs.get(fhId) ?? groupRefs.get(String(fhId)) ?? groupRefs.get(Number(fhId));
        if (fromGroup) {
          fromX = fromGroup.position.x;
          fromY = fromGroup.position.y;
          fromZ = fromGroup.position.z;
        }

        const thId = edge.toHouseholdId;
        const toGroup = groupRefs.get(thId) ?? groupRefs.get(String(thId)) ?? groupRefs.get(Number(thId));
        if (toGroup) {
          toX = toGroup.position.x;
          toY = toGroup.position.y;
          toZ = toGroup.position.z;
        }
      }

      let fromScale = 1.0, toScale = 1.0;
      if (groupRefs) {
        const fGroup = groupRefs.get(edge.fromHouseholdId) ?? groupRefs.get(String(edge.fromHouseholdId)) ?? groupRefs.get(Number(edge.fromHouseholdId));
        if (fGroup) fromScale = fGroup.scale.x;
        const tGroup = groupRefs.get(edge.toHouseholdId) ?? groupRefs.get(String(edge.toHouseholdId)) ?? groupRefs.get(Number(edge.toHouseholdId));
        if (tGroup) toScale = tGroup.scale.x;
      }

      if (edge.childStarLocal) {
        toX = toX + edge.childStarLocal.x * toScale;
        toY = toY + edge.childStarLocal.y * toScale;
        toZ = toZ + edge.childStarLocal.z * toScale;
      }

      const fromR = GALAXY_RING_RADIUS * fromScale;
      _ringFrom.set(fromX, fromY, fromZ);
      _ringTarget.set(toX, toY, toZ);
      _ringDir.copy(state.camera.position).sub(_ringFrom).normalize();
      const upY = Math.abs(_ringDir.y) > 0.95 ? 1 : 0;
      _ringUp.set(upY, 1 - upY, 0);
      _ringRight.crossVectors(_ringUp, _ringDir).normalize();
      _ringCorrUp.crossVectors(_ringDir, _ringRight).normalize();
      const localX = _ringTarget.x - fromX;
      const localY = _ringTarget.y - fromY;
      const localZ = _ringTarget.z - fromZ;
      const projR = localX * _ringRight.x + localY * _ringRight.y + localZ * _ringRight.z;
      const projU = localX * _ringCorrUp.x + localY * _ringCorrUp.y + localZ * _ringCorrUp.z;
      const projLen = Math.sqrt(projR * projR + projU * projU);
      if (projLen > 0.001) {
        const nR = projR / projLen;
        const nU = projU / projLen;
        fromX += (_ringRight.x * nR + _ringCorrUp.x * nU) * fromR;
        fromY += (_ringRight.y * nR + _ringCorrUp.y * nU) * fromR;
        fromZ += (_ringRight.z * nR + _ringCorrUp.z * nU) * fromR;
      }

      const isHighlighted = hoveredHouseholdId && (String(hoverMask[i]?.from) === String(hoveredHouseholdId) || String(hoverMask[i]?.to) === String(hoveredHouseholdId));
      const hlVal = isHighlighted ? 1.0 : 0.05;

      const edgeColors = HOUSEHOLD_COLORS[edge.fromColorIndex % HOUSEHOLD_COLORS.length];
      _lineColor.set(edgeColors.glow);

      const base = edgeIdx * 4;
      for (let v = 0; v < 4; v++) {
        const vi = (base + v) * 3;
        spAttr.array[vi] = fromX;
        spAttr.array[vi + 1] = fromY;
        spAttr.array[vi + 2] = fromZ;
        epAttr.array[vi] = toX;
        epAttr.array[vi + 1] = toY;
        epAttr.array[vi + 2] = toZ;
        if (colAttr) {
          colAttr.array[vi] = _lineColor.r;
          colAttr.array[vi + 1] = _lineColor.g;
          colAttr.array[vi + 2] = _lineColor.b;
        }
        if (hlAttr) hlAttr.array[base + v] = hlVal;
      }

      edgeIdx++;
    }

    spAttr.needsUpdate = true;
    epAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;
    if (hlAttr) hlAttr.needsUpdate = true;

    if (nodeGlowRef.current && nodeGlowRef.current.geometry) {
      const ngPosAttr = nodeGlowRef.current.geometry.getAttribute('position');
      const ngColAttr = nodeGlowRef.current.geometry.getAttribute('nodeColor');
      const ngAlphaAttr = nodeGlowRef.current.geometry.getAttribute('nodeAlpha');
      if (ngPosAttr && ngColAttr && ngAlphaAttr) {
        let nodeIdx = 0;
        let validIdx = 0;
        for (let i = 0; i < edgeData.length; i++) {
          const edge = edgeData[i];
          if (!edge) continue;
          if (nodeIdx + 1 < nodeGlowCount) {
            const base = validIdx * 4;
            const svi = base * 3;
            const evi = (base + 2) * 3;
            ngPosAttr.array[nodeIdx * 3] = spAttr.array[svi];
            ngPosAttr.array[nodeIdx * 3 + 1] = spAttr.array[svi + 1];
            ngPosAttr.array[nodeIdx * 3 + 2] = spAttr.array[svi + 2];
            ngPosAttr.array[(nodeIdx + 1) * 3] = epAttr.array[evi];
            ngPosAttr.array[(nodeIdx + 1) * 3 + 1] = epAttr.array[evi + 1];
            ngPosAttr.array[(nodeIdx + 1) * 3 + 2] = epAttr.array[evi + 2];
            if (colAttr) {
              for (let ci = 0; ci < 3; ci++) {
                ngColAttr.array[nodeIdx * 3 + ci] = colAttr.array[svi + ci];
                ngColAttr.array[(nodeIdx + 1) * 3 + ci] = colAttr.array[svi + ci];
              }
            }
            const isHl = hoveredHouseholdId && (String(hoverMask[i]?.from) === String(hoveredHouseholdId) || String(hoverMask[i]?.to) === String(hoveredHouseholdId));
            const alpha = isHl ? 0.6 : 0.2;
            ngAlphaAttr.array[nodeIdx] = alpha;
            ngAlphaAttr.array[nodeIdx + 1] = alpha;
            nodeIdx += 2;
          }
          validIdx++;
        }
        ngPosAttr.needsUpdate = true;
        ngColAttr.needsUpdate = true;
        ngAlphaAttr.needsUpdate = true;
      }
    }
  });

  if (totalVerts === 0) return null;

  return (
    <group>
      <mesh ref={meshRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={totalVerts} array={dummyPositions} itemSize={3} />
          <bufferAttribute attach="attributes-aStart" count={totalVerts} array={startPos} itemSize={3} />
          <bufferAttribute attach="attributes-aEnd" count={totalVerts} array={endPos} itemSize={3} />
          <bufferAttribute attach="attributes-aSide" count={totalVerts} array={sides} itemSize={1} />
          <bufferAttribute attach="attributes-aT" count={totalVerts} array={tValues} itemSize={1} />
          <bufferAttribute attach="attributes-aColor" count={totalVerts} array={colorValues} itemSize={3} />
          <bufferAttribute attach="attributes-aHighlight" count={totalVerts} array={highlightValues} itemSize={1} />
          <bufferAttribute attach="index" count={indices.length} array={indices} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={connectionLineShader.vertexShader}
          fragmentShader={connectionLineShader.fragmentShader}
          uniforms={{
            uTime: timeUniform.current,
            uResolution: resolutionUniform.current,
            uLineWidth: lineWidthUniform.current,
          }}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {nodeGlowCount > 0 && (
        <points ref={nodeGlowRef} frustumCulled={false} material={nodeGlowMaterial}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={nodeGlowCount} array={nodePositions} itemSize={3} />
            <bufferAttribute attach="attributes-nodeColor" count={nodeGlowCount} array={nodeColors} itemSize={3} />
            <bufferAttribute attach="attributes-nodeAlpha" count={nodeGlowCount} array={nodeAlphas} itemSize={1} />
          </bufferGeometry>
        </points>
      )}
    </group>
  );
}

function AmbientDrift({ qualityTier }) {
  const pointsRef = useRef();

  const particleCount = qualityTier.driftCount || 300;

  const { positions, velocities, colors, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const vel = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const siz = new Float32Array(particleCount);
    const pha = new Float32Array(particleCount);

    const driftColors = [
      new THREE.Color(0xffd700),
      new THREE.Color(0xffb347),
      new THREE.Color(0xffe8cc),
      new THREE.Color(0xc8a8ff),
    ];

    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 200;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 200;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 200;

      vel[i * 3] = (Math.random() - 0.5) * 0.3;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;

      const c = driftColors[Math.floor(Math.random() * driftColors.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;

      siz[i] = 2 + Math.random() * 2;
      pha[i] = Math.random() * Math.PI * 2;
    }

    return { positions: pos, velocities: vel, colors: col, sizes: siz, phases: pha };
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
          float flicker = sin(time * 0.4 + phase) * 0.5 + 0.5;
          vAlpha = mix(0.05, 0.15, flicker);

          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (120.0 / -mvPos.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 6.0);
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
          alpha = pow(alpha, 2.0);
          alpha *= vAlpha;
          if (alpha < 0.003) discard;
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

  useFrame((state, delta) => {
    material.uniforms.time.value = state.clock.elapsedTime;
    if (pointsRef.current) {
      const posAttr = pointsRef.current.geometry.attributes.position;
      const arr = posAttr.array;
      const t = state.clock.elapsedTime;
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const turbX = Math.sin(t * 0.1 + phases[i]) * 0.02;
        const turbY = Math.cos(t * 0.08 + phases[i] * 1.3) * 0.02;
        const turbZ = Math.sin(t * 0.12 + phases[i] * 0.7) * 0.02;
        arr[i3] += (velocities[i3] + turbX) * delta;
        arr[i3 + 1] += (velocities[i3 + 1] + turbY) * delta;
        arr[i3 + 2] += (velocities[i3 + 2] + turbZ) * delta;

        for (let axis = 0; axis < 3; axis++) {
          if (arr[i3 + axis] > 100) arr[i3 + axis] = -100;
          if (arr[i3 + axis] < -100) arr[i3 + axis] = 100;
        }
      }
      posAttr.needsUpdate = true;
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
  const householdGroupRefs = useRef(new Map());
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
        isParent: person.isParent,
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

  const coupleHouseholds = useMemo(() => {
    const set = new Set();
    starsByHousehold.forEach((stars, hhId) => {
      const parentStars = stars.filter(s => s.isParent);
      if (parentStars.length >= 2) set.add(hhId);
    });
    return set;
  }, [starsByHousehold]);

  const hoveredPos = useMemo(() => {
    if (!hoveredHouseholdId) return null;
    return householdPositions.get(hoveredHouseholdId);
  }, [hoveredHouseholdId, householdPositions]);

  const connectedToHovered = useMemo(() => {
    if (!hoveredHouseholdId || !householdEdges) return null;
    const connected = new Set();
    connected.add(hoveredHouseholdId);
    householdEdges.forEach(edge => {
      if (edge.from === hoveredHouseholdId) connected.add(edge.to);
      if (edge.to === hoveredHouseholdId) connected.add(edge.from);
    });
    return connected;
  }, [hoveredHouseholdId, householdEdges]);
  
  return (
    <group>
      {!focusedHouseholdId && filters.showLines !== false && (
        <HouseholdConnectionLines
          edges={householdEdges}
          householdPositions={householdPositions}
          hoveredHouseholdId={hoveredHouseholdId}
          starsByHousehold={starsByHousehold}
          householdGroupRefs={householdGroupRefs}
          coupleHouseholds={coupleHouseholds}
        />
      )}
      {households.map((household, index) => {
        const pos = householdPositions.get(household.id);
        if (!pos) return null;
        
        const isFocused = household.id === focusedHouseholdId;
        const isHovered = household.id === hoveredHouseholdId;
        const householdStars = starsByHousehold.get(household.id) || [];
        const isConnectedToHovered = connectedToHovered ? connectedToHovered.has(household.id) : false;
        
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
            isConnectedToHovered={isConnectedToHovered}
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
            householdGroupRefs={householdGroupRefs}
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
    scene.fog = new THREE.FogExp2('#0a0812', 0.0018);
    return () => {
      scene.fog = null;
    };
  }, [scene]);
  
  return null;
}

function BackgroundStarField({ qualityTier }) {
  const pointsRef = useRef();

  const starCount = qualityTier.bgStarCount || 2000;

  const { positions, phases, brightnesses } = useMemo(() => {
    const pos = new Float32Array(starCount * 3);
    const pha = new Float32Array(starCount);
    const bri = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 200 + Math.random() * 300;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      pha[i] = Math.random() * Math.PI * 2;
      bri[i] = 0.3 + Math.random() * 0.7;
    }

    return { positions: pos, phases: pha, brightnesses: bri };
  }, [starCount]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute float phase;
        attribute float brightness;
        uniform float time;
        varying float vAlpha;

        void main() {
          float twinkle = sin(time * (0.8 + brightness * 2.0) + phase) * 0.5 + 0.5;
          float twinkle2 = sin(time * (0.3 + brightness * 0.7) + phase * 2.3) * 0.5 + 0.5;
          twinkle = mix(twinkle, twinkle2, 0.3);
          twinkle = twinkle * 0.7 + 0.3;
          vAlpha = brightness * twinkle * 0.7;

          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (1.0 + brightness) * (200.0 / -mvPos.z);
          gl_PointSize = clamp(gl_PointSize, 0.5, 2.5);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying float vAlpha;

        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          if (dist > 0.5) discard;

          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          vec3 coolStar = vec3(0.75, 0.82, 1.0);
          vec3 warmStar = vec3(1.0, 0.92, 0.8);
          vec3 color = mix(coolStar, warmStar, vAlpha * 0.6);
          gl_FragColor = vec4(color, alpha * vAlpha);
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
      pointsRef.current.rotation.y += 0.00003;
      pointsRef.current.rotation.x += 0.00001;
    }
  });

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={starCount} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-phase" count={starCount} array={phases} itemSize={1} />
        <bufferAttribute attach="attributes-brightness" count={starCount} array={brightnesses} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function PolarStabilizer({ controlsRef, active }) {
  const savedPolar = useRef(null);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (active) {
      if (savedPolar.current === null) {
        savedPolar.current = controls.getPolarAngle();
      }
      const current = controls.getPolarAngle();
      const diff = current - savedPolar.current;
      if (Math.abs(diff) > 0.001) {
        const az = controls.getAzimuthalAngle();
        const dist = controls.getDistance();
        const target = controls.target;
        const phi = savedPolar.current;
        const sinPhi = Math.sin(phi);
        controls.object.position.set(
          target.x + dist * sinPhi * Math.sin(az),
          target.y + dist * Math.cos(phi),
          target.z + dist * sinPhi * Math.cos(az)
        );
      }
    } else {
      savedPolar.current = null;
    }
  });

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
      
      <NebulaBackground qualityTier={qualityTier} />
      
      <BackgroundStarField qualityTier={qualityTier} />
      
      {qualityTier.showGasCloud && <NebulaGasCloud count={qualityTier.gasCount} />}
      {qualityTier.showFilaments && <NebulaFilaments qualityTier={qualityTier} />}
      
      {qualityTier.showDrift && <AmbientDrift qualityTier={qualityTier} />}
      
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
        maxDistance={level === 'system' ? 35 : 250}
        autoRotate={autoRotateEnabled && level === 'galaxy' && !hoveredHouseholdId}
        autoRotateSpeed={0.08}
        rotateSpeed={0.4}
        zoomSpeed={0.6}
        panSpeed={0.4}
        minPolarAngle={Math.PI * 0.05}
        maxPolarAngle={Math.PI * 0.95}
      />
      <PolarStabilizer controlsRef={controlsRef} active={autoRotateEnabled && level === 'galaxy' && !hoveredHouseholdId} />
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

function CornerBrackets({ children, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-amber-400/30" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-amber-400/30" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-amber-400/30" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-amber-400/30" />
      {children}
    </div>
  );
}

function HoverTooltip({ household, memberCount, starClass, mousePos, generation = 0, members = [], colorIndex = 0, hasChildren = false, hasParents = false }) {
  if (!household || !mousePos) return null;

  const householdColor = HOUSEHOLD_COLORS[Math.abs(colorIndex) % HOUSEHOLD_COLORS.length];
  const accentColor = householdColor?.primary || '#8B5CF6';

  const memberNames = members.slice(0, 6).map(m => {
    const firstName = (m.name || '').split(' ')[0];
    return firstName;
  });
  const extraCount = members.length - 6;

  return (
    <div
      className="fixed z-[60] pointer-events-none"
      style={{ left: mousePos.x + 20, top: mousePos.y - 8 }}
    >
      <div
        className="rounded-xl min-w-[190px] overflow-hidden"
        style={{
          background: 'rgba(6, 4, 16, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: `0 0 30px ${accentColor}18, 0 0 60px ${accentColor}08, 0 8px 32px rgba(0,0,0,0.6)`,
          border: `1px solid ${accentColor}22`,
        }}
      >
        <div
          className="h-[2px]"
          style={{
            background: `linear-gradient(to right, transparent, ${accentColor}66, ${accentColor}aa, ${accentColor}66, transparent)`,
          }}
        />
        <div className="px-3.5 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 0 6px ${accentColor}aa, 0 0 12px ${accentColor}44`,
              }}
            />
            <span className="text-[13px] font-semibold text-slate-50 tracking-wide">{household.name}</span>
          </div>

          <div className="text-[10px] text-slate-500 mb-2.5">{members.length} {members.length === 1 ? 'member' : 'members'}</div>

          <div
            className="h-px mb-2.5"
            style={{
              background: `linear-gradient(to right, ${accentColor}20, ${accentColor}08)`,
            }}
          />

          {memberNames.length > 0 && (
            <div className="space-y-0.5">
              {memberNames.map((name, i) => (
                <span key={i} className="block text-[11px] text-slate-300/80 font-light">{name}</span>
              ))}
              {extraCount > 0 && (
                <span className="text-xs text-slate-500">+{extraCount} more</span>
              )}
            </div>
          )}
        </div>
      </div>
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
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/60 mb-1">System Overview</div>
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

        <div className="h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent mb-3" />

        <div className="bg-slate-800/40 rounded px-2 py-1.5 mb-3">
          <div className="text-[9px] uppercase tracking-widest text-slate-500">Members</div>
          <div className="text-sm font-medium text-slate-200 mt-0.5">{memberCount}</div>
        </div>

        {members.length > 0 && (
          <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-1 h-1 rounded-full bg-amber-400/50" />
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
            <Home className="w-4 h-4 text-amber-400/70 group-hover:text-amber-300 transition-colors" />
            <span
              className={`text-xs uppercase tracking-[0.2em] font-medium transition-colors ${
                level === 'galaxy' ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'
              }`}
            >
              Galaxy Map
            </span>
          </button>
          {level === 'system' && selectedHousehold && (
            <>
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <span className="text-xs uppercase tracking-[0.2em] font-medium text-amber-400">
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
            <span className="text-[10px] uppercase tracking-[0.15em] text-amber-400/50 border border-amber-400/20 px-2 py-0.5 rounded">
              {selectedHousehold.name}
            </span>
          )}
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent" />
    </div>
  );
}

function FilterToggles({
  viewMode,
  onToggleViewMode,
  filters,
  onToggleFilter,
  qualityTier,
  onSetQuality,
}) {
  return (
    <div className="absolute top-16 left-4 z-50">
      <CornerBrackets className="bg-slate-950/80 backdrop-blur-md p-2.5 space-y-2.5">
        <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 px-1">Filters</div>

        <div className="space-y-1">
          <button
            onClick={() => onToggleFilter('showLines')}
            className={`flex items-center gap-2 text-[10px] uppercase tracking-wider px-1 py-0.5 w-full rounded transition-colors ${
              filters.showLines ? 'text-amber-400' : 'text-slate-600'
            }`}
          >
            {filters.showLines ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            Lines
          </button>
          <button
            onClick={() => onToggleFilter('showLabels')}
            className={`flex items-center gap-2 text-[10px] uppercase tracking-wider px-1 py-0.5 w-full rounded transition-colors ${
              filters.showLabels ? 'text-amber-400' : 'text-slate-600'
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
              <Sparkles className="w-3 h-3 text-amber-400" />
              Star Map
            </>
          ) : (
            <>
              <Cloud className="w-3 h-3 text-purple-400" />
              Nebula
            </>
          )}
        </button>

        {onSetQuality && (
          <>
            <div className="h-px bg-slate-700/50" />
            <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 px-1">Quality</div>
            <div className="flex gap-1">
              {['low', 'medium', 'high', 'ultra'].map(t => (
                <button
                  key={t}
                  onClick={() => onSetQuality(t)}
                  className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider transition-all ${
                    qualityTier?.tier === t
                      ? 'text-amber-400 border border-amber-400/40 bg-amber-400/10'
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  {t[0]}
                </button>
              ))}
            </div>
          </>
        )}
      </CornerBrackets>
    </div>
  );
}

function ZoomControls({ onZoomIn, onZoomOut, onResetView }) {
  return (
    <div className="absolute bottom-24 right-6 z-50 flex flex-col gap-1.5">
      <button
        onClick={onZoomIn}
        className="p-2 bg-slate-950/70 border border-amber-500/20 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 transition-colors rounded"
        title="Zoom In"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <button
        onClick={onZoomOut}
        className="p-2 bg-slate-950/70 border border-amber-500/20 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 transition-colors rounded"
        title="Zoom Out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
      <button
        onClick={onResetView}
        className="p-2 bg-slate-950/70 border border-amber-500/20 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 transition-colors rounded"
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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[480px] max-w-[calc(100vw-2rem)] glass-card rounded-2xl p-6 border border-amber-500/20 z-50 animate-in slide-in-from-bottom duration-300 bg-slate-900/95 backdrop-blur-xl">
      <div className="flex justify-between items-start">
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-amber-500/20">
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

  const handleToggleFilter = useCallback((type) => {
    setFilters(prev => ({ ...prev, [type]: !prev[type] }));
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
    const gen = pos?.generation ?? 0;
    const members = people.filter(p => p.household_id === hoveredHouseholdId);
    const colorIndex = households.findIndex(h => h.id === hoveredHouseholdId);
    const memberIds = new Set(members.map(m => m.id));
    const hasChildren = relationships.some(r =>
      r.relationship_type === 'parent' && memberIds.has(r.person_id) && !memberIds.has(r.related_person_id)
    );
    const hasParents = relationships.some(r =>
      r.relationship_type === 'parent' && memberIds.has(r.related_person_id) && !memberIds.has(r.person_id)
    );
    return { memberCount: mc, starClass: classifyHousehold(mc), generation: gen, members, colorIndex, hasChildren, hasParents };
  }, [hoveredHouseholdId, householdPositions, people, households, relationships]);

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
      <div
        className="absolute inset-0 pointer-events-none z-[2]"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(10,4,18,0.3) 60%, rgba(6,2,12,0.6) 100%)',
        }}
      />
      {contextLost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/90">
          <div className="text-center">
            <p className="text-white text-lg mb-2">Recovering graphics...</p>
            <p className="text-slate-400 text-sm">Please wait a moment</p>
          </div>
        </div>
      )}
      <Canvas
        camera={{ position: [75, 140, 105], fov: 55 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ background: '#060410' }}
        dpr={qualityTier.dpr}
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
          qualityTier={qualityTier}
          onSetQuality={qualityTier.setTier}
        />
      )}

      <ZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
      />

      {level === 'galaxy' && hoveredHousehold && hoveredHouseholdInfo && (
        <HoverTooltip
          household={hoveredHousehold}
          memberCount={hoveredHouseholdInfo.memberCount}
          starClass={hoveredHouseholdInfo.starClass}
          mousePos={mousePos}
          generation={hoveredHouseholdInfo.generation}
          members={hoveredHouseholdInfo.members}
          colorIndex={hoveredHouseholdInfo.colorIndex}
          hasChildren={hoveredHouseholdInfo.hasChildren}
          hasParents={hoveredHouseholdInfo.hasParents}
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
