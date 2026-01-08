import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "./utils";
import { base44 } from "@/api/base44Client";
import { 
  Home, 
  Users, 
  MapPin, 
  Calendar, 
  Heart, 
  Settings,
  Menu,
  X,
  LogOut,
  Star,
  Image
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (e) {
      console.log("Not logged in");
    }
  };

  const navigation = [
    { name: "Home", href: createPageUrl("Home"), icon: Home },
    { name: "Family", href: createPageUrl("Family"), icon: Users },
    { name: "Trips", href: createPageUrl("Trips"), icon: MapPin },
    { name: "Rituals", href: createPageUrl("Rituals"), icon: Calendar },
    { name: "Moments", href: createPageUrl("Moments"), icon: Image },
    { name: "Love Notes", href: createPageUrl("LoveNotes"), icon: Heart },
  ];

  const isActive = (href) => {
    return location.pathname === new URL(href, window.location.origin).pathname;
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <style>{`
        :root {
          --color-cosmos-dark: #0f172a;
          --color-cosmos-deeper: #0a0e1a;
          --color-nebula-purple: #1e1b4b;
          --color-starlight: #f8fafc;
          --color-gold-soft: #fbbf24;
          --color-gold-warm: #f59e0b;
          --color-constellation-blue: #60a5fa;
          --color-cosmic-purple: #a78bfa;
        }

        body {
          background: radial-gradient(ellipse at top, #1e1b4b 0%, #0a0e1a 50%, #000000 100%);
          min-height: 100vh;
          overflow-x: hidden;
        }

        .star-field {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 0;
          background-image: 
            radial-gradient(1.5px 1.5px at 20% 30%, white, transparent),
            radial-gradient(1.5px 1.5px at 60% 70%, white, transparent),
            radial-gradient(1px 1px at 50% 50%, white, transparent),
            radial-gradient(1px 1px at 80% 10%, white, transparent),
            radial-gradient(1.5px 1.5px at 90% 60%, white, transparent),
            radial-gradient(1px 1px at 33% 90%, white, transparent),
            radial-gradient(1px 1px at 15% 60%, white, transparent);
          background-size: 200% 200%;
          animation: starTwinkle 8s ease-in-out infinite;
          opacity: 0.6;
        }

        @keyframes starTwinkle {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }

        .star-field::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            radial-gradient(2px 2px at 40% 20%, rgba(255,255,255,0.8), transparent),
            radial-gradient(1.5px 1.5px at 70% 80%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 25% 45%, rgba(255,255,255,0.4), transparent);
          background-size: 100% 100%;
          animation: starPulse 4s ease-in-out infinite alternate;
        }

        @keyframes starPulse {
          0% { opacity: 0.3; }
          100% { opacity: 0.7; }
        }

        .nebula-glow {
          position: fixed;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          pointer-events: none;
          z-index: 1;
          background: 
            radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 70%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 90%, rgba(251, 191, 36, 0.08) 0%, transparent 40%);
          animation: nebulaShift 30s ease-in-out infinite;
        }

        @keyframes nebulaShift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-5%, -5%) scale(1.1); }
        }

        .glass-card {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(148, 163, 184, 0.15);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .constellation-line {
          stroke: rgba(251, 191, 36, 0.3);
          stroke-width: 1;
          fill: none;
        }

        .glow-gold {
          box-shadow: 0 0 30px rgba(251, 191, 36, 0.3), 0 0 60px rgba(251, 191, 36, 0.15);
        }

        .glow-cosmic {
          box-shadow: 0 0 20px rgba(167, 139, 250, 0.4);
        }
      `}</style>

      <div className="nebula-glow" />
      
      <div className="star-field" />
      
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass-card border-b border-slate-800/50">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to={createPageUrl("Home")} className="flex items-center gap-2">
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-purple-600 flex items-center justify-center glow-gold">
            <Star className="w-4 h-4 text-white fill-white" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 to-transparent opacity-50 animate-pulse" />
          </div>
          <span className="text-lg font-semibold bg-gradient-to-r from-amber-200 via-amber-100 to-purple-200 bg-clip-text text-transparent">Nashiverse</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400 hover:text-slate-100"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-64 glass-card z-50 transform transition-transform duration-300 ease-out",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-800/50">
            <Link to={createPageUrl("Home")} className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-purple-600 flex items-center justify-center glow-gold">
                <Star className="w-5 h-5 text-white fill-white" />
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 to-transparent opacity-50 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-semibold bg-gradient-to-r from-amber-200 via-amber-100 to-purple-200 bg-clip-text text-transparent">Nashiverse</h1>
                <p className="text-xs text-purple-300/60">Your Family Universe</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                    active 
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  )}
                >
                  <Icon className={cn("w-5 h-5", active && "text-amber-400")} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          {user && (
            <div className="p-4 border-t border-slate-800/50">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/30">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                  <span className="text-sm font-medium text-slate-300">
                    {user.full_name?.charAt(0) || user.email?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {user.full_name || "Family Member"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <Link 
                  to={createPageUrl("Settings")} 
                  className="flex-1"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Button variant="ghost" size="sm" className="w-full text-slate-400 hover:text-slate-200">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-slate-400 hover:text-red-400"
                  onClick={() => base44.auth.logout()}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-64 min-h-screen pt-16 lg:pt-0 relative z-10">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}