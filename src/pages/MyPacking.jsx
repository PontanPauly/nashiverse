import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, Trash2, Package, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

export default function MyPacking() {
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: () => base44.entities.Trip.list(),
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['participants'],
    queryFn: () => base44.entities.TripParticipant.list(),
  });

  // Find current user's person record
  const myPerson = people.find(p => p.linked_user_email === user?.email);

  // Get trips I'm attending
  const myTrips = trips.filter(trip => {
    const myParticipation = participants.find(p => 
      p.trip_id === trip.id && 
      p.person_id === myPerson?.id &&
      p.status === 'accepted'
    );
    return !!myParticipation;
  });

  // Get people I can pack for (me + my children/teens as guardian)
  const peopleICanPackFor = people.filter(p => {
    if (p.id === myPerson?.id) return true;
    if (p.guardian_ids?.includes(myPerson?.id)) return true;
    return false;
  });

  const activeTripId = selectedTripId || myTrips[0]?.id;
  const activePersonId = selectedPersonId || myPerson?.id;

  const { data: packingItems = [] } = useQuery({
    queryKey: ['packingItems', activeTripId, activePersonId],
    queryFn: () => base44.entities.PackingItem.filter({ 
      trip_id: activeTripId,
      person_id: activePersonId 
    }),
    enabled: !!activeTripId && !!activePersonId,
  });

  const togglePacked = useMutation({
    mutationFn: ({ id, is_packed }) => base44.entities.PackingItem.update(id, { is_packed }),
    onSuccess: () => queryClient.invalidateQueries(['packingItems']),
  });

  const deleteItem = useMutation({
    mutationFn: (id) => base44.entities.PackingItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['packingItems']),
  });

  const activeTrip = trips.find(t => t.id === activeTripId);
  const activePerson = people.find(p => p.id === activePersonId);
  const packedCount = packingItems.filter(i => i.is_packed).length;

  if (!myPerson) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="glass-card rounded-xl p-12 text-center">
          <Package className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-200 mb-2">Link Your Profile</h2>
          <p className="text-slate-500 mb-4">Please link your account to a family member to manage packing lists.</p>
          <Link to={createPageUrl('Profile')}>
            <Button className="bg-amber-500 hover:bg-amber-600 text-slate-900">
              Go to Profile
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Package className="w-6 h-6 text-amber-400" />
          My Packing Lists
        </h1>
        <p className="text-slate-500 mt-1">Manage packing for your trips</p>
      </div>

      {myTrips.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <MapPin className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-200 mb-2">No Upcoming Trips</h2>
          <p className="text-slate-500 mb-4">You're not attending any trips yet.</p>
          <Link to={createPageUrl('Trips')}>
            <Button className="bg-amber-500 hover:bg-amber-600 text-slate-900">
              View Trips
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Trip and Person Selection */}
          <div className="glass-card rounded-xl p-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300 text-sm mb-2 block">Trip</Label>
                <Select value={activeTripId} onValueChange={setSelectedTripId}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {myTrips.map(trip => (
                      <SelectItem key={trip.id} value={trip.id}>
                        {trip.name} - {format(new Date(trip.start_date), 'MMM d')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {peopleICanPackFor.length > 1 && (
                <div>
                  <Label className="text-slate-300 text-sm mb-2 block">Packing For</Label>
                  <Select value={activePersonId} onValueChange={setSelectedPersonId}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {peopleICanPackFor.map(person => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name} {person.id === myPerson.id && '(Me)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Packing List */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  {activePerson?.name}'s List
                </h3>
                <p className="text-sm text-slate-500">
                  {packedCount} of {packingItems.length} items packed
                </p>
              </div>
              <Button onClick={() => setShowForm(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>

            {packingItems.length > 0 ? (
              <div className="space-y-2">
                {packingItems.map(item => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors",
                      item.is_packed && "opacity-60"
                    )}
                  >
                    <button
                      onClick={() => togglePacked.mutate({ id: item.id, is_packed: !item.is_packed })}
                      className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                        item.is_packed
                          ? "bg-green-500 border-green-500"
                          : "border-slate-600 hover:border-slate-500"
                      )}
                    >
                      {item.is_packed && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1">
                      <p className={cn("text-slate-200", item.is_packed && "line-through")}>
                        {item.item_name} {item.quantity > 1 && `(${item.quantity})`}
                      </p>
                      <Badge className="mt-1 text-xs">{item.category}</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteItem.mutate(item.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No items yet. Start adding things to pack!</p>
              </div>
            )}
          </div>
        </>
      )}

      {showForm && (
        <PackingItemForm
          tripId={activeTripId}
          personId={activePersonId}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries(['packingItems']);
          }}
        />
      )}
    </div>
  );
}

function PackingItemForm({ tripId, personId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    item_name: '',
    category: 'other',
    quantity: 1,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await base44.entities.PackingItem.create({
      ...formData,
      trip_id: tripId,
      person_id: personId,
      quantity: parseInt(formData.quantity),
    });
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Add Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-slate-300">Item Name</Label>
            <Input
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              className="bg-slate-800 border-slate-700 text-slate-100"
              placeholder="e.g., Sunscreen, Jacket, Phone charger"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Category</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="clothing">Clothing</SelectItem>
                  <SelectItem value="toiletries">Toiletries</SelectItem>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="documents">Documents</SelectItem>
                  <SelectItem value="activities">Activities</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Quantity</Label>
              <Input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900">
              Add Item
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}