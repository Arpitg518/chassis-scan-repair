import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogOut, AlertTriangle, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DashboardStats {
  totalInspections: number;
  leakageFreeToday: number;
  leakageFreeWeek: number;
  leakageFreeMonth: number;
  pendingRepairs: number;
  delayedRepairs: number;
  completedRepairs: number;
}

interface InspectionRecord {
  id: string;
  created_at: string;
  status: string;
  severity: string;
  machine: {
    chassis_number: string;
    model: {
      name: string;
      product_line: {
        name: string;
        code: string;
      };
    };
  };
  leakage_type: {
    name: string;
  } | null;
  profiles: {
    full_name: string;
  };
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalInspections: 0,
    leakageFreeToday: 0,
    leakageFreeWeek: 0,
    leakageFreeMonth: 0,
    pendingRepairs: 0,
    delayedRepairs: 0,
    completedRepairs: 0,
  });
  const [recentInspections, setRecentInspections] = useState<InspectionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Fetch inspections with related data
      const { data: inspections, error } = await supabase
        .from("inspection_data")
        .select(`
          *,
          machine:machines(
            chassis_number,
            model:models(
              name,
              product_line:product_lines(name, code)
            )
          ),
          leakage_type:leakage_types(name)
        `)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Fetch tester profiles separately
      const testerIds = [...new Set(inspections?.map(i => i.tester_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", testerIds);

      // Map profiles to inspections
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const inspectionsWithProfiles = inspections?.map(i => ({
        ...i,
        profiles: profileMap.get(i.tester_id) || { full_name: "Unknown" }
      })) || [];

      const leakageFreeToday = inspectionsWithProfiles.filter(
        (i) => i.severity === "None" && new Date(i.created_at) >= todayStart
      ).length || 0;

      const leakageFreeWeek = inspectionsWithProfiles.filter(
        (i) => i.severity === "None" && new Date(i.created_at) >= weekStart
      ).length || 0;

      const leakageFreeMonth = inspectionsWithProfiles.filter(
        (i) => i.severity === "None" && new Date(i.created_at) >= monthStart
      ).length || 0;

      const pending = inspectionsWithProfiles.filter((i) => i.status === "Pending").length || 0;
      const delayed = inspectionsWithProfiles.filter((i) => i.status === "Delayed").length || 0;
      const completed = inspectionsWithProfiles.filter((i) => i.status === "Completed").length || 0;

      setStats({
        totalInspections: inspectionsWithProfiles.length || 0,
        leakageFreeToday,
        leakageFreeWeek,
        leakageFreeMonth,
        pendingRepairs: pending,
        delayedRepairs: delayed,
        completedRepairs: completed,
      });

      setRecentInspections(inspectionsWithProfiles);
    } catch (error: any) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("selectedRole");
    navigate("/");
  };

  const getStatusColor = (status: string) => {
    if (status === "Completed") return "bg-green-500";
    if (status === "Delayed") return "bg-red-500";
    if (status === "Pending") return "bg-yellow-500";
    return "bg-gray-500";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leakage-Free Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.leakageFreeToday}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Repairs</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingRepairs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delayed Repairs</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.delayedRepairs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedRepairs}</div>
            </CardContent>
          </Card>
        </div>

        {/* Leakage-Free Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Leakage-Free Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-3xl font-bold">{stats.leakageFreeToday}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-3xl font-bold">{stats.leakageFreeWeek}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-3xl font-bold">{stats.leakageFreeMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Inspections */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Inspections</CardTitle>
            <CardDescription>Latest inspection records and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentInspections.map((inspection) => (
                <div
                  key={inspection.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{inspection.machine.model.product_line.code}</Badge>
                      <p className="font-medium">{inspection.machine.model.name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Chassis: {inspection.machine.chassis_number}
                    </p>
                    {inspection.leakage_type && (
                      <p className="text-sm">Leakage: {inspection.leakage_type.name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Tester: {inspection.profiles.full_name} | {new Date(inspection.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={inspection.severity === "None" ? "default" : "destructive"}>
                      {inspection.severity}
                    </Badge>
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(inspection.status)}`} />
                    <p className="text-sm font-medium">{inspection.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
