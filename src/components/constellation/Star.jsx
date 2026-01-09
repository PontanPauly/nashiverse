import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getStarVisuals, DEFAULT_STAR_PROFILE } from '@/lib/starConfig';

// Style 1: Nebula - Complex turbulent multi-color clouds (Cassiopeia A inspired)
const nebulaShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  varying vec2 vUv;
  
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
  
  float ridgedNoise(vec2 p) {
    return 1.0 - abs(snoise(p));
  }
  
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
    if (dist > 0.5) discard;
    
    float angle = atan(center.y, center.x);
    float t = time * 0.25 + uniqueOffset * 10.0;
    vec2 wUv = center * (4.0 + styleVariant * 2.0);
    
    // Multi-layer warping for turbulence
    float warpX = fbm(wUv + t * 0.08, 5);
    float warpY = fbm(wUv + vec2(5.2, 1.3) + t * 0.1, 5);
    vec2 warped = wUv + vec2(warpX, warpY) * (0.4 + styleVariant * 0.4);
    
    // Second warp layer
    float warpX2 = fbm(warped * 0.7 + t * 0.05, 3);
    float warpY2 = fbm(warped * 0.7 + vec2(3.1, 7.2) + t * 0.06, 3);
    warped += vec2(warpX2, warpY2) * 0.25;
    
    // Multi-scale structure
    float largeStructure = fbm(warped * 0.4 + t * 0.03, 6);
    float medStructure = fbm(warped * 1.2 + t * 0.06, 5);
    float fineDetail = fbm(warped * 3.0 + t * 0.12, 4);
    float structure = largeStructure * 0.45 + medStructure * 0.35 + fineDetail * 0.2;
    structure = structure * 0.5 + 0.5;
    
    // Bright filaments
    float filaments = ridgedFbm(warped * 1.5 + t * 0.08, 4);
    float filaments2 = ridgedFbm(warped * 2.5 - t * 0.06, 3);
    float filamentGlow = pow(filaments, 1.8) * 0.6 + pow(filaments2, 2.2) * 0.4;
    
    // Hot spots
    float hotSpots = pow(max(fbm(warped * 2.0 + t * 0.15, 3), 0.0), 2.5);
    
    // Multi-color palette (Cassiopeia A inspired)
    vec3 hotWhite = vec3(1.0, 0.99, 0.96);
    vec3 hotYellow = vec3(1.0, 0.92, 0.6);
    vec3 hotPink = vec3(1.0, 0.45, 0.65);
    vec3 electricBlue = vec3(0.35, 0.55, 1.0);
    vec3 deepPurple = vec3(0.55, 0.2, 0.85);
    vec3 cyan = vec3(0.3, 0.85, 0.95);
    vec3 green = vec3(0.4, 0.9, 0.5);
    
    // Color zones
    float zone1 = fbm(warped * 0.8 + t * 0.04, 4) * 0.5 + 0.5;
    float zone2 = fbm(warped * 1.0 + vec2(5.0, 9.0) + t * 0.05, 4) * 0.5 + 0.5;
    float zone3 = fbm(warped * 1.3 + vec2(11.0, 3.0) - t * 0.03, 4) * 0.5 + 0.5;
    
    vec3 colorMix = primaryColor;
    colorMix = mix(colorMix, electricBlue, smoothstep(0.3, 0.65, zone1) * 0.55);
    colorMix = mix(colorMix, deepPurple, smoothstep(0.35, 0.75, zone2) * 0.5);
    colorMix = mix(colorMix, hotPink, smoothstep(0.4, 0.85, zone3) * 0.45);
    colorMix = mix(colorMix, cyan, pow(filaments, 2.0) * 0.4);
    colorMix = mix(colorMix, green, pow(filaments2, 2.5) * 0.25);
    colorMix = mix(colorMix, hotYellow, hotSpots * 0.6);
    
    // Core glow
    float coreGlow = pow(1.0 - smoothstep(0.0, 0.25, dist), 1.8);
    colorMix = mix(colorMix, hotWhite, coreGlow * 0.75);
    colorMix = mix(colorMix, hotYellow, coreGlow * hotSpots * 0.5);
    
    // Edge wisps
    float edgeNoise = fbm(vec2(angle * 4.0, dist * 6.0) + t * 0.15, 4);
    float wispyEdge = smoothstep(0.2, 0.42, dist) * (0.4 + edgeNoise * 0.6);
    
    // Intensity
    float intensity = structure * 0.55 + filamentGlow * 0.9 + coreGlow * 1.3;
    intensity *= brightness * (0.88 + 0.12 * sin(time * 1.8 + uniqueOffset * 5.0));
    intensity *= 0.92 + 0.08 * sin(time * 2.9 + 1.2);
    
    vec3 finalColor = colorMix * intensity;
    finalColor += hotWhite * pow(filaments, 3.5) * 0.35;
    finalColor += cyan * pow(filaments2, 3.0) * 0.25;
    
    float alpha = (structure * 0.45 + filamentGlow * 0.9 + coreGlow * 1.1);
    alpha *= 1.0 - smoothstep(0.32 + wispyEdge * 0.1, 0.5, dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.65);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Style 2: Classic - Elegant radiant star with prominent diffraction spikes
