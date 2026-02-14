import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  CheckCircle,
  Clock,
  Shield,
  Users,
  ArrowRight,
} from "lucide-react";

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [user, loading, navigate]);

  const features = [
    { icon: ShieldCheck, title: "Multi-Tenant", description: "Each campus operates independently with isolated data" },
    { icon: Users, title: "Role-Based Access", description: "Admins, supervisors, students & technicians with tailored views" },
    { icon: Clock, title: "Real-Time Tracking", description: "Track complaint status from submission to resolution" },
    { icon: Shield, title: "Secure & Reliable", description: "Enterprise-grade security with data isolation" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <nav className="flex items-center justify-between py-6">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
                <ShieldCheck className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-semibold text-foreground">CampusCare ERP</span>
            </div>
            <Link to="/auth">
              <Button variant="outline">Sign In</Button>
            </Link>
          </nav>

          <div className="py-24 sm:py-32 lg:py-40">
            <div className="text-center animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-sm text-muted-foreground mb-8">
                <CheckCircle className="h-4 w-4 text-accent" />
                Streamline campus maintenance
              </div>

              <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                Campus Complaint &<br />
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Maintenance Management
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                A comprehensive multi-tenant ERP system for managing campus
                complaints, maintenance requests, and facility operations across
                multiple colleges.
              </p>

              <div className="mt-10 flex items-center justify-center gap-4">
                <Link to="/auth">
                  <Button size="lg" className="gradient-primary">
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="outline">Register Campus</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="py-24 bg-card">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl font-semibold text-foreground">
              Everything you need to manage campus maintenance
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">Built for educational institutions of all sizes</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="relative group rounded-2xl border border-border bg-background p-6 shadow-card hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative rounded-3xl gradient-hero p-12 lg:p-16 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
            <div className="relative text-center">
              <h2 className="font-display text-3xl font-semibold text-primary-foreground mb-4">
                Ready to streamline your campus operations?
              </h2>
              <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
                Join hundreds of campuses using CampusCare ERP to manage maintenance requests efficiently.
              </p>
              <Link to="/auth">
                <Button size="lg" variant="secondary" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                  Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
                <ShieldCheck className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display font-semibold text-foreground">CampusCare ERP</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 CampusCare ERP. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
