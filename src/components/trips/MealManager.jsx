import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { 
  UtensilsCrossed, 
  Plus, 
  AlertCircle,
  User,
  Edit,
  Trash2,
  Hand
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export default function MealManager({ tripId, trip, meals, people, participants }) {
  const [showMealForm, setShowMealForm] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  
  const queryClient = useQueryClient();

  const tripDays = trip?.start_date && trip?.end_date 
    ? eachDayOfInterval({ start: parseISO(trip.start_date), end: parseISO(trip.end_date) })
    : [];

  const getMealsForDay = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return meals.filter(m => m.date === dateStr).sort((a, b) => {
      const order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3, other: 4 };
      return (order[a.meal_type] || 5) - (order[b.meal_type] || 5);
    });
  };

  const getPersonName = (personId) => {
    const person = people.find(p => p.id === personId);
    return person?.name || "Unknown";
  };

  const getAttendingPeople = () => {
    const acceptedParticipantIds = participants
      .filter(p => p.status === 'accepted')
      .map(p => p.person_id);
    return people.filter(p => acceptedParticipantIds.includes(p.id));
  };

  const getDietaryAlerts = () => {
    const attendees = getAttendingPeople();
    const alerts = [];
    attendees.forEach(person => {
      person.allergies?.forEach(allergy => {
        alerts.push({ person: person.name, item: allergy, isAllergy: true });
      });
      person.dietary_preferences?.forEach(pref => {
        alerts.push({ person: person.name, item: pref, isAllergy: false });
      });
    });
    return alerts;
  };

  const volunteerForMeal = async (mealId) => {
    const user = await base44.auth.me();
    const myPerson = people.find(p => p.linked_user_email === user.email);
    if (myPerson) {
      await base44.entities.Meal.update(mealId, { 
        responsible_person_id: myPerson.id,
        is_open_for_volunteer: false 
      });
      queryClient.invalidateQueries(['trip-meals', tripId]);
    }
  };

  const deleteMeal = async (mealId) => {
    await base44.entities.Meal.delete(mealId);
    queryClient.invalidateQueries(['trip-meals', tripId]);
  };

  const mealTypeIcons = {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
    snack: '🍎',
    other: '🍽️'
  };

  const dietaryAlerts = getDietaryAlerts();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-amber-400" />
          Meals
        </h2>
        <Button 
          onClick={() => setShowMealForm(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Meal
        </Button>
      </div>

      {/* Dietary Alerts */}
      {dietaryAlerts.length > 0 && (
        <div className="glass-card rounded-xl p-4 border-l-4 border-red-500">
          <h3 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            Heads up for cooks
          </h3>
          <div className="flex flex-wrap gap-2">
            {dietaryAlerts.map((alert, i) => (
              <Badge 
                key={i}
                className={cn(
                  "border",
                  alert.isAllergy 
                    ? "bg-red-500/20 text-red-400 border-red-500/30" 
                    : "bg-slate-700 text-slate-300 border-slate-600"
                )}
              >
                {alert.person}: {alert.item}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Meals by Day */}
      <div className="space-y-4">
        {tripDays.map((day) => {
          const dayMeals = getMealsForDay(day);
          
          return (
            <div key={day.toString()} className="glass-card rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
                <h3 className="font-medium text-slate-200">
                  {format(day, 'EEEE, MMMM d')}
                </h3>
              </div>
              
              <div className="p-4">
                {dayMeals.length > 0 ? (
                  <div className="space-y-3">
                    {dayMeals.map((meal) => (
                      <div 
                        key={meal.id}
                        className="flex items-start justify-between p-3 rounded-lg bg-slate-800/50"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{mealTypeIcons[meal.meal_type]}</span>
                          <div>
                            <h4 className="font-medium text-slate-200">{meal.name}</h4>
                            <p className="text-sm text-slate-500 capitalize">{meal.meal_type}</p>
                            
                            {meal.responsible_person_id ? (
                              <p className="text-sm text-slate-400 mt-1 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {getPersonName(meal.responsible_person_id)}
                              </p>
                            ) : meal.is_open_for_volunteer ? (
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="text-amber-400 p-0 h-auto mt-1"
                                onClick={() => volunteerForMeal(meal.id)}
                              >
                                <Hand className="w-3 h-3 mr-1" />
                                Volunteer
                              </Button>
                            ) : null}
                            
                            {meal.menu_description && (
                              <p className="text-sm text-slate-400 mt-2">{meal.menu_description}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-500 hover:text-slate-300"
                            onClick={() => {
                              setEditingMeal(meal);
                              setShowMealForm(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-500 hover:text-red-400"
                            onClick={() => deleteMeal(meal.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm text-center py-4">No meals planned</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {tripDays.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <UtensilsCrossed className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">Set trip dates to start planning meals</p>
        </div>
      )}

      {/* Meal Form Dialog */}
      <Dialog open={showMealForm} onOpenChange={(open) => {
        setShowMealForm(open);
        if (!open) setEditingMeal(null);
      }}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {editingMeal ? 'Edit Meal' : 'Add Meal'}
            </DialogTitle>
          </DialogHeader>
          <MealForm 
            meal={editingMeal}
            tripId={tripId}
            tripDays={tripDays}
            people={people}
            onSuccess={() => {
              setShowMealForm(false);
              setEditingMeal(null);
              queryClient.invalidateQueries(['trip-meals', tripId]);
            }}
            onCancel={() => {
              setShowMealForm(false);
              setEditingMeal(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MealForm({ meal, tripId, tripDays, people, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    trip_id: tripId,
    name: meal?.name || "",
    date: meal?.date || (tripDays[0] ? format(tripDays[0], 'yyyy-MM-dd') : ""),
    time: meal?.time || "",
    meal_type: meal?.meal_type || "dinner",
    is_needed: meal?.is_needed ?? true,
    responsible_person_id: meal?.responsible_person_id || "",
    is_open_for_volunteer: meal?.is_open_for_volunteer ?? true,
    menu_description: meal?.menu_description || "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dataToSave = {
      ...formData,
      responsible_person_id: formData.responsible_person_id || null,
    };

    if (meal?.id) {
      await base44.entities.Meal.update(meal.id, dataToSave);
    } else {
      await base44.entities.Meal.create(dataToSave);
    }

    setLoading(false);
    onSuccess();
  };

  const adultPeople = people.filter(p => p.role_type === 'adult');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label className="text-slate-300">Meal Name *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="e.g., Welcome dinner"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Date *</Label>
          <Select value={formData.date} onValueChange={(value) => setFormData({ ...formData, date: value })}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {tripDays.map(day => (
                <SelectItem key={day.toString()} value={format(day, 'yyyy-MM-dd')}>
                  {format(day, 'EEE, MMM d')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Meal Type *</Label>
          <Select value={formData.meal_type} onValueChange={(value) => setFormData({ ...formData, meal_type: value })}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="breakfast">Breakfast</SelectItem>
              <SelectItem value="lunch">Lunch</SelectItem>
              <SelectItem value="dinner">Dinner</SelectItem>
              <SelectItem value="snack">Snack</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Responsible Person</Label>
        <Select 
          value={formData.responsible_person_id || "none"} 
          onValueChange={(value) => setFormData({ 
            ...formData, 
            responsible_person_id: value === "none" ? "" : value,
            is_open_for_volunteer: value === "none" ? formData.is_open_for_volunteer : false
          })}
        >
          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
            <SelectValue placeholder="Select cook/host" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="none">Not assigned</SelectItem>
            {adultPeople.map(person => (
              <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!formData.responsible_person_id && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
          <Label className="text-slate-300">Open for volunteers</Label>
          <Switch
            checked={formData.is_open_for_volunteer}
            onCheckedChange={(checked) => setFormData({ ...formData, is_open_for_volunteer: checked })}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-slate-300">Menu / Description</Label>
        <Textarea
          value={formData.menu_description}
          onChange={(e) => setFormData({ ...formData, menu_description: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="What's being served?"
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-slate-400">
          Cancel
        </Button>
        <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900" disabled={loading}>
          {loading ? "Saving..." : (meal ? "Update" : "Add Meal")}
        </Button>
      </div>
    </form>
  );
}