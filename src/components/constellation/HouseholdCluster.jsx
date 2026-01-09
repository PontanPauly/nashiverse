import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const HOUSEHOLD_COLORS = [
  { primary: '#60A5FA', glow: '#93C5FD' },
  { primary: '#F472B6', glow: '#FBCFE8' },
  { primary: '#FBBF24', glow: '#FDE68A' },
  { primary: '#34D399', glow: '#6EE7B7' },
  { primary: '#A78BFA', glow: '#C4B5FD' },
  { primary: '#FB923C', glow: '#FDBA74' },
  { primary: '#F87171', glow: '#FECACA' },
  { primary: '#2DD4BF', glow: '#5EEAD4' },
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

function NebulaCoreGlow({ color, scale, isHovered }) {
  const meshRef = useRef();
  const materialRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
    if (materialRef.current) {
      const pulse = 0.7 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      const hoverBoost = isHovered ? 1.3 : 1;
      materialRef.current.opacity = pulse * 0.6 * hoverBoost;
    }
  });
  
  const glowScale = scale * (isHovered ? 1.4 : 1.2);
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[glowScale * 3, glowScale * 3]} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function ParticleCloud({ color, particleCount, scale, seed, isHovered }) {
  const pointsRef = useRef();
  const timeOffset = useMemo(() => seededRandom(seed) * 100, [seed]);
  
  const { positions, sizes } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const siz = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      const theta = seededRandom(seed + '-theta-' + i) * Math.PI * 2;
      const phi = Math.acos(2 * seededRandom(seed + '-phi-' + i) - 1);
      const radius = (0.3 + seededRandom(seed + '-r-' + i) * 0.7) * scale;
      
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
      
      siz[i] = (0.5 + seededRandom(seed + '-size-' + i) * 0.5) * scale * 0.15;
    }
    
    return { positions: pos, sizes: siz };
  }, [particleCount, scale, seed]);
  
  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.05 + timeOffset;
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.03 + timeOffset) * 0.1;
      
      const hoverScale = isHovered ? 1.15 : 1;
      pointsRef.current.scale.setScalar(hoverScale);
    }
  });
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={particleCount}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.08 * scale}
        transparent
        opacity={isHovered ? 0.9 : 0.7}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

function NebulaCore({ color, scale, isHovered }) {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.05;
      const hoverScale = isHovered ? 1.2 : 1;
      meshRef.current.scale.setScalar(pulse * hoverScale);
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[scale * 0.25, 16, 16]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={isHovered ? 0.9 : 0.7}
      />
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
  const scale = 0.8 + Math.min(memberCount * 0.15, 0.8);
  const particleCount = 40 + memberCount * 15;
  
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
        onPointerOver?.(household.id);
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
        onPointerOut?.();
      }}
    >
      <NebulaCoreGlow color={colors.glow} scale={scale} isHovered={isHovered} />
      
      <ParticleCloud
        color={colors.primary}
        particleCount={particleCount}
        scale={scale}
        seed={household.id}
        isHovered={isHovered}
      />
      
      <NebulaCore color={colors.primary} scale={scale} isHovered={isHovered} />
      
      <mesh visible={false}>
        <sphereGeometry args={[scale * 1.2, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

export { HOUSEHOLD_COLORS };
