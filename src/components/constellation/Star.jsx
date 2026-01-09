import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStarVisuals, DEFAULT_STAR_PROFILE } from '@/lib/starConfig';

const shimmeringStarShader = {
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
    uniform float temperature;
    varying vec2 vUv;
    
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
    
    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float angle = atan(center.y, center.x);
      
      // Completely transparent outside the circular area
      if (dist > 0.5) discard;
      
      // Time variations for shimmer
      float t = time + uniqueOffset * 10.0;
      float fastTime = t * 8.0;
      float medTime = t * 3.0;
      float slowTime = t * 0.5;
      
      // === CORE ===
      float coreRadius = 0.08;
      float coreGlow = 1.0 - smoothstep(0.0, coreRadius, dist);
      coreGlow = pow(coreGlow, 1.5);
      
      // Hot white center
      vec3 hotWhite = vec3(1.0, 0.99, 0.95);
      vec3 coreColor = mix(primaryColor, hotWhite, coreGlow * temperature);
      
      // === CHROMATIC ABERRATION / COLOR DANCING ===
      // Shift RGB channels slightly for that prismatic effect
      float chromaticSpeed = 5.0;
      float chromaticAmount = 0.15;
      
      float redShift = sin(fastTime * 1.1 + angle * 2.0) * chromaticAmount;
      float greenShift = sin(fastTime * 1.3 + angle * 2.5 + 2.0) * chromaticAmount;
      float blueShift = sin(fastTime * 1.7 + angle * 3.0 + 4.0) * chromaticAmount;
      
      vec3 chromaticColor = vec3(
        primaryColor.r + redShift,
        primaryColor.g + greenShift,
        primaryColor.b + blueShift
      );
      
      // === SHIMMERING RAYS ===
      float rayCount = 6.0;
      float rays = 0.0;
      
      for (float i = 0.0; i < 3.0; i++) {
        float rayAngle = angle + slowTime * (0.1 + i * 0.05);
        float rayPattern = pow(abs(sin(rayAngle * rayCount + i * 0.5)), 20.0 - i * 5.0);
        float rayFalloff = exp(-dist * (3.0 + i * 2.0));
        
        // Shimmer the rays
        float rayShimmer = 0.7 + 0.3 * sin(fastTime * (2.0 + i) + i * 1.5);
        rays += rayPattern * rayFalloff * rayShimmer * (1.0 - i * 0.2);
      }
      
      // Secondary cross rays at 45 degrees
      float crossAngle = angle + 0.785398; // 45 degrees
      float crossRays = pow(abs(sin(crossAngle * 4.0)), 30.0);
      crossRays *= exp(-dist * 4.0);
      crossRays *= 0.5 + 0.5 * sin(fastTime * 1.5 + 1.0);
      rays += crossRays * 0.5;
      
      // === INNER GLOW ===
      float innerGlow = 1.0 - smoothstep(0.0, 0.2, dist);
      innerGlow = pow(innerGlow, 2.0);
      
      // Pulsing inner glow
      float pulse = 0.85 + 0.15 * sin(medTime + uniqueOffset * 5.0);
      float pulse2 = 0.9 + 0.1 * sin(medTime * 1.7 + 1.0);
      innerGlow *= pulse * pulse2;
      
      // === OUTER HALO ===
      float haloGlow = 1.0 - smoothstep(0.1, 0.45, dist);
      haloGlow = pow(haloGlow, 3.0);
      
      // Shimmer the halo
      float haloShimmer = 0.7 + 0.3 * sin(fastTime * 0.8 + uniqueOffset * 3.0);
      haloShimmer *= 0.8 + 0.2 * sin(fastTime * 1.3 + 2.0);
      haloGlow *= haloShimmer;
      
      // === SPARKLE EFFECT ===
      float sparkle = 0.0;
      for (float i = 0.0; i < 8.0; i++) {
        float sparkleAngle = i * 0.785398 + slowTime * 0.2;
        float sparkleDir = cos(angle - sparkleAngle);
        float sparkleIntensity = pow(max(sparkleDir, 0.0), 50.0);
        sparkleIntensity *= exp(-dist * 5.0);
        
        // Random flicker for each sparkle
        float flicker = 0.5 + 0.5 * sin(fastTime * (3.0 + i * 0.7) + i * 2.5);
        sparkle += sparkleIntensity * flicker;
      }
      
      // === COMBINE LAYERS ===
      vec3 finalColor = vec3(0.0);
      
      // Core (brightest, white-hot)
      finalColor += coreColor * coreGlow * 2.0;
      
      // Inner glow with chromatic shift
      finalColor += chromaticColor * innerGlow * 1.5;
      
      // Rays with color
      vec3 rayColor = mix(glowColor, hotWhite, 0.3);
      finalColor += rayColor * rays * 0.8;
      
      // Outer halo
      finalColor += glowColor * haloGlow * 0.6;
      
      // Sparkles
      finalColor += hotWhite * sparkle * 0.5;
      
      // === TWINKLING INTENSITY ===
      float twinkle = 0.7 + 0.3 * sin(fastTime * 2.0 + uniqueOffset * 7.0);
      twinkle *= 0.8 + 0.2 * sin(fastTime * 3.3 + 1.5);
      twinkle *= 0.9 + 0.1 * noise(vec2(fastTime * 2.0, uniqueOffset * 10.0));
      
      finalColor *= brightness * twinkle;
      
      // === ALPHA ===
      float alpha = coreGlow * 1.5 + innerGlow + rays * 0.7 + haloGlow * 0.5 + sparkle * 0.3;
      alpha = clamp(alpha, 0.0, 1.0);
      
      // Smooth edge falloff
      alpha *= 1.0 - smoothstep(0.35, 0.5, dist);
      
      // Boost overall visibility
      alpha = pow(alpha, 0.8);
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
};

const atmosphericGlowShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform vec3 glowColor;
    uniform float time;
    uniform float intensity;
    uniform float uniqueOffset;
    varying vec2 vUv;
    
    float hash(float n) {
      return fract(sin(n) * 43758.5453);
    }
    
    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      
      if (dist > 0.5) discard;
      
      float t = time + uniqueOffset * 10.0;
      
      // Soft atmospheric glow
      float glow = 1.0 - smoothstep(0.0, 0.5, dist);
      glow = pow(glow, 4.0);
      
      // Breathing effect
      float breath = 0.7 + 0.3 * sin(t * 1.5);
      breath *= 0.85 + 0.15 * sin(t * 2.3 + 1.0);
      
      // Shimmer
      float shimmer = 0.8 + 0.2 * sin(t * 5.0 + dist * 10.0);
      
      float alpha = glow * intensity * breath * shimmer * 0.5;
      
      // Smooth circular edge
      alpha *= 1.0 - smoothstep(0.4, 0.5, dist);
      
      gl_FragColor = vec4(glowColor * 1.2, alpha);
    }
  `,
};

function ShimmeringStarSprite({ colors, scale, brightness, uniqueOffset, temperature = 0.7 }) {
  const meshRef = useRef();
  const timeRef = useRef(uniqueOffset * 100);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: shimmeringStarShader.vertexShader,
      fragmentShader: shimmeringStarShader.fragmentShader,
      uniforms: {
        primaryColor: { value: new THREE.Color(colors.primary) },
        secondaryColor: { value: new THREE.Color(colors.secondary) },
        glowColor: { value: new THREE.Color(colors.glow) },
        time: { value: 0 },
        brightness: { value: brightness * 1.3 },
        uniqueOffset: { value: uniqueOffset },
        temperature: { value: temperature },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, brightness, uniqueOffset, temperature]);
  
  useFrame((state, delta) => {
    timeRef.current += delta;
    material.uniforms.time.value = timeRef.current;
    
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  const spriteSize = 0.5 * scale;
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[spriteSize, spriteSize, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function AtmosphericGlow({ colors, scale, intensity, uniqueOffset }) {
  const meshRef = useRef();
  const timeRef = useRef(uniqueOffset * 100);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: atmosphericGlowShader.vertexShader,
      fragmentShader: atmosphericGlowShader.fragmentShader,
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
  
  const temperature = useMemo(() => {
    const colorId = starProfile?.colorPalette || 'celestial';
    if (colorId === 'solar' || colorId === 'ember' || colorId === 'amber' || colorId === 'sunset') return 0.95;
    if (colorId === 'arctic' || colorId === 'celestial') return 0.6;
    if (colorId === 'ruby' || colorId === 'rose') return 0.8;
    return 0.7;
  }, [starProfile]);
  
  return (
    <group 
      ref={groupRef} 
      position={position}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <AtmosphericGlow
        colors={visuals.colors}
        scale={activeScale}
        intensity={activeIntensity * 0.7}
        uniqueOffset={uniqueOffset}
      />
      
      <ShimmeringStarSprite
        colors={visuals.colors}
        scale={activeScale}
        brightness={visuals.brightness}
        uniqueOffset={uniqueOffset}
        temperature={temperature}
      />
      
      <mesh visible={false}>
        <sphereGeometry args={[0.2 * activeScale, 8, 8]} />
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
