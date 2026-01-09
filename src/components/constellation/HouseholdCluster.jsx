import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const HOUSEHOLD_COLORS = [
  { 
    primary: '#8B5CF6', 
    secondary: '#3B82F6',
    accent: '#A78BFA',
    glow: '#C4B5FD',
    dust: '#1e1b4b'
  },
  { 
    primary: '#F97316', 
    secondary: '#EF4444',
    accent: '#FB923C',
    glow: '#FED7AA',
    dust: '#451a03'
  },
  { 
    primary: '#10B981', 
    secondary: '#06B6D4',
    accent: '#34D399',
    glow: '#6EE7B7',
    dust: '#022c22'
  },
  { 
    primary: '#EC4899', 
    secondary: '#A855F7',
    accent: '#F472B6',
    glow: '#FBCFE8',
    dust: '#4a044e'
  },
  { 
    primary: '#3B82F6', 
    secondary: '#8B5CF6',
    accent: '#60A5FA',
    glow: '#BFDBFE',
    dust: '#1e1b4b'
  },
  { 
    primary: '#F59E0B', 
    secondary: '#F97316',
    accent: '#FBBF24',
    glow: '#FDE68A',
    dust: '#451a03'
  },
  { 
    primary: '#06B6D4', 
    secondary: '#10B981',
    accent: '#22D3EE',
    glow: '#A5F3FC',
    dust: '#042f2e'
  },
  { 
    primary: '#EF4444', 
    secondary: '#F97316',
    accent: '#F87171',
    glow: '#FECACA',
    dust: '#450a0a'
  },
];

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

const nebulaVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const advancedNebulaFragmentShader = `
  uniform vec3 color1;
  uniform vec3 color2;
  uniform vec3 color3;
  uniform float opacity;
  uniform float time;
  uniform float noiseScale;
  uniform float distortionAmount;
  uniform float layerOffset;
  uniform float wispiness;
  varying vec2 vUv;
  
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  float fbm(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for(int i = 0; i < 6; i++) {
      if(i >= octaves) break;
      value += amplitude * snoise(p * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
  
  float turbulence(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for(int i = 0; i < 4; i++) {
      value += amplitude * abs(snoise(p * frequency));
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    
    float slowTime = time * 0.02;
    
    vec3 noisePos = vec3(
      vUv.x * noiseScale + sin(slowTime * 0.3 + layerOffset) * 0.1,
      vUv.y * noiseScale + cos(slowTime * 0.25 + layerOffset) * 0.1,
      slowTime * 0.1 + layerOffset
    );
    
    float spiral = sin(angle * 3.0 + dist * 8.0 - slowTime * 0.5) * 0.15;
    noisePos.xy += spiral;
    
    float mainNoise = fbm(noisePos, 5);
    float detailNoise = fbm(noisePos * 2.0 + 10.0, 4);
    float turb = turbulence(noisePos * 1.5);
    
    float wisps = pow(abs(snoise(noisePos * wispiness)), 0.5) * 0.8;
    
    float radialFade = 1.0 - smoothstep(0.0, 0.55, dist);
    float softEdge = smoothstep(0.55, 0.3, dist);
    
    float cloudDensity = mainNoise * 0.5 + detailNoise * 0.3 + turb * 0.2;
    cloudDensity = cloudDensity * 0.5 + 0.5;
    cloudDensity *= radialFade;
    cloudDensity += wisps * softEdge * 0.3;
    
    float filaments = pow(max(0.0, snoise(noisePos * 3.0)), 2.0) * softEdge;
    cloudDensity += filaments * 0.4;
    
    cloudDensity = pow(max(0.0, cloudDensity), 0.85);
    
    float colorMix1 = snoise(noisePos * 0.5 + 5.0) * 0.5 + 0.5;
    float colorMix2 = snoise(noisePos * 0.3 + 10.0) * 0.5 + 0.5;
    
    vec3 finalColor = mix(color1, color2, colorMix1);
    finalColor = mix(finalColor, color3, colorMix2 * 0.4);
    
    float brightSpots = pow(max(0.0, snoise(noisePos * 4.0)), 4.0);
    finalColor += brightSpots * color3 * 0.5;
    
    float pulse = 0.95 + sin(time * 0.05 + layerOffset) * 0.05;
    float alpha = cloudDensity * opacity * pulse;
    
    alpha *= smoothstep(0.6, 0.35, dist);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const coreGlowFragmentShader = `
  uniform vec3 coreColor;
  uniform vec3 haloColor;
  uniform float time;
  uniform float intensity;
  varying vec2 vUv;
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    
    float innerCore = 1.0 - smoothstep(0.0, 0.15, dist);
    innerCore = pow(innerCore, 1.5);
    
    float midGlow = 1.0 - smoothstep(0.0, 0.35, dist);
    midGlow = pow(midGlow, 2.0);
    
    float outerHalo = 1.0 - smoothstep(0.0, 0.5, dist);
    outerHalo = pow(outerHalo, 3.0);
    
    float pulse = 0.9 + sin(time * 0.3) * 0.1;
    float twinkle = 0.95 + sin(time * 1.5) * 0.05;
    
    vec3 color = coreColor * innerCore * 2.0 * twinkle;
    color += coreColor * midGlow * 0.8;
    color += haloColor * outerHalo * 0.4;
    
    float alpha = (innerCore + midGlow * 0.6 + outerHalo * 0.3) * pulse * intensity;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

