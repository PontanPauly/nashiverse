import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getStarVisuals, DEFAULT_STAR_PROFILE } from '@/lib/starConfig';

const createGlowTexture = () => {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const center = size / 2;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy) / center;
      const alpha = Math.max(0, 1 - dist * dist);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.floor(alpha * 255);
    }
  }
  
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
};

const glowTexture = createGlowTexture();

// Shared noise functions for all shaders
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
    for (int i = 0; i < 7; i++) {
      if (i >= oct) break;
      sum += snoise(p * freq) * amp;
      freq *= 2.1;
      amp *= 0.48;
    }
    return sum;
  }
  
  // Organic edge function - creates irregular, wispy boundaries
  // Uses scaled UV space (0.35 max) so content fits within larger plane geometry
  float organicEdge(vec2 center, float baseRadius, float time, float uniqueOffset) {
    float angle = atan(center.y, center.x);
    
    // Noise layers for natural variation (operates in 0-0.35 range)
    float edgeNoise1 = snoise(vec2(angle * 2.5 + uniqueOffset * 10.0, time * 0.15)) * 0.06;
    float edgeNoise2 = snoise(vec2(angle * 5.0 - uniqueOffset * 5.0, time * 0.25)) * 0.04;
    float edgeNoise3 = snoise(vec2(angle * 9.0 + time * 0.08, uniqueOffset * 3.0)) * 0.02;
    
    // Shape deformation
    float shapeWarp = snoise(vec2(angle * 1.5 + uniqueOffset * 8.0, 0.3)) * 0.05;
    
    float irregularRadius = baseRadius + edgeNoise1 + edgeNoise2 + edgeNoise3 + shapeWarp;
    // Clamp to stay well within plane bounds (leave margin for smooth fade)
    return min(irregularRadius, 0.35);
  }
