import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar as CalendarIcon, Cake, Plus, Edit, Trash2, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths, isBefore, isAfter, startOfDay, differenceInYears } from "date-fns";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const queryClient = useQueryClient();

  const { data: people = [], isLoading: loadingPeople } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => base44.entities.CalendarEvent.list(),
  });

  const deleteEvent = useMutation({
    mutationFn: (id) => base44.entities.CalendarEvent.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['calendarEvents']),
  });

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // Get events for a specific day (birthdays + custom events)
  const getEventsForDay = (day) => {
    const dayEvents = [];
    
    // Add birthdays
    people.forEach(person => {
      if (person.birth_date) {
        const birthDate = new Date(person.birth_date);
        if (birthDate.getMonth() === day.getMonth() && birthDate.getDate() === day.getDate()) {
          const age = differenceInYears(day, birthDate);
          dayEvents.push({
            type: 'birthday',
            person,
            age,
            title: `${person.name}'s Birthday`,
            color: 'bg-amber-500'
          });
        }
      }
    });
    
    // Add custom events
    events.forEach(event => {
      if (isSameDay(new Date(event.date), day)) {
        dayEvents.push({
          type: 'event',
          event,
          title: event.title,
          color: event.color || 'bg-blue-500'
        });
      }
    });
    
    return dayEvents;
  };

  // Upcoming events (next 30 days)
  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());
    const upcoming = [];
    
    // Add birthdays
    people.forEach(person => {
      if (!person.birth_date) return;
      
      const birthDate = new Date(person.birth_date);
      const thisYear = today.getFullYear();
      const nextBirthday = new Date(thisYear, birthDate.getMonth(), birthDate.getDate());
      
      if (isBefore(nextBirthday, today)) {
        nextBirthday.setFullYear(thisYear + 1);
      }
      
      const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntil <= 30) {
        const age = differenceInYears(nextBirthday, birthDate);
        upcoming.push({
          type: 'birthday',
          date: nextBirthday,
          daysUntil,
          person,
          age,
          title: `${person.name}'s Birthday`,
        });
      }
    });
    
    // Add custom events
    events.forEach(event => {
      const eventDate = new Date(event.date);
      const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntil >= 0 && daysUntil <= 30) {
        upcoming.push({
          type: 'event',
          date: eventDate,
          daysUntil,
          event,
          title: event.title,
        });
      }
    });
    
    return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [people, events]);

  if (loadingPeople || loadingEvents) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-amber-400" />
            Family Calendar
          </h1>
          <p className="text-slate-500 mt-1">Birthdays and important events</p>
        </div>
        <Button onClick={() => { setEditingEvent(null); setShowEventForm(true); }} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
          <Plus className="w-4 h-4 mr-2" />
          Add Event
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar View */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-100">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="border-slate-700 text-slate-300">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="border-slate-700 text-slate-300">
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="border-slate-700 text-slate-300">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="space-y-2">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, idx) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = isSameDay(day, new Date());
                
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedDate(day);
                      if (dayEvents.length === 0) {
                        setShowEventForm(true);
                      }
                    }}
                    className={`
                      min-h-[80px] p-2 rounded-lg border transition-colors text-left relative
                      ${isCurrentMonth ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-900/30 border-slate-800'}
                      ${isToday ? 'ring-2 ring-amber-500' : ''}
                      hover:bg-slate-800 hover:border-slate-600
                    `}
                  >
                    <div className={`text-sm font-medium mb-1 ${isCurrentMonth ? 'text-slate-200' : 'text-slate-600'}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((evt, i) => (
                        <div key={i} className={`text-[10px] px-1 py-0.5 rounded ${evt.color} text-white truncate`}>
                          {evt.type === 'birthday' && <Cake className="w-2 h-2 inline mr-0.5" />}
                          {evt.person ? evt.person.name : evt.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-slate-500">+{dayEvents.length - 2} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Upcoming Events Sidebar */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Coming Up</h3>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {item.type === 'birthday' ? (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <Cake className="w-3 h-3 text-amber-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-200 truncate">
                                {item.person.name}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">Turning {item.age}</p>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-slate-200 mb-1">{item.title}</div>
                            {item.event.description && (
                              <p className="text-xs text-slate-500 truncate">{item.event.description}</p>
                            )}
                          </>
                        )}
                      </div>
                      <Badge className={
                        item.daysUntil === 0 ? "bg-amber-500 text-white" :
                        item.daysUntil <= 7 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                        "bg-slate-700 text-slate-300"
                      }>
                        {item.daysUntil === 0 ? "Today" : 
                         item.daysUntil === 1 ? "Tomorrow" : 
                         `${item.daysUntil}d`}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      {format(item.date, 'MMM d, yyyy')}
                    </div>
                    {item.type === 'event' && (
                      <div className="flex gap-1 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEvent(item.event);
                            setShowEventForm(true);
                          }}
                          className="h-6 px-2 text-xs text-slate-400 hover:text-slate-200"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEvent.mutate(item.event.id);
                          }}
                          className="h-6 px-2 text-xs text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No upcoming events</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event Form */}
      <EventForm
        open={showEventForm}
        onClose={() => {
          setShowEventForm(false);
          setEditingEvent(null);
          setSelectedDate(null);
        }}
        event={editingEvent}
        people={people}
        defaultDate={selectedDate}
      />
    </div>
  );
}

function EventForm({ open, onClose, event, people, defaultDate }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: event?.title || "",
    description: event?.description || "",
    date: event?.date || (defaultDate ? format(defaultDate, 'yyyy-MM-dd') : ""),
    event_type: event?.event_type || "other",
    person_ids: event?.person_ids || [],
    is_recurring: event?.is_recurring || false,
    color: event?.color || "bg-blue-500",
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || "",
        description: event.description || "",
        date: event.date || "",
        event_type: event.event_type || "other",
        person_ids: event.person_ids || [],
        is_recurring: event.is_recurring || false,
        color: event.color || "bg-blue-500",
      });
    } else if (defaultDate) {
      setFormData(prev => ({ ...prev, date: format(defaultDate, 'yyyy-MM-dd') }));
    }
  }, [event, defaultDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (event?.id) {
      await base44.entities.CalendarEvent.update(event.id, formData);
    } else {
      await base44.entities.CalendarEvent.create(formData);
    }

    queryClient.invalidateQueries(['calendarEvents']);
    setLoading(false);
    onClose();
  };

  const colorOptions = [
    { value: 'bg-blue-500', label: 'Blue' },
    { value: 'bg-green-500', label: 'Green' },
    { value: 'bg-purple-500', label: 'Purple' },
    { value: 'bg-pink-500', label: 'Pink' },
    { value: 'bg-red-500', label: 'Red' },
    { value: 'bg-orange-500', label: 'Orange' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-100">{event ? 'Edit Event' : 'New Event'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="bg-slate-800 border-slate-700 text-slate-100"
              placeholder="Event title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-slate-800 border-slate-700 text-slate-100"
              placeholder="Event details"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Type</Label>
              <Select value={formData.event_type} onValueChange={(value) => setFormData({ ...formData, event_type: value })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="appointment">Appointment</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                  <SelectItem value="anniversary">Anniversary</SelectItem>
                  <SelectItem value="celebration">Celebration</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Color</Label>
            <div className="grid grid-cols-6 gap-2">
              {colorOptions.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`h-10 rounded-lg ${color.value} ${formData.color === color.value ? 'ring-2 ring-white' : ''}`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400">
              Cancel
            </Button>
            <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900" disabled={loading}>
              {loading ? "Saving..." : (event ? "Update" : "Create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}