const dustLaneFragmentShader = `
  uniform vec3 dustColor;
  uniform float time;
  uniform float opacity;
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
    
    float lane = sin(angle * 2.0 + dist * 5.0) * 0.5 + 0.5;
    lane *= noise(vUv * 8.0 + time * 0.01);
    
    float fade = 1.0 - smoothstep(0.2, 0.5, dist);
    lane *= fade;
    
    float alpha = lane * opacity * 0.3;
    
    gl_FragColor = vec4(dustColor * 0.3, alpha);
  }
`;

function NebulaLayer({ 
  color1, 
  color2, 
  color3,
  scale, 
  rotation, 
  opacity, 
  noiseScale, 
  distortionAmount,
  animationSpeed,
  seed,
  wispiness = 2.0
}) {
  const meshRef = useRef();
  const timeOffset = useMemo(() => seededRandom(seed) * 100, [seed]);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: nebulaVertexShader,
      fragmentShader: advancedNebulaFragmentShader,
      uniforms: {
        color1: { value: new THREE.Color(color1) },
        color2: { value: new THREE.Color(color2) },
        color3: { value: new THREE.Color(color3 || color2) },
        opacity: { value: opacity },
        time: { value: 0 },
        noiseScale: { value: noiseScale },
        distortionAmount: { value: distortionAmount },
        layerOffset: { value: seededRandom(seed + '-offset') * 10 },
        wispiness: { value: wispiness },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [color1, color2, color3, opacity, noiseScale, distortionAmount, wispiness, seed]);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
      meshRef.current.rotation.z = rotation + state.clock.elapsedTime * animationSpeed * 0.005;
    }
    if (material) {
      material.uniforms.time.value = state.clock.elapsedTime + timeOffset;
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[scale, scale, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function NebulaGlowCore({ color, haloColor, scale, isHovered, intensity = 1 }) {
  const meshRef = useRef();
  
  const gradientMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: nebulaVertexShader,
      fragmentShader: coreGlowFragmentShader,
      uniforms: {
        coreColor: { value: new THREE.Color(color) },
        haloColor: { value: new THREE.Color(haloColor || color) },
        time: { value: 0 },
        intensity: { value: intensity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [color, haloColor, intensity]);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      const hoverBoost = isHovered ? 1.15 : 1;
      meshRef.current.scale.setScalar(pulse * hoverBoost);
    }
    gradientMaterial.uniforms.time.value = state.clock.elapsedTime;
  });
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[scale, scale]} />
      <primitive object={gradientMaterial} attach="material" />
    </mesh>
  );
}

