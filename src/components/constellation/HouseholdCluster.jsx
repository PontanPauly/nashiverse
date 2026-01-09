import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const HOUSEHOLD_COLORS = [
  { 
    primary: '#8B5CF6', 
    secondary: '#3B82F6',
    accent: '#A78BFA',
    glow: '#C4B5FD'
  },
  { 
    primary: '#F97316', 
    secondary: '#EF4444',
    accent: '#FB923C',
    glow: '#FED7AA'
  },
  { 
    primary: '#10B981', 
    secondary: '#06B6D4',
    accent: '#34D399',
    glow: '#6EE7B7'
  },
  { 
    primary: '#EC4899', 
    secondary: '#A855F7',
    accent: '#F472B6',
    glow: '#FBCFE8'
  },
  { 
    primary: '#3B82F6', 
    secondary: '#8B5CF6',
    accent: '#60A5FA',
    glow: '#BFDBFE'
  },
  { 
    primary: '#F59E0B', 
    secondary: '#F97316',
    accent: '#FBBF24',
    glow: '#FDE68A'
  },
  { 
    primary: '#06B6D4', 
    secondary: '#10B981',
    accent: '#22D3EE',
    glow: '#A5F3FC'
  },
  { 
    primary: '#EF4444', 
    secondary: '#F97316',
    accent: '#F87171',
    glow: '#FECACA'
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
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const nebulaFragmentShader = `
  uniform vec3 color1;
  uniform vec3 color2;
  uniform float opacity;
  uniform float time;
  uniform float noiseScale;
  uniform float distortionAmount;
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
  
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for(int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    
    vec2 distortedUv = vUv + vec2(
      sin(time * 0.06 + vUv.y * 2.5) * distortionAmount,
      cos(time * 0.04 + vUv.x * 2.5) * distortionAmount
    );
    
    float n = fbm(distortedUv * noiseScale + time * 0.015);
    float n2 = fbm(distortedUv * noiseScale * 0.5 - time * 0.008);
    
    float cloudShape = smoothstep(0.6, 0.0, dist);
    cloudShape *= (n * 0.6 + n2 * 0.4);
    cloudShape = pow(cloudShape, 0.9);
    
    vec3 finalColor = mix(color1, color2, n * 0.6 + 0.4);
    
    float pulse = 0.92 + sin(time * 0.08) * 0.08;
    float alpha = cloudShape * opacity * pulse;
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

function NebulaLayer({ 
  color1, 
  color2, 
  scale, 
  rotation, 
  opacity, 
  noiseScale, 
  distortionAmount,
  animationSpeed,
  seed 
}) {
  const meshRef = useRef();
  const materialRef = useRef();
  const timeOffset = useMemo(() => seededRandom(seed) * 100, [seed]);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: nebulaVertexShader,
      fragmentShader: nebulaFragmentShader,
      uniforms: {
        color1: { value: new THREE.Color(color1) },
        color2: { value: new THREE.Color(color2) },
        opacity: { value: opacity },
        time: { value: 0 },
        noiseScale: { value: noiseScale },
        distortionAmount: { value: distortionAmount },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [color1, color2, opacity, noiseScale, distortionAmount]);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
      meshRef.current.rotation.z = rotation + state.clock.elapsedTime * animationSpeed * 0.02;
    }
    if (material) {
      material.uniforms.time.value = state.clock.elapsedTime + timeOffset;
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[scale, scale, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function NebulaGlowCore({ color, scale, isHovered }) {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.1;
      const hoverBoost = isHovered ? 1.2 : 1;
      meshRef.current.scale.setScalar(pulse * hoverBoost);
    }
  });
  
  const gradientMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: nebulaVertexShader,
      fragmentShader: `
        uniform vec3 coreColor;
        uniform float time;
        varying vec2 vUv;
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          glow = pow(glow, 2.0);
          
          float pulse = 0.9 + sin(time * 1.2) * 0.1;
          
          gl_FragColor = vec4(coreColor * 1.5, glow * pulse);
        }
      `,
      uniforms: {
        coreColor: { value: new THREE.Color(color) },
        time: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [color]);
  
  useFrame((state) => {
    gradientMaterial.uniforms.time.value = state.clock.elapsedTime;
  });
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[scale * 1.5, scale * 1.5]} />
      <primitive object={gradientMaterial} attach="material" />
    </mesh>
  );
}

function NebulaSparkles({ color, count, scale, seed, isHovered }) {
  const pointsRef = useRef();
  const timeOffset = useMemo(() => seededRandom(seed) * 100, [seed]);
  
  const { positions, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const pha = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      const theta = seededRandom(seed + '-theta-' + i) * Math.PI * 2;
      const phi = Math.acos(2 * seededRandom(seed + '-phi-' + i) - 1);
      const radiusFactor = Math.pow(seededRandom(seed + '-r-' + i), 0.5);
      const radius = radiusFactor * scale * 0.5;
      
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6;
      pos[i * 3 + 2] = radius * Math.cos(phi) * 0.4;
      
      siz[i] = (0.3 + seededRandom(seed + '-size-' + i) * 0.7);
      pha[i] = seededRandom(seed + '-phase-' + i) * Math.PI * 2;
    }
    
    return { positions: pos, sizes: siz, phases: pha };
  }, [count, scale, seed]);
  
  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02 + timeOffset;
      pointsRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.01) * 0.05;
      
      const hoverScale = isHovered ? 1.1 : 1;
      pointsRef.current.scale.setScalar(hoverScale);
    }
  });
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.15}
        transparent
        opacity={isHovered ? 0.9 : 0.6}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
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
  const baseScale = 3 + Math.min(memberCount * 0.5, 2);
  const sparkleCount = 60 + memberCount * 20;
  
  const layers = useMemo(() => {
    const seed = household?.id || 'default';
    return [
      {
        scale: baseScale * 1.4,
        rotation: seededRandom(seed + '-rot1') * Math.PI,
        opacity: 0.25,
        noiseScale: 2.5,
        distortionAmount: 0.04,
        animationSpeed: 0.8,
        color1: colors.secondary,
        color2: colors.primary,
      },
      {
        scale: baseScale * 1.1,
        rotation: seededRandom(seed + '-rot2') * Math.PI + 0.5,
        opacity: 0.35,
        noiseScale: 3.5,
        distortionAmount: 0.03,
        animationSpeed: 1.2,
        color1: colors.primary,
        color2: colors.accent,
      },
      {
        scale: baseScale * 0.8,
        rotation: seededRandom(seed + '-rot3') * Math.PI + 1.2,
        opacity: 0.5,
        noiseScale: 4.5,
        distortionAmount: 0.02,
        animationSpeed: 0.5,
        color1: colors.accent,
        color2: colors.glow,
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
      {layers.map((layer, i) => (
        <NebulaLayer
          key={i}
          color1={layer.color1}
          color2={layer.color2}
          scale={layer.scale * (isHovered ? 1.15 : 1)}
          rotation={layer.rotation}
          opacity={layer.opacity * (isHovered ? 1.3 : 1)}
          noiseScale={layer.noiseScale}
          distortionAmount={layer.distortionAmount}
          animationSpeed={layer.animationSpeed}
          seed={`${household?.id}-layer-${i}`}
        />
      ))}
      
      <NebulaGlowCore 
        color={colors.glow} 
        scale={baseScale * 0.3} 
        isHovered={isHovered} 
      />
      
      <NebulaSparkles
        color={colors.glow}
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
