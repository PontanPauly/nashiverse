import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Ring, Icosahedron } from '@react-three/drei';
import * as THREE from 'three';
import { getStarVisuals, DEFAULT_STAR_PROFILE } from '@/lib/starConfig';

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFragmentShader = `
  uniform vec3 glowColor;
  uniform float intensity;
  uniform float falloff;
  uniform float time;
  uniform float pulsing;
  varying vec2 vUv;
  
  void main() {
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center);
    
    float pulseEffect = pulsing > 0.5 ? 0.1 * sin(time * 2.0) : 0.0;
    float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * (intensity + pulseEffect);
    alpha = pow(alpha, falloff);
    
    gl_FragColor = vec4(glowColor, alpha * 0.8);
  }
`;

const coreFragmentShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform float time;
  uniform float brightness;
  varying vec3 vPosition;
  
  void main() {
    float fresnel = pow(1.0 - abs(dot(normalize(vPosition), vec3(0.0, 0.0, 1.0))), 2.0);
    vec3 color = mix(primaryColor, secondaryColor, fresnel);
    
    float pulse = 0.05 * sin(time * 1.5);
    float finalBrightness = brightness + pulse;
    
    gl_FragColor = vec4(color * finalBrightness, 1.0);
  }
`;

function StarCore({ shape, colors, scale, brightness, animation, uniqueOffset }) {
  const meshRef = useRef();
  const time = useRef(0);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: coreFragmentShader,
      uniforms: {
        primaryColor: { value: new THREE.Color(colors.primary) },
        secondaryColor: { value: new THREE.Color(colors.secondary) },
        time: { value: 0 },
        brightness: { value: brightness },
      },
      transparent: false,
    });
  }, [colors.primary, colors.secondary, brightness]);
  
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    time.current += delta;
    material.uniforms.time.value = time.current + animation.delay;
    
    if (animation.type === 'pulse' || animation.type === 'breath') {
      const pulseScale = 1 + Math.sin(time.current * animation.speed + animation.delay) * animation.amplitude * 0.1;
      meshRef.current.scale.setScalar(scale * pulseScale);
    }
    
    if (animation.type === 'dance') {
      meshRef.current.rotation.y += delta * 0.5;
      meshRef.current.rotation.x = Math.sin(time.current * 0.3 + uniqueOffset) * 0.1;
    }
    
    if (shape.geometry === 'spiral' || shape.geometry === 'crystal') {
      meshRef.current.rotation.y += delta * 0.2;
    }
  });
  
  const baseSize = 0.15 * scale;
  
  if (shape.geometry === 'icosahedron') {
    return (
      <Icosahedron ref={meshRef} args={[baseSize, 1]} material={material} />
    );
  }
  
  if (shape.geometry === 'ring') {
    return (
      <group ref={meshRef}>
        <Sphere args={[baseSize * 0.7, 16, 16]} material={material} />
        <Ring
          args={[baseSize * 1.2, baseSize * 1.5, 32]}
          rotation={[Math.PI * 0.5, 0, 0]}
        >
          <meshBasicMaterial color={colors.primary} transparent opacity={0.6} side={THREE.DoubleSide} />
        </Ring>
      </group>
    );
  }
  
  if (shape.geometry === 'cluster') {
    return (
      <group ref={meshRef}>
        <Sphere args={[baseSize * 0.8, 16, 16]} material={material} />
        {[...Array(shape.pointCount)].map((_, i) => {
          const angle = (i / shape.pointCount) * Math.PI * 2;
          const radius = baseSize * 1.5;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius * 0.5;
          const z = Math.sin(angle * 2) * radius * 0.3;
          return (
            <Sphere key={i} args={[baseSize * 0.3, 8, 8]} position={[x, y, z]}>
              <meshBasicMaterial color={colors.secondary} transparent opacity={0.8} />
            </Sphere>
          );
        })}
      </group>
    );
  }
  
  return (
    <Sphere ref={meshRef} args={[baseSize, 32, 32]} material={material} />
  );
}

function StarGlow({ colors, glow, scale, animation }) {
  const meshRef = useRef();
  const time = useRef(0);
  
  const material = useMemo(() => {
    const falloffValue = glow.falloff === 'smooth' ? 1.5 : glow.falloff === 'exponential' ? 2.5 : 1.0;
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: glowFragmentShader,
      uniforms: {
        glowColor: { value: new THREE.Color(colors.glow) },
        intensity: { value: glow.intensity },
        falloff: { value: falloffValue },
        time: { value: 0 },
        pulsing: { value: glow.pulsing ? 1.0 : 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors.glow, glow.intensity, glow.falloff, glow.pulsing]);
  
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    time.current += delta;
    material.uniforms.time.value = time.current;
    
    meshRef.current.lookAt(state.camera.position);
  });
  
  const glowSize = 0.15 * scale * glow.radius;
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[glowSize * 2, glowSize * 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function StarRays({ colors, shape, scale, animation }) {
  const groupRef = useRef();
  const time = useRef(0);
  
  const rayCount = shape.pointCount || 4;
  
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    time.current += delta;
    groupRef.current.lookAt(state.camera.position);
    
    if (animation.type === 'twinkle') {
      groupRef.current.rotation.z = Math.sin(time.current * animation.speed) * 0.1;
    }
  });
  
  if (rayCount === 0) return null;
  
  const rayLength = 0.15 * scale * (1 + shape.pointSharpness);
  const rayWidth = 0.01 * scale;
  
  return (
    <group ref={groupRef}>
      {[...Array(rayCount)].map((_, i) => {
        const angle = (i / rayCount) * Math.PI * 2 + (shape.rotationOffset || 0);
        return (
          <mesh key={i} rotation={[0, 0, angle]}>
            <planeGeometry args={[rayWidth, rayLength]} />
            <meshBasicMaterial
              color={colors.glow}
              transparent
              opacity={0.4 * shape.pointSharpness}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
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
  
  const activeScale = useMemo(() => {
    if (isFocused) return visuals.scale * 1.5;
    if (isHovered) return visuals.scale * 1.25;
    return visuals.scale;
  }, [isHovered, isFocused, visuals.scale]);
  
  const activeGlow = useMemo(() => ({
    ...visuals.glow,
    intensity: isFocused ? visuals.glow.intensity * 1.5 : 
               isHovered ? visuals.glow.intensity * 1.3 : 
               visuals.glow.intensity,
  }), [isHovered, isFocused, visuals.glow]);
  
  return (
    <group 
      ref={groupRef} 
      position={position}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <StarGlow 
        colors={visuals.colors}
        glow={activeGlow}
        scale={activeScale}
        animation={visuals.animation}
      />
      
      <StarRays 
        colors={visuals.colors}
        shape={visuals.shape}
        scale={activeScale}
        animation={visuals.animation}
      />
      
      <StarCore 
        shape={visuals.shape}
        colors={visuals.colors}
        scale={activeScale}
        brightness={visuals.brightness}
        animation={visuals.animation}
        uniqueOffset={visuals.uniqueOffset}
      />
      
      <mesh visible={false}>
        <sphereGeometry args={[0.3 * activeScale, 8, 8]} />
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
