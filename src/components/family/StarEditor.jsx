import React, { useState, useMemo, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Star as StarIcon, Shuffle, Check } from "lucide-react";
import Star from "@/components/constellation/Star";
import {
  COLOR_PALETTES,
  DEFAULT_STAR_PROFILE,
  generateRandomStarProfile,
} from "@/lib/starConfig";

const STAR_TYPES = [
  { id: 'classic', name: 'Classic', desc: 'Radiant point star' },
  { id: 'nova', name: 'Nova', desc: 'Explosive burst' },
  { id: 'crystal', name: 'Crystal', desc: 'Faceted gem' },
  { id: 'nebula', name: 'Nebula', desc: 'Cloudy gas' },
];

const TWINKLE_PRESETS = [
  { id: 'steady', name: 'Steady', glowStyle: 'soft-halo', animation: 'steady', size: 'standard' },
  { id: 'gentle', name: 'Gentle', glowStyle: 'soft-halo', animation: 'gentle-pulse', size: 'standard' },
  { id: 'twinkle', name: 'Twinkle', glowStyle: 'sparkle', animation: 'twinkle', size: 'standard' },
  { id: 'vivid', name: 'Vivid', glowStyle: 'flame', animation: 'dancing', size: 'grand' },
];

function getTwinklePresetId(profile) {
  for (const preset of TWINKLE_PRESETS) {
    if (profile.animation === preset.animation) return preset.id;
  }
  return 'gentle';
}

function StarPreview({ starProfile }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 2], fov: 50 }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.1} />
      <Suspense fallback={null}>
        <Star
          position={[0, 0, 0]}
          starProfile={starProfile}
          personId="preview"
          onClick={() => {}}
          onPointerOver={() => {}}
          onPointerOut={() => {}}
        />
      </Suspense>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
}

function ColorSwatch({ color, isSelected, onClick, name }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative w-10 h-10 rounded-lg transition-all duration-200
        ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-105'}
      `}
      style={{
        background: `linear-gradient(135deg, ${color.primary} 0%, ${color.secondary} 100%)`,
        boxShadow: isSelected ? `0 0 20px ${color.glow}60` : `0 0 10px ${color.glow}30`,
      }}
      title={name}
    >
      {isSelected && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Check className="w-4 h-4 text-white drop-shadow-lg" />
        </div>
      )}
    </button>
  );
}

function OptionButton({ isSelected, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
        ${isSelected 
          ? 'bg-amber-500/20 text-amber-300 border-2 border-amber-500/50 shadow-lg shadow-amber-500/10' 
          : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-300'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}

export default function StarEditor({ value, onChange }) {
  const [starProfile, setStarProfile] = useState(() => ({
    ...DEFAULT_STAR_PROFILE,
    ...value,
  }));

  const updateProfile = (updates) => {
    const newProfile = { ...starProfile, ...updates };
    setStarProfile(newProfile);
    onChange?.(newProfile);
  };

  const handleRandomize = () => {
    const randomProfile = generateRandomStarProfile();
    setStarProfile(randomProfile);
    onChange?.(randomProfile);
  };

  const colorOptions = useMemo(() => Object.values(COLOR_PALETTES), []);
  const currentTwinkle = getTwinklePresetId(starProfile);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/10 to-violet-500/10 border border-amber-500/30 mb-3">
          <StarIcon className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium bg-gradient-to-r from-amber-300 to-violet-300 bg-clip-text text-transparent">
            Design Your Star
          </span>
        </div>
      </div>

      <div className="relative h-48 rounded-xl overflow-hidden border border-slate-700/50">
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, #1e1b4b 0%, #0f0a1f 50%, #030014 100%)',
          }}
        />
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              radial-gradient(1px 1px at 20% 30%, white, transparent),
              radial-gradient(1px 1px at 40% 70%, white, transparent),
              radial-gradient(0.5px 0.5px at 60% 20%, white, transparent),
              radial-gradient(0.5px 0.5px at 80% 60%, white, transparent),
              radial-gradient(0.5px 0.5px at 10% 80%, white, transparent),
              radial-gradient(0.5px 0.5px at 90% 40%, white, transparent)
            `,
            backgroundSize: '100% 100%',
          }}
        />
        <StarPreview starProfile={starProfile} />
        <div className="absolute bottom-2 left-0 right-0 text-center">
          <span className="text-xs text-slate-500 bg-slate-900/50 px-2 py-1 rounded-full">
            Live Preview
          </span>
        </div>
      </div>

      <div className="flex justify-center">
        <Button
          type="button"
          onClick={handleRandomize}
          variant="outline"
          className="border-violet-500/50 text-violet-300 hover:bg-violet-500/10 hover:border-violet-500"
        >
          <Shuffle className="w-4 h-4 mr-2" />
          Randomize
        </Button>
      </div>

      <Card className="bg-slate-800/30 border-slate-700/50">
        <CardContent className="p-4 space-y-5">
          <div className="space-y-3">
            <Label className="text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Star Type
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {STAR_TYPES.map((type) => (
                <OptionButton
                  key={type.id}
                  isSelected={starProfile.shape === type.id}
                  onClick={() => updateProfile({ shape: type.id })}
                >
                  {type.name}
                </OptionButton>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Color
            </Label>
            <div className="flex flex-wrap gap-2 justify-center p-3 rounded-lg bg-slate-900/50">
              {colorOptions.map((color) => (
                <ColorSwatch
                  key={color.id}
                  color={color}
                  name={color.name}
                  isSelected={starProfile.colorPalette === color.id}
                  onClick={() => updateProfile({ colorPalette: color.id, customColor: null })}
                />
              ))}
            </div>
            <p className="text-xs text-center text-slate-500">
              {COLOR_PALETTES[starProfile.colorPalette]?.name || 'Select a color'}
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              Brightness
            </Label>
            <div className="flex items-center gap-3 px-1">
              <span className="text-xs text-slate-500 w-8">Dim</span>
              <input
                type="range"
                min="0.3"
                max="1.0"
                step="0.05"
                value={starProfile.brightness}
                onChange={(e) => updateProfile({ brightness: parseFloat(e.target.value) })}
                className="flex-1 accent-amber-400 h-2"
              />
              <span className="text-xs text-slate-500 w-10 text-right">Bright</span>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Twinkle
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {TWINKLE_PRESETS.map((preset) => (
                <OptionButton
                  key={preset.id}
                  isSelected={currentTwinkle === preset.id}
                  onClick={() => updateProfile({
                    glowStyle: preset.glowStyle,
                    animation: preset.animation,
                    size: preset.size,
                  })}
                >
                  {preset.name}
                </OptionButton>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
