import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Wrench } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const RepairQueue = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadPendingReports();
  }, []);

  const loadPendingReports = async () => {
    const { data, error } = await supabase
      .from("leakage_reports")
      .select(`
        *,
        products(chassis_no, product_name),
        vehicle_types(name),
        vehicle_models(name),
        leakages(leakage_type, description),
        profiles(full_name)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (data) {
      setReports(data);
    }
    setLoading(false);
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
          {reports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wrench className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">No pending repairs at the moment</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reports.map((report) => (
                <Card key={report.id} className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/repair/${report.id}`)}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">
                        {report.products?.product_name}
                      </CardTitle>
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Chassis No</p>
                      <p className="font-medium">{report.products?.chassis_no}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Vehicle</p>
                      <p className="font-medium">
                        {report.vehicle_types?.name} - {report.vehicle_models?.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Leakages ({report.leakages?.length})</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {report.leakages?.map((leak: any, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {leak.leakage_type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Reported by</p>
                      <p className="text-sm">{report.profiles?.full_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Reported at</p>
                      <p className="text-sm">{new Date(report.created_at).toLocaleString()}</p>
                    </div>
                    <Button className="w-full mt-4">
                      <Wrench className="w-4 h-4 mr-2" />
                      Start Repair
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default RepairQueue;
