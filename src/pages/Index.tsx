import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Wrench, ClipboardCheck, BarChart3, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-secondary/30">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center text-primary-foreground space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Quality Tracking System
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90">
              Streamline your machinery quality assurance and repair workflow
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="bg-card text-card-foreground rounded-lg p-6 shadow-lg">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-secondary rounded-full">
                  <ClipboardCheck className="w-10 h-10 text-secondary-foreground" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Test & Report</h3>
              <p className="text-muted-foreground">
                Scan products, identify leakages, and submit detailed reports instantly
              </p>
            </div>

            <div className="bg-card text-card-foreground rounded-lg p-6 shadow-lg">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-primary rounded-full">
                  <Wrench className="w-10 h-10 text-primary-foreground" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Repair & Update</h3>
              <p className="text-muted-foreground">
                Access repair queues, fix issues, and document your work with photos
              </p>
            </div>

            <div className="bg-card text-card-foreground rounded-lg p-6 shadow-lg">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-accent rounded-full">
                  <BarChart3 className="w-10 h-10 text-accent-foreground" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Track Progress</h3>
              <p className="text-muted-foreground">
                Monitor completion rates, identify delays, and optimize workflow
              </p>
            </div>
          </div>

          <div className="pt-8">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="text-lg px-8 py-6 bg-secondary hover:bg-secondary/90 text-secondary-foreground"
            >
              Get Started
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>

          <div className="pt-12 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <p className="text-3xl font-bold">Fast</p>
              <p className="text-sm text-primary-foreground/80">Scan & Report</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">Efficient</p>
              <p className="text-sm text-primary-foreground/80">Repair Tracking</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">Clear</p>
              <p className="text-sm text-primary-foreground/80">Progress Visibility</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