function DustLane({ color, scale, seed, opacity = 0.15 }) {
  const meshRef = useRef();
  const rotation = useMemo(() => seededRandom(seed) * Math.PI * 2, [seed]);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: nebulaVertexShader,
      fragmentShader: dustLaneFragmentShader,
      uniforms: {
        dustColor: { value: new THREE.Color(color) },
        time: { value: 0 },
        opacity: { value: opacity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
  }, [color, opacity]);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
      meshRef.current.rotation.z = rotation;
    }
    material.uniforms.time.value = state.clock.elapsedTime;
  });
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[scale, scale]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function NebulaSparkles({ color, secondaryColor, count, scale, seed, isHovered }) {
  const pointsRef = useRef();
  const timeOffset = useMemo(() => seededRandom(seed) * 100, [seed]);
  
  const { positions, colors, sizes, phases, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const pha = new Float32Array(count);
    const spd = new Float32Array(count);
    
    const primaryCol = new THREE.Color(color);
    const secondCol = new THREE.Color(secondaryColor || color);
    
    for (let i = 0; i < count; i++) {
      const theta = seededRandom(seed + '-theta-' + i) * Math.PI * 2;
      const phi = Math.acos(2 * seededRandom(seed + '-phi-' + i) - 1);
      const radiusFactor = Math.pow(seededRandom(seed + '-r-' + i), 0.6);
      const radius = radiusFactor * scale * 0.55;
      
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.7;
      pos[i * 3 + 2] = radius * Math.cos(phi) * 0.5;
      
      const colorMix = seededRandom(seed + '-col-' + i);
      const mixedColor = primaryCol.clone().lerp(secondCol, colorMix);
      col[i * 3] = mixedColor.r;
      col[i * 3 + 1] = mixedColor.g;
      col[i * 3 + 2] = mixedColor.b;
      
      siz[i] = 0.4 + seededRandom(seed + '-size-' + i) * 0.8;
      pha[i] = seededRandom(seed + '-phase-' + i) * Math.PI * 2;
      spd[i] = 0.3 + seededRandom(seed + '-speed-' + i) * 0.7;
    }
    
    return { positions: pos, colors: col, sizes: siz, phases: pha, speeds: spd };
  }, [count, scale, seed, color, secondaryColor]);
  
  const particleMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute float size;
        attribute float phase;
        attribute float speed;
        attribute vec3 particleColor;
        uniform float time;
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vColor = particleColor;
          float twinkle = 0.5 + 0.5 * sin(time * speed + phase);
          vAlpha = 0.3 + twinkle * 0.7;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPosition.z) * (0.8 + twinkle * 0.4);
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
          gl_FragColor = vec4(vColor * 1.5, alpha * vAlpha);
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
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.01 + timeOffset;
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.008) * 0.03;
      
      const hoverScale = isHovered ? 1.08 : 1;
      pointsRef.current.scale.setScalar(hoverScale);
    }
    particleMaterial.uniforms.time.value = state.clock.elapsedTime;
  });
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-particleColor" count={count} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-phase" count={count} array={phases} itemSize={1} />
        <bufferAttribute attach="attributes-speed" count={count} array={speeds} itemSize={1} />
      </bufferGeometry>
      <primitive object={particleMaterial} attach="material" />
    </points>
  );
}

