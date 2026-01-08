import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X, Plus, AlertCircle, Upload, Sparkles } from "lucide-react";
import StarCustomizer from "./StarCustomizer";

export default function PersonForm({ person, households, people, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    name: person?.name || "",
    nickname: person?.nickname || "",
    birth_date: person?.birth_date || "",
    birth_year: person?.birth_year || "",
    role_type: person?.role_type || "adult",
    is_deceased: person?.is_deceased || false,
    death_date: person?.death_date || "",
    household_id: person?.household_id || "",
    guardian_ids: person?.guardian_ids || [],
    photo_url: person?.photo_url || "",
    allergies: person?.allergies || [],
    dietary_preferences: person?.dietary_preferences || [],
    medical_notes: person?.medical_notes || "",
    about: person?.about || "",
    star_pattern: person?.star_pattern || "classic",
    star_intensity: person?.star_intensity || 5,
    star_flare_count: person?.star_flare_count || 8,
  });
  
  const [newAllergy, setNewAllergy] = useState("");
  const [newDietPref, setNewDietPref] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showStarCustomizer, setShowStarCustomizer] = useState(false);

  // Relationship state
  const [parentIds, setParentIds] = useState([]);
  const [partnerId, setPartnerId] = useState("");
  const [childrenIds, setChildrenIds] = useState([]);
  const [relationships, setRelationships] = useState([]);

  // Load relationships when editing
  React.useEffect(() => {
    if (person?.id) {
      loadRelationships();
    }
  }, [person?.id]);

  const loadRelationships = async () => {
    const rels = await base44.entities.Relationship.filter({ person_id: person.id });
    const rels2 = await base44.entities.Relationship.filter({ related_person_id: person.id });
    setRelationships([...rels, ...rels2]);

    // Extract parents (where person is child)
    const parents = rels2.filter(r => r.relationship_type === 'parent').map(r => r.person_id);
    setParentIds(parents);

    // Extract partner
    const partner = rels.find(r => r.relationship_type === 'partner');
    if (partner) setPartnerId(partner.related_person_id);

    // Extract children (where person is parent)
    const children = rels.filter(r => r.relationship_type === 'parent').map(r => r.related_person_id);
    setChildrenIds(children);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dataToSave = {
      ...formData,
      birth_year: formData.birth_year ? Number(formData.birth_year) : null,
    };

    let personId = person?.id;
    if (person?.id) {
      await base44.entities.Person.update(person.id, dataToSave);
    } else {
      const newPerson = await base44.entities.Person.create(dataToSave);
      personId = newPerson.id;
    }

    // Save relationships
    if (personId) {
      await saveRelationships(personId);
    }

    setLoading(false);
    onSuccess();
  };

  const saveRelationships = async (personId) => {
    // Get existing relationships
    const existing = await base44.entities.Relationship.filter({ person_id: personId });
    const existing2 = await base44.entities.Relationship.filter({ related_person_id: personId });
    const allExisting = [...existing, ...existing2];

    // Handle parents - create parent->child relationships
    const existingParents = allExisting.filter(r => r.relationship_type === 'parent' && r.related_person_id === personId);
    const existingParentIds = existingParents.map(r => r.person_id);

    // Remove old parents
    for (const parentId of existingParentIds) {
      if (!parentIds.includes(parentId)) {
        const rel = existingParents.find(r => r.person_id === parentId);
        if (rel) await base44.entities.Relationship.delete(rel.id);
      }
    }

    // Add new parents
    for (const parentId of parentIds) {
      if (!existingParentIds.includes(parentId)) {
        await base44.entities.Relationship.create({
          person_id: parentId,
          related_person_id: personId,
          relationship_type: 'parent'
        });
      }
    }

    // Handle partner
    const existingPartner = allExisting.find(r => r.relationship_type === 'partner' && 
      (r.person_id === personId || r.related_person_id === personId));

    if (existingPartner && !partnerId) {
      await base44.entities.Relationship.delete(existingPartner.id);
    } else if (partnerId && (!existingPartner || 
      (existingPartner.person_id !== partnerId && existingPartner.related_person_id !== partnerId))) {
      if (existingPartner) await base44.entities.Relationship.delete(existingPartner.id);
      await base44.entities.Relationship.create({
        person_id: personId,
        related_person_id: partnerId,
        relationship_type: 'partner'
      });
    }
  };

  const addParent = (parentId) => {
    if (!parentIds.includes(parentId) && parentId !== person?.id) {
      setParentIds([...parentIds, parentId]);
    }
  };

  const removeParent = (parentId) => {
    setParentIds(parentIds.filter(id => id !== parentId));
  };

  const addChild = async (childId) => {
    if (person?.id && childId !== person.id) {
      await base44.entities.Relationship.create({
        person_id: person.id,
        related_person_id: childId,
        relationship_type: 'parent'
      });
      await loadRelationships();
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFormData({ ...formData, photo_url: file_url });
    setUploading(false);
  };

  const addAllergy = () => {
    if (newAllergy.trim()) {
      setFormData({
        ...formData,
        allergies: [...formData.allergies, newAllergy.trim()]
      });
      setNewAllergy("");
    }
  };

  const removeAllergy = (index) => {
    setFormData({
      ...formData,
      allergies: formData.allergies.filter((_, i) => i !== index)
    });
  };

  const addDietPref = () => {
    if (newDietPref.trim()) {
      setFormData({
        ...formData,
        dietary_preferences: [...formData.dietary_preferences, newDietPref.trim()]
      });
      setNewDietPref("");
    }
  };

  const removeDietPref = (index) => {
    setFormData({
      ...formData,
      dietary_preferences: formData.dietary_preferences.filter((_, i) => i !== index)
    });
  };

  const adultPeople = people.filter(p => p.role_type === 'adult' && p.id !== person?.id);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Photo */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-slate-700">
          {formData.photo_url ? (
            <img src={formData.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl text-slate-500">{formData.name?.charAt(0) || "?"}</span>
          )}
        </div>
        <div>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            <Button type="button" variant="outline" size="sm" className="border-amber-500/50 text-slate-100 hover:bg-amber-500/10 hover:border-amber-500" disabled={uploading}>
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Uploading..." : "Upload Photo"}
            </Button>
          </label>
        </div>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Full Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="bg-slate-800 border-slate-700 text-slate-100"
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Nickname</Label>
          <Input
            value={formData.nickname}
            onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
            className="bg-slate-800 border-slate-700 text-slate-100"
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Role Type *</Label>
          <Select value={formData.role_type} onValueChange={(value) => setFormData({ ...formData, role_type: value })}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="adult">Adult</SelectItem>
              <SelectItem value="teen">Teen</SelectItem>
              <SelectItem value="child">Child</SelectItem>
              <SelectItem value="ancestor">Ancestor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Household</Label>
          <Select 
            value={formData.household_id || "none"} 
            onValueChange={(value) => setFormData({ ...formData, household_id: value === "none" ? "" : value })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue placeholder="Select household" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="none">No household</SelectItem>
              {households.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Birth Date</Label>
          <Input
            type="date"
            value={formData.birth_date}
            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
            className="bg-slate-800 border-slate-700 text-slate-100"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Or Birth Year</Label>
          <Input
            type="number"
            value={formData.birth_year}
            onChange={(e) => setFormData({ ...formData, birth_year: e.target.value })}
            className="bg-slate-800 border-slate-700 text-slate-100"
            placeholder="e.g., 1985"
          />
        </div>
      </div>

      {/* Deceased toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
        <div>
          <Label className="text-slate-300">Deceased</Label>
          <p className="text-sm text-slate-500">Mark if this person has passed away</p>
        </div>
        <Switch
          checked={formData.is_deceased}
          onCheckedChange={(checked) => setFormData({ ...formData, is_deceased: checked })}
        />
      </div>

      {formData.is_deceased && (
        <div className="space-y-2">
          <Label className="text-slate-300">Date of Passing</Label>
          <Input
            type="date"
            value={formData.death_date}
            onChange={(e) => setFormData({ ...formData, death_date: e.target.value })}
            className="bg-slate-800 border-slate-700 text-slate-100"
          />
        </div>
      )}

      {/* Guardians for children/teens */}
      {(formData.role_type === 'child' || formData.role_type === 'teen') && (
        <div className="space-y-2">
          <Label className="text-slate-300">Guardian(s)</Label>
          <Select 
            value="" 
            onValueChange={(value) => {
              if (!formData.guardian_ids.includes(value)) {
                setFormData({ ...formData, guardian_ids: [...formData.guardian_ids, value] });
              }
            }}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue placeholder="Add guardian" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {adultPeople.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.guardian_ids.map((gId) => {
              const guardian = people.find(p => p.id === gId);
              return (
                <Badge key={gId} className="bg-slate-700 text-slate-200">
                  {guardian?.name || gId}
                  <button type="button" onClick={() => setFormData({
                    ...formData,
                    guardian_ids: formData.guardian_ids.filter(id => id !== gId)
                  })}>
                    <X className="w-3 h-3 ml-1" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Allergies */}
      <div className="space-y-2">
        <Label className="text-slate-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          Allergies
        </Label>
        <div className="flex gap-2">
          <Input
            value={newAllergy}
            onChange={(e) => setNewAllergy(e.target.value)}
            placeholder="Add allergy"
            className="bg-slate-800 border-slate-700 text-slate-100"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAllergy())}
          />
          <Button type="button" onClick={addAllergy} variant="outline" className="border-slate-700">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.allergies.map((allergy, i) => (
            <Badge key={i} className="bg-red-500/20 text-red-400 border border-red-500/30">
              {allergy}
              <button type="button" onClick={() => removeAllergy(i)}>
                <X className="w-3 h-3 ml-1" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Dietary Preferences */}
      <div className="space-y-2">
        <Label className="text-slate-300">Dietary Preferences</Label>
        <div className="flex gap-2">
          <Input
            value={newDietPref}
            onChange={(e) => setNewDietPref(e.target.value)}
            placeholder="e.g., Vegetarian, Kosher"
            className="bg-slate-800 border-slate-700 text-slate-100"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDietPref())}
          />
          <Button type="button" onClick={addDietPref} variant="outline" className="border-slate-700">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.dietary_preferences.map((pref, i) => (
            <Badge key={i} className="bg-slate-700 text-slate-300">
              {pref}
              <button type="button" onClick={() => removeDietPref(i)}>
                <X className="w-3 h-3 ml-1" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Medical Notes */}
      <div className="space-y-2">
        <Label className="text-slate-300">Medical Notes</Label>
        <Textarea
          value={formData.medical_notes}
          onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="Private medical information"
          rows={2}
        />
      </div>

      {/* About */}
      <div className="space-y-2">
        <Label className="text-slate-300">About</Label>
        <Textarea
          value={formData.about}
          onChange={(e) => setFormData({ ...formData, about: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="A few words about this person..."
          rows={3}
        />
      </div>

      {/* Family Links */}
      <div className="space-y-4 pt-4 border-t border-slate-700">
        <Label className="text-slate-300 text-base font-semibold">Family Links</Label>

        {/* Parents */}
        <div className="space-y-2">
          <Label className="text-slate-300">Parents</Label>
          <Select value="" onValueChange={addParent}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue placeholder="Add parent" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {people.filter(p => p.role_type === 'adult' && p.id !== person?.id && !parentIds.includes(p.id)).map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            {parentIds.map(pId => {
              const parent = people.find(p => p.id === pId);
              return (
                <Badge key={pId} className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  {parent?.name || pId}
                  <button type="button" onClick={() => removeParent(pId)} className="ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Partner */}
        {formData.role_type === 'adult' && (
          <div className="space-y-2">
            <Label className="text-slate-300">Partner</Label>
            <Select value={partnerId || "none"} onValueChange={(val) => setPartnerId(val === "none" ? "" : val)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue placeholder="Select partner" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="none">No partner</SelectItem>
                {people.filter(p => p.role_type === 'adult' && p.id !== person?.id).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Children */}
        {(formData.role_type === 'adult' && person?.id) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">Children</Label>
              {childrenIds.length > 0 && (
                <Select value="" onValueChange={addChild}>
                  <SelectTrigger className="w-32 h-8 text-xs bg-slate-800 border-slate-700 text-slate-100">
                    <SelectValue placeholder="Add child" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {people.filter(p => 
                      (p.role_type === 'child' || p.role_type === 'teen') && 
                      p.id !== person.id && 
                      !childrenIds.includes(p.id)
                    ).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {childrenIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {childrenIds.map(cId => {
                  const child = people.find(p => p.id === cId);
                  return (
                    <Badge key={cId} className="bg-green-500/20 text-green-400 border-green-500/30">
                      {child?.name || cId}
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No children linked yet</p>
            )}
          </div>
        )}
      </div>

      {/* Star Customization */}
      <div className="space-y-2 pt-4 border-t border-slate-700">
        <Label className="text-slate-300">Constellation Appearance</Label>
        <Button
          type="button"
          onClick={() => setShowStarCustomizer(true)}
          className="w-full bg-slate-700 hover:bg-slate-600 text-white border border-amber-500/30"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Customize Star
        </Button>
        {formData.star_pattern && (
          <p className="text-xs text-slate-500 text-center">
            Pattern: {formData.star_pattern} • Brightness: {formData.star_intensity || 5}/10
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-slate-400">
          Cancel
        </Button>
        <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900" disabled={loading}>
          {loading ? "Saving..." : (person ? "Update Person" : "Add Person")}
        </Button>
      </div>

      {/* Star Customizer Dialog */}
      <Dialog open={showStarCustomizer} onOpenChange={setShowStarCustomizer}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Customize Your Star</DialogTitle>
          </DialogHeader>
          <StarCustomizer
            person={formData}
            onSave={(starConfig) => {
              setFormData({ ...formData, ...starConfig });
              setShowStarCustomizer(false);
            }}
            onCancel={() => setShowStarCustomizer(false)}
          />
        </DialogContent>
      </Dialog>
    </form>
  );
}