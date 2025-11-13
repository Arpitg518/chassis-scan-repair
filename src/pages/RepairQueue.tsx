import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Wrench, AlertTriangle } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const RepairQueue = () => {
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadPendingInspections();
  }, []);

  const loadPendingInspections = async () => {
    const { data, error } = await (supabase as any)
      .from("inspection_data")
      .select(`
        *,
        machines(
          chassis_number,
          models(
            name,
            code,
            product_lines(name, code)
          )
        ),
        leakage_types(name, code),
        profiles(full_name)
      `)
      .eq("status", "Pending")
      .order("created_at", { ascending: true });

    if (data) {
      setInspections(data);
    }
    setLoading(false);
  };

  const isDelayed = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const hoursSince = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    return hoursSince > 48; // 2 days = 48 hours
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["repairman"]}>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card shadow-sm">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Repair Queue</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {inspections.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wrench className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">No pending repairs at the moment</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {inspections.map((inspection) => {
                const delayed = isDelayed(inspection.created_at);
                return (
                  <Card 
                    key={inspection.id} 
                    className={`hover:shadow-lg transition-shadow cursor-pointer ${delayed ? 'border-status-delayed' : ''}`}
                    onClick={() => navigate(`/repair/${inspection.id}`)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">
                          {inspection.machines?.models?.product_lines?.code}
                        </CardTitle>
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary">Pending</Badge>
                          {delayed && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Delayed
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Chassis No</p>
                        <p className="font-medium">{inspection.machines?.chassis_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Model</p>
                        <p className="font-medium">
                          {inspection.machines?.models?.code} - {inspection.machines?.models?.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Leakage Type</p>
                        <p className="font-medium">
                          {inspection.leakage_types?.code} - {inspection.leakage_types?.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Severity</p>
                        <Badge 
                          variant={
                            inspection.severity === "High" ? "destructive" : 
                            inspection.severity === "Medium" ? "default" : "secondary"
                          }
                        >
                          {inspection.severity}
                        </Badge>
                      </div>
                      {inspection.remarks && (
                        <div>
                          <p className="text-sm text-muted-foreground">Tester Remarks</p>
                          <p className="text-sm">{inspection.remarks}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-muted-foreground">Reported by</p>
                        <p className="text-sm">{inspection.profiles?.full_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Reported at</p>
                        <p className="text-sm">{new Date(inspection.created_at).toLocaleString()}</p>
                      </div>
                      <Button className="w-full mt-4">
                        <Wrench className="w-4 h-4 mr-2" />
                        Start Repair
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default RepairQueue;