import React, { useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const PersonNode = ({ data, selected }) => {
  const [isHovered, setIsHovered] = useState(false);

  const pattern = data.star_pattern || 'classic';
  const intensity = (data.star_intensity || 5) / 5;
  const flareCount = data.star_flare_count || 8;
  
  const getStarSize = (roleType) => {
    const sizes = { 'adult': 14, 'teen': 11, 'child': 9, 'ancestor': 18 };
    return sizes[roleType] || 14;
  };

  const getStarColors = (householdId) => {
    if (!householdId) return { 
      primary: '#e0e7ff', secondary: '#a5b4fc', tertiary: '#818cf8',
      accent: '#c7d2fe', glow: '#6366f1'
    };
    const palettes = [
      { primary: '#fef3c7', secondary: '#fde68a', tertiary: '#fcd34d', accent: '#fbbf24', glow: '#f59e0b' },
      { primary: '#dbeafe', secondary: '#93c5fd', tertiary: '#60a5fa', accent: '#3b82f6', glow: '#2563eb' },
      { primary: '#f3e8ff', secondary: '#d8b4fe', tertiary: '#c084fc', accent: '#a855f7', glow: '#9333ea' },
      { primary: '#fce7f3', secondary: '#fbcfe8', tertiary: '#f472b6', accent: '#ec4899', glow: '#db2777' },
      { primary: '#d1fae5', secondary: '#6ee7b7', tertiary: '#34d399', accent: '#10b981', glow: '#059669' },
      { primary: '#fed7aa', secondary: '#fdba74', tertiary: '#fb923c', accent: '#f97316', glow: '#ea580c' },
    ];
    const hash = householdId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return palettes[hash % palettes.length];
  };

  const size = getStarSize(data.role_type);
  const colors = getStarColors(data.household_id);
  const twinkleDuration = 2.5 + Math.random() * 1.5;
  const pulseDelay = Math.random() * 2;
  const randomRotation = Math.random() * 360;

  const renderStarPattern = () => {
    switch(pattern) {
      case 'burst':
        return (
          <>
            {/* Main rays */}
            {[...Array(flareCount)].map((_, i) => {
              const angle = (i / flareCount) * Math.PI * 2;
              const length = size * 5 * intensity;
              const thickness = 4;
              return (
                <motion.div
                  key={`ray-${i}`}
                  className="absolute"
                  style={{
                    width: thickness,
                    height: length,
                    left: size * 4 - thickness/2,
                    top: size * 4 - length / 2,
                    background: `linear-gradient(180deg, 
                      transparent 0%, 
                      ${colors.tertiary}30 15%,
                      ${colors.secondary}80 35%, 
                      ${colors.primary} 48%,
                      white 50%,
                      ${colors.primary} 52%,
                      ${colors.secondary}80 65%,
                      ${colors.tertiary}30 85%,
                      transparent 100%)`,
                    transformOrigin: `50% ${length / 2}px`,
                    transform: `rotate(${angle}rad)`,
                    filter: 'blur(0.5px)',
                    boxShadow: `0 0 ${size}px ${colors.glow}40`,
                  }}
                  animate={{ 
                    opacity: [0.5, 1, 0.5], 
                    scaleY: [0.85, 1.15, 0.85],
                    filter: ['blur(0.5px) brightness(1)', 'blur(1px) brightness(1.4)', 'blur(0.5px) brightness(1)']
                  }}
                  transition={{ duration: twinkleDuration, repeat: Infinity, delay: pulseDelay + i * 0.05 }}
                />
              );
            })}
            {/* Secondary shimmer rays */}
            {[...Array(flareCount * 2)].map((_, i) => {
              const angle = (i / (flareCount * 2)) * Math.PI * 2 + 0.1;
              const length = size * 2.5 * intensity;
              return (
                <motion.div
                  key={`shimmer-${i}`}
                  className="absolute"
                  style={{
                    width: 1,
                    height: length,
                    left: size * 4,
                    top: size * 4 - length / 2,
                    background: `linear-gradient(180deg, transparent, ${colors.primary}60, transparent)`,
                    transformOrigin: `50% ${length / 2}px`,
                    transform: `rotate(${angle}rad)`,
                    filter: 'blur(0.5px)',
                  }}
                  animate={{ opacity: [0.2, 0.6, 0.2] }}
                  transition={{ duration: twinkleDuration * 0.7, repeat: Infinity, delay: pulseDelay + i * 0.03 }}
                />
              );
            })}
          </>
        );
        
      case 'diamond':
        return (
          <>
            {/* Outer diamond shell */}
            <motion.div
              className="absolute"
              style={{
                width: size * 7,
                height: size * 7,
                left: size * 0.5,
                top: size * 0.5,
                transform: 'rotate(45deg)',
                background: `linear-gradient(135deg, 
                  ${colors.tertiary}40 0%,
                  ${colors.secondary} 25%,
                  ${colors.primary} 45%,
                  white 50%,
                  ${colors.primary} 55%,
                  ${colors.secondary} 75%,
                  ${colors.tertiary}40 100%)`,
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                filter: 'blur(1px)',
                boxShadow: `0 0 ${size * 2}px ${colors.glow}80, inset 0 0 ${size}px ${colors.primary}40`,
              }}
              animate={{ 
                opacity: [0.7, 1, 0.7],
                scale: [0.95, 1.08, 0.95],
                rotate: [45, 50, 45]
              }}
              transition={{ duration: twinkleDuration, repeat: Infinity, delay: pulseDelay }}
            />
            {/* Inner crystalline structure */}
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  width: size * (5 - i),
                  height: size * (5 - i),
                  left: size * (1.5 + i/2),
                  top: size * (1.5 + i/2),
                  transform: `rotate(${45 + i * 10}deg)`,
                  border: `2px solid ${colors.primary}${Math.floor((1 - i/4) * 255).toString(16)}`,
                  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                  filter: 'blur(0.5px)',
                }}
                animate={{ 
                  opacity: [0.3, 0.8, 0.3],
                  rotate: [45 + i * 10, 50 + i * 10, 45 + i * 10]
                }}
                transition={{ duration: twinkleDuration * 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </>
        );
        
      case 'cross':
        return (
          <>
            {/* Horizontal beam with depth */}
            <motion.div className="absolute" style={{ width: size * 9, height: size * 3, left: -size * 0.5, top: size * 2.5 }}>
              <div className="absolute inset-0" style={{
                background: `linear-gradient(90deg, 
                  transparent 0%,
                  ${colors.tertiary}20 10%,
                  ${colors.secondary}60 30%,
                  ${colors.primary} 45%,
                  white 50%,
                  ${colors.primary} 55%,
                  ${colors.secondary}60 70%,
                  ${colors.tertiary}20 90%,
                  transparent 100%)`,
                filter: 'blur(2px)',
                boxShadow: `0 0 ${size * 2}px ${colors.glow}`,
              }} />
              <motion.div 
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(90deg, transparent, ${colors.primary}, white, ${colors.primary}, transparent)`,
                  filter: 'blur(4px)',
                }}
                animate={{ opacity: [0.3, 0.7, 0.3], scaleX: [0.95, 1.05, 0.95] }}
                transition={{ duration: twinkleDuration, repeat: Infinity, delay: pulseDelay }}
              />
            </motion.div>
            {/* Vertical beam with depth */}
            <motion.div className="absolute" style={{ width: size * 3, height: size * 9, left: size * 2.5, top: -size * 0.5 }}>
              <div className="absolute inset-0" style={{
                background: `linear-gradient(180deg, 
                  transparent 0%,
                  ${colors.tertiary}20 10%,
                  ${colors.secondary}60 30%,
                  ${colors.primary} 45%,
                  white 50%,
                  ${colors.primary} 55%,
                  ${colors.secondary}60 70%,
                  ${colors.tertiary}20 90%,
                  transparent 100%)`,
                filter: 'blur(2px)',
                boxShadow: `0 0 ${size * 2}px ${colors.glow}`,
              }} />
              <motion.div 
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(180deg, transparent, ${colors.primary}, white, ${colors.primary}, transparent)`,
                  filter: 'blur(4px)',
                }}
                animate={{ opacity: [0.3, 0.7, 0.3], scaleY: [0.95, 1.05, 0.95] }}
                transition={{ duration: twinkleDuration, repeat: Infinity, delay: pulseDelay + 0.3 }}
              />
            </motion.div>
            {/* Center junction glow */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: size * 4,
                height: size * 4,
                left: size * 2,
                top: size * 2,
                background: `radial-gradient(circle, white, ${colors.primary}80, ${colors.secondary}40, transparent)`,
                filter: 'blur(4px)',
                boxShadow: `0 0 ${size * 3}px ${colors.glow}`,
              }}
              animate={{ opacity: [0.6, 1, 0.6], scale: [0.9, 1.1, 0.9] }}
              transition={{ duration: twinkleDuration * 0.6, repeat: Infinity, delay: pulseDelay }}
            />
          </>
        );
        
      case 'spiral':
        return (
          <>
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  width: size * (2 + i * 0.8),
                  height: size * (2 + i * 0.8),
                  left: size * (3 - i * 0.4),
                  top: size * (3 - i * 0.4),
                  borderRadius: '50%',
                  border: `${3 - i * 0.3}px solid ${colors.primary}${Math.floor((1 - i/8) * 200).toString(16)}`,
                  filter: `blur(${i * 0.3}px)`,
                  boxShadow: `0 0 ${size * (1 + i * 0.5)}px ${colors.glow}${Math.floor((1 - i/8) * 100).toString(16)}`,
                }}
                animate={{ 
                  rotate: [randomRotation, randomRotation + 360],
                  opacity: [0.4 + i * 0.05, 0.9 - i * 0.05, 0.4 + i * 0.05]
                }}
                transition={{ 
                  rotate: { duration: 12 + i * 3, repeat: Infinity, ease: "linear" },
                  opacity: { duration: twinkleDuration, repeat: Infinity, delay: i * 0.15 }
                }}
              />
            ))}
            {/* Spiral arms */}
            {[...Array(3)].map((_, armIndex) => (
              <motion.div
                key={`arm-${armIndex}`}
                className="absolute"
                style={{
                  width: size * 6,
                  height: 2,
                  left: size,
                  top: size * 4,
                  background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary}60, transparent)`,
                  transformOrigin: 'left center',
                  filter: 'blur(1px)',
                }}
                animate={{ 
                  rotate: [armIndex * 120, armIndex * 120 + 360],
                  opacity: [0.6, 0.9, 0.6]
                }}
                transition={{ 
                  rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                  opacity: { duration: twinkleDuration, repeat: Infinity }
                }}
              />
            ))}
          </>
        );
        
      case 'nebula':
        return (
          <>
            {/* Gaseous clouds with chromatic effect */}
            {[...Array(8)].map((_, i) => {
              const randSize = 3 + Math.random() * 4;
              const randX = 1 + Math.random() * 4;
              const randY = 1 + Math.random() * 4;
              const colorChoice = [colors.primary, colors.secondary, colors.tertiary][i % 3];
              return (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: size * randSize,
                    height: size * randSize,
                    left: size * randX,
                    top: size * randY,
                    background: `radial-gradient(circle at ${30 + i * 5}% ${40 + i * 3}%, 
                      ${colorChoice}90 0%,
                      ${colorChoice}60 30%,
                      ${colorChoice}30 60%,
                      transparent 100%)`,
                    filter: `blur(${10 + i}px)`,
                    mixBlendMode: 'screen',
                  }}
                  animate={{ 
                    opacity: [0.3, 0.8, 0.3],
                    scale: [0.8, 1.3, 0.8],
                    x: [0, (Math.random() - 0.5) * size * 2, 0],
                    y: [0, (Math.random() - 0.5) * size * 2, 0],
                  }}
                  transition={{ duration: 4 + i * 0.5, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
                />
              );
            })}
            {/* Dust particles */}
            {[...Array(15)].map((_, i) => (
              <motion.div
                key={`dust-${i}`}
                className="absolute rounded-full"
                style={{
                  width: 2,
                  height: 2,
                  left: size * (1 + Math.random() * 6),
                  top: size * (1 + Math.random() * 6),
                  background: colors.primary,
                  filter: 'blur(0.5px)',
                  boxShadow: `0 0 4px ${colors.primary}`,
                }}
                animate={{ 
                  opacity: [0.3, 1, 0.3],
                  scale: [0.5, 1.5, 0.5]
                }}
                transition={{ duration: 2 + Math.random(), repeat: Infinity, delay: Math.random() * 2 }}
              />
            ))}
          </>
        );
        
      case 'pulsar':
        return (
          <>
            {/* Electromagnetic rings */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: size * (3 + i * 1.5),
                  height: size * (3 + i * 1.5),
                  left: size * (2.5 - i * 0.75),
                  top: size * (2.5 - i * 0.75),
                  border: `${4 - i * 0.5}px solid ${colors.primary}`,
                  filter: `blur(${1 + i * 0.5}px)`,
                  boxShadow: `0 0 ${size * (2 + i)}px ${colors.glow}, inset 0 0 ${size}px ${colors.primary}30`,
                }}
                animate={{ 
                  opacity: [0, 0.9, 0],
                  scale: [0.3, 1.8, 1.8]
                }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.25, ease: "easeOut" }}
              />
            ))}
            {/* Beam poles */}
            {[0, 180].map((angle, idx) => (
              <motion.div
                key={`beam-${idx}`}
                className="absolute"
                style={{
                  width: 2,
                  height: size * 5,
                  left: size * 4,
                  top: -size * 0.5,
                  background: `linear-gradient(180deg, ${colors.primary}80, transparent, transparent, ${colors.primary}80)`,
                  transformOrigin: `50% ${size * 4}px`,
                  transform: `rotate(${angle}deg)`,
                  filter: 'blur(1px)',
                  boxShadow: `0 0 ${size}px ${colors.glow}`,
                }}
                animate={{ 
                  opacity: [0.5, 1, 0.5],
                  scaleY: [0.9, 1.1, 0.9]
                }}
                transition={{ duration: 1.5, repeat: Infinity, delay: idx * 0.75 }}
              />
            ))}
          </>
        );
        
      case 'binary':
        return (
          <>
            {/* First star */}
            <motion.div className="absolute" style={{ width: size * 3.5, height: size * 3.5 }}>
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle, white, ${colors.primary}, ${colors.secondary}60, transparent)`,
                  filter: 'blur(4px)',
                  boxShadow: `0 0 ${size * 3}px ${colors.glow}`,
                }}
                animate={{ x: [size * 1.5, size * 3.5, size * 1.5], opacity: [0.9, 1, 0.9] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${colors.primary}, transparent)`,
                  filter: 'blur(2px)',
                }}
                animate={{ x: [size * 1.5, size * 3.5, size * 1.5], scale: [1, 1.2, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
            {/* Second star */}
            <motion.div className="absolute" style={{ width: size * 3, height: size * 3 }}>
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle, white, ${colors.tertiary}, ${colors.accent}60, transparent)`,
                  filter: 'blur(4px)',
                  boxShadow: `0 0 ${size * 2.5}px ${colors.accent}`,
                }}
                animate={{ x: [size * 4, size * 2, size * 4], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${colors.tertiary}, transparent)`,
                  filter: 'blur(2px)',
                }}
                animate={{ x: [size * 4, size * 2, size * 4], scale: [1, 1.15, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
            {/* Gravitational bridge */}
            <motion.div
              className="absolute"
              style={{
                width: size * 5,
                height: 1,
                left: size * 1.5,
                top: size * 4,
                background: `linear-gradient(90deg, ${colors.primary}60, ${colors.tertiary}80, ${colors.primary}60)`,
                filter: 'blur(2px)',
              }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </>
        );
        
      default: // classic
        return (
          <>
            {/* Chromatic aberration layers */}
            <motion.div 
              className="absolute rounded-full"
              style={{ 
                width: size * 7,
                height: size * 7,
                left: size * 0.5,
                top: size * 0.5,
                background: `radial-gradient(circle, ${colors.primary}40 0%, transparent 70%)`,
                filter: 'blur(6px)',
                mixBlendMode: 'screen',
              }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: twinkleDuration, repeat: Infinity, delay: pulseDelay }}
            />
            {/* Diffraction spikes */}
            {[0, 45, 90, 135].map((angle, idx) => (
              <motion.div
                key={idx}
                className="absolute"
                style={{
                  width: 2,
                  height: size * 6 * intensity,
                  left: size * 4 - 1,
                  top: size * 4 - (size * 3 * intensity),
                  background: `linear-gradient(180deg, transparent, ${colors.secondary}60, ${colors.primary}, ${colors.secondary}60, transparent)`,
                  transformOrigin: `50% ${size * 3 * intensity}px`,
                  transform: `rotate(${angle}deg)`,
                  filter: 'blur(1px)',
                  boxShadow: `0 0 ${size}px ${colors.glow}40`,
                }}
                animate={{ 
                  opacity: [0.4, 0.9, 0.4],
                  scaleY: [0.9, 1.1, 0.9]
                }}
                transition={{ duration: twinkleDuration, repeat: Infinity, delay: pulseDelay + idx * 0.1 }}
              />
            ))}
          </>
        );
    }
  };

  return (
    <motion.div 
      className="relative cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: size * 8, height: size * 8 }}
    >
      {/* Outer halo with chromatic aberration */}
      <motion.div 
        className="absolute rounded-full"
        style={{ 
          width: size * 12 * intensity,
          height: size * 12 * intensity,
          left: size * (4 - 1.5 * intensity),
          top: size * (4 - 1.5 * intensity),
          background: `radial-gradient(circle, ${colors.glow}20 0%, ${colors.tertiary}15 40%, transparent 70%)`,
          filter: 'blur(20px)',
        }}
        animate={{ 
          opacity: [0.2, 0.5, 0.2],
          scale: [0.95, 1.15, 0.95]
        }}
        transition={{ duration: twinkleDuration * 1.5, repeat: Infinity, delay: pulseDelay }}
      />
      
      {/* Secondary glow ring */}
      <motion.div 
        className="absolute rounded-full"
        style={{ 
          width: size * 9 * intensity,
          height: size * 9 * intensity,
          left: size * (4 - 1.125 * intensity),
          top: size * (4 - 1.125 * intensity),
          background: `radial-gradient(circle, ${colors.secondary}40 0%, ${colors.tertiary}30 50%, transparent 75%)`,
          filter: 'blur(12px)',
          boxShadow: `0 0 ${size * 3}px ${colors.glow}30`,
        }}
        animate={{ 
          opacity: [0.4, 0.8, 0.4],
          scale: [0.9, 1.1, 0.9]
        }}
        transition={{ duration: twinkleDuration, repeat: Infinity, delay: pulseDelay + 0.2 }}
      />
      
      {/* Pattern layer */}
      {renderStarPattern()}
      
      {/* Inner luminosity */}
      <motion.div 
        className="absolute rounded-full"
        style={{ 
          width: size * 6,
          height: size * 6,
          left: size,
          top: size,
          background: `radial-gradient(circle, 
            white 0%,
            ${colors.primary} 20%,
            ${colors.secondary} 50%,
            ${colors.tertiary}60 75%,
            transparent 100%)`,
          filter: 'blur(6px)',
          boxShadow: `0 0 ${size * 4}px ${colors.glow}, inset 0 0 ${size * 2}px white`,
        }}
        animate={{ 
          opacity: [0.6, 1, 0.6],
          scale: [0.95, 1.05, 0.95]
        }}
        transition={{ duration: twinkleDuration * 0.8, repeat: Infinity, delay: pulseDelay + 0.1 }}
      />
      
      {/* Core brilliance */}
      <motion.div 
        className="absolute rounded-full"
        style={{ 
          width: size * 3.5 * intensity,
          height: size * 3.5 * intensity,
          left: size * (4 - 0.875 * intensity),
          top: size * (4 - 0.875 * intensity),
          background: `radial-gradient(circle, 
            white 0%,
            white 20%,
            ${colors.primary} 50%,
            ${colors.secondary} 80%,
            transparent 100%)`,
          filter: 'blur(3px)',
          boxShadow: `0 0 ${size * 5 * intensity}px ${colors.primary}, 0 0 ${size * 3 * intensity}px white`,
        }}
        animate={{ 
          opacity: [0.95, 1, 0.95],
          scale: isHovered ? [1.4, 1.6, 1.4] : [1, 1.15, 1]
        }}
        transition={{ duration: twinkleDuration * 0.5, repeat: Infinity, delay: pulseDelay + 0.3 }}
      />

      {/* Central white point */}
      <motion.div 
        className="absolute rounded-full"
        style={{ 
          width: size * 1.5,
          height: size * 1.5,
          left: size * 3.25,
          top: size * 3.25,
          background: 'white',
          filter: 'blur(0.5px)',
          boxShadow: `0 0 ${size * 4}px white, 0 0 ${size * 2}px ${colors.primary}`,
        }}
        animate={{ 
          opacity: [0.95, 1, 0.95],
          scale: isHovered ? [1.5, 2, 1.5] : [1, 1.3, 1]
        }}
        transition={{ duration: twinkleDuration * 0.3, repeat: Infinity, delay: pulseDelay + 0.4 }}
      />

      {data.is_deceased && (
        <div className="absolute inset-0 rounded-full backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.65)' }} />
      )}

      <AnimatePresence>
        {(isHovered || selected) && (
          <motion.div 
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-50"
            style={{ top: size * 8 + 12 }}
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            transition={{ type: "spring", damping: 20 }}
          >
            <div className="px-4 py-2 rounded-xl glass-card border-2 border-amber-400/60 shadow-2xl backdrop-blur-lg">
              <p className="text-sm font-bold text-slate-50 drop-shadow-lg">{data.name}</p>
              {data.nickname && <p className="text-xs text-amber-300 drop-shadow">"{data.nickname}"</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const nodeTypes = {
  person: PersonNode,
};

export default function FamilyConstellation({ people, households, relationships }) {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [hoveredPerson, setHoveredPerson] = useState(null);

  // Create beautiful constellation patterns
  const initialNodes = useMemo(() => {
    const householdGroups = {};
    
    // Group people by household
    people.forEach(person => {
      const householdId = person.household_id || 'unassigned';
      if (!householdGroups[householdId]) {
        householdGroups[householdId] = [];
      }
      householdGroups[householdId].push(person);
    });

    const nodes = [];
    const viewportWidth = 1600;
    const viewportHeight = 900;
    const totalGroups = Object.keys(householdGroups).length;

    // Create organic constellation clusters
    Object.entries(householdGroups).forEach(([householdId, groupPeople], groupIndex) => {
      // Position household clusters in a spiral galaxy pattern
      const spiralAngle = groupIndex * 1.618 * Math.PI; // Golden angle
      const spiralRadius = 200 + groupIndex * 150;
      
      const clusterCenterX = viewportWidth / 2 + Math.cos(spiralAngle) * spiralRadius;
      const clusterCenterY = viewportHeight / 2 + Math.sin(spiralAngle) * spiralRadius;

      // Create constellation shape for each household
      groupPeople.forEach((person, index) => {
        let x, y;
        
        if (groupPeople.length === 1) {
          // Single star
          x = clusterCenterX;
          y = clusterCenterY;
        } else if (groupPeople.length === 2) {
          // Binary star system
          const offset = 80;
          x = clusterCenterX + (index === 0 ? -offset : offset);
          y = clusterCenterY;
        } else if (groupPeople.length <= 5) {
          // Pentagon/circular pattern
          const angle = (index / groupPeople.length) * Math.PI * 2 - Math.PI / 2;
          const radius = 100;
          x = clusterCenterX + Math.cos(angle) * radius;
          y = clusterCenterY + Math.sin(angle) * radius;
        } else {
          // Larger families: concentric rings
          const ring = Math.floor(index / 6);
          const posInRing = index % 6;
          const totalInRing = Math.min(6, groupPeople.length - ring * 6);
          const angle = (posInRing / totalInRing) * Math.PI * 2;
          const radius = 100 + ring * 80;
          x = clusterCenterX + Math.cos(angle) * radius;
          y = clusterCenterY + Math.sin(angle) * radius;
        }
        
        // Add slight organic variation
        x += (Math.random() - 0.5) * 30;
        y += (Math.random() - 0.5) * 30;
        
        nodes.push({
          id: person.id,
          type: 'person',
          data: { ...person, householdIndex: groupIndex },
          position: { x, y },
        });
      });
    });

    return nodes;
  }, [people, households]);

  // Always show constellation lines between household members and relationships
  const initialEdges = useMemo(() => {
    const edges = [];
    
    // Create household constellation lines (always visible)
    const householdGroups = {};
    people.forEach(person => {
      const householdId = person.household_id || 'unassigned';
      if (!householdGroups[householdId]) {
        householdGroups[householdId] = [];
      }
      householdGroups[householdId].push(person);
    });
    
    Object.values(householdGroups).forEach(groupPeople => {
      if (groupPeople.length > 1) {
        // Connect household members with subtle lines
        for (let i = 0; i < groupPeople.length; i++) {
          for (let j = i + 1; j < groupPeople.length; j++) {
            edges.push({
              id: `household-${groupPeople[i].id}-${groupPeople[j].id}`,
              source: groupPeople[i].id,
              target: groupPeople[j].id,
              type: 'straight',
              style: {
                stroke: '#475569',
                strokeWidth: 1,
                opacity: hoveredPerson === groupPeople[i].id || hoveredPerson === groupPeople[j].id ? 0.4 : 0.15,
              },
            });
          }
        }
      }
    });
    
    // Add relationship lines (highlighted on hover)
    relationships.forEach((rel, index) => {
      const isHovered = hoveredPerson === rel.person_id || hoveredPerson === rel.related_person_id;
      
      const getEdgeStyle = (relType) => {
        switch(relType) {
          case 'spouse':
            return { stroke: '#f472b6', strokeWidth: 3, animated: true };
          case 'parent':
          case 'child':
            return { stroke: '#fcd34d', strokeWidth: 2.5, animated: true };
          case 'sibling':
            return { stroke: '#c084fc', strokeWidth: 2.5, animated: true };
          default:
            return { stroke: '#60a5fa', strokeWidth: 2, animated: true };
        }
      };

      const style = getEdgeStyle(rel.relationship_type);

      edges.push({
        id: `rel-${index}`,
        source: rel.person_id,
        target: rel.related_person_id,
        type: 'smoothstep',
        style: {
          ...style,
          opacity: isHovered ? 0.8 : 0.3,
        },
        animated: isHovered,
      });
    });

    return edges;
  }, [relationships, hoveredPerson, people]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update edges when hoveredPerson changes
  useEffect(() => {
    setEdges(initialEdges);
  }, [hoveredPerson, initialEdges, setEdges]);

  const onNodeClick = (event, node) => {
    if (node.type === 'person') {
      setSelectedPerson(node.data);
    }
  };

  const onNodeMouseEnter = (event, node) => {
    if (node.type === 'person') {
      setHoveredPerson(node.id);
    }
  };

  const onNodeMouseLeave = () => {
    setHoveredPerson(null);
  };

  return (
    <div className="fixed inset-0 z-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        style={{
          background: 'transparent',
        }}
        proOptions={{ hideAttribution: true }}
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnDoubleClick={true}
        panOnDrag={true}
      >
        <Background 
          color="#475569" 
          gap={60} 
          size={0.5}
          style={{ opacity: 0.05 }}
        />
      </ReactFlow>

      {/* Person Detail Card */}
      <AnimatePresence>
        {selectedPerson && (
          <motion.div 
            className="fixed top-1/2 left-1/2 z-50 w-96"
            initial={{ opacity: 0, scale: 0.8, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.8, x: '-50%', y: '-50%' }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-card rounded-2xl p-6 border-2 border-amber-500/30 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                  {selectedPerson.photo_url ? (
                    <img src={selectedPerson.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-medium text-slate-400">
                      {selectedPerson.name?.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-100">{selectedPerson.name}</h3>
                  {selectedPerson.nickname && (
                    <p className="text-sm text-slate-400">"{selectedPerson.nickname}"</p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedPerson(null)}
                className="text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500">Role:</span>
                <span className="text-slate-200 ml-2 capitalize">{selectedPerson.role_type}</span>
              </div>
              
              {selectedPerson.birth_date && (
                <div>
                  <span className="text-slate-500">Birth Date:</span>
                  <span className="text-slate-200 ml-2">{selectedPerson.birth_date}</span>
                </div>
              )}

              {selectedPerson.about && (
                <div>
                  <p className="text-slate-500 mb-1">About:</p>
                  <p className="text-slate-300">{selectedPerson.about}</p>
                </div>
              )}

              {selectedPerson.is_deceased && (
                <div className="pt-2 border-t border-slate-700">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Star className="w-4 h-4" />
                    <span className="text-sm">In loving memory</span>
                  </div>
                </div>
              )}
              </div>
              </div>
              </motion.div>
              )}
              </AnimatePresence>

      {/* Click to dismiss overlay */}
      <AnimatePresence>
        {selectedPerson && (
          <motion.div 
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPerson(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}