`;

// Style 1: Nebula - Complex turbulent multi-color clouds with organic edges
const nebulaShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  uniform float globalOpacity;
  varying vec2 vUv;
  
  ${noiseLib}
  
  float ridgedNoise(vec2 p) { return 1.0 - abs(snoise(p)); }
  
  float ridgedFbm(vec2 p, int oct) {
    float sum = 0.0, amp = 0.5, freq = 1.0;
    for (int i = 0; i < 5; i++) {
      if (i >= oct) break;
      sum += ridgedNoise(p * freq) * amp;
      freq *= 2.0;
      amp *= 0.5;
    }
    return sum;
  }
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    float t = time * 0.25 + uniqueOffset * 10.0;
    
    // Organic irregular boundary
    float edgeRadius = organicEdge(center, 0.28, t, uniqueOffset);
    
    // Wispy tendrils extending outward
    float tendrils = 0.0;
    for (float i = 0.0; i < 8.0; i++) {
      float tendrilAngle = i * 0.785 + uniqueOffset * 6.28 + t * 0.05;
      float angleDiff = abs(mod(angle - tendrilAngle + 3.14159, 6.28318) - 3.14159);
      float tendrilWidth = 0.15 + snoise(vec2(i, uniqueOffset)) * 0.1;
      float tendril = exp(-angleDiff * angleDiff / (tendrilWidth * tendrilWidth));
      float tendrilLength = 0.35 + snoise(vec2(i * 2.0, t * 0.1)) * 0.15;
      tendril *= smoothstep(tendrilLength + 0.1, tendrilLength * 0.5, dist);
      tendrils += tendril * 0.3;
    }
    
    // Soft discard with organic edge
    float edgeFade = 1.0 - smoothstep(edgeRadius - 0.1, edgeRadius + 0.15, dist);
    edgeFade = max(edgeFade, tendrils);
    if (edgeFade < 0.01) discard;
    
    vec2 wUv = center * (4.0 + styleVariant * 2.0);
    
    // Multi-layer warping
    float warpX = fbm(wUv + t * 0.08, 5);
    float warpY = fbm(wUv + vec2(5.2, 1.3) + t * 0.1, 5);
    vec2 warped = wUv + vec2(warpX, warpY) * (0.4 + styleVariant * 0.4);
    
    float warpX2 = fbm(warped * 0.7 + t * 0.05, 3);
    float warpY2 = fbm(warped * 0.7 + vec2(3.1, 7.2) + t * 0.06, 3);
    warped += vec2(warpX2, warpY2) * 0.25;
    
    // Structure
    float largeStructure = fbm(warped * 0.4 + t * 0.03, 6);
    float medStructure = fbm(warped * 1.2 + t * 0.06, 5);
    float fineDetail = fbm(warped * 3.0 + t * 0.12, 4);
    float structure = largeStructure * 0.45 + medStructure * 0.35 + fineDetail * 0.2;
    structure = structure * 0.5 + 0.5;
    
    // Filaments
    float filaments = ridgedFbm(warped * 1.5 + t * 0.08, 4);
    float filaments2 = ridgedFbm(warped * 2.5 - t * 0.06, 3);
    float filamentGlow = pow(filaments, 1.8) * 0.6 + pow(filaments2, 2.2) * 0.4;
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.99, 0.96);
    vec3 hotYellow = vec3(1.0, 0.92, 0.6);
    vec3 hotPink = vec3(1.0, 0.45, 0.65);
    vec3 electricBlue = vec3(0.35, 0.55, 1.0);
    vec3 deepPurple = vec3(0.55, 0.2, 0.85);
    vec3 cyan = vec3(0.3, 0.85, 0.95);
    
    float zone1 = fbm(warped * 0.8 + t * 0.04, 4) * 0.5 + 0.5;
    float zone2 = fbm(warped * 1.0 + vec2(5.0, 9.0) + t * 0.05, 4) * 0.5 + 0.5;
    
    vec3 colorMix = primaryColor;
    colorMix = mix(colorMix, electricBlue, smoothstep(0.3, 0.65, zone1) * 0.55);
    colorMix = mix(colorMix, deepPurple, smoothstep(0.35, 0.75, zone2) * 0.5);
    colorMix = mix(colorMix, hotPink, filamentGlow * 0.4);
    colorMix = mix(colorMix, cyan, pow(filaments, 2.0) * 0.4);
    
    // Core
    float coreGlow = pow(1.0 - smoothstep(0.0, 0.2, dist), 1.8);
    colorMix = mix(colorMix, hotWhite, coreGlow * 0.75);
    colorMix = mix(colorMix, hotYellow, coreGlow * pow(max(fbm(warped * 2.0 + t * 0.15, 3), 0.0), 2.5) * 0.5);
    
    float intensity = structure * 0.55 + filamentGlow * 0.9 + coreGlow * 1.3 + tendrils * 0.5;
    intensity *= brightness * (0.88 + 0.12 * sin(time * 1.8 + uniqueOffset * 5.0));
    
    vec3 finalColor = colorMix * intensity;
    finalColor += hotWhite * pow(filaments, 3.5) * 0.35;
    finalColor += cyan * pow(filaments2, 3.0) * 0.25;
    
    float alpha = (structure * 0.4 + filamentGlow * 0.85 + coreGlow * 1.1 + tendrils * 0.6) * edgeFade;
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.6);
    
    gl_FragColor = vec4(finalColor * globalOpacity, alpha * globalOpacity);
  }
`;

