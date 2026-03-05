import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Mail, Lock, User } from "lucide-react";

function AnimatedStarfield({ canvasRef }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let stars = [];
    let shootingStars = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const STAR_COUNT = 280;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.8 + 0.3,
        alpha: Math.random() * 0.6 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 1.2,
        color: Math.random() > 0.7
          ? `rgba(251,191,36,` 
          : Math.random() > 0.5
          ? `rgba(245,158,11,`
          : `rgba(255,255,255,`,
      });
    }

    const spawnShootingStar = () => {
      if (shootingStars.length < 2 && Math.random() < 0.003) {
        shootingStars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height * 0.4,
          vx: 3 + Math.random() * 4,
          vy: 1 + Math.random() * 2,
          life: 1,
          length: 40 + Math.random() * 60,
        });
      }
    };

    const draw = (time) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const s of stars) {
        const twinkle = Math.sin(time * 0.001 * s.speed + s.phase) * 0.3 + 0.7;
        const a = s.alpha * twinkle;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = s.color + a + ")";
        ctx.fill();

        if (s.radius > 1.2) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius * 3, 0, Math.PI * 2);
          ctx.fillStyle = s.color + (a * 0.15) + ")";
          ctx.fill();
        }
      }

      spawnShootingStar();
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life -= 0.012;

        if (ss.life <= 0) {
          shootingStars.splice(i, 1);
          continue;
        }

        const grad = ctx.createLinearGradient(
          ss.x, ss.y,
          ss.x - ss.vx * ss.length * 0.3, ss.y - ss.vy * ss.length * 0.3
        );
        grad.addColorStop(0, `rgba(251,191,36,${ss.life * 0.8})`);
        grad.addColorStop(1, `rgba(251,191,36,0)`);
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(
          ss.x - ss.vx * ss.length * 0.3,
          ss.y - ss.vy * ss.length * 0.3
        );
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef]);

  return null;
}

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData.email, formData.password, formData.fullName);
      }
      navigate("/");
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="login-nebula-bg" />
      <div className="login-nebula-accent login-nebula-accent--1" />
      <div className="login-nebula-accent login-nebula-accent--2" />
      <div className="login-nebula-accent login-nebula-accent--3" />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[1] pointer-events-none"
      />
      <AnimatedStarfield canvasRef={canvasRef} />

      <div className="login-vignette" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400/30 to-amber-600/10 animate-pulse blur-xl" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Sparkles className="w-9 h-9 text-white drop-shadow-lg" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent mb-3 tracking-tight">
            Nashiverse
          </h1>
          <p className="text-lg text-amber-200/70 font-light tracking-wide">
            Every family is a constellation of stories
          </p>
          <p className="text-sm text-slate-400/80 mt-1">
            Step into your universe
          </p>
        </div>

        <div className="login-card rounded-2xl p-8">
          <div className="flex gap-2 mb-6">
            <Button
              type="button"
              variant={isLogin ? "default" : "ghost"}
              className={
                isLogin
                  ? "flex-1 bg-amber-500/90 hover:bg-amber-500 text-slate-900 font-semibold shadow-lg shadow-amber-500/20 border-0"
                  : "flex-1 text-slate-400 hover:text-amber-200 border-0"
              }
              onClick={() => setIsLogin(true)}
            >
              Sign In
            </Button>
            <Button
              type="button"
              variant={!isLogin ? "default" : "ghost"}
              className={
                !isLogin
                  ? "flex-1 bg-amber-500/90 hover:bg-amber-500 text-slate-900 font-semibold shadow-lg shadow-amber-500/20 border-0"
                  : "flex-1 text-slate-400 hover:text-amber-200 border-0"
              }
              onClick={() => setIsLogin(false)}
            >
              Register
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
                  <Input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="pl-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-amber-400/20 backdrop-blur-sm"
                    placeholder="Your name"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="pl-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-amber-400/20 backdrop-blur-sm"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50" />
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="pl-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-amber-400/20 backdrop-blur-sm"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm backdrop-blur-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold shadow-lg shadow-amber-500/25 border-0 h-11"
              disabled={loading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : isLogin ? (
                "Enter the Universe"
              ) : (
                "Create Your Star"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500/60 mt-6">
          A private galaxy for the Nash family
        </p>
      </div>
    </div>
  );
}
