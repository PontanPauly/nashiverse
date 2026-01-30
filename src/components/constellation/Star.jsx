import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getStarVisuals, DEFAULT_STAR_PROFILE } from '@/lib/starConfig';

const noiseLib = `
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
    float sum = 0.0, amp = 0.5, freq = 1.0;
    for (int i = 0; i < 6; i++) {
      if (i >= oct) break;
      sum += snoise(p * freq) * amp;
      freq *= 2.0;
      amp *= 0.5;
    }
    return sum;
  }
`;

const livingStarShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform vec3 accentColor;
  uniform float time;
  uniform float energy;
  uniform float uniqueOffset;
  uniform float globalOpacity;
  varying vec2 vUv;
  
  ${noiseLib}
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    
    float t = time * (0.3 + energy * 0.4) + uniqueOffset * 20.0;
    float slowT = t * 0.3;
    float fastT = t * 1.5;
    
    // === CORE: Bright pulsing center ===
    float corePulse = 0.8 + 0.2 * sin(t * 2.0) * sin(t * 1.3 + 1.0);
    float coreSize = 0.06 + 0.02 * sin(t * 1.5);
    float core = smoothstep(coreSize + 0.03, coreSize * 0.3, dist);
    core = pow(core, 1.5) * corePulse;
    
    // === SPIRAL ARMS: Rotating logarithmic spirals ===
    float numArms = 3.0 + floor(uniqueOffset * 3.0);
    float spiralTightness = 2.0 + uniqueOffset * 1.5;
    float spiralAngle = angle + log(dist + 0.01) * spiralTightness - slowT * 0.5;
    float spiral = sin(spiralAngle * numArms) * 0.5 + 0.5;
    spiral = pow(spiral, 2.0);
    
    // Spiral brightness falls off with distance
    float spiralFade = smoothstep(0.4, 0.08, dist);
    spiral *= spiralFade;
    
    // Add rotation to the whole thing
    float rotation = slowT * 0.2;
    vec2 rotatedCenter = vec2(
      center.x * cos(rotation) - center.y * sin(rotation),
      center.x * sin(rotation) + center.y * cos(rotation)
    );
    
    // === FLOWING COLOR WAVES ===
    float wave1 = sin(angle * 2.0 + dist * 8.0 - t * 1.2) * 0.5 + 0.5;
    float wave2 = sin(angle * 3.0 - dist * 6.0 + t * 0.8 + uniqueOffset * 5.0) * 0.5 + 0.5;
    float wave3 = sin(dist * 12.0 - t * 2.0) * 0.5 + 0.5;
    
    // Combine waves with noise for organic feel
    float noiseWarp = fbm(rotatedCenter * 4.0 + t * 0.1, 4) * 0.5 + 0.5;
    float colorWave = (wave1 + wave2 * 0.7 + wave3 * 0.5) / 2.2;
    colorWave = mix(colorWave, noiseWarp, 0.4);
    
    // === FLICKERING HOTSPOTS ===
    float hotspotNoise = fbm(vec2(angle * 2.0 + uniqueOffset * 10.0, dist * 5.0 + fastT * 0.3), 3);
    float hotspots = smoothstep(0.3, 0.8, hotspotNoise) * smoothstep(0.35, 0.1, dist);
    hotspots *= (0.5 + 0.5 * sin(fastT * 3.0 + hotspotNoise * 10.0));
    
    // === ORGANIC BREATHING ===
    float breathe = 0.85 + 0.15 * sin(t * 0.8) * sin(t * 0.5 + 2.0);
    float asyncBreath = 0.9 + 0.1 * sin(t * 1.3 + uniqueOffset * 8.0);
    breathe *= asyncBreath;
    
    // === WISPY OUTER TENDRILS ===
    float tendrilNoise = fbm(vec2(angle * 4.0 + slowT * 0.5, uniqueOffset * 15.0), 4);
    float tendrils = smoothstep(0.2, 0.5, tendrilNoise);
    float tendrilFade = smoothstep(0.45, 0.15, dist) * smoothstep(0.05, 0.2, dist);
    tendrils *= tendrilFade * 0.6;
    
    // === EDGE FADE ===
    float edgeFade = 1.0 - smoothstep(0.2, 0.48, dist);
    edgeFade = pow(edgeFade, 1.5);
    
    // === COLOR MIXING ===
    vec3 hotWhite = vec3(1.0, 0.98, 0.95);
    vec3 baseColor = mix(primaryColor, secondaryColor, colorWave);
    baseColor = mix(baseColor, accentColor, wave2 * 0.3 * energy);
    baseColor = mix(baseColor, glowColor, tendrils * 0.5);
    
    // Core is white-hot
    vec3 finalColor = mix(baseColor, hotWhite, core * 0.9);
    
    // Hotspots add bright pops
    finalColor = mix(finalColor, hotWhite, hotspots * 0.7);
    
    // Spiral structure affects brightness
    float brightness = 0.4 + spiral * 0.4 + core * 1.2 + hotspots * 0.5 + tendrils * 0.3;
    brightness *= breathe;
    brightness *= (0.7 + energy * 0.6);
    
    finalColor *= brightness;
    
    // Add glow bloom
    float bloom = exp(-dist * 4.0) * 0.3;
    finalColor += glowColor * bloom;
    
    float alpha = edgeFade * globalOpacity;
    alpha *= smoothstep(0.0, 0.15, brightness);
    
    if (alpha < 0.01) discard;
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const outerGlowShader = `
  uniform vec3 glowColor;
  uniform vec3 secondaryColor;
  uniform float time;
  uniform float energy;
  uniform float uniqueOffset;
  uniform float globalOpacity;
  varying vec2 vUv;
  
  ${noiseLib}
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    
    float t = time * 0.3 + uniqueOffset * 10.0;
    
    // Soft exponential glow
    float glow = exp(-dist * 3.5);
    glow = pow(glow, 1.8);
    
    // Breathing
    float breath = 0.85 + 0.15 * sin(t * 0.8 + uniqueOffset * 5.0);
    
    // Wispy variations
    float wisp = snoise(vec2(angle * 3.0, dist * 4.0 + t * 0.2)) * 0.2 + 0.8;
    glow *= wisp * breath;
    
    // Edge fade
    float edgeFade = 1.0 - smoothstep(0.3, 0.5, dist);
    
    vec3 color = mix(glowColor, secondaryColor, dist * 2.0);
    
    float alpha = glow * 0.4 * globalOpacity * edgeFade * (0.6 + energy * 0.4);
    
    if (alpha < 0.01) discard;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

function StarSprite({ colors, energy, uniqueOffset, globalOpacity = 1.0 }) {
  const materialRef = useRef();
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: livingStarShader,
      uniforms: {
        primaryColor: { value: new THREE.Color(colors.primary) },
        secondaryColor: { value: new THREE.Color(colors.secondary) },
        glowColor: { value: new THREE.Color(colors.glow) },
        accentColor: { value: new THREE.Color(colors.accent) },
        time: { value: 0 },
        energy: { value: energy },
        uniqueOffset: { value: uniqueOffset },
        globalOpacity: { value: globalOpacity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, energy, uniqueOffset]);
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.globalOpacity.value = globalOpacity;
    }
  });
  
  materialRef.current = material;
  
  return (
    <mesh>
      <planeGeometry args={[1.8, 1.8]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function OuterGlow({ colors, energy, uniqueOffset, globalOpacity = 1.0 }) {
  const materialRef = useRef();
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: outerGlowShader,
      uniforms: {
        glowColor: { value: new THREE.Color(colors.glow) },
        secondaryColor: { value: new THREE.Color(colors.secondary) },
        time: { value: 0 },
        energy: { value: energy },
        uniqueOffset: { value: uniqueOffset },
        globalOpacity: { value: globalOpacity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, energy, uniqueOffset]);
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.globalOpacity.value = globalOpacity;
    }
  });
  
  materialRef.current = material;
  
  return (
    <mesh position={[0, 0, -0.01]}>
      <planeGeometry args={[3.2, 3.2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

export default function Star({
  position = [0, 0, 0],
  starProfile,
  personId,
  personName,
  onClick,
  onPointerOver,
  onPointerOut,
  showLabel = false,
  globalOpacity = 1.0,
}) {
  const groupRef = useRef();
  const profile = { ...DEFAULT_STAR_PROFILE, ...starProfile };
  const visuals = useMemo(() => getStarVisuals(profile, personId), [profile, personId]);
  
  const handleClick = (e) => {
    e.stopPropagation();
    onClick?.(personId);
  };
  
  const handlePointerOver = (e) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    onPointerOver?.(personId);
  };
  
  const handlePointerOut = (e) => {
    e.stopPropagation();
    document.body.style.cursor = 'auto';
    onPointerOut?.(personId);
  };
  
  return (
    <group ref={groupRef} position={position}>
      <group
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <OuterGlow
          colors={visuals.colors}
          energy={visuals.energy}
          uniqueOffset={visuals.uniqueOffset}
          globalOpacity={globalOpacity}
        />
        <StarSprite
          colors={visuals.colors}
          energy={visuals.energy}
          uniqueOffset={visuals.uniqueOffset}
          globalOpacity={globalOpacity}
        />
        
        <mesh visible={false}>
          <sphereGeometry args={[0.8, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </group>
      
      {showLabel && personName && (
        <Html
          position={[0, -1.2, 0]}
          center
          style={{
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <div className="px-2 py-1 bg-slate-900/80 backdrop-blur-sm rounded text-sm text-white font-medium border border-slate-700/50">
            {personName}
          </div>
        </Html>
      )}
    </group>
  );
}

export function StarInstanced({
  stars = [],
  onStarClick,
  onStarHover,
  hoveredId,
  focusedId,
  globalOpacity = 1.0,
  globalScale = 1.0,
  animated = true,
}) {
  return (
    <group>
      {stars.map((star) => {
        const isHovered = hoveredId === star.personId;
        const isFocused = focusedId === star.personId;
        const scale = globalScale * (isHovered ? 1.15 : isFocused ? 1.1 : 1.0);
        
        return (
          <group 
            key={star.personId} 
            position={star.position}
            scale={[scale, scale, scale]}
          >
            <Star
              position={[0, 0, 0]}
              starProfile={star.starProfile}
              personId={star.personId}
              personName={star.name}
              onClick={() => onStarClick?.(star)}
              onPointerOver={() => onStarHover?.(star.personId)}
              onPointerOut={() => onStarHover?.(null)}
              showLabel={isHovered || isFocused}
              globalOpacity={globalOpacity}
            />
          </group>
        );
      })}
    </group>
  );
}