// Style 2: Classic - Radiant star with organic diffraction spikes
const classicShader = `
  uniform vec3 primaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  uniform float rayCount;
  uniform float globalOpacity;
  varying vec2 vUv;
  
  ${noiseLib}
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    float t = time + uniqueOffset * 10.0;
    
    // Core with organic edge
    float coreRadius = 0.06 + styleVariant * 0.03;
    float coreNoise = snoise(vec2(angle * 8.0, t * 0.5)) * 0.015;
    float core = 1.0 - smoothstep(0.0, coreRadius + coreNoise, dist);
    core = pow(core, 1.2);
    
    // Corona with irregular shape
    float coronaNoise = snoise(vec2(angle * 4.0 + uniqueOffset * 5.0, t * 0.2)) * 0.05;
    float corona = 1.0 - smoothstep(0.0, 0.18 + coronaNoise, dist);
    corona = pow(corona, 2.0);
    
    // Halo
    float haloNoise = snoise(vec2(angle * 3.0, t * 0.15)) * 0.08;
    float halo = 1.0 - smoothstep(0.0, 0.35 + haloNoise, dist);
    halo = pow(halo, 3.2);
    
    // Organic diffraction spikes with varying lengths
    float rays = 0.0;
    float numRays = rayCount;
    for (float i = 0.0; i < 12.0; i++) {
      if (i >= numRays) break;
      float rayAngle = i * 6.28318 / numRays + uniqueOffset * 3.14159;
      float rayLengthVar = 0.8 + snoise(vec2(i, uniqueOffset * 10.0)) * 0.4;
      float rayWidthVar = 0.8 + snoise(vec2(i * 2.0, uniqueOffset * 5.0)) * 0.4;
      
      float spikeIntensity = pow(abs(cos((angle - rayAngle) * numRays * 0.5)), 50.0 * rayWidthVar + styleVariant * 30.0);
      spikeIntensity *= exp(-dist * (2.5 / rayLengthVar - styleVariant * 0.5));
      
      // Wispy ray edges
      float rayNoise = snoise(vec2(dist * 10.0, i + t * 0.3)) * 0.3;
      spikeIntensity *= (0.7 + rayNoise);
      
      float taper = 1.0 - pow(dist * 1.8, 1.2);
      spikeIntensity *= max(taper, 0.0);
      rays += spikeIntensity;
    }
    
    // Shimmer
    float shimmer = 0.88 + 0.12 * sin(t * 2.5) * sin(t * 3.7 + 1.5);
    shimmer *= 0.92 + 0.08 * sin(t * 4.1 + angle * 2.0);
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.995, 0.97);
    vec3 warmCore = vec3(1.0, 0.95, 0.88);
    vec3 coreColor = mix(warmCore, hotWhite, core * 0.9);
    vec3 rayColor = mix(glowColor, hotWhite, 0.45);
    
    vec3 finalColor = coreColor * core * 2.5;
    finalColor += primaryColor * corona * 0.8;
    finalColor += mix(primaryColor, glowColor, 0.3) * halo * 0.4;
    finalColor += rayColor * rays * 0.75;
    finalColor *= brightness * shimmer;
    
    float alpha = core * 1.2 + corona * 0.7 + halo * 0.35 + rays * 0.55;
    
    // Soft organic edge fade
    float edgeRadius = organicEdge(center, 0.3, t, uniqueOffset);
    alpha *= 1.0 - smoothstep(edgeRadius - 0.15, edgeRadius + 0.1, dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.7);
    
    if (alpha < 0.01) discard;
    
    gl_FragColor = vec4(finalColor * globalOpacity, alpha * globalOpacity);
  }
`;

// Style 3: Plasma - Swirling energy with organic boundaries
const plasmaShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  uniform float globalOpacity;
  varying vec2 vUv;
  
  ${noiseLib}
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    float t = time * (0.7 + styleVariant * 0.4) + uniqueOffset * 10.0;
    
    // Organic boundary
    float edgeRadius = organicEdge(center, 0.28, t, uniqueOffset);
    float edgeFade = 1.0 - smoothstep(edgeRadius - 0.12, edgeRadius + 0.12, dist);
    if (edgeFade < 0.01) discard;
    
    // Plasma tendrils extending outward
    float plasmaTendrils = 0.0;
    for (float i = 0.0; i < 6.0; i++) {
      float tAngle = i * 1.047 + t * 0.2 + uniqueOffset * 3.0;
      float tNoise = snoise(vec2(i, t * 0.1)) * 0.5;
      float angleDiff = abs(mod(angle - tAngle + 3.14159, 6.28318) - 3.14159);
      float tendril = exp(-angleDiff * angleDiff / 0.08);
      tendril *= smoothstep(0.5 + tNoise, 0.1, dist);
      plasmaTendrils += tendril * 0.25;
    }
    
    // Swirling plasma
    float swirl1 = sin(angle * (3.0 + styleVariant * 2.0) + dist * 12.0 - t * 2.2);
    float swirl2 = sin(angle * (5.0 + styleVariant) - dist * 9.0 + t * 1.7);
    float swirl3 = sin(angle * 7.0 + dist * 6.0 - t * 0.9);
    float plasmaPattern = swirl1 * 0.4 + swirl2 * 0.35 + swirl3 * 0.25;
    plasmaPattern += fbm(vec2(angle * 6.0, dist * 12.0 + t), 5) * 0.5;
    
    // Electric arcs
    float arcs = 0.0;
    for (float i = 0.0; i < 6.0; i++) {
      float arcAngle = i * 1.047 + t * (0.25 + i * 0.05) + uniqueOffset * 6.28;
      float arcDist = 0.12 + sin(t * 1.8 + i * 1.2) * 0.06;
      vec2 arcPos = vec2(cos(arcAngle), sin(arcAngle)) * arcDist;
      float arc = exp(-length(center - arcPos) * 35.0);
      arc *= 0.7 + 0.3 * sin(t * 6.0 + i * 3.0);
      arcs += arc;
    }
    
    // Core
    float core = 1.0 - smoothstep(0.0, 0.1 + sin(t * 2.5) * 0.025, dist);
    core = pow(core, 1.6);
    
    // Corona
    float corona = 1.0 - smoothstep(0.0, 0.3, dist);
    corona = pow(corona, 2.5);
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.98, 0.96);
    vec3 hotBlue = vec3(0.6, 0.85, 1.0);
    vec3 plasmaColor = mix(primaryColor, secondaryColor, plasmaPattern * 0.5 + 0.5);
    plasmaColor = mix(plasmaColor, hotBlue, arcs * 0.6);
    plasmaColor = mix(plasmaColor, glowColor, corona * 0.3);
    plasmaColor = mix(plasmaColor, hotWhite, core * 0.85);
    
    float intensity = (plasmaPattern * 0.25 + 0.75) * (1.0 - dist * 1.2);
    intensity += arcs * 0.7 + core * 1.8 + plasmaTendrils;
    intensity *= brightness * (0.92 + 0.08 * sin(t * 4.5));
    
    vec3 finalColor = plasmaColor * intensity;
    finalColor += hotWhite * arcs * 0.35;
    
    float alpha = (intensity * 0.65 + core * 0.8 + plasmaTendrils * 0.5) * edgeFade;
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.65);
    
    gl_FragColor = vec4(finalColor * globalOpacity, alpha * globalOpacity);
  }
