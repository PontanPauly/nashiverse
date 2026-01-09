import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

const HOUSEHOLD_COLORS = [
  { primary: '#8B5CF6', secondary: '#A78BFA', glow: '#C4B5FD' },
  { primary: '#F97316', secondary: '#FB923C', glow: '#FED7AA' },
  { primary: '#10B981', secondary: '#34D399', glow: '#6EE7B7' },
  { primary: '#EC4899', secondary: '#F472B6', glow: '#FBCFE8' },
  { primary: '#3B82F6', secondary: '#60A5FA', glow: '#BFDBFE' },
  { primary: '#F59E0B', secondary: '#FBBF24', glow: '#FDE68A' },
  { primary: '#06B6D4', secondary: '#22D3EE', glow: '#A5F3FC' },
  { primary: '#EF4444', secondary: '#F87171', glow: '#FECACA' },
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

function SimpleNebulaCore({ color, glowColor, scale, isHovered }) {
  const meshRef = useRef();
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 coreColor;
        uniform vec3 glowColor;
        uniform float time;
        uniform float hoverBoost;
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
          
          float n = noise(vUv * 4.0 + time * 0.05);
          
          float core = smoothstep(0.5, 0.0, dist);
          core = pow(core, 1.5);
          core *= (0.8 + n * 0.2);
          
          float pulse = 0.95 + sin(time * 0.4) * 0.05;
          
          vec3 color = mix(glowColor, coreColor, pow(dist * 2.0, 0.7));
          color *= (1.0 + hoverBoost * 0.3);
          
          float alpha = core * pulse * (0.7 + hoverBoost * 0.3);
          alpha = clamp(alpha, 0.0, 1.0);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      uniforms: {
        coreColor: { value: new THREE.Color(color) },
        glowColor: { value: new THREE.Color(glowColor) },
        time: { value: 0 },
        hoverBoost: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [color, glowColor]);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
    material.uniforms.time.value = state.clock.elapsedTime;
    material.uniforms.hoverBoost.value = THREE.MathUtils.lerp(
      material.uniforms.hoverBoost.value,
      isHovered ? 1 : 0,
      0.1
    );
  });
  
  return (
    <mesh ref={meshRef} raycast={() => null}>
      <planeGeometry args={[scale, scale]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function SimpleOuterGlow({ color, scale, isHovered }) {
  const meshRef = useRef();
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float hoverBoost;
        varying vec2 vUv;
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          
          float glow = smoothstep(0.5, 0.0, dist);
          glow = pow(glow, 3.0);
          
          float alpha = glow * (0.15 + hoverBoost * 0.15);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      uniforms: {
        color: { value: new THREE.Color(color) },
        hoverBoost: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [color]);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
    material.uniforms.hoverBoost.value = THREE.MathUtils.lerp(
      material.uniforms.hoverBoost.value,
      isHovered ? 1 : 0,
      0.1
    );
  });
  
  return (
    <mesh ref={meshRef} raycast={() => null}>
      <planeGeometry args={[scale, scale]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function MemberStars({ memberCount, scale, seed, color }) {
  const pointsRef = useRef();
  
  const { positions, colors, sizes, phases } = useMemo(() => {
    const count = Math.min(memberCount, 20);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const pha = new Float32Array(count);
    
    const starColor = new THREE.Color(color);
    const innerRadius = scale * 0.15;
    const outerRadius = scale * 0.35;
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + seededRandom(seed + '-angle-' + i) * 0.5;
      const radiusMix = seededRandom(seed + '-r-' + i);
      const radius = innerRadius + radiusMix * (outerRadius - innerRadius);
      
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = Math.sin(angle) * radius * 0.7;
      pos[i * 3 + 2] = (seededRandom(seed + '-z-' + i) - 0.5) * scale * 0.1;
      
      col[i * 3] = starColor.r;
      col[i * 3 + 1] = starColor.g;
      col[i * 3 + 2] = starColor.b;
      
      siz[i] = 2.5 + seededRandom(seed + '-size-' + i) * 1.5;
      pha[i] = seededRandom(seed + '-phase-' + i) * Math.PI * 2;
    }
    
    return { positions: pos, colors: col, sizes: siz, phases: pha };
  }, [memberCount, scale, seed, color]);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 starColor;
        attribute float size;
        attribute float phase;
        uniform float time;
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vColor = starColor;
          float twinkle = 0.7 + 0.3 * sin(time * 0.5 + phase);
          vAlpha = twinkle;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (150.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          
          float core = 1.0 - smoothstep(0.0, 0.2, dist);
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          glow = pow(glow, 2.0);
          
          vec3 color = vColor * (core * 2.0 + glow);
          float alpha = (core + glow * 0.5) * vAlpha;
          
          gl_FragColor = vec4(color, alpha);
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
  });
  
  if (memberCount === 0) return null;
  
  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-starColor" count={colors.length / 3} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={sizes.length} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-phase" count={phases.length} array={phases} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function HouseholdLabel({ name, isHovered }) {
  if (!isHovered) return null;
  
  return (
    <Html center style={{ pointerEvents: 'none' }} position={[0, 2.5, 0]}>
      <div 
        className="px-3 py-1.5 rounded-lg whitespace-nowrap"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        <span className="text-sm font-medium text-white">{name}</span>
      </div>
    </Html>
  );
}

export default function HouseholdCluster({
  position,
  household,
  memberCount = 0,
  colorIndex = 0,
  isHovered = false,
  onClick,
  onPointerOver,
  onPointerOut,
}) {
  const groupRef = useRef();
  const currentScale = useRef(1);
  
  const colors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  const baseScale = 2.0 + Math.min(memberCount, 10) * 0.15;
  
  useFrame(() => {
    if (groupRef.current) {
      const targetScale = isHovered ? 1.25 : 1;
      currentScale.current = THREE.MathUtils.lerp(currentScale.current, targetScale, 0.08);
      groupRef.current.scale.setScalar(currentScale.current);
    }
  });
  
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
      <SimpleOuterGlow 
        color={colors.secondary} 
        scale={baseScale * 2.0}
        isHovered={isHovered}
      />
      
      <SimpleNebulaCore
        color={colors.primary}
        glowColor={colors.glow}
        scale={baseScale * 1.2}
        isHovered={isHovered}
      />
      
      <MemberStars
        memberCount={memberCount}
        scale={baseScale}
        seed={`${household?.id}-members`}
        color={colors.glow}
      />
      
      <HouseholdLabel 
        name={household?.name || 'Unknown'} 
        isHovered={isHovered}
      />
      
      <mesh>
        <sphereGeometry args={[baseScale * 0.5, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export { HOUSEHOLD_COLORS };
