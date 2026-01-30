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
  
  float universalEdgeFade(float dist) {
    float fade = 1.0 - smoothstep(0.28, 0.48, dist);
    return fade * fade;
  }
`;

const shaders = {
  nebula: `
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
      float t = time * (0.2 + energy * 0.3) + uniqueOffset * 20.0;
      
      // Swirling spiral structure
      float numArms = 3.0 + floor(uniqueOffset * 2.0);
      float spiral = sin(angle * numArms + log(dist + 0.01) * 3.0 - t * 0.4) * 0.5 + 0.5;
      spiral = pow(spiral, 1.5) * smoothstep(0.4, 0.05, dist);
      
      // Turbulent clouds
      vec2 warp = center * 4.0;
      float warpX = fbm(warp + t * 0.1, 4);
      float warpY = fbm(warp + vec2(5.0, 3.0) + t * 0.08, 4);
      vec2 warped = warp + vec2(warpX, warpY) * 0.5;
      float clouds = fbm(warped * 0.8, 5) * 0.5 + 0.5;
      
      // Bright core
      float core = exp(-dist * 8.0);
      
      // Breathing
      float breath = 0.85 + 0.15 * sin(t * 0.7) * sin(t * 0.5 + 1.0);
      
      // Color mixing
      vec3 col = mix(primaryColor, secondaryColor, clouds);
      col = mix(col, accentColor, spiral * 0.4);
      col = mix(col, glowColor, smoothstep(0.3, 0.0, dist) * 0.5);
      col = mix(col, vec3(1.0), core * 0.8);
      
      float intensity = (clouds * 0.5 + spiral * 0.6 + core * 1.2) * breath * (0.7 + energy * 0.5);
      
      float alpha = universalEdgeFade(dist) * globalOpacity * smoothstep(0.0, 0.1, intensity);
      if (alpha < 0.01) discard;
      
      gl_FragColor = vec4(col * intensity, alpha);
    }
  `,
  
  classic: `
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
      float t = time * (0.3 + energy * 0.4) + uniqueOffset * 15.0;
      
      // Radiant rays with variation
      float numRays = 6.0 + floor(uniqueOffset * 4.0);
      float rayAngle = angle + t * 0.1 + snoise(vec2(dist * 3.0, t * 0.2)) * 0.3;
      float rays = pow(abs(sin(rayAngle * numRays)), 3.0 + uniqueOffset * 2.0);
      rays *= smoothstep(0.4, 0.1, dist);
      
      // Glowing core with pulse
      float corePulse = 0.9 + 0.1 * sin(t * 2.0) * sin(t * 1.3);
      float core = exp(-dist * 10.0) * corePulse;
      
      // Atmospheric halo
      float halo = exp(-dist * 3.0) * 0.6;
      
      // Shimmer
      float shimmer = snoise(vec2(angle * 4.0 + t, dist * 5.0)) * 0.15 + 0.85;
      
      // Color
      vec3 col = mix(primaryColor, secondaryColor, dist * 2.0);
      col = mix(col, glowColor, rays * 0.4);
      col = mix(col, vec3(1.0, 0.98, 0.95), core * 0.9);
      
      float intensity = (halo + rays * 0.5 + core * 1.5) * shimmer * (0.7 + energy * 0.5);
      
      float alpha = universalEdgeFade(dist) * globalOpacity * smoothstep(0.0, 0.08, intensity);
      if (alpha < 0.01) discard;
      
      gl_FragColor = vec4(col * intensity, alpha);
    }
  `,
  
  plasma: `
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
      float t = time * (0.4 + energy * 0.5) + uniqueOffset * 25.0;
      
      // Electric tendrils
      float tendrils = 0.0;
      for (float i = 0.0; i < 5.0; i++) {
        float tendrilAngle = i * 1.257 + uniqueOffset * 6.28 + t * 0.3;
        float angleDiff = abs(mod(angle - tendrilAngle + 3.14159, 6.28318) - 3.14159);
        float wiggle = snoise(vec2(dist * 8.0 + t, i)) * 0.3;
        float tendril = exp(-angleDiff * angleDiff / (0.15 + wiggle * 0.1));
        tendril *= smoothstep(0.35, 0.1, dist);
        tendrils += tendril * 0.4;
      }
      
      // Crackling energy
      float crackle = snoise(vec2(angle * 6.0 + t * 2.0, dist * 10.0));
      crackle = smoothstep(0.3, 0.8, crackle) * smoothstep(0.35, 0.1, dist);
      
      // Hot core
      float core = exp(-dist * 12.0);
      float corePulse = 0.8 + 0.2 * sin(t * 3.0);
      core *= corePulse;
      
      // Color
      vec3 col = mix(primaryColor, accentColor, tendrils);
      col = mix(col, glowColor, crackle * 0.6);
      col = mix(col, vec3(1.0), core * 0.85);
      
      float intensity = (tendrils * 0.8 + crackle * 0.5 + core * 1.3) * (0.7 + energy * 0.6);
      
      float alpha = universalEdgeFade(dist) * globalOpacity * smoothstep(0.0, 0.1, intensity);
      if (alpha < 0.01) discard;
      
      gl_FragColor = vec4(col * intensity, alpha);
    }
  `,
  
  crystal: `
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
      float t = time * (0.2 + energy * 0.3) + uniqueOffset * 18.0;
      
      // Faceted geometry
      float numFacets = 6.0 + floor(uniqueOffset * 3.0);
      float facetAngle = mod(angle + 3.14159, 6.28318 / numFacets);
      float facets = 1.0 - smoothstep(0.0, 0.15, abs(facetAngle - 3.14159 / numFacets));
      facets *= smoothstep(0.35, 0.15, dist);
      
      // Internal refraction
      float refract = snoise(vec2(angle * numFacets + t * 0.5, dist * 6.0));
      refract = refract * 0.5 + 0.5;
      
      // Sparkle points
      float sparkle = snoise(vec2(angle * 12.0 + t * 3.0, dist * 15.0 + t));
      sparkle = smoothstep(0.6, 1.0, sparkle) * smoothstep(0.3, 0.1, dist);
      
      // Core glow
      float core = exp(-dist * 8.0);
      float pulse = 0.9 + 0.1 * sin(t * 1.5);
      
      // Color
      vec3 col = mix(primaryColor, secondaryColor, refract);
      col = mix(col, accentColor, facets * 0.3);
      col = mix(col, glowColor, sparkle);
      col = mix(col, vec3(1.0), core * 0.7);
      
      float intensity = (refract * 0.4 + facets * 0.5 + sparkle * 0.8 + core * 1.2) * pulse * (0.7 + energy * 0.5);
      
      float alpha = universalEdgeFade(dist) * globalOpacity * smoothstep(0.0, 0.1, intensity);
      if (alpha < 0.01) discard;
      
      gl_FragColor = vec4(col * intensity, alpha);
    }
  `,
  
  pulse: `
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
      float t = time * (0.5 + energy * 0.6) + uniqueOffset * 12.0;
      
      // Expanding rings
      float ringSpeed = 0.8 + uniqueOffset * 0.4;
      float rings = sin(dist * 20.0 - t * ringSpeed * 3.0);
      rings = smoothstep(0.3, 1.0, rings) * smoothstep(0.4, 0.1, dist);
      
      // Heartbeat core
      float heartbeat = sin(t * 2.5) * 0.5 + 0.5;
      heartbeat = pow(heartbeat, 2.0);
      float coreSize = 0.08 + heartbeat * 0.04;
      float core = smoothstep(coreSize + 0.05, coreSize * 0.3, dist);
      
      // Ambient glow
      float glow = exp(-dist * 4.0);
      
      // Ripple distortion
      float ripple = snoise(vec2(angle * 3.0, dist * 8.0 - t * 2.0)) * 0.2;
      
      // Color
      vec3 col = mix(primaryColor, secondaryColor, dist * 2.0 + ripple);
      col = mix(col, accentColor, rings * 0.5);
      col = mix(col, vec3(1.0), core * 0.9);
      
      float intensity = (glow * 0.6 + rings * 0.5 + core * 1.4) * (0.7 + energy * 0.5);
      
      float alpha = universalEdgeFade(dist) * globalOpacity * smoothstep(0.0, 0.08, intensity);
      if (alpha < 0.01) discard;
      
      gl_FragColor = vec4(col * intensity, alpha);
    }
  `,
  
  nova: `
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
      float t = time * (0.3 + energy * 0.4) + uniqueOffset * 22.0;
      
      // Explosive rays
      float numRays = 8.0 + floor(uniqueOffset * 6.0);
      float rayNoise = snoise(vec2(angle * 2.0 + t * 0.3, uniqueOffset * 10.0)) * 0.5;
      float rays = pow(abs(sin((angle + rayNoise) * numRays + t * 0.2)), 4.0);
      rays *= smoothstep(0.45, 0.05, dist);
      
      // Expanding shockwave
      float shockwave = sin(dist * 15.0 - t * 2.0);
      shockwave = smoothstep(0.5, 1.0, shockwave) * smoothstep(0.4, 0.15, dist);
      
      // Blazing core
      float corePulse = 0.85 + 0.15 * sin(t * 2.5) * sin(t * 1.8);
      float core = exp(-dist * 15.0) * corePulse;
      
      // Debris particles
      float debris = snoise(vec2(angle * 8.0 + t, dist * 12.0 - t * 3.0));
      debris = smoothstep(0.4, 0.9, debris) * smoothstep(0.4, 0.15, dist);
      
      // Color - hot center to cool edges
      vec3 col = mix(secondaryColor, primaryColor, dist * 2.5);
      col = mix(col, accentColor, rays * 0.4 + shockwave * 0.3);
      col = mix(col, glowColor, debris * 0.5);
      col = mix(col, vec3(1.0, 0.95, 0.9), core * 0.9);
      
      float intensity = (rays * 0.7 + shockwave * 0.4 + core * 1.5 + debris * 0.3) * (0.7 + energy * 0.6);
      
      float alpha = universalEdgeFade(dist) * globalOpacity * smoothstep(0.0, 0.1, intensity);
      if (alpha < 0.01) discard;
      
      gl_FragColor = vec4(col * intensity, alpha);
    }
  `,
};

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
    
    float glow = exp(-dist * 3.5);
    glow = pow(glow, 1.8);
    
    float breath = 0.85 + 0.15 * sin(t * 0.8 + uniqueOffset * 5.0);
    float wisp = snoise(vec2(angle * 3.0, dist * 4.0 + t * 0.2)) * 0.2 + 0.8;
    glow *= wisp * breath;
    
    float edgeFade = 1.0 - smoothstep(0.3, 0.5, dist);
    
    vec3 color = mix(glowColor, secondaryColor, dist * 2.0);
    
    float alpha = glow * 0.4 * globalOpacity * edgeFade * (0.6 + energy * 0.4);
    if (alpha < 0.01) discard;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

function StarSprite({ shape, colors, energy, uniqueOffset, globalOpacity = 1.0 }) {
  const materialRef = useRef();
  
  const shaderCode = shaders[shape] || shaders.classic;
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: shaderCode,
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
  }, [shaderCode, colors, energy, uniqueOffset]);
  
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
          shape={visuals.shape}
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
            key={star.personId || star.id || Math.random().toString()} 
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