`;

// Style 4: Crystal - Geometric with organic glow overflow
const crystalShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  uniform float globalOpacity;
  varying vec2 vUv;
  
  ${noiseLib}
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    float t = time * 0.4 + uniqueOffset * 10.0;
    
    // Organic outer glow that extends beyond crystal
    float glowRadius = organicEdge(center, 0.32, t, uniqueOffset);
    float outerGlow = 1.0 - smoothstep(0.0, glowRadius, dist);
    outerGlow = pow(outerGlow, 2.5) * 0.4;
    
    // Crystal facets (sharper inner boundary)
    float facets = 6.0 + floor(styleVariant * 4.0);
    float facetAngle = mod(angle + t * 0.08, 6.28318 / facets);
    float facetCenter = 3.14159 / facets;
    float facetEdge = abs(facetAngle - facetCenter) / facetCenter;
    facetEdge = 1.0 - pow(facetEdge, 0.5);
    
    // Inner facets
    float innerAngle = mod(angle - t * 0.05, 6.28318 / (facets * 2.0));
    float innerEdge = abs(innerAngle - 3.14159 / (facets * 2.0));
    innerEdge = 1.0 - smoothstep(0.0, 0.25, innerEdge);
    
    // Crystal body with slightly irregular edge
    float crystalRadius = 0.28 + snoise(vec2(angle * facets, uniqueOffset * 5.0)) * 0.03;
    float crystalBody = 1.0 - smoothstep(crystalRadius - 0.05, crystalRadius + 0.02, dist);
    
    // Core
    float core = 1.0 - smoothstep(0.0, 0.08, dist);
    core = pow(core, 1.3);
    
    // Fire inside
    float fire = sin(angle * 8.0 + dist * 15.0 + t * 2.0) * 0.5 + 0.5;
    fire *= sin(angle * 5.0 - dist * 10.0 - t * 1.5) * 0.5 + 0.5;
    fire = pow(fire, 2.0) * crystalBody;
    
    // Sparkles
    float sparkle = 0.0;
    for (float i = 0.0; i < 10.0; i++) {
      float sparkAngle = i * 0.628318 + t * 0.15 + uniqueOffset * 6.28;
      float sp = pow(max(cos(angle - sparkAngle), 0.0), 80.0);
      sp *= exp(-dist * 5.0);
      sp *= 0.4 + 0.6 * sin(t * 4.5 + i * 2.3);
      sparkle += sp;
    }
    
    // Iridescence
    float iridescence = sin(angle * 4.0 + dist * 12.0 + t * 0.8) * 0.5 + 0.5;
    vec3 iriColor = mix(primaryColor, secondaryColor, iridescence);
    
    vec3 hotWhite = vec3(1.0, 0.99, 0.97);
    vec3 fireColor = vec3(1.0, 0.7, 0.4);
    
    vec3 gemColor = iriColor;
    gemColor += facetEdge * 0.2 * glowColor * crystalBody;
    gemColor += innerEdge * 0.15 * secondaryColor * crystalBody;
    gemColor = mix(gemColor, fireColor, fire * 0.5);
    gemColor = mix(gemColor, hotWhite, core * 0.8);
    gemColor += hotWhite * sparkle * 0.6;
    
    // Add outer glow color
    vec3 glowColor2 = mix(primaryColor, glowColor, 0.5);
    gemColor = mix(glowColor2, gemColor, crystalBody + 0.3);
    
    float intensity = 0.5 + facetEdge * 0.25 + core * 1.2 + fire * 0.4 + sparkle * 0.4 + outerGlow;
    intensity *= brightness * (0.92 + 0.08 * sin(t * 1.5));
    
    vec3 finalColor = gemColor * intensity;
    
    float alpha = 0.55 * crystalBody + facetEdge * 0.2 + core * 0.6 + sparkle * 0.3 + outerGlow;
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.7);
    
    if (alpha < 0.01) discard;
    
    gl_FragColor = vec4(finalColor * globalOpacity, alpha * globalOpacity);
  }
`;

