import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStarVisuals, DEFAULT_STAR_PROFILE } from '@/lib/starConfig';

const realisticStarShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  
  coreFragmentShader: `
    uniform vec3 primaryColor;
    uniform vec3 secondaryColor;
    uniform vec3 glowColor;
    uniform float time;
    uniform float brightness;
    uniform float temperature;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
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
      vec3 viewDir = normalize(vViewPosition);
      float NdotV = max(dot(vNormal, viewDir), 0.0);
      
      float fresnel = pow(1.0 - NdotV, 3.0);
      float rimLight = pow(1.0 - NdotV, 1.5);
      
      vec3 hotCore = vec3(1.0, 0.98, 0.95);
      vec3 midLayer = mix(hotCore, primaryColor, 0.3);
      vec3 outerLayer = primaryColor;
      
      float coreGradient = pow(NdotV, 2.0);
      vec3 baseColor = mix(outerLayer, hotCore, coreGradient * temperature);
      
      vec2 noiseCoord = vUv * 8.0 + time * 0.1;
      float surfaceNoise = fbm(noiseCoord) * 0.15;
      float granulation = noise(vUv * 40.0 + time * 0.5) * 0.08;
      
      float sunspotNoise = fbm(vUv * 3.0 + time * 0.02);
      float sunspots = smoothstep(0.6, 0.7, sunspotNoise) * 0.3;
      
      float pulse = sin(time * 1.5) * 0.03 + sin(time * 2.7) * 0.02;
      float flicker = noise(vec2(time * 10.0, 0.0)) * 0.02;
      
      float finalBrightness = brightness * (1.0 + pulse + flicker + surfaceNoise - sunspots);
      
      vec3 rimColor = mix(glowColor, hotCore, 0.5);
      baseColor += rimColor * rimLight * 0.4;
      
      baseColor += granulation * primaryColor;
      
      baseColor *= finalBrightness;
      
      baseColor = pow(baseColor, vec3(0.9));
      
      gl_FragColor = vec4(baseColor, 1.0);
    }
  `,
};

const coronaShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform vec3 innerColor;
    uniform vec3 outerColor;
    uniform float time;
    uniform float intensity;
    uniform float coronaSize;
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
    
    float fbm(vec2 p, int octaves) {
      float sum = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
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
      
      float coreRadius = 0.15;
      float coronaEdge = 0.5;
      
      if (dist < coreRadius * 0.8) discard;
      
      float radialNoise = fbm(vec2(angle * 3.0, dist * 4.0 + time * 0.3), 5);
      float coronaWisp = fbm(vec2(angle * 6.0 + time * 0.2, dist * 8.0), 4);
      
      float flare = pow(abs(sin(angle * 2.0)), 8.0) * 0.3;
      float flare2 = pow(abs(sin(angle * 3.0 + 0.5)), 6.0) * 0.2;
      
      float baseFalloff = 1.0 - smoothstep(coreRadius, coronaEdge * coronaSize, dist);
      baseFalloff = pow(baseFalloff, 1.5);
      
      float coronaShape = baseFalloff * (0.7 + radialNoise * 0.5 + coronaWisp * 0.3);
      coronaShape += (flare + flare2) * baseFalloff * 0.5;
      
      float streamers = pow(fbm(vec2(angle * 12.0, dist * 20.0 - time * 0.5), 3), 2.0);
      coronaShape += streamers * baseFalloff * 0.4;
      
      vec3 hotWhite = vec3(1.0, 0.98, 0.9);
      float colorMix = smoothstep(coreRadius, coronaEdge * 0.5, dist);
      vec3 coronaColor = mix(hotWhite, innerColor, colorMix * 0.5);
      coronaColor = mix(coronaColor, outerColor, pow(colorMix, 2.0) * 0.7);
      
      float alpha = coronaShape * intensity;
      alpha *= smoothstep(coronaEdge * coronaSize, coreRadius, dist);
      
      float pulse = 1.0 + sin(time * 2.0) * 0.05 + sin(time * 3.7) * 0.03;
      alpha *= pulse;
      
      gl_FragColor = vec4(coronaColor, alpha * 0.9);
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
    uniform float time;
    uniform float intensity;
    uniform float size;
    varying vec2 vUv;
    
    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      
      float innerRadius = 0.1;
      float outerRadius = 0.5;
      
      if (dist < innerRadius * 0.5) discard;
      
      float glow = 1.0 - smoothstep(innerRadius, outerRadius * size, dist);
      glow = pow(glow, 2.5);
      
      float softEdge = 1.0 - smoothstep(0.0, outerRadius * 0.3, dist);
      glow += softEdge * 0.3;
      
      float pulse = 1.0 + sin(time * 1.2) * 0.08 + sin(time * 2.1) * 0.05;
      
      float alpha = glow * intensity * pulse * 0.6;
      
      vec3 finalColor = glowColor * (1.0 + (1.0 - dist / outerRadius) * 0.3);
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
};

const diffractionSpikesShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform vec3 spikeColor;
    uniform float time;
    uniform float intensity;
    uniform int spikeCount;
    uniform float rotation;
    varying vec2 vUv;
    
    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float angle = atan(center.y, center.x) + rotation;
      
      float spikes = 0.0;
      float spikeAngle = 3.14159 / float(spikeCount);
      
      for (int i = 0; i < 8; i++) {
        if (i >= spikeCount * 2) break;
        float a = float(i) * spikeAngle;
        float spike = pow(abs(cos(angle - a)), 80.0);
        spike *= exp(-dist * 3.0);
        spikes += spike;
      }
      
      float glow = exp(-dist * 8.0) * 0.3;
      
      float flicker = 1.0 + sin(time * 3.0 + angle * 2.0) * 0.1;
      
      float alpha = (spikes + glow) * intensity * flicker;
      
      vec3 finalColor = mix(spikeColor, vec3(1.0), 0.3);
      
      gl_FragColor = vec4(finalColor, alpha * 0.7);
    }
  `,
};

function RealisticStarCore({ colors, scale, brightness, animation, uniqueOffset, temperature = 0.7 }) {
  const meshRef = useRef();
  const timeRef = useRef(uniqueOffset || 0);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: realisticStarShader.vertexShader,
      fragmentShader: realisticStarShader.coreFragmentShader,
      uniforms: {
        primaryColor: { value: new THREE.Color(colors.primary) },
        secondaryColor: { value: new THREE.Color(colors.secondary) },
        glowColor: { value: new THREE.Color(colors.glow) },
        time: { value: 0 },
        brightness: { value: brightness * 1.2 },
        temperature: { value: temperature },
      },
    });
  }, [colors, brightness, temperature]);
  
  useFrame((state, delta) => {
    timeRef.current += delta;
    material.uniforms.time.value = timeRef.current;
    
    if (meshRef.current && animation) {
      const animSpeed = animation.speed || 0.5;
      const animAmp = animation.amplitude || 0.1;
      
      if (animation.type === 'pulse' || animation.type === 'breath') {
        const pulseScale = 1 + Math.sin(timeRef.current * animSpeed) * animAmp * 0.15;
        meshRef.current.scale.setScalar(pulseScale);
      }
      
      meshRef.current.rotation.y += delta * 0.1;
    }
  });
  
  const baseSize = 0.12 * scale;
  
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[baseSize, 64, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function StarCorona({ colors, scale, intensity, animation, uniqueOffset }) {
  const meshRef = useRef();
  const timeRef = useRef(uniqueOffset || 0);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: coronaShader.vertexShader,
      fragmentShader: coronaShader.fragmentShader,
      uniforms: {
        innerColor: { value: new THREE.Color(colors.primary) },
        outerColor: { value: new THREE.Color(colors.glow) },
        time: { value: 0 },
        intensity: { value: intensity * 1.2 },
        coronaSize: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, intensity]);
  
  useFrame((state, delta) => {
    timeRef.current += delta;
    material.uniforms.time.value = timeRef.current;
    
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  const coronaSize = 0.12 * scale * 4;
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[coronaSize, coronaSize]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function StarOuterGlow({ colors, scale, intensity, uniqueOffset }) {
  const meshRef = useRef();
  const timeRef = useRef(uniqueOffset || 0);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: outerGlowShader.vertexShader,
      fragmentShader: outerGlowShader.fragmentShader,
      uniforms: {
        glowColor: { value: new THREE.Color(colors.glow) },
        time: { value: 0 },
        intensity: { value: intensity },
        size: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, intensity]);
  
  useFrame((state, delta) => {
    timeRef.current += delta;
    material.uniforms.time.value = timeRef.current;
    
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  const glowSize = 0.12 * scale * 8;
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[glowSize, glowSize]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function StarDiffractionSpikes({ colors, scale, intensity, spikeCount = 4, uniqueOffset }) {
  const meshRef = useRef();
  const timeRef = useRef(uniqueOffset || 0);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: diffractionSpikesShader.vertexShader,
      fragmentShader: diffractionSpikesShader.fragmentShader,
      uniforms: {
        spikeColor: { value: new THREE.Color(colors.glow) },
        time: { value: 0 },
        intensity: { value: intensity * 0.8 },
        spikeCount: { value: spikeCount },
        rotation: { value: uniqueOffset * Math.PI },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, intensity, spikeCount, uniqueOffset]);
  
  useFrame((state, delta) => {
    timeRef.current += delta;
    material.uniforms.time.value = timeRef.current;
    
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  const spikeSize = 0.12 * scale * 6;
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[spikeSize, spikeSize]} />
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
    if (isFocused) return visuals.scale * 1.4;
    if (isHovered) return visuals.scale * 1.2;
    return visuals.scale;
  }, [isHovered, isFocused, visuals.scale]);
  
  const activeIntensity = useMemo(() => {
    const base = visuals.glow?.intensity || 0.7;
    if (isFocused) return base * 1.5;
    if (isHovered) return base * 1.3;
    return base;
  }, [isHovered, isFocused, visuals.glow]);
  
  const spikeCount = useMemo(() => {
    const shape = visuals.shape?.id || 'classic';
    if (shape === 'nova') return 6;
    if (shape === 'crystal') return 6;
    if (shape === 'classic') return 4;
    if (shape === 'pulse') return 4;
    return 4;
  }, [visuals.shape]);
  
  const temperature = useMemo(() => {
    const colorId = starProfile?.colorPalette || 'celestial';
    if (colorId === 'solar' || colorId === 'ember' || colorId === 'amber' || colorId === 'sunset') return 0.9;
    if (colorId === 'arctic' || colorId === 'celestial') return 0.5;
    if (colorId === 'ruby' || colorId === 'rose') return 0.7;
    return 0.6;
  }, [starProfile]);
  
  return (
    <group 
      ref={groupRef} 
      position={position}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <StarOuterGlow
        colors={visuals.colors}
        scale={activeScale}
        intensity={activeIntensity * 0.6}
        uniqueOffset={uniqueOffset}
      />
      
      <StarDiffractionSpikes
        colors={visuals.colors}
        scale={activeScale}
        intensity={activeIntensity}
        spikeCount={spikeCount}
        uniqueOffset={uniqueOffset}
      />
      
      <StarCorona
        colors={visuals.colors}
        scale={activeScale}
        intensity={activeIntensity}
        animation={visuals.animation}
        uniqueOffset={uniqueOffset}
      />
      
      <RealisticStarCore
        colors={visuals.colors}
        scale={activeScale}
        brightness={visuals.brightness}
        animation={visuals.animation}
        uniqueOffset={uniqueOffset}
        temperature={temperature}
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
