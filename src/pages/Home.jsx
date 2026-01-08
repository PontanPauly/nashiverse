import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { 
  MapPin, 
  Calendar, 
  Users, 
  Sparkles, 
  Heart,
  ChevronRight,
  Star,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  const [user, setUser] = useState(null);
  const [personProfile, setPersonProfile] = useState(null);

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

  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: () => base44.entities.Trip.list('-start_date', 10),
  });

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const { data: moments = [] } = useQuery({
    queryKey: ['recent-moments'],
    queryFn: () => base44.entities.Moment.list('-created_date', 5),
  });

  const { data: loveNotes = [] } = useQuery({
    queryKey: ['recent-love-notes'],
    queryFn: () => base44.entities.LoveNote.list('-created_date', 3),
  });

  const { data: familySettings = [] } = useQuery({
    queryKey: ['family-settings'],
    queryFn: () => base44.entities.FamilySettings.list(),
  });

  useEffect(() => {
    if (user && people.length > 0) {
      const profile = people.find(p => p.linked_user_email === user.email);
      setPersonProfile(profile);
    }
  }, [user, people]);

  const settings = familySettings[0];
  const today = new Date();
  
  const upcomingTrips = trips.filter(trip => 
    isAfter(new Date(trip.start_date), today) || 
    (isAfter(new Date(trip.end_date), today) && isBefore(new Date(trip.start_date), today))
  ).slice(0, 3);

  const getPersonName = (personId) => {
    const person = people.find(p => p.id === personId);
    return person?.name || "Someone";
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Section */}
      <section className="relative overflow-hidden rounded-3xl glass-card p-8 lg:p-12">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500/10 to-orange-500/5 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-amber-400 mb-3">
            <Star className="w-4 h-4" />
            <span className="text-sm font-medium">Welcome back</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-100 mb-2">
            {personProfile?.nickname || personProfile?.name || user.full_name || "Family Member"}
          </h1>
          <p className="text-slate-400 text-lg">
            {settings?.family_name ? `${settings.family_name}'s Universe` : "Your Family Universe"}
          </p>
          
          {settings?.tagline && (
            <p className="mt-4 text-slate-500 italic">"{settings.tagline}"</p>
          )}

          <div className="mt-8 flex flex-wrap gap-4">
            <Link to={createPageUrl("Trips")}>
              <Button className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium">
                <Plus className="w-4 h-4 mr-2" />
                Plan a Trip
              </Button>
            </Link>
            <Link to={createPageUrl("Family")}>
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                <Users className="w-4 h-4 mr-2" />
                View Family
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Family Members", value: people.length, icon: Users, color: "from-blue-500 to-cyan-500" },
          { label: "Trips", value: trips.length, icon: MapPin, color: "from-amber-500 to-orange-500" },
          { label: "Moments", value: moments.length, icon: Star, color: "from-purple-500 to-pink-500" },
          { label: "Love Notes", value: loveNotes.length, icon: Heart, color: "from-rose-500 to-red-500" },
        ].map((stat, i) => (
          <div key={i} className="glass-card rounded-2xl p-5">
            <div className={cn(
              "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3",
              stat.color
            )}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-slate-100">{stat.value}</p>
            <p className="text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Trips */}
        <section className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              Upcoming Trips
            </h2>
            <Link to={createPageUrl("Trips")} className="text-amber-400 hover:text-amber-300 text-sm font-medium flex items-center">
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {upcomingTrips.length > 0 ? (
            <div className="space-y-3">
              {upcomingTrips.map((trip) => (
                <Link 
                  key={trip.id}
                  to={createPageUrl(`TripDetail?id=${trip.id}`)}
                  className="block p-4 rounded-xl bg-slate-800/40 hover:bg-slate-800/60 transition-colors border border-slate-700/50"
                >
                  <h3 className="font-medium text-slate-100 mb-1">{trip.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(trip.start_date), "MMM d")}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {trip.location}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">No upcoming trips</p>
              <Link to={createPageUrl("Trips")}>
                <Button variant="link" className="text-amber-400 mt-2">
                  Plan your first trip
                </Button>
              </Link>
            </div>
          )}
        </section>

        {/* Recent Love Notes */}
        <section className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-400" />
              Recent Love Notes
            </h2>
            <Link to={createPageUrl("LoveNotes")} className="text-amber-400 hover:text-amber-300 text-sm font-medium flex items-center">
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {loveNotes.length > 0 ? (
            <div className="space-y-3">
              {loveNotes.map((note) => (
                <div 
                  key={note.id}
                  className="p-4 rounded-xl bg-gradient-to-br from-rose-500/10 to-pink-500/5 border border-rose-500/20"
                >
                  <p className="text-slate-300 text-sm mb-2">"{note.content}"</p>
                  <p className="text-xs text-slate-500">
                    From {getPersonName(note.from_person_id)} to {getPersonName(note.to_person_id)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Heart className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">No love notes yet</p>
              <Link to={createPageUrl("LoveNotes")}>
                <Button variant="link" className="text-amber-400 mt-2">
                  Send your first note
                </Button>
              </Link>
            </div>
          )}
        </section>
      </div>

      {/* Recent Moments */}
      {moments.length > 0 && (
        <section className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Star className="w-5 h-5 text-purple-400" />
              Recent Moments
            </h2>
            <Link to={createPageUrl("Moments")} className="text-amber-400 hover:text-amber-300 text-sm font-medium flex items-center">
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {moments.slice(0, 5).map((moment) => (
              <div 
                key={moment.id}
                className="aspect-square rounded-xl bg-slate-800/50 overflow-hidden relative group"
              >
                {moment.media_urls?.[0] ? (
                  <img 
                    src={moment.media_urls[0]} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-3">
                    <p className="text-slate-400 text-xs text-center line-clamp-4">{moment.content}</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}