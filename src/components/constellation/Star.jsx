import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStarVisuals, DEFAULT_STAR_PROFILE } from '@/lib/starConfig';

// Style 1: Nebula - Complex turbulent multi-color clouds
const nebulaShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  varying vec2 vUv;
  
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m*m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  float fbm(vec2 p, int oct) {
    float sum = 0.0, amp = 0.5;
    for (int i = 0; i < 6; i++) {
      if (i >= oct) break;
      sum += snoise(p) * amp;
      p *= 2.0;
      amp *= 0.5;
    }
    return sum;
  }
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float t = time * 0.3 + uniqueOffset * 10.0;
    vec2 wUv = center * (3.0 + styleVariant * 2.0);
    
    float warpX = fbm(wUv + t * 0.1, 4);
    float warpY = fbm(wUv + vec2(5.2, 1.3) + t * 0.12, 4);
    vec2 warped = wUv + vec2(warpX, warpY) * (0.3 + styleVariant * 0.3);
    
    float structure = fbm(warped * 0.5 + t * 0.05, 5) * 0.4 +
                     fbm(warped * 1.5 + t * 0.08, 5) * 0.35 +
                     fbm(warped * 4.0 + t * 0.15, 4) * 0.25;
    structure = structure * 0.5 + 0.5;
    
    float filaments = pow(1.0 - abs(snoise(warped * 2.0 + t * 0.1)), 1.5) * 0.5;
    
    vec3 hotWhite = vec3(1.0, 0.98, 0.95);
    vec3 accent1 = vec3(0.3, 0.5, 1.0);
    vec3 accent2 = vec3(0.6, 0.2, 0.8);
    vec3 accent3 = vec3(1.0, 0.4, 0.6);
    
    float zone1 = fbm(warped + t * 0.05, 3) * 0.5 + 0.5;
    float zone2 = fbm(warped + vec2(3.0, 7.0) + t * 0.07, 3) * 0.5 + 0.5;
    
    vec3 colorMix = primaryColor;
    colorMix = mix(colorMix, accent1, smoothstep(0.3, 0.7, zone1) * 0.5);
    colorMix = mix(colorMix, accent2, smoothstep(0.4, 0.8, zone2) * 0.4);
    colorMix = mix(colorMix, accent3, filaments * 0.4);
    
    float coreGlow = pow(1.0 - smoothstep(0.0, 0.3, dist), 1.5);
    colorMix = mix(colorMix, hotWhite, coreGlow * 0.7);
    
    float intensity = structure * 0.6 + filaments + coreGlow * 1.2;
    intensity *= brightness * (0.85 + 0.15 * sin(time * 2.0 + uniqueOffset * 5.0));
    
    vec3 finalColor = colorMix * intensity;
    finalColor += hotWhite * pow(filaments, 3.0) * 0.3;
    
    float alpha = (structure * 0.5 + filaments * 0.8 + coreGlow) * (1.0 - smoothstep(0.35, 0.5, dist));
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.7);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Style 2: Classic - Clean radiant star with prominent rays
const classicShader = `
  uniform vec3 primaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  uniform float rayCount;
  varying vec2 vUv;
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float angle = atan(center.y, center.x);
    float t = time + uniqueOffset * 10.0;
    
    // Core
    float core = 1.0 - smoothstep(0.0, 0.12 + styleVariant * 0.05, dist);
    core = pow(core, 1.5);
    
    // Inner glow
    float innerGlow = 1.0 - smoothstep(0.0, 0.25, dist);
    innerGlow = pow(innerGlow, 2.0);
    
    // Rays
    float rays = 0.0;
    float numRays = rayCount;
    for (float i = 0.0; i < 12.0; i++) {
      if (i >= numRays) break;
      float rayAngle = i * 6.28318 / numRays + uniqueOffset * 3.14159;
      float rayIntensity = pow(abs(cos((angle - rayAngle) * numRays * 0.5)), 40.0 + styleVariant * 20.0);
      rayIntensity *= exp(-dist * (4.0 - styleVariant));
      rays += rayIntensity;
    }
    
    // Secondary rays (offset)
    float rays2 = 0.0;
    for (float i = 0.0; i < 12.0; i++) {
      if (i >= numRays) break;
      float rayAngle = i * 6.28318 / numRays + uniqueOffset * 3.14159 + 3.14159 / numRays;
      float rayIntensity = pow(abs(cos((angle - rayAngle) * numRays * 0.5)), 60.0);
      rayIntensity *= exp(-dist * 5.0) * 0.5;
      rays2 += rayIntensity;
    }
    rays += rays2;
    
    // Shimmer
    float shimmer = 0.85 + 0.15 * sin(t * 3.0) * sin(t * 4.7 + 1.0);
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.99, 0.95);
    vec3 coreColor = mix(primaryColor, hotWhite, core * 0.8);
    vec3 rayColor = mix(glowColor, hotWhite, 0.4);
    
    vec3 finalColor = coreColor * core * 2.0;
    finalColor += primaryColor * innerGlow;
    finalColor += rayColor * rays * 0.7;
    finalColor *= brightness * shimmer;
    
    float alpha = core + innerGlow * 0.8 + rays * 0.6;
    alpha *= 1.0 - smoothstep(0.4, 0.5, dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.8);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Style 3: Plasma - Swirling energy plasma ball
const plasmaShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  varying vec2 vUv;
  
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float angle = atan(center.y, center.x);
    float t = time * (0.8 + styleVariant * 0.5) + uniqueOffset * 10.0;
    
    // Swirling plasma
    float swirl = sin(angle * (3.0 + styleVariant * 2.0) + dist * 10.0 - t * 2.0);
    float swirl2 = sin(angle * (5.0 + styleVariant) - dist * 8.0 + t * 1.5);
    float plasmaPattern = swirl * 0.5 + swirl2 * 0.3;
    plasmaPattern += noise(vec2(angle * 5.0, dist * 10.0 + t)) * 0.4;
    
    // Electric arcs
    float arcs = 0.0;
    for (float i = 0.0; i < 5.0; i++) {
      float arcAngle = i * 1.2566 + t * 0.3 + uniqueOffset * 6.28;
      float arcDist = 0.15 + sin(t * 2.0 + i) * 0.05;
      vec2 arcPos = vec2(cos(arcAngle), sin(arcAngle)) * arcDist;
      float arc = exp(-length(center - arcPos) * 30.0);
      arcs += arc;
    }
    
    // Core
    float core = 1.0 - smoothstep(0.0, 0.15, dist);
    core = pow(core, 2.0);
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.98, 0.95);
    vec3 plasmaColor = mix(primaryColor, secondaryColor, plasmaPattern * 0.5 + 0.5);
    plasmaColor = mix(plasmaColor, glowColor, arcs * 0.5);
    plasmaColor = mix(plasmaColor, hotWhite, core * 0.8);
    
    float intensity = (plasmaPattern * 0.3 + 0.7) * (1.0 - dist * 1.5);
    intensity += arcs * 0.5 + core * 1.5;
    intensity *= brightness * (0.9 + 0.1 * sin(t * 5.0));
    
    vec3 finalColor = plasmaColor * intensity;
    
    float alpha = intensity * 0.8 + core;
    alpha *= 1.0 - smoothstep(0.35, 0.5, dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.75);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Style 4: Crystal - Geometric faceted appearance
const crystalShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  varying vec2 vUv;
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float angle = atan(center.y, center.x);
    float t = time * 0.5 + uniqueOffset * 10.0;
    
    // Faceted pattern
    float facets = floor(6.0 + styleVariant * 4.0);
    float facetAngle = mod(angle + t * 0.1, 6.28318 / facets);
    float facetEdge = abs(facetAngle - 3.14159 / facets);
    facetEdge = 1.0 - smoothstep(0.0, 0.3, facetEdge);
    
    // Radial facets
    float radialFacets = floor(3.0 + styleVariant * 2.0);
    float radialZone = floor(dist * radialFacets * 3.0);
    float radialEdge = fract(dist * radialFacets * 3.0);
    radialEdge = 1.0 - smoothstep(0.0, 0.1, radialEdge) * smoothstep(1.0, 0.9, radialEdge);
    
    // Core gem
    float core = 1.0 - smoothstep(0.0, 0.12, dist);
    core = pow(core, 1.5);
    
    // Sparkle points
    float sparkle = 0.0;
    for (float i = 0.0; i < 8.0; i++) {
      float sparkAngle = i * 0.785398 + t * 0.2;
      float sp = pow(max(cos(angle - sparkAngle), 0.0), 50.0);
      sp *= exp(-dist * 4.0);
      sp *= 0.5 + 0.5 * sin(t * 5.0 + i * 2.0);
      sparkle += sp;
    }
    
    // Colors with iridescence
    float iridescence = sin(angle * 3.0 + dist * 10.0 + t) * 0.5 + 0.5;
    vec3 iriColor = mix(primaryColor, secondaryColor, iridescence);
    vec3 hotWhite = vec3(1.0, 0.98, 0.95);
    
    vec3 gemColor = iriColor;
    gemColor += facetEdge * 0.2 * glowColor;
    gemColor += radialEdge * 0.15 * secondaryColor;
    gemColor = mix(gemColor, hotWhite, core * 0.7);
    gemColor += hotWhite * sparkle * 0.5;
    
    float intensity = 0.6 + facetEdge * 0.2 + core * 1.0 + sparkle * 0.3;
    intensity *= brightness * (0.9 + 0.1 * sin(t * 2.0));
    
    vec3 finalColor = gemColor * intensity;
    
    float alpha = 0.7 + facetEdge * 0.2 + core * 0.5 + sparkle * 0.3;
    alpha *= 1.0 - smoothstep(0.35, 0.5, dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.8);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Style 5: Pulse - Pulsating energy rings
const pulseShader = `
  uniform vec3 primaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  varying vec2 vUv;
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float t = time * (1.5 + styleVariant) + uniqueOffset * 10.0;
    
    // Pulsating rings
    float rings = 0.0;
    float ringCount = 3.0 + styleVariant * 2.0;
    for (float i = 0.0; i < 6.0; i++) {
      if (i >= ringCount) break;
      float ringPhase = t * 2.0 - i * 0.5;
      float ringRadius = fract(ringPhase * 0.2) * 0.4;
      float ring = 1.0 - smoothstep(0.0, 0.03, abs(dist - ringRadius));
      ring *= 1.0 - fract(ringPhase * 0.2) * 1.5; // Fade out
      rings += max(ring, 0.0);
    }
    
    // Core pulse
    float coreSize = 0.08 + sin(t * 3.0) * 0.03;
    float core = 1.0 - smoothstep(0.0, coreSize, dist);
    core = pow(core, 1.5);
    
    // Glow
    float glow = 1.0 - smoothstep(0.0, 0.35, dist);
    glow = pow(glow, 2.5);
    glow *= 0.7 + 0.3 * sin(t * 4.0);
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.98, 0.95);
    vec3 ringColor = mix(glowColor, hotWhite, 0.3);
    vec3 coreColor = mix(primaryColor, hotWhite, 0.7);
    
    vec3 finalColor = coreColor * core * 2.0;
    finalColor += primaryColor * glow * 0.6;
    finalColor += ringColor * rings * 0.8;
    finalColor *= brightness;
    
    float alpha = core + glow * 0.6 + rings * 0.7;
    alpha *= 1.0 - smoothstep(0.4, 0.5, dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.75);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Style 6: Nova - Explosive burst with debris
const novaShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  varying vec2 vUv;
  
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float angle = atan(center.y, center.x);
    float t = time * 0.5 + uniqueOffset * 10.0;
    
    // Explosive rays
    float rays = 0.0;
    float numRays = 8.0 + styleVariant * 8.0;
    for (float i = 0.0; i < 20.0; i++) {
      if (i >= numRays) break;
      float rayAngle = hash(i + uniqueOffset * 100.0) * 6.28318;
      float rayLength = 0.3 + hash(i * 2.0 + uniqueOffset * 50.0) * 0.2;
      float rayWidth = 0.02 + hash(i * 3.0) * 0.03;
      
      float angleDiff = abs(mod(angle - rayAngle + 3.14159, 6.28318) - 3.14159);
      float rayIntensity = 1.0 - smoothstep(0.0, rayWidth, angleDiff);
      rayIntensity *= 1.0 - smoothstep(0.05, rayLength, dist);
      rayIntensity *= 0.5 + 0.5 * sin(t * (2.0 + hash(i) * 3.0) + i);
      rays += rayIntensity;
    }
    
    // Core explosion
    float core = 1.0 - smoothstep(0.0, 0.1 + styleVariant * 0.05, dist);
    core = pow(core, 1.2);
    
    // Shockwave
    float shockRadius = fract(t * 0.3) * 0.4;
    float shock = 1.0 - smoothstep(0.0, 0.02, abs(dist - shockRadius));
    shock *= 1.0 - fract(t * 0.3);
    
    // Debris particles
    float debris = 0.0;
    for (float i = 0.0; i < 12.0; i++) {
      float debrisAngle = hash(i + 0.5) * 6.28318;
      float debrisDist = 0.1 + hash(i * 1.5) * 0.25;
      debrisDist *= 0.5 + 0.5 * sin(t * 2.0 + i);
      vec2 debrisPos = vec2(cos(debrisAngle), sin(debrisAngle)) * debrisDist;
      float d = exp(-length(center - debrisPos) * 50.0);
      debris += d * (0.5 + 0.5 * sin(t * 5.0 + i * 2.0));
    }
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.98, 0.95);
    vec3 hotYellow = vec3(1.0, 0.9, 0.5);
    
    vec3 finalColor = mix(primaryColor, hotWhite, core * 0.8) * core * 2.5;
    finalColor += mix(glowColor, hotYellow, 0.3) * rays * 0.8;
    finalColor += secondaryColor * shock * 0.6;
    finalColor += hotWhite * debris * 0.4;
    finalColor *= brightness * (0.85 + 0.15 * sin(t * 3.0));
    
    float alpha = core + rays * 0.6 + shock * 0.5 + debris * 0.4;
    alpha *= 1.0 - smoothstep(0.4, 0.5, dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.7);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STYLE_SHADERS = {
  nebula: nebulaShader,
  classic: classicShader,
  plasma: plasmaShader,
  crystal: crystalShader,
  pulse: pulseShader,
  nova: novaShader,
};

