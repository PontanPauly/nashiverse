import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";

const patterns = [
  { value: 'classic', label: 'Classic', desc: 'Simple radiant star' },
  { value: 'burst', label: 'Burst', desc: 'Multiple light rays' },
  { value: 'diamond', label: 'Diamond', desc: 'Crystalline shape' },
  { value: 'cross', label: 'Cross', desc: 'Four-pointed cross' },
  { value: 'spiral', label: 'Spiral', desc: 'Rotating spiral arms' },
  { value: 'nebula', label: 'Nebula', desc: 'Cloudy gas effect' },
  { value: 'pulsar', label: 'Pulsar', desc: 'Pulsing rings' },
  { value: 'binary', label: 'Binary', desc: 'Twin stars orbiting' },
];

export default function StarCustomizer({ person, onSave, onCancel }) {
  const [config, setConfig] = useState({
    star_pattern: person.star_pattern || 'classic',
    star_intensity: person.star_intensity || 5,
    star_flare_count: person.star_flare_count || 8,
  });

  const handleSave = () => {
    onSave(config);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 mb-3">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-amber-300">Customize Your Star</span>
        </div>
        <p className="text-sm text-slate-400">Make your constellation presence unique</p>
      </div>

      {/* Pattern Selection */}
      <div className="space-y-2">
        <Label className="text-slate-300">Star Pattern</Label>
        <Select value={config.star_pattern} onValueChange={(value) => setConfig({...config, star_pattern: value})}>
          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            {patterns.map(p => (
              <SelectItem key={p.value} value={p.value}>
                <div>
                  <div className="font-medium text-slate-100">{p.label}</div>
                  <div className="text-xs text-slate-500">{p.desc}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Intensity */}
      <div className="space-y-3">
        <div className="flex justify-between">
          <Label className="text-slate-300">Brightness</Label>
          <span className="text-sm text-amber-400">{config.star_intensity}/10</span>
        </div>
        <Slider
          value={[config.star_intensity]}
          onValueChange={(val) => setConfig({...config, star_intensity: val[0]})}
          min={1}
          max={10}
          step={1}
          className="[&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-amber-500"
        />
      </div>

      {/* Flare Count */}
      <div className="space-y-3">
        <div className="flex justify-between">
          <Label className="text-slate-300">Light Rays</Label>
          <span className="text-sm text-amber-400">{config.star_flare_count}</span>
        </div>
        <Slider
          value={[config.star_flare_count]}
          onValueChange={(val) => setConfig({...config, star_flare_count: val[0]})}
          min={4}
          max={16}
          step={1}
          className="[&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-amber-500"
        />
      </div>

      {/* Preview hint */}
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <p className="text-xs text-slate-400 text-center">
          Your star will appear in the constellation view with these settings
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
        <Button variant="ghost" onClick={onCancel} className="text-slate-200 hover:bg-slate-700">
          Cancel
        </Button>
        <Button onClick={handleSave} className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
          <Sparkles className="w-4 h-4 mr-2" />
          Save Star
        </Button>
      </div>
    </div>
  );
}