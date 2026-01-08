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
      {/* Hero Welcome */}
      <section className="text-center py-20">
        <h1 className="text-5xl lg:text-6xl font-bold text-slate-100 mb-4">
          Welcome Home
        </h1>
        
        <h2 className="text-3xl lg:text-4xl font-light text-amber-400 mb-6">
          {personProfile?.nickname || personProfile?.name || user.full_name || "Family Member"}
        </h2>
        
        <p className="text-xl text-slate-400 mb-10">
          Moments today. Traditions tomorrow.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Link to={createPageUrl("Trips")}>
            <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-8">
              Plan a Trip
            </Button>
          </Link>
          <Link to={createPageUrl("Family")}>
            <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 px-8">
              View Constellations
            </Button>
          </Link>
        </div>
      </section>

      {/* Universe Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Stars in Constellation", value: people.length, icon: Users, color: "from-amber-500 to-orange-500", border: "border-amber-500/20 hover:border-amber-500/40" },
          { label: "Cosmic Journeys", value: trips.length, icon: MapPin, color: "from-blue-500 to-cyan-500", border: "border-blue-500/20 hover:border-blue-500/40" },
          { label: "Captured Memories", value: moments.length, icon: Star, color: "from-purple-500 to-pink-500", border: "border-purple-500/20 hover:border-purple-500/40" },
          { label: "Notes of Gratitude", value: loveNotes.length, icon: Heart, color: "from-pink-500 to-rose-500", border: "border-pink-500/20 hover:border-pink-500/40" },
        ].map((stat, i) => (
          <div key={i} className={cn("relative glass-card rounded-2xl p-5 border transition-all group", stat.border)}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className={cn(
                "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3",
                stat.color
              )}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-3xl font-bold text-slate-100">{stat.value}</p>
              <p className="text-sm text-slate-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming Journeys */}
        <section className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold bg-gradient-to-r from-amber-200 to-slate-100 bg-clip-text text-transparent">
                Upcoming Journeys
              </h2>
            </div>
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

        {/* Recent Gratitude */}
        <section className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center glow-cosmic">
                <Heart className="w-5 h-5 text-pink-400" />
              </div>
              <h2 className="text-lg font-semibold bg-gradient-to-r from-pink-200 to-slate-100 bg-clip-text text-transparent">
                Recent Gratitude
              </h2>
            </div>
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

      {/* Recent Memories */}
      {moments.length > 0 && (
        <section className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold bg-gradient-to-r from-purple-200 to-slate-100 bg-clip-text text-transparent">
                Recent Memories
              </h2>
            </div>
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