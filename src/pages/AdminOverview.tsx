import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock, CheckCircle2, AlertTriangle, Download, Calendar } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const AdminOverview = () => {
  const [stats, setStats] = useState({
    totalTested: 0,
    leakageFree: 0,
    pending: 0,
    completed: 0,
    delayed: 0,
  });
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const [topLeakages, setTopLeakages] = useState<any[]>([]);
  const [productLines, setProductLines] = useState<any[]>([]);
  const [selectedProductLine, setSelectedProductLine] = useState("");
  const [dateFilter, setDateFilter] = useState("today");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    loadProductLines();
  }, [dateFilter, selectedProductLine]);

  const loadProductLines = async () => {
    const { data } = await (supabase as any).from("product_lines").select("*").order("name");
    if (data) setProductLines(data);
  };

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch(dateFilter) {
      case "today":
        return today.toISOString();
      case "week":
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return weekAgo.toISOString();
      case "month":
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return monthAgo.toISOString();
      default:
        return today.toISOString();
    }
  };

  const loadData = async () => {
    const dateFrom = getDateRange();
    
    const { data: inspections } = await (supabase as any)
      .from("inspection_data")
      .select(`
        *,
        machines(
          chassis_number,
          models(
            name,
            code,
            product_lines(id, name, code)
          )
        ),
        leakage_types(name, code, id),
        profiles(full_name),
        repair_data(
          repair_status,
          completed_at,
          profiles(full_name)
        )
      `)
      .gte("created_at", dateFrom)
      .order("created_at", { ascending: false });

    if (inspections) {
      const totalTested = inspections.length;
      const leakageFree = 0; // In this system, all inspections are for leakages
      const pending = inspections.filter((i) => i.status === "Pending").length;
      const completed = inspections.filter((i) => i.status === "Completed").length;
      
      const now = new Date();
      const delayed = inspections.filter((i) => {
        if (i.status === "Pending") {
          const createdAt = new Date(i.created_at);
          const hoursSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          return hoursSince > 48; // 2 days
        }
        return false;
      }).length;

      setStats({ totalTested, leakageFree, pending, completed, delayed });
      setRecentInspections(inspections.slice(0, 10));

      // Calculate top leakages
      const leakageCounts: { [key: string]: { count: number; name: string; code: string } } = {};
      inspections.forEach((i) => {
        if (i.leakage_types) {
          const key = i.leakage_types.id;
          if (!leakageCounts[key]) {
            leakageCounts[key] = { 
              count: 0, 
              name: i.leakage_types.name,
              code: i.leakage_types.code
            };
          }
          leakageCounts[key].count++;
        }
      });

      const topLeaks = Object.values(leakageCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setTopLeakages(topLeaks);
    }
    setLoading(false);
  };

  const handleExport = () => {
    // Create CSV content
    const headers = ["Chassis No", "Product Line", "Model", "Leakage Type", "Severity", "Status", "Tester", "Reported At"];
    const rows = recentInspections.map(i => [
      i.machines?.chassis_number,
      i.machines?.models?.product_lines?.code,
      i.machines?.models?.code,
      i.leakage_types?.code,
      i.severity,
      i.status,
      i.profiles?.full_name,
      new Date(i.created_at).toLocaleString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inspection-report-${new Date().toISOString()}.csv`;
    a.click();
  };

  const isDelayed = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const hoursSince = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    return hoursSince > 48; // 2 days
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
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            </div>
            <Button onClick={handleExport} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {/* Filters */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedProductLine} onValueChange={setSelectedProductLine}>
                <SelectTrigger>
                  <SelectValue placeholder="All Product Lines" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="">All Product Lines</SelectItem>
                  {productLines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.code} - {line.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tested</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalTested}</div>
                <p className="text-xs text-muted-foreground mt-1">Machines inspected</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Leakage-Free</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-status-repaired" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-status-repaired">{stats.leakageFree}</div>
                <p className="text-xs text-muted-foreground mt-1">No issues found</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-status-pending" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-status-pending">{stats.pending}</div>
                <p className="text-xs text-muted-foreground mt-1">Awaiting repair</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-status-repaired" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-status-repaired">{stats.completed}</div>
                <p className="text-xs text-muted-foreground mt-1">Successfully repaired</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Delayed</CardTitle>
                <AlertTriangle className="h-4 w-4 text-status-delayed" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-status-delayed">{stats.delayed}</div>
                <p className="text-xs text-muted-foreground mt-1">Over 2 days old</p>
              </CardContent>
            </Card>
          </div>

          {/* Top 10 Leakages */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Top 10 Leakages by Frequency</CardTitle>
            </CardHeader>
            <CardContent>
              {topLeakages.length > 0 ? (
                <div className="space-y-3">
                  {topLeakages.map((leak, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{leak.code} - {leak.name}</p>
                      </div>
                      <Badge variant="secondary">{leak.count} occurrences</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No leakage data available</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Inspections */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Inspections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentInspections.map((inspection) => {
                  const delayed = inspection.status === "Pending" && isDelayed(inspection.created_at);

                  return (
                    <div 
                      key={inspection.id} 
                      className={`flex items-start justify-between p-4 border rounded-lg ${delayed ? 'border-status-delayed bg-status-delayed/5' : ''}`}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">
                            {inspection.machines?.models?.product_lines?.code} - {inspection.machines?.models?.code}
                          </p>
                          <Badge variant={inspection.status === "Completed" ? "default" : "secondary"}>
                            {inspection.status}
                          </Badge>
                          <Badge 
                            variant={
                              inspection.severity === "High" ? "destructive" : 
                              inspection.severity === "Medium" ? "default" : "secondary"
                            }
                          >
                            {inspection.severity}
                          </Badge>
                          {delayed && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Delayed
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Chassis: {inspection.machines?.chassis_number}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Leakage: {inspection.leakage_types?.code} - {inspection.leakage_types?.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Tester: {inspection.profiles?.full_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Reported: {new Date(inspection.created_at).toLocaleString()}
                        </p>
                        {inspection.repair_data?.[0] && (
                          <p className="text-sm text-status-repaired">
                            Repaired by: {inspection.repair_data[0].profiles?.full_name} - Status: {inspection.repair_data[0].repair_status}
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