const SHAPE_TO_STYLE = {
  classic: 'classic',
  nova: 'nova',
  nebula: 'nebula',
  crystal: 'crystal',
  pulse: 'pulse',
  spiral: 'plasma',
  ring: 'pulse',
  cluster: 'nebula',
};

function StarSprite({ colors, scale, brightness, uniqueOffset, shapeId, glowIntensity }) {
  const meshRef = useRef();
  const timeRef = useRef(uniqueOffset * 100);
  
  const styleKey = SHAPE_TO_STYLE[shapeId] || 'classic';
  const fragmentShader = STYLE_SHADERS[styleKey];
  
  const material = useMemo(() => {
    const styleVariant = (uniqueOffset * 5) % 1;
    const rayCount = 4 + Math.floor(uniqueOffset * 8);
    
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        primaryColor: { value: new THREE.Color(colors.primary) },
        secondaryColor: { value: new THREE.Color(colors.secondary) },
        glowColor: { value: new THREE.Color(colors.glow) },
        time: { value: 0 },
        brightness: { value: brightness * 1.3 },
        uniqueOffset: { value: uniqueOffset },
        styleVariant: { value: styleVariant },
        rayCount: { value: rayCount },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, brightness, uniqueOffset, fragmentShader]);
  
  useFrame((state, delta) => {
    timeRef.current += delta;
    material.uniforms.time.value = timeRef.current;
    
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  const spriteSize = 0.55 * scale;
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[spriteSize, spriteSize, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function OuterGlow({ colors, scale, intensity, uniqueOffset }) {
  const meshRef = useRef();
  const timeRef = useRef(uniqueOffset * 100);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float time;
        uniform float intensity;
        uniform float uniqueOffset;
        varying vec2 vUv;
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          if (dist > 0.5) discard;
          
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          glow = pow(glow, 3.5);
          
          float breath = 0.75 + 0.25 * sin(time * 1.5 + uniqueOffset * 5.0);
          
          float alpha = glow * intensity * breath * 0.35;
          alpha *= 1.0 - smoothstep(0.4, 0.5, dist);
          
          gl_FragColor = vec4(glowColor * 1.1, alpha);
        }
      `,
      uniforms: {
        glowColor: { value: new THREE.Color(colors.glow) },
        time: { value: 0 },
        intensity: { value: intensity },
        uniqueOffset: { value: uniqueOffset },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, intensity, uniqueOffset]);
  
  useFrame((state, delta) => {
    timeRef.current += delta;
    material.uniforms.time.value = timeRef.current;
    
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  const glowSize = 0.9 * scale;
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[glowSize, glowSize, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

export default function Star({ 
  position = [0, 0, 0],
  starProfile = DEFAULT_STAR_PROFILE,
  personId = 'default',
  isHovered = false,
  isFocused = false,
  onClick,
  onPointerOver,
  onPointerOut,
}) {
  const groupRef = useRef();
  
  const visuals = useMemo(() => {
    return getStarVisuals(starProfile, personId);
  }, [starProfile, personId]);
  
  const uniqueOffset = useMemo(() => {
    let hash = 0;
    const str = String(personId);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return (hash % 1000) / 1000;
  }, [personId]);
  
  const shapeId = starProfile?.shape || visuals.shape?.id || 'classic';
  
  const activeScale = useMemo(() => {
    if (isFocused) return visuals.scale * 1.5;
    if (isHovered) return visuals.scale * 1.3;
    return visuals.scale;
  }, [isHovered, isFocused, visuals.scale]);
  
  const activeIntensity = useMemo(() => {
    const base = visuals.glow?.intensity || 0.7;
    if (isFocused) return base * 1.6;
    if (isHovered) return base * 1.4;
    return base;
  }, [isHovered, isFocused, visuals.glow]);
  
  return (
    <group 
      ref={groupRef} 
      position={position}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <OuterGlow
        colors={visuals.colors}
        scale={activeScale}
        intensity={activeIntensity * 0.6}
        uniqueOffset={uniqueOffset}
      />
      
      <StarSprite
        colors={visuals.colors}
        scale={activeScale}
        brightness={visuals.brightness}
        uniqueOffset={uniqueOffset}
        shapeId={shapeId}
        glowIntensity={activeIntensity}
      />
      
      <mesh visible={false}>
        <sphereGeometry args={[0.22 * activeScale, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

export function StarInstanced({ stars, onStarClick, onStarHover, hoveredId, focusedId }) {
  return (
    <group>
      {stars.map((star) => (
        <Star
          key={star.id}
          position={star.position}
          starProfile={star.starProfile}
          personId={star.id}
          isHovered={hoveredId === star.id}
          isFocused={focusedId === star.id}
          onClick={(e) => {
            e.stopPropagation();
            onStarClick?.(star);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            onStarHover?.(star.id);
          }}
          onPointerOut={() => onStarHover?.(null)}
        />
      ))}
    </group>
  );
}
