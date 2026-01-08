import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PersonForm from "@/components/family/PersonForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (e) {
      base44.auth.redirectToLogin();
    }
  };

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const { data: households = [] } = useQuery({
    queryKey: ['households'],
    queryFn: () => base44.entities.Household.list(),
  });

  // Find person profile linked to current user
  const myProfile = people.find(p => p.linked_user_email === user?.email);

  const linkProfile = useMutation({
    mutationFn: async (personId) => {
      const person = people.find(p => p.id === personId);
      if (!person) return;
      
      await base44.entities.Person.update(personId, {
        ...person,
        linked_user_email: user.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['people']);
    }
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!myProfile) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="glass-card rounded-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Connect Your Profile</h2>
          <p className="text-slate-400 mb-6">
            Select which family member profile belongs to you
          </p>
          <div className="space-y-3">
            {people.filter(p => !p.linked_user_email).map(person => (
              <Button
                key={person.id}
                onClick={() => linkProfile.mutate(person.id)}
                className="w-full justify-start bg-slate-800 hover:bg-slate-700 text-slate-100"
              >
                <User className="w-4 h-4 mr-3" />
                {person.name} {person.nickname && `"${person.nickname}"`}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="glass-card rounded-2xl p-8">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-4 border-amber-400/30">
            {myProfile.photo_url ? (
              <img src={myProfile.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-medium text-slate-400">
                {myProfile.name?.charAt(0)}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-100 mb-2">{myProfile.name}</h1>
            {myProfile.nickname && (
              <p className="text-xl text-amber-300 mb-2">"{myProfile.nickname}"</p>
            )}
            <p className="text-slate-400">{user.email}</p>
            <Button
              onClick={() => setShowEditDialog(true)}
              className="mt-4 bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              Edit Profile
            </Button>
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Basic Info</h3>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-slate-500">Role:</span>
              <span className="text-slate-200 ml-2 capitalize">{myProfile.role_type}</span>
            </div>
            {myProfile.birth_date && (
              <div>
                <span className="text-slate-500">Birth Date:</span>
                <span className="text-slate-200 ml-2">{myProfile.birth_date}</span>
              </div>
            )}
            {myProfile.household_id && (
              <div>
                <span className="text-slate-500">Household:</span>
                <span className="text-slate-200 ml-2">
                  {households.find(h => h.id === myProfile.household_id)?.name || "Unknown"}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            My Star
          </h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-slate-500">Pattern:</span>
              <span className="text-slate-200 ml-2 capitalize">{myProfile.star_pattern || 'classic'}</span>
            </div>
            <div>
              <span className="text-slate-500">Brightness:</span>
              <span className="text-slate-200 ml-2">{myProfile.star_intensity || 5}/10</span>
            </div>
            <div>
              <span className="text-slate-500">Light Rays:</span>
              <span className="text-slate-200 ml-2">{myProfile.star_flare_count || 8}</span>
            </div>
          </div>
        </div>
      </div>

      {myProfile.about && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-3">About</h3>
          <p className="text-slate-300">{myProfile.about}</p>
        </div>
      )}

      {(myProfile.allergies?.length > 0 || myProfile.dietary_preferences?.length > 0) && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Health & Dietary</h3>
          {myProfile.allergies?.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-slate-500 mb-2">Allergies:</p>
              <div className="flex flex-wrap gap-2">
                {myProfile.allergies.map((allergy, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm border border-red-500/30">
                    {allergy}
                  </span>
                ))}
              </div>
            </div>
          )}
          {myProfile.dietary_preferences?.length > 0 && (
            <div>
              <p className="text-sm text-slate-500 mb-2">Dietary Preferences:</p>
              <div className="flex flex-wrap gap-2">
                {myProfile.dietary_preferences.map((pref, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-slate-700 text-slate-300 text-sm">
                    {pref}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Edit Your Profile</DialogTitle>
          </DialogHeader>
          <PersonForm
            person={myProfile}
            households={households}
            people={people}
            onSuccess={() => {
              setShowEditDialog(false);
              queryClient.invalidateQueries(['people']);
            }}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}