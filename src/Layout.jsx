import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "./utils";
import { base44 } from "@/api/base44Client";
import { 
  Home, 
  Users, 
  MapPin, 
  Sparkles, 
  Heart, 
  Settings,
  Menu,
  X,
  LogOut,
  Star
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
    { name: "Rituals", href: createPageUrl("Rituals"), icon: Sparkles },
    { name: "Moments", href: createPageUrl("Moments"), icon: Star },
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
          --color-cosmos-darker: #020617;
          --color-starlight: #f8fafc;
          --color-gold-soft: #fbbf24;
          --color-gold-warm: #f59e0b;
          --color-twilight-blue: #3b82f6;
          --color-twilight-purple: #8b5cf6;
        }
        
        body {
          background: linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e1b4b 100%);
          min-height: 100vh;
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
            radial-gradient(2px 2px at 20px 30px, rgba(255,255,255,0.15), transparent),
            radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.1), transparent),
            radial-gradient(1px 1px at 90px 40px, rgba(255,255,255,0.15), transparent),
            radial-gradient(2px 2px at 160px 120px, rgba(255,255,255,0.12), transparent),
            radial-gradient(1px 1px at 230px 80px, rgba(255,255,255,0.1), transparent),
            radial-gradient(2px 2px at 300px 160px, rgba(255,255,255,0.08), transparent);
          background-size: 350px 200px;
        }
        
        .glass-card {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(148, 163, 184, 0.1);
        }
        
        .glow-gold {
          box-shadow: 0 0 20px rgba(251, 191, 36, 0.15);
        }
      `}</style>
      
      <div className="star-field" />
      
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass-card border-b border-slate-800/50">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to={createPageUrl("Home")} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Star className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-slate-100">Nashiverse</span>
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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center glow-gold">
                <Star className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-100">Nashiverse</h1>
                <p className="text-xs text-slate-500">Family Universe</p>
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