const classicShader = `
  uniform vec3 primaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  uniform float rayCount;
  varying vec2 vUv;
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float angle = atan(center.y, center.x);
    float t = time + uniqueOffset * 10.0;
    
    // Brilliant core with color temperature
    float coreRadius = 0.08 + styleVariant * 0.04;
    float core = 1.0 - smoothstep(0.0, coreRadius, dist);
    core = pow(core, 1.2);
    
    // Inner corona
    float corona = 1.0 - smoothstep(0.0, 0.22, dist);
    corona = pow(corona, 2.2);
    
    // Outer halo
    float halo = 1.0 - smoothstep(0.0, 0.4, dist);
    halo = pow(halo, 3.5);
    
    // Primary diffraction spikes
    float rays = 0.0;
    float numRays = rayCount;
    for (float i = 0.0; i < 12.0; i++) {
      if (i >= numRays) break;
      float rayAngle = i * 6.28318 / numRays + uniqueOffset * 3.14159;
      float spikeIntensity = pow(abs(cos((angle - rayAngle) * numRays * 0.5)), 60.0 + styleVariant * 40.0);
      spikeIntensity *= exp(-dist * (3.0 - styleVariant * 0.8));
      
      // Taper the spikes
      float taper = 1.0 - pow(dist * 2.0, 1.5);
      spikeIntensity *= max(taper, 0.0);
      rays += spikeIntensity;
    }
    
    // Secondary shorter spikes (offset by half)
    float rays2 = 0.0;
    for (float i = 0.0; i < 12.0; i++) {
      if (i >= numRays) break;
      float rayAngle = i * 6.28318 / numRays + uniqueOffset * 3.14159 + 3.14159 / numRays;
      float spikeIntensity = pow(abs(cos((angle - rayAngle) * numRays * 0.5)), 80.0);
      spikeIntensity *= exp(-dist * 5.0) * 0.4;
      rays2 += spikeIntensity;
    }
    rays += rays2;
    
    // Chromatic shimmer
    float shimmer = 0.88 + 0.12 * sin(t * 2.5) * sin(t * 3.7 + 1.5);
    shimmer *= 0.92 + 0.08 * sin(t * 4.1 + angle * 2.0);
    
    // Color gradient
    vec3 hotWhite = vec3(1.0, 0.995, 0.97);
    vec3 warmCore = vec3(1.0, 0.95, 0.88);
    vec3 coreColor = mix(warmCore, hotWhite, core * 0.9);
    vec3 rayColor = mix(glowColor, hotWhite, 0.45);
    vec3 haloColor = mix(primaryColor, glowColor, 0.3);
    
    vec3 finalColor = coreColor * core * 2.5;
    finalColor += primaryColor * corona * 0.8;
    finalColor += haloColor * halo * 0.4;
    finalColor += rayColor * rays * 0.75;
    finalColor *= brightness * shimmer;
    
    float alpha = core * 1.2 + corona * 0.7 + halo * 0.4 + rays * 0.55;
    alpha *= 1.0 - smoothstep(0.42, 0.5, dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.75);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Style 3: Plasma - Swirling energy plasma with electric arcs
const plasmaShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  varying vec2 vUv;
  
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
  
  float fbm(vec2 p) {
    float sum = 0.0, amp = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += noise(p) * amp;
      p *= 2.0;
      amp *= 0.5;
    }
    return sum;
  }
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float angle = atan(center.y, center.x);
    float t = time * (0.7 + styleVariant * 0.4) + uniqueOffset * 10.0;
    
    // Swirling plasma layers
    float swirl1 = sin(angle * (3.0 + styleVariant * 2.0) + dist * 12.0 - t * 2.2);
    float swirl2 = sin(angle * (5.0 + styleVariant) - dist * 9.0 + t * 1.7);
    float swirl3 = sin(angle * 7.0 + dist * 6.0 - t * 0.9);
    float plasmaPattern = swirl1 * 0.4 + swirl2 * 0.35 + swirl3 * 0.25;
    plasmaPattern += fbm(vec2(angle * 6.0, dist * 12.0 + t)) * 0.5;
    
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
    
    // Core pulse
    float coreSize = 0.1 + sin(t * 2.5) * 0.025;
    float core = 1.0 - smoothstep(0.0, coreSize, dist);
    core = pow(core, 1.6);
    
    // Outer corona
    float corona = 1.0 - smoothstep(0.0, 0.35, dist);
    corona = pow(corona, 2.8);
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.98, 0.96);
    vec3 hotBlue = vec3(0.6, 0.85, 1.0);
    vec3 plasmaColor = mix(primaryColor, secondaryColor, plasmaPattern * 0.5 + 0.5);
    plasmaColor = mix(plasmaColor, hotBlue, arcs * 0.6);
    plasmaColor = mix(plasmaColor, glowColor, corona * 0.3);
    plasmaColor = mix(plasmaColor, hotWhite, core * 0.85);
    
    float intensity = (plasmaPattern * 0.25 + 0.75) * (1.0 - dist * 1.3);
    intensity += arcs * 0.7 + core * 1.8;
    intensity *= brightness * (0.92 + 0.08 * sin(t * 4.5));
    
    vec3 finalColor = plasmaColor * intensity;
    finalColor += hotWhite * arcs * 0.35;
    
    float alpha = intensity * 0.7 + core * 0.8;
    alpha *= 1.0 - smoothstep(0.38, 0.5, dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.7);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Style 4: Crystal - Geometric faceted gem with internal fire
const crystalShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  varying vec2 vUv;
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float angle = atan(center.y, center.x);
    float t = time * 0.4 + uniqueOffset * 10.0;
    
    // Faceted structure
    float facets = 6.0 + floor(styleVariant * 4.0);
    float facetAngle = mod(angle + t * 0.08, 6.28318 / facets);
    float facetCenter = 3.14159 / facets;
    float facetEdge = abs(facetAngle - facetCenter) / facetCenter;
    facetEdge = 1.0 - pow(facetEdge, 0.5);
    
    // Inner facet layers
    float innerFacets = facets * 2.0;
    float innerAngle = mod(angle - t * 0.05, 6.28318 / innerFacets);
    float innerEdge = abs(innerAngle - 3.14159 / innerFacets);
    innerEdge = 1.0 - smoothstep(0.0, 0.25, innerEdge);
    
    // Radial zones
    float radialZones = 4.0 + styleVariant * 2.0;
    float radialPos = dist * radialZones;
    float radialEdge = smoothstep(0.0, 0.15, abs(fract(radialPos) - 0.5));
    
    // Core brilliance
    float core = 1.0 - smoothstep(0.0, 0.1, dist);
    core = pow(core, 1.3);
    
    // Fire inside
    float fire = sin(angle * 8.0 + dist * 15.0 + t * 2.0) * 0.5 + 0.5;
    fire *= sin(angle * 5.0 - dist * 10.0 - t * 1.5) * 0.5 + 0.5;
    fire = pow(fire, 2.0) * (1.0 - dist * 2.0);
    
    // Sparkle points
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
    vec3 iriColor1 = mix(primaryColor, secondaryColor, iridescence);
    vec3 iriColor2 = mix(secondaryColor, glowColor, 1.0 - iridescence);
    vec3 gemColor = mix(iriColor1, iriColor2, dist * 1.5);
    
    vec3 hotWhite = vec3(1.0, 0.99, 0.97);
    vec3 fireColor = vec3(1.0, 0.7, 0.4);
    
    gemColor += facetEdge * 0.2 * glowColor;
    gemColor += innerEdge * 0.15 * secondaryColor * (1.0 - dist * 2.0);
    gemColor = mix(gemColor, fireColor, fire * 0.5);
    gemColor = mix(gemColor, hotWhite, core * 0.8);
    gemColor += hotWhite * sparkle * 0.6;
    
    float intensity = 0.55 + facetEdge * 0.25 + core * 1.2 + fire * 0.4 + sparkle * 0.4;
    intensity *= brightness * (0.92 + 0.08 * sin(t * 1.5));
    
    vec3 finalColor = gemColor * intensity;
    
    float alpha = 0.65 + facetEdge * 0.25 + core * 0.6 + sparkle * 0.3;
    alpha *= 1.0 - smoothstep(0.38, 0.5, dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.75);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Style 5: Pulse - Pulsating energy with rippling rings
const pulseShader = `
  uniform vec3 primaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  varying vec2 vUv;
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float t = time * (1.2 + styleVariant * 0.6) + uniqueOffset * 10.0;
    
    // Pulsating core
    float pulseFreq = 2.0 + styleVariant;
    float coreSize = 0.07 + sin(t * pulseFreq) * 0.025 + sin(t * pulseFreq * 1.7) * 0.015;
    float core = 1.0 - smoothstep(0.0, coreSize, dist);
    core = pow(core, 1.3);
    
    // Inner glow
    float innerSize = 0.18 + sin(t * pulseFreq * 0.7) * 0.03;
    float innerGlow = 1.0 - smoothstep(0.0, innerSize, dist);
    innerGlow = pow(innerGlow, 2.0);
    
    // Rippling rings
    float rings = 0.0;
    float ringCount = 4.0 + styleVariant * 2.0;
    for (float i = 0.0; i < 7.0; i++) {
      if (i >= ringCount) break;
      float ringPhase = t * 1.5 - i * 0.4;
      float ringRadius = fract(ringPhase * 0.25) * 0.42;
      float ringWidth = 0.015 + i * 0.003;
      float ring = 1.0 - smoothstep(0.0, ringWidth, abs(dist - ringRadius));
      float ringFade = 1.0 - fract(ringPhase * 0.25) * 1.8;
      ring *= max(ringFade, 0.0);
      ring *= 0.7 + 0.3 * sin(t * 3.0 + i * 1.5);
      rings += ring;
    }
    
    // Outer halo
    float halo = 1.0 - smoothstep(0.0, 0.4, dist);
    halo = pow(halo, 3.0);
    float haloPulse = 0.75 + 0.25 * sin(t * pulseFreq * 0.6);
    halo *= haloPulse;
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.99, 0.97);
    vec3 ringColor = mix(glowColor, hotWhite, 0.35);
    vec3 coreColor = mix(primaryColor, hotWhite, 0.75);
    vec3 haloColor = mix(primaryColor, glowColor, 0.4);
    
    vec3 finalColor = coreColor * core * 2.2;
    finalColor += haloColor * halo * 0.5;
    finalColor += primaryColor * innerGlow * 0.7;
    finalColor += ringColor * rings * 0.85;
    finalColor *= brightness;
    
    float alpha = core * 1.1 + innerGlow * 0.6 + halo * 0.35 + rings * 0.7;
    alpha *= 1.0 - smoothstep(0.42, 0.5, dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.7);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Style 6: Nova - Explosive supernova burst
const novaShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  varying vec2 vUv;
  
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = i.x + i.y * 57.0;
    return mix(mix(hash(n), hash(n + 1.0), f.x),
               mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y);
  }
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float angle = atan(center.y, center.x);
    float t = time * 0.4 + uniqueOffset * 10.0;
    
    // Explosive core
    float coreSize = 0.08 + styleVariant * 0.04;
    float core = 1.0 - smoothstep(0.0, coreSize, dist);
    core = pow(core, 1.1);
    
    // Explosive rays
    float rays = 0.0;
    float numRays = 10.0 + styleVariant * 10.0;
    for (float i = 0.0; i < 24.0; i++) {
      if (i >= numRays) break;
      float rayAngle = hash(i + uniqueOffset * 100.0) * 6.28318;
      float rayLength = 0.25 + hash(i * 2.0 + uniqueOffset * 50.0) * 0.2;
      float rayWidth = 0.012 + hash(i * 3.0) * 0.025;
      float rayBrightness = 0.5 + hash(i * 4.0) * 0.5;
      
      float angleDiff = abs(mod(angle - rayAngle + 3.14159, 6.28318) - 3.14159);
      float rayIntensity = 1.0 - smoothstep(0.0, rayWidth, angleDiff);
      rayIntensity *= 1.0 - smoothstep(0.03, rayLength, dist);
      rayIntensity *= rayBrightness;
      rayIntensity *= 0.6 + 0.4 * sin(t * (1.5 + hash(i) * 2.5) + i * 1.2);
      rays += rayIntensity;
    }
    
    // Shockwave
    float shockPhase = fract(t * 0.25);
    float shockRadius = shockPhase * 0.45;
    float shock = 1.0 - smoothstep(0.0, 0.018, abs(dist - shockRadius));
    shock *= 1.0 - shockPhase * 1.2;
    shock = max(shock, 0.0);
    
    // Debris cloud
    float debris = 0.0;
    for (float i = 0.0; i < 15.0; i++) {
      float debrisAngle = hash(i + 0.5 + uniqueOffset) * 6.28318;
      float debrisDist = 0.08 + hash(i * 1.7) * 0.25;
      debrisDist *= 0.6 + 0.4 * sin(t * 1.5 + i * 0.8);
      vec2 debrisPos = vec2(cos(debrisAngle), sin(debrisAngle)) * debrisDist;
      float d = exp(-length(center - debrisPos) * 45.0);
      d *= 0.5 + 0.5 * sin(t * 4.0 + i * 2.5);
      debris += d;
    }
    
    // Outer nebula
    float nebulaPattern = noise(vec2(angle * 3.0, dist * 8.0 + t * 0.5)) * 0.5 + 0.5;
    float nebula = nebulaPattern * (1.0 - smoothstep(0.15, 0.45, dist));
    nebula = pow(nebula, 1.5) * 0.4;
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.99, 0.97);
    vec3 hotYellow = vec3(1.0, 0.92, 0.55);
    vec3 hotOrange = vec3(1.0, 0.65, 0.3);
    
    vec3 finalColor = mix(primaryColor, hotWhite, core * 0.85) * core * 2.8;
    finalColor += mix(glowColor, hotYellow, 0.35) * rays * 0.85;
    finalColor += mix(secondaryColor, hotWhite, 0.4) * shock * 0.7;
    finalColor += hotWhite * debris * 0.45;
    finalColor += mix(primaryColor, secondaryColor, nebulaPattern) * nebula;
    finalColor *= brightness * (0.88 + 0.12 * sin(t * 2.5));
    
    float alpha = core + rays * 0.55 + shock * 0.5 + debris * 0.4 + nebula * 0.6;
    alpha *= 1.0 - smoothstep(0.42, 0.5, dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.65);
    
    gl_FragColor = vec4(finalColor, alpha);
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