// Style 5: Pulse - Rippling rings with organic dissipation
const pulseShader = `
  uniform vec3 primaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  uniform float globalOpacity;
  varying vec2 vUv;
  
  ${noiseLib}
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    float t = time * (1.2 + styleVariant * 0.6) + uniqueOffset * 10.0;
    
    // Organic boundary
    float edgeRadius = organicEdge(center, 0.3, t, uniqueOffset);
    float edgeFade = 1.0 - smoothstep(edgeRadius - 0.15, edgeRadius + 0.15, dist);
    if (edgeFade < 0.01) discard;
    
    // Core
    float pulseFreq = 2.0 + styleVariant;
    float coreSize = 0.06 + sin(t * pulseFreq) * 0.02 + sin(t * pulseFreq * 1.7) * 0.012;
    float core = 1.0 - smoothstep(0.0, coreSize, dist);
    core = pow(core, 1.3);
    
    // Inner glow
    float innerNoise = snoise(vec2(angle * 4.0, t * 0.3)) * 0.03;
    float innerSize = 0.15 + sin(t * pulseFreq * 0.7) * 0.025 + innerNoise;
    float innerGlow = 1.0 - smoothstep(0.0, innerSize, dist);
    innerGlow = pow(innerGlow, 2.0);
    
    // Rippling rings with organic distortion
    float rings = 0.0;
    float ringCount = 4.0 + styleVariant * 2.0;
    for (float i = 0.0; i < 7.0; i++) {
      if (i >= ringCount) break;
      float ringPhase = t * 1.5 - i * 0.4;
      float ringRadius = fract(ringPhase * 0.25) * 0.45;
      
      // Distort ring shape
      float ringDistort = snoise(vec2(angle * 3.0 + i, t * 0.2)) * 0.03;
      float distortedDist = dist + ringDistort;
      
      float ringWidth = 0.012 + i * 0.002;
      float ring = 1.0 - smoothstep(0.0, ringWidth, abs(distortedDist - ringRadius));
      float ringFade = 1.0 - fract(ringPhase * 0.25) * 1.8;
      ring *= max(ringFade, 0.0);
      ring *= 0.7 + 0.3 * sin(t * 3.0 + i * 1.5);
      rings += ring;
    }
    
    // Outer halo
    float haloNoise = snoise(vec2(angle * 2.0, t * 0.1)) * 0.06;
    float halo = 1.0 - smoothstep(0.0, 0.38 + haloNoise, dist);
    halo = pow(halo, 3.0);
    halo *= 0.75 + 0.25 * sin(t * pulseFreq * 0.6);
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.99, 0.97);
    vec3 ringColor = mix(glowColor, hotWhite, 0.35);
    vec3 coreColor = mix(primaryColor, hotWhite, 0.75);
    
    vec3 finalColor = coreColor * core * 2.2;
    finalColor += mix(primaryColor, glowColor, 0.4) * halo * 0.5;
    finalColor += primaryColor * innerGlow * 0.7;
    finalColor += ringColor * rings * 0.85;
    finalColor *= brightness;
    
    float alpha = (core * 1.1 + innerGlow * 0.6 + halo * 0.35 + rings * 0.7) * edgeFade;
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.65);
    
    gl_FragColor = vec4(finalColor * globalOpacity, alpha * globalOpacity);
  }
`;

