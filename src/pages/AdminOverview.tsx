import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const AdminOverview = () => {
  const [stats, setStats] = useState({
    pending: 0,
    repaired: 0,
    delayed: 0,
  });
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: reports } = await supabase
      .from("leakage_reports")
      .select(`
        *,
        products(chassis_no, product_name),
        vehicle_types(name),
        vehicle_models(name),
        profiles(full_name),
        repairs(completed_at, profiles(full_name))
      `)
      .order("created_at", { ascending: false })
      .limit(10);

    if (reports) {
      const pending = reports.filter((r) => r.status === "pending").length;
      const repaired = reports.filter((r) => r.status === "repaired").length;
      
      const now = new Date();
      const delayed = reports.filter((r) => {
        if (r.status === "pending") {
          const createdAt = new Date(r.created_at);
          const hoursSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          return hoursSince > 24;
        }
        return false;
      }).length;

      setStats({ pending, repaired, delayed });
      setRecentReports(reports);
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
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card shadow-sm">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Admin Overview</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Repairs</CardTitle>
                <Clock className="h-4 w-4 text-status-pending" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-status-pending">{stats.pending}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Awaiting repair
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-status-repaired" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-status-repaired">{stats.repaired}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Successfully repaired
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Delayed</CardTitle>
                <AlertTriangle className="h-4 w-4 text-status-delayed" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-status-delayed">{stats.delayed}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Over 24 hours old
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentReports.map((report) => {
                  const createdAt = new Date(report.created_at);
                  const now = new Date();
                  const hoursSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
                  const isDelayed = report.status === "pending" && hoursSince > 24;

                  return (
                    <div key={report.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{report.products?.product_name}</p>
                          <Badge variant={report.status === "repaired" ? "default" : "secondary"}>
                            {report.status}
                          </Badge>
                          {isDelayed && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Delayed
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Chassis: {report.products?.chassis_no}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Tester: {report.profiles?.full_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Reported: {createdAt.toLocaleString()}
                        </p>
                        {report.repairs?.[0] && (
                          <p className="text-sm text-status-repaired">
                            Completed by: {report.repairs[0].profiles?.full_name}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default AdminOverview;