function StarSprite({ colors, scale, brightness, uniqueOffset, shapeId }) {
  const meshRef = useRef();
  const timeRef = useRef(uniqueOffset * 100);
  
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
        time: { value: 0 },
        brightness: { value: brightness * 1.4 },
        uniqueOffset: { value: uniqueOffset },
        styleVariant: { value: styleVariant },
        rayCount: { value: rayCount },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, brightness, uniqueOffset, fragmentShader]);
  
  useFrame((state, delta) => {
    timeRef.current += delta;
    material.uniforms.time.value = timeRef.current;
    
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  const spriteSize = 0.55 * scale;
  
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
      vertexShader,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform vec3 secondaryColor;
        uniform float time;
        uniform float intensity;
        uniform float uniqueOffset;
        varying vec2 vUv;
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          if (dist > 0.5) discard;
          
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          glow = pow(glow, 3.2);
          
          float breath = 0.78 + 0.22 * sin(time * 1.3 + uniqueOffset * 5.0);
          breath *= 0.9 + 0.1 * sin(time * 2.1 + 1.5);
          
          vec3 color = mix(glowColor, secondaryColor, dist * 1.5);
          
          float alpha = glow * intensity * breath * 0.4;
          alpha *= 1.0 - smoothstep(0.42, 0.5, dist);
          
          gl_FragColor = vec4(color * 1.15, alpha);
        }
      `,
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
          animation: 'fadeInUp 0.2s ease-out',
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
  
  const shapeId = starProfile?.shape || visuals.shape?.id || 'classic';
  
  // Much larger hover scale
  const activeScale = useMemo(() => {
    if (isFocused) return visuals.scale * 2.2;
    if (isHovered) return visuals.scale * 2.0;
    return visuals.scale;
  }, [isHovered, isFocused, visuals.scale]);
  
  const activeIntensity = useMemo(() => {
    const base = visuals.glow?.intensity || 0.7;
    if (isFocused) return base * 1.8;
    if (isHovered) return base * 1.6;
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
      <StarLabel name={personName} isVisible={isHovered || isFocused} />
      
      <OuterGlow
        colors={visuals.colors}
        scale={activeScale}
        intensity={activeIntensity * 0.65}
        uniqueOffset={uniqueOffset}
      />
      
      <StarSprite
        colors={visuals.colors}
        scale={activeScale}
        brightness={visuals.brightness}
        uniqueOffset={uniqueOffset}
        shapeId={shapeId}
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
          personName={star.person?.name || star.person?.first_name || ''}
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