// Style 6: Nova - Explosive burst with chaotic edges
const novaShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  uniform float globalOpacity;
  varying vec2 vUv;
  
  ${noiseLib}
  
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    float t = time * 0.4 + uniqueOffset * 10.0;
    
    // Very organic, chaotic boundary
    float edgeRadius = organicEdge(center, 0.26, t, uniqueOffset);
    
    // Extra chaos for nova
    float chaos = snoise(vec2(angle * 5.0, t * 0.3)) * 0.08;
    chaos += snoise(vec2(angle * 11.0, t * 0.5)) * 0.04;
    edgeRadius += chaos;
    
    // Core
    float coreSize = 0.07 + styleVariant * 0.03;
    float core = 1.0 - smoothstep(0.0, coreSize, dist);
    core = pow(core, 1.1);
    
    // Explosive rays with varying lengths
    float rays = 0.0;
    float numRays = 12.0 + styleVariant * 12.0;
    for (float i = 0.0; i < 28.0; i++) {
      if (i >= numRays) break;
      float rayAngle = hash(i + uniqueOffset * 100.0) * 6.28318;
      float rayLength = 0.2 + hash(i * 2.0 + uniqueOffset * 50.0) * 0.25;
      float rayWidth = 0.008 + hash(i * 3.0) * 0.02;
      float rayBrightness = 0.4 + hash(i * 4.0) * 0.6;
      
      // Ray noise for organic look
      float rayNoise = snoise(vec2(dist * 8.0, i + t * 0.5)) * 0.4;
      
      float angleDiff = abs(mod(angle - rayAngle + 3.14159, 6.28318) - 3.14159);
      float rayIntensity = 1.0 - smoothstep(0.0, rayWidth * (1.0 + rayNoise), angleDiff);
      rayIntensity *= 1.0 - smoothstep(0.02, rayLength, dist);
      rayIntensity *= rayBrightness;
      rayIntensity *= 0.6 + 0.4 * sin(t * (1.5 + hash(i) * 2.5) + i * 1.2);
      rays += rayIntensity;
    }
    
    // Shockwave
    float shockPhase = fract(t * 0.25);
    float shockRadius = shockPhase * 0.5;
    float shockNoise = snoise(vec2(angle * 4.0, t)) * 0.02;
    float shock = 1.0 - smoothstep(0.0, 0.015, abs(dist - shockRadius + shockNoise));
    shock *= 1.0 - shockPhase * 1.3;
    shock = max(shock, 0.0);
    
    // Debris
    float debris = 0.0;
    for (float i = 0.0; i < 18.0; i++) {
      float debrisAngle = hash(i + 0.5 + uniqueOffset) * 6.28318;
      float debrisDist = 0.06 + hash(i * 1.7) * 0.3;
      debrisDist *= 0.6 + 0.4 * sin(t * 1.5 + i * 0.8);
      vec2 debrisPos = vec2(cos(debrisAngle), sin(debrisAngle)) * debrisDist;
      float d = exp(-length(center - debrisPos) * 40.0);
      d *= 0.5 + 0.5 * sin(t * 4.0 + i * 2.5);
      debris += d;
    }
    
    // Nebula background
    float nebula = fbm(vec2(angle * 3.0, dist * 8.0 + t * 0.5), 4) * 0.5 + 0.5;
    nebula *= 1.0 - smoothstep(0.1, 0.45, dist);
    nebula = pow(nebula, 1.5) * 0.35;
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.99, 0.97);
    vec3 hotYellow = vec3(1.0, 0.92, 0.55);
    
    vec3 finalColor = mix(primaryColor, hotWhite, core * 0.85) * core * 2.8;
    finalColor += mix(glowColor, hotYellow, 0.35) * rays * 0.85;
    finalColor += mix(secondaryColor, hotWhite, 0.4) * shock * 0.7;
    finalColor += hotWhite * debris * 0.45;
    finalColor += mix(primaryColor, secondaryColor, nebula) * nebula;
    finalColor *= brightness * (0.88 + 0.12 * sin(t * 2.5));
    
    float alpha = core + rays * 0.5 + shock * 0.45 + debris * 0.4 + nebula * 0.5;
    
    // Organic edge
    float edgeFade = 1.0 - smoothstep(edgeRadius - 0.1, edgeRadius + 0.15, dist);
    edgeFade = max(edgeFade, rays * 0.7 + debris * 0.5);
    alpha *= edgeFade;
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.6);
    
    if (alpha < 0.01) discard;
    
    gl_FragColor = vec4(finalColor * globalOpacity, alpha * globalOpacity);
  }
