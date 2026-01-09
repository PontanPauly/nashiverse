import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, isAfter, isBefore, addDays, differenceInYears } from "date-fns";
import { 
  MapPin, 
  Calendar, 
  Users, 
  Sparkles, 
  Heart,
  ChevronRight,
  Star,
  Plus,
  Cake,
  BookOpen,
  Download,
  Lightbulb,
  Image
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  const { data: stories = [] } = useQuery({
    queryKey: ['stories'],
    queryFn: () => base44.entities.FamilyStory.list('-created_date', 3),
  });

  const [aiInsight, setAiInsight] = useState(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

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

  // Calculate next birthday
  const upcomingBirthdays = people
    .filter(p => p.birth_date)
    .map(person => {
      const birthDate = new Date(person.birth_date);
      const thisYear = today.getFullYear();
      const nextBirthday = new Date(thisYear, birthDate.getMonth(), birthDate.getDate());
      if (isBefore(nextBirthday, today)) {
        nextBirthday.setFullYear(thisYear + 1);
      }
      const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
      return { person, daysUntil, nextBirthday };
    })
    .filter(b => b.daysUntil >= 0 && b.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 3);

  const loadAIInsight = async () => {
    setLoadingInsight(true);
    try {
      const { data } = await base44.functions.invoke('getFamilyInsights');
      setAiInsight(data.insight);
    } catch (error) {
      console.error('Failed to load AI insight:', error);
    }
    setLoadingInsight(false);
  };

  const handleExportData = async () => {
    try {
      const { data } = await base44.functions.invoke('exportFamilyData');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
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
      {/* Universe Welcome */}
      <section className="relative overflow-hidden rounded-3xl glass-card p-8 lg:p-12 border-2 border-amber-500/20">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-amber-900/20" />
        <div className="absolute top-4 right-4 w-32 h-32 bg-amber-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-4 left-4 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-sm font-medium text-amber-300">Welcome Home</span>
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold mb-3 bg-gradient-to-r from-amber-200 via-slate-100 to-purple-200 bg-clip-text text-transparent">
            {personProfile?.nickname || personProfile?.name || user.full_name || "Family Member"}
          </h1>
          
          <p className="text-xl text-purple-300/80">
            Moments today. Traditions tomorrow.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link to={createPageUrl("Trips")}>
              <Button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 font-semibold shadow-lg shadow-amber-500/20">
                <Plus className="w-4 h-4 mr-2" />
                Plan a Trip
              </Button>
            </Link>
            <Link to={createPageUrl("Family")}>
              <Button className="bg-slate-700 hover:bg-slate-600 text-white border-2 border-slate-500 font-medium">
                <Users className="w-4 h-4 mr-2" />
                View Constellations
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Universe Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Stars in Constellation", value: people.length, icon: Users, color: "from-amber-500 to-orange-500", border: "border-amber-500/20 hover:border-amber-500/40" },
          { label: "Trips", value: trips.length, icon: MapPin, color: "from-blue-500 to-cyan-500", border: "border-blue-500/20 hover:border-blue-500/40" },
           { label: "Captured Memories", value: moments.length, icon: Image, color: "from-purple-500 to-pink-500", border: "border-purple-500/20 hover:border-purple-500/40" },
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

      {/* AI Insight & Quick Actions */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-100">Family Insight</h2>
            </div>
            {!aiInsight && (
              <Button 
                onClick={loadAIInsight} 
                disabled={loadingInsight}
                size="sm"
                variant="outline"
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                {loadingInsight ? "Thinking..." : "Generate"}
              </Button>
            )}
          </div>
          {aiInsight ? (
            <p className="text-slate-300 leading-relaxed">{aiInsight}</p>
          ) : (
            <p className="text-slate-500 text-sm">Click "Generate" to get AI-powered insights about your family universe.</p>
          )}
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Button 
              onClick={handleExportData}
              variant="outline" 
              className="w-full justify-start border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
            <Link to={createPageUrl("Calendar")} className="block">
              <Button variant="outline" className="w-full justify-start border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50">
                <Calendar className="w-4 h-4 mr-2" />
                Calendar
              </Button>
            </Link>
            <Link to={createPageUrl("FamilyStories")} className="block">
              <Button variant="outline" className="w-full justify-start border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50">
                <BookOpen className="w-4 h-4 mr-2" />
                Stories
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Upcoming Birthdays */}
      {upcomingBirthdays.length > 0 && (
        <section className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Cake className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-100">Upcoming Birthdays</h2>
            </div>
            <Link to={createPageUrl("Calendar")} className="text-amber-400 hover:text-amber-300 text-sm font-medium flex items-center">
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {upcomingBirthdays.map(({ person, daysUntil, nextBirthday }) => {
              const age = differenceInYears(nextBirthday, new Date(person.birth_date));
              return (
                <div key={person.id} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                      {person.photo_url ? (
                        <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium text-slate-400">{person.name?.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-100 text-sm truncate">{person.name}</h3>
                      <p className="text-xs text-slate-400">Turning {age}</p>
                    </div>
                  </div>
                  <Badge className={
                    daysUntil === 0 ? "bg-amber-500 text-white" :
                    daysUntil <= 7 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                    "bg-slate-700 text-slate-300"
                  }>
                    {daysUntil === 0 ? "Today!" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
                 Upcoming Trips
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
                <Button variant="link" className="text-amber-400 hover:text-amber-300 mt-2 font-medium">
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
                <Button variant="link" className="text-amber-400 hover:text-amber-300 mt-2 font-medium">
                  Send your first note
                </Button>
              </Link>
            </div>
          )}
        </section>
      </div>

      {/* Recent Memories & Stories */}
      <div className="grid lg:grid-cols-2 gap-6">
        {moments.length > 0 && (
          <section className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Star className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-lg font-semibold text-slate-100">Recent Memories</h2>
              </div>
              <Link to={createPageUrl("Moments")} className="text-amber-400 hover:text-amber-300 text-sm font-medium flex items-center">
                View all
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {moments.slice(0, 3).map((moment) => (
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
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <p className="text-slate-400 text-xs text-center line-clamp-3">{moment.content}</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </section>
        )}

        {stories.length > 0 && (
          <section className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-slate-100">Family Stories</h2>
              </div>
              <Link to={createPageUrl("FamilyStories")} className="text-amber-400 hover:text-amber-300 text-sm font-medium flex items-center">
                View all
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="space-y-3">
              {stories.map((story) => (
                <Link
                  key={story.id}
                  to={createPageUrl("FamilyStories")}
                  className="block p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/60 transition-colors border border-slate-700/50"
                >
                  <h3 className="font-medium text-slate-100 text-sm mb-1 line-clamp-1">{story.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2">{story.content}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}