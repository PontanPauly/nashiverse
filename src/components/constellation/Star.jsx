import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStarVisuals, DEFAULT_STAR_PROFILE } from '@/lib/starConfig';

const nebulaStarShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform vec3 primaryColor;
    uniform vec3 secondaryColor;
    uniform vec3 glowColor;
    uniform float time;
    uniform float brightness;
    uniform float uniqueOffset;
    varying vec2 vUv;
    
    // Simplex-like noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                         -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0))
                       + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                              dot(x12.zw,x12.zw)), 0.0);
      m = m*m;
      m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    
    float fbm(vec2 p, int octaves) {
      float sum = 0.0;
      float amp = 0.5;
      float freq = 1.0;
      for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        sum += snoise(p * freq) * amp;
        freq *= 2.0;
        amp *= 0.5;
      }
      return sum;
    }
    
    float ridgedNoise(vec2 p) {
      return 1.0 - abs(snoise(p));
    }
    
    float ridgedFbm(vec2 p, int octaves) {
      float sum = 0.0;
      float amp = 0.5;
      float freq = 1.0;
      for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        sum += ridgedNoise(p * freq) * amp;
        freq *= 2.0;
        amp *= 0.5;
      }
      return sum;
    }
    
    vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
      return a + b * cos(6.28318 * (c * t + d));
    }
    
    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float angle = atan(center.y, center.x);
      
      if (dist > 0.5) discard;
      
      float t = time * 0.3 + uniqueOffset * 10.0;
      
      // === TURBULENT STRUCTURE ===
      vec2 turbulentUv = center * 4.0;
      
      // Warped coordinates for organic shape
      float warpX = fbm(turbulentUv + t * 0.1, 4);
      float warpY = fbm(turbulentUv + vec2(5.2, 1.3) + t * 0.12, 4);
      vec2 warpedUv = turbulentUv + vec2(warpX, warpY) * 0.5;
      
      // Multi-scale noise layers
      float largeStructure = fbm(warpedUv * 0.5 + t * 0.05, 5);
      float mediumStructure = fbm(warpedUv * 1.5 + t * 0.08, 5);
      float fineDetail = fbm(warpedUv * 4.0 + t * 0.15, 4);
      
      // Filaments using ridged noise
      float filaments = ridgedFbm(warpedUv * 2.0 + t * 0.1, 5);
      float filaments2 = ridgedFbm(warpedUv * 3.0 - t * 0.08, 4);
      
      // Hot spots
      float hotSpots = pow(fbm(warpedUv * 2.0 + t * 0.2, 3) * 0.5 + 0.5, 3.0);
      
      // === MULTI-COLOR MIXING ===
      // Different colors for different regions
      vec3 hotPink = vec3(1.0, 0.4, 0.6);
      vec3 electricBlue = vec3(0.3, 0.5, 1.0);
      vec3 deepPurple = vec3(0.6, 0.2, 0.8);
      vec3 brightYellow = vec3(1.0, 0.9, 0.4);
      vec3 cyanGlow = vec3(0.3, 0.9, 0.9);
      vec3 hotWhite = vec3(1.0, 0.98, 0.95);
      vec3 orangeFire = vec3(1.0, 0.5, 0.2);
      
      // Color zones based on noise
      float colorZone1 = fbm(warpedUv * 1.0 + t * 0.05, 3) * 0.5 + 0.5;
      float colorZone2 = fbm(warpedUv * 1.5 + vec2(3.0, 7.0) + t * 0.07, 3) * 0.5 + 0.5;
      float colorZone3 = fbm(warpedUv * 2.0 + vec2(11.0, 5.0) - t * 0.04, 3) * 0.5 + 0.5;
      
      // Mix primary color with chaotic multi-colors
      vec3 baseColor = primaryColor;
      
      // Layer different colors based on noise zones
      vec3 colorMix = baseColor;
      colorMix = mix(colorMix, electricBlue, smoothstep(0.3, 0.7, colorZone1) * 0.6);
      colorMix = mix(colorMix, deepPurple, smoothstep(0.4, 0.8, colorZone2) * 0.5);
      colorMix = mix(colorMix, hotPink, smoothstep(0.5, 0.9, colorZone3) * 0.4);
      colorMix = mix(colorMix, cyanGlow, filaments * 0.4);
      colorMix = mix(colorMix, brightYellow, hotSpots * 0.6);
      colorMix = mix(colorMix, orangeFire, pow(filaments2, 2.0) * 0.3);
      
      // === STRUCTURE INTENSITY ===
      float structure = largeStructure * 0.4 + mediumStructure * 0.35 + fineDetail * 0.25;
      structure = structure * 0.5 + 0.5; // Normalize to 0-1
      
      // Add filament brightness
      float filamentGlow = pow(filaments, 1.5) * 0.5 + pow(filaments2, 2.0) * 0.3;
      
      // Core brightness gradient
      float coreGlow = 1.0 - smoothstep(0.0, 0.3, dist);
      coreGlow = pow(coreGlow, 1.5);
      
      // Hot core
      colorMix = mix(colorMix, hotWhite, coreGlow * 0.7);
      colorMix = mix(colorMix, brightYellow, coreGlow * hotSpots * 0.5);
      
      // === EDGE WISPS ===
      float edgeNoise = fbm(vec2(angle * 3.0, dist * 5.0) + t * 0.2, 4);
      float wispyEdge = smoothstep(0.25, 0.45, dist) * (0.5 + edgeNoise * 0.5);
      
      // Outer tendrils
      float tendrils = 0.0;
      for (float i = 0.0; i < 6.0; i++) {
        float tendrilAngle = angle + i * 1.047 + t * 0.1 * (0.5 + i * 0.1);
        float tendrilNoise = fbm(vec2(tendrilAngle, dist * 3.0 + i) + t * 0.1, 3);
        float tendril = pow(max(tendrilNoise, 0.0), 2.0) * exp(-dist * 3.0);
        tendrils += tendril;
      }
      
      // === COMBINE ===
      float intensity = structure * 0.6 + filamentGlow + coreGlow * 1.2 + tendrils * 0.3;
      intensity *= brightness;
      
      // Pulsing
      float pulse = 0.85 + 0.15 * sin(time * 2.0 + uniqueOffset * 5.0);
      pulse *= 0.9 + 0.1 * sin(time * 3.3 + 1.5);
      intensity *= pulse;
      
      vec3 finalColor = colorMix * intensity;
      
      // Add bright filament highlights
      finalColor += hotWhite * pow(filaments, 3.0) * 0.4;
      finalColor += cyanGlow * pow(filaments2, 3.0) * 0.3;
      
      // === ALPHA ===
      float baseAlpha = structure * 0.5 + filamentGlow * 0.8 + coreGlow;
      baseAlpha += tendrils * 0.5;
      
      // Soft circular falloff
      float edgeFade = 1.0 - smoothstep(0.3, 0.5, dist);
      edgeFade = mix(edgeFade, 1.0, wispyEdge * 0.3);
      
      float alpha = baseAlpha * edgeFade;
      alpha = clamp(alpha, 0.0, 1.0);
      alpha = pow(alpha, 0.7);
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
};

const outerGlowShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform vec3 glowColor;
    uniform vec3 secondaryColor;
    uniform float time;
    uniform float intensity;
    uniform float uniqueOffset;
    varying vec2 vUv;
    
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }
    
    float fbm(vec2 p) {
      float sum = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 4; i++) {
        sum += noise(p) * amp;
        p *= 2.0;
        amp *= 0.5;
      }
      return sum;
    }
    
    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float angle = atan(center.y, center.x);
      
      if (dist > 0.5) discard;
      
      float t = time * 0.2 + uniqueOffset * 10.0;
      
      // Soft outer glow
      float glow = 1.0 - smoothstep(0.0, 0.5, dist);
      glow = pow(glow, 3.0);
      
      // Wispy variations
      float wispNoise = fbm(vec2(angle * 2.0, dist * 3.0) + t);
      glow *= 0.7 + wispNoise * 0.3;
      
      // Color gradient
      vec3 innerColor = mix(glowColor, vec3(1.0), 0.3);
      vec3 outerColor = mix(glowColor, secondaryColor, 0.5);
      vec3 color = mix(innerColor, outerColor, dist * 2.0);
      
      // Breathing
      float breath = 0.8 + 0.2 * sin(time * 1.5 + uniqueOffset * 3.0);
      
      float alpha = glow * intensity * breath * 0.4;
      alpha *= 1.0 - smoothstep(0.4, 0.5, dist);
      
      gl_FragColor = vec4(color, alpha);
    }
  `,
};

function NebulaStarSprite({ colors, scale, brightness, uniqueOffset }) {
  const meshRef = useRef();
  const timeRef = useRef(uniqueOffset * 100);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: nebulaStarShader.vertexShader,
      fragmentShader: nebulaStarShader.fragmentShader,
      uniforms: {
        primaryColor: { value: new THREE.Color(colors.primary) },
        secondaryColor: { value: new THREE.Color(colors.secondary) },
        glowColor: { value: new THREE.Color(colors.glow) },
        time: { value: 0 },
        brightness: { value: brightness * 1.4 },
        uniqueOffset: { value: uniqueOffset },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, brightness, uniqueOffset]);
  
  useFrame((state, delta) => {
    timeRef.current += delta;
    material.uniforms.time.value = timeRef.current;
    
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  const spriteSize = 0.6 * scale;
  
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
      vertexShader: outerGlowShader.vertexShader,
      fragmentShader: outerGlowShader.fragmentShader,
      uniforms: {
        glowColor: { value: new THREE.Color(colors.glow) },
        secondaryColor: { value: new THREE.Color(colors.secondary) },
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
  
  const glowSize = 1.0 * scale;
  
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
      
      <NebulaStarSprite
        colors={visuals.colors}
        scale={activeScale}
        brightness={visuals.brightness}
        uniqueOffset={uniqueOffset}
      />
      
      <mesh visible={false}>
        <sphereGeometry args={[0.25 * activeScale, 8, 8]} />
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