function OuterHalo({ color, scale, opacity = 0.15 }) {
  const meshRef = useRef();
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: nebulaVertexShader,
      fragmentShader: `
        uniform vec3 haloColor;
        uniform float opacity;
        varying vec2 vUv;
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          
          float halo = 1.0 - smoothstep(0.2, 0.5, dist);
          halo = pow(halo, 4.0);
          
          gl_FragColor = vec4(haloColor, halo * opacity);
        }
      `,
      uniforms: {
        haloColor: { value: new THREE.Color(color) },
        opacity: { value: opacity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [color, opacity]);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[scale, scale]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

export default function HouseholdCluster({
  position = [0, 0, 0],
  household,
  memberCount = 1,
  colorIndex = 0,
  isHovered = false,
  onClick,
  onPointerOver,
  onPointerOut,
}) {
  const groupRef = useRef();
  
  const colors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  const baseScale = 3.5 + Math.min(memberCount * 0.4, 1.8);
  const sparkleCount = 80 + memberCount * 25;
  
  const layers = useMemo(() => {
    const seed = household?.id || 'default';
    return [
      {
        scale: baseScale * 1.8,
        rotation: seededRandom(seed + '-rot1') * Math.PI,
        opacity: 0.12,
        noiseScale: 1.8,
        distortionAmount: 0.03,
        animationSpeed: 0.4,
        color1: colors.dust,
        color2: colors.secondary,
        color3: colors.primary,
        wispiness: 1.5,
      },
      {
        scale: baseScale * 1.5,
        rotation: seededRandom(seed + '-rot2') * Math.PI + 0.7,
        opacity: 0.2,
        noiseScale: 2.2,
        distortionAmount: 0.025,
        animationSpeed: 0.6,
        color1: colors.secondary,
        color2: colors.primary,
        color3: colors.accent,
        wispiness: 2.0,
      },
      {
        scale: baseScale * 1.2,
        rotation: seededRandom(seed + '-rot3') * Math.PI + 1.4,
        opacity: 0.3,
        noiseScale: 2.8,
        distortionAmount: 0.02,
        animationSpeed: 0.3,
        color1: colors.primary,
        color2: colors.accent,
        color3: colors.glow,
        wispiness: 2.5,
      },
      {
        scale: baseScale * 0.9,
        rotation: seededRandom(seed + '-rot4') * Math.PI + 2.1,
        opacity: 0.4,
        noiseScale: 3.5,
        distortionAmount: 0.015,
        animationSpeed: 0.2,
        color1: colors.accent,
        color2: colors.glow,
        color3: colors.glow,
        wispiness: 3.0,
      },
    ];
  }, [baseScale, colors, household?.id]);
  
  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(household);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        onPointerOver?.(household?.id);
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
        onPointerOut?.();
      }}
    >
      <OuterHalo 
        color={colors.secondary} 
        scale={baseScale * 2.5 * (isHovered ? 1.1 : 1)} 
        opacity={isHovered ? 0.2 : 0.1}
      />
      
      {layers.map((layer, i) => (
        <NebulaLayer
          key={i}
          color1={layer.color1}
          color2={layer.color2}
          color3={layer.color3}
          scale={layer.scale * (isHovered ? 1.1 : 1)}
          rotation={layer.rotation}
          opacity={layer.opacity * (isHovered ? 1.2 : 1)}
          noiseScale={layer.noiseScale}
          distortionAmount={layer.distortionAmount}
          animationSpeed={layer.animationSpeed}
          wispiness={layer.wispiness}
          seed={`${household?.id}-layer-${i}`}
        />
      ))}
      
      <DustLane
        color={colors.dust}
        scale={baseScale * 1.3}
        seed={`${household?.id}-dust`}
        opacity={0.1}
      />
      
      <NebulaGlowCore 
        color={colors.glow} 
        haloColor={colors.accent}
        scale={baseScale * 0.6} 
        isHovered={isHovered}
        intensity={isHovered ? 1.3 : 1}
      />
      
      <NebulaSparkles
        color={colors.glow}
        secondaryColor={colors.accent}
        count={sparkleCount}
        scale={baseScale}
        seed={household?.id || 'default'}
        isHovered={isHovered}
      />
      
      <mesh visible={false}>
        <sphereGeometry args={[baseScale * 0.7, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

export { HOUSEHOLD_COLORS };