`;

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STYLE_SHADERS = {
  nebula: nebulaShader,
  classic: classicShader,
  plasma: plasmaShader,
  crystal: crystalShader,
  pulse: pulseShader,
  nova: novaShader,
};

const SHAPE_TO_STYLE = {
  classic: 'classic',
  nova: 'nova',
  nebula: 'nebula',
  crystal: 'crystal',
  pulse: 'pulse',
  spiral: 'plasma',
  ring: 'pulse',
  cluster: 'nebula',
};

function StarSprite({ colors, scale, brightness, uniqueOffset, shapeId, globalOpacity = 1, frozen = false }) {
  const meshRef = useRef(null);
  const timeRef = useRef(uniqueOffset * 100);
  const frozenTime = useMemo(() => uniqueOffset * 50, [uniqueOffset]);
  
  const styleKey = SHAPE_TO_STYLE[shapeId] || 'classic';
  const fragmentShader = STYLE_SHADERS[styleKey];
  
  const material = useMemo(() => {
    const styleVariant = (uniqueOffset * 5) % 1;
    const rayCount = 4 + Math.floor(uniqueOffset * 8);
    
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        primaryColor: { value: new THREE.Color(colors.primary) },
        secondaryColor: { value: new THREE.Color(colors.secondary) },
        glowColor: { value: new THREE.Color(colors.glow) },
        time: { value: frozen ? frozenTime : 0 },
        brightness: { value: brightness * 1.4 },
        uniqueOffset: { value: uniqueOffset },
        styleVariant: { value: styleVariant },
        rayCount: { value: rayCount },
        globalOpacity: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, brightness, uniqueOffset, fragmentShader, frozen, frozenTime]);
  
  useFrame((state, delta) => {
    if (!frozen) {
      timeRef.current += delta;
      material.uniforms.time.value = timeRef.current;
    }
    material.uniforms.globalOpacity.value = globalOpacity;
    
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  const spriteSize = 0.9 * scale;
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[spriteSize, spriteSize, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function OuterGlow({ colors, scale, intensity, uniqueOffset, globalOpacity = 1, frozen = false }) {
  const meshRef = useRef(null);
  const timeRef = useRef(uniqueOffset * 100);
  const frozenTime = useMemo(() => uniqueOffset * 50, [uniqueOffset]);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform vec3 secondaryColor;
        uniform float time;
        uniform float intensity;
        uniform float uniqueOffset;
        uniform float globalOpacity;
        varying vec2 vUv;
        
        ${noiseLib}
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float angle = atan(center.y, center.x);
          
          // Organic glow boundary
          float edgeRadius = organicEdge(center, 0.32, time * 0.2, uniqueOffset);
          if (dist > edgeRadius + 0.1) discard;
          
          float glow = 1.0 - smoothstep(0.0, edgeRadius, dist);
          glow = pow(glow, 2.8);
          
          float breath = 0.78 + 0.22 * sin(time * 1.3 + uniqueOffset * 5.0);
          breath *= 0.9 + 0.1 * sin(time * 2.1 + 1.5);
          
          // Wispy variations
          float wisp = snoise(vec2(angle * 3.0, dist * 5.0 + time * 0.2)) * 0.3 + 0.7;
          glow *= wisp;
          
          vec3 color = mix(glowColor, secondaryColor, dist * 1.8);
          
          float alpha = glow * intensity * breath * 0.45 * globalOpacity;
          
          gl_FragColor = vec4(color * 1.15 * globalOpacity, alpha);
        }
      `,
      uniforms: {
        glowColor: { value: new THREE.Color(colors.glow) },
        secondaryColor: { value: new THREE.Color(colors.secondary) },
        time: { value: frozen ? frozenTime : 0 },
        intensity: { value: intensity },
        uniqueOffset: { value: uniqueOffset },
        globalOpacity: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, intensity, uniqueOffset, frozen, frozenTime]);
  
  useFrame((state, delta) => {
    if (!frozen) {
      timeRef.current += delta;
      material.uniforms.time.value = timeRef.current;
    }
    material.uniforms.globalOpacity.value = globalOpacity;
    
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  const glowSize = 1.4 * scale;
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[glowSize, glowSize, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function StarLabel({ name, isVisible }) {
  if (!isVisible || !name) return null;
  
  return (
    <Html
      position={[0, 0.5, 0]}
      center
      style={{
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.95), rgba(59, 130, 246, 0.85))',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '600',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), 0 0 30px rgba(59, 130, 246, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(8px)',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
          letterSpacing: '0.5px',
          transform: 'translateY(-20px)',
        }}
      >
        {name}
      </div>
    </Html>
  );
}

export default function Star({ 
  position = [0, 0, 0],
  starProfile = DEFAULT_STAR_PROFILE,
  personId = 'default',
  personName = '',
  isHovered = false,
  isFocused = false,
  globalOpacity = 1,
  globalScale = 1,
  animated = true,
  onClick,
  onPointerOver,
  onPointerOut,
}) {
  const groupRef = useRef(null);
  
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
  
  const shapeId = starProfile?.shape || visuals.shape?.id || 'classic';
  
  const activeScale = useMemo(() => {
    let base = visuals.scale;
    if (isFocused) base = visuals.scale * 2.2;
    else if (isHovered) base = visuals.scale * 2.0;
    return base * globalScale;
  }, [isHovered, isFocused, visuals.scale, globalScale]);
  
  const activeIntensity = useMemo(() => {
    const base = visuals.glow?.intensity || 0.7;
    if (isFocused) return base * 1.8;
    if (isHovered) return base * 1.6;
    return base;
  }, [isHovered, isFocused, visuals.glow]);
  
  if (!animated) {
    return (
      <group 
        ref={groupRef} 
        position={position}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <StarLabel name={personName} isVisible={isHovered || isFocused} />
        
        <OuterGlow
          colors={visuals.colors}
          scale={activeScale * 0.8}
          intensity={activeIntensity * 0.5}
          uniqueOffset={uniqueOffset}
          globalOpacity={globalOpacity}
          frozen={true}
        />
        
        <StarSprite
          colors={visuals.colors}
          scale={activeScale * 0.8}
          brightness={visuals.brightness * 0.9}
          uniqueOffset={uniqueOffset}
          shapeId={shapeId}
          globalOpacity={globalOpacity}
          frozen={true}
        />
        
        <mesh visible={false}>
          <sphereGeometry args={[0.2 * activeScale, 6, 6]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </group>
    );
  }
  
  return (
    <group 
      ref={groupRef} 
      position={position}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <StarLabel name={personName} isVisible={isHovered || isFocused} />
      
      <OuterGlow
        colors={visuals.colors}
        scale={activeScale}
        intensity={activeIntensity * 0.65}
        uniqueOffset={uniqueOffset}
        globalOpacity={globalOpacity}
      />
      
      <StarSprite
        colors={visuals.colors}
        scale={activeScale}
        brightness={visuals.brightness}
        uniqueOffset={uniqueOffset}
        shapeId={shapeId}
        globalOpacity={globalOpacity}
      />
      
      <mesh visible={false}>
        <sphereGeometry args={[0.25 * activeScale, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

export function StarInstanced({ stars, onStarClick, onStarHover, hoveredId, focusedId, globalOpacity = 1, globalScale = 1, animated = true }) {
  return (
    <group>
      {stars.map((star) => (
        <Star
          key={star.id}
          position={star.position}
          starProfile={star.starProfile}
          personId={star.id}
          personName={star.person?.name || star.person?.first_name || ''}
          isHovered={hoveredId === star.id}
          isFocused={focusedId === star.id}
          globalOpacity={globalOpacity}
          globalScale={globalScale}
          animated={animated}
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
