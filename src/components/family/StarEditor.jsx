import React, { useState, useMemo, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Sparkles, Shuffle, Check } from "lucide-react";
import Star from "@/components/constellation/Star";
import {
  CORE_SHAPES,
  COLOR_PALETTES,
  DEFAULT_STAR_PROFILE,
  generateRandomStarProfile,
} from "@/lib/starConfig";

function StarPreview({ starProfile }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3], fov: 50 }}
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
        autoRotateSpeed={0.3}
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
        background: `radial-gradient(circle at 30% 30%, ${color.glow} 0%, ${color.primary} 40%, ${color.secondary} 100%)`,
        boxShadow: isSelected ? `0 0 20px ${color.glow}80` : `0 0 10px ${color.glow}40`,
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

function ShapeButton({ shape, isSelected, onClick }) {
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
      `}
    >
      {shape.name}
    </button>
  );
}

export default function StarEditor({ value, onChange }) {
  const [starProfile, setStarProfile] = useState(() => ({
    ...DEFAULT_STAR_PROFILE,
    ...value,
  }));

  const shapes = useMemo(() => Object.values(CORE_SHAPES), []);
  const colorPalettes = useMemo(() => Object.values(COLOR_PALETTES), []);

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

  const energyLabel = useMemo(() => {
    if (starProfile.energy < 0.3) return "Calm";
    if (starProfile.energy < 0.5) return "Gentle";
    if (starProfile.energy < 0.7) return "Lively";
    return "Energetic";
  }, [starProfile.energy]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-amber-400">
        <Sparkles className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Design Your Star</h3>
      </div>

      <p className="text-sm text-slate-400">
        Create a unique star that represents you in the constellation
      </p>

      <div className="h-56 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50">
        <StarPreview starProfile={starProfile} />
        <div className="text-center text-xs text-slate-500 -mt-6 pb-2">
          Live Preview • Drag to rotate
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleRandomize}
        className="w-full bg-slate-800/50 border-slate-700 hover:bg-slate-700/50"
      >
        <Shuffle className="w-4 h-4 mr-2" />
        Randomize
      </Button>

      <div className="space-y-3">
        <Label className="text-slate-300">Star Style</Label>
        <div className="flex flex-wrap gap-2">
          {shapes.map((shape) => (
            <ShapeButton
              key={shape.id}
              shape={shape}
              isSelected={starProfile.shape === shape.id}
              onClick={() => updateProfile({ shape: shape.id })}
            />
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {CORE_SHAPES[starProfile.shape]?.description || 'Traditional radiant star'}
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-slate-300">Color Palette</Label>
        <div className="grid grid-cols-6 gap-2">
          {colorPalettes.map((palette) => (
            <ColorSwatch
              key={palette.id}
              color={palette}
              name={palette.name}
              isSelected={starProfile.colorPalette === palette.id}
              onClick={() => updateProfile({ colorPalette: palette.id })}
            />
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {COLOR_PALETTES[starProfile.colorPalette]?.name || 'Celestial Blue'}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-slate-300">Energy Level</Label>
          <span className="text-sm text-amber-400 font-medium">{energyLabel}</span>
        </div>
        <Slider
          value={[starProfile.energy * 100]}
          onValueChange={([val]) => updateProfile({ energy: val / 100 })}
          max={100}
          min={0}
          step={5}
          className="py-2"
        />
        <p className="text-xs text-slate-500">
          Affects how animated and vibrant your star appears
        </p>
      </div>
    </div>
  );
}
