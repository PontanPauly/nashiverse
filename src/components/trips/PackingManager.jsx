import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export default function PackingManager({ tripId, people }) {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['packingItems', tripId],
    queryFn: () => base44.entities.PackingItem.filter({ trip_id: tripId }),
  });

  const togglePacked = useMutation({
    mutationFn: ({ id, is_packed }) => base44.entities.PackingItem.update(id, { is_packed }),
    onSuccess: () => queryClient.invalidateQueries(['packingItems', tripId]),
  });

  const deleteItem = useMutation({
    mutationFn: (id) => base44.entities.PackingItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['packingItems', tripId]),
  });

  const sharedItems = items.filter(i => i.is_shared);
  const personalItems = items.filter(i => !i.is_shared);

  const packedCount = items.filter(i => i.is_packed).length;
  const totalCount = items.length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Packing List</h3>
          <p className="text-sm text-slate-500">
            {packedCount} of {totalCount} items packed
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      {/* Shared Items */}
      {sharedItems.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Shared Items
          </h4>
          <div className="space-y-2">
            {sharedItems.map(item => (
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
        </div>
      )}

      {/* Personal Items */}
      {personalItems.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-400 mb-3">Personal Items</h4>
          <div className="space-y-3">
            {people.map(person => {
              const personItems = personalItems.filter(i => i.assigned_to_person_id === person.id);
              if (personItems.length === 0) return null;
              return (
                <div key={person.id}>
                  <p className="text-xs font-medium text-slate-500 mb-2">{person.name}</p>
                  <div className="space-y-2">
                    {personItems.map(item => (
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <Package className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No packing items yet</p>
        </div>
      )}

      {showForm && (
        <PackingItemForm
          tripId={tripId}
          people={people}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries(['packingItems', tripId]);
          }}
        />
      )}
    </div>
  );
}

function PackingItemForm({ tripId, people, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    item_name: '',
    category: 'other',
    is_shared: true,
    assigned_to_person_id: '',
    quantity: 1,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await base44.entities.PackingItem.create({
      ...formData,
      trip_id: tripId,
      quantity: parseInt(formData.quantity),
    });
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Add Packing Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-slate-300">Item Name</Label>
            <Input
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              className="bg-slate-800 border-slate-700 text-slate-100"
              placeholder="e.g., Sunscreen, Tent, Hiking boots"
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

          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50">
            <Label className="text-slate-300">Shared Item</Label>
            <Switch
              checked={formData.is_shared}
              onCheckedChange={(val) => setFormData({ ...formData, is_shared: val })}
            />
          </div>

          {!formData.is_shared && (
            <div>
              <Label className="text-slate-300">Assign To</Label>
              <Select value={formData.assigned_to_person_id} onValueChange={(val) => setFormData({ ...formData, assigned_to_person_id: val })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {people.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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