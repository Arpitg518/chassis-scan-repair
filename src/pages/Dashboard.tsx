import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Wrench, ClipboardCheck, BarChart3 } from "lucide-react";

const Dashboard = () => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      setUserName(profile?.full_name || "User");

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData) {
        setUserRole(roleData.role);
      }
      setLoading(false);
    };

    loadUserData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You've been successfully logged out.",
    });
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Quality Tracking System</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Welcome, {userName}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!userRole ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-card rounded-lg p-8 shadow-md text-center">
              <h2 className="text-2xl font-bold mb-4">Role Assignment Required</h2>
              <p className="text-muted-foreground mb-6">
                Your account needs to be assigned a role by an administrator before you can access the system.
                Please contact your system administrator.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8">
              {userRole === "tester" && "Testing Dashboard"}
              {userRole === "repairman" && "Repair Dashboard"}
              {userRole === "admin" && "Admin Dashboard"}
            </h2>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {userRole === "tester" && (
                <>
                  <Button
                    onClick={() => navigate("/scan")}
                    className="h-32 flex flex-col items-center justify-center gap-3"
                    size="lg"
                  >
                    <ClipboardCheck className="w-12 h-12" />
                    <span className="text-lg font-semibold">Scan & Report</span>
                  </Button>
                  <Button
                    onClick={() => navigate("/reports")}
                    variant="outline"
                    className="h-32 flex flex-col items-center justify-center gap-3"
                    size="lg"
                  >
                    <BarChart3 className="w-12 h-12" />
                    <span className="text-lg font-semibold">My Reports</span>
                  </Button>
                </>
              )}

              {userRole === "repairman" && (
                <>
                  <Button
                    onClick={() => navigate("/repair-queue")}
                    className="h-32 flex flex-col items-center justify-center gap-3"
                    size="lg"
                  >
                    <Wrench className="w-12 h-12" />
                    <span className="text-lg font-semibold">Repair Queue</span>
                  </Button>
                  <Button
                    onClick={() => navigate("/my-repairs")}
                    variant="outline"
                    className="h-32 flex flex-col items-center justify-center gap-3"
                    size="lg"
                  >
                    <BarChart3 className="w-12 h-12" />
                    <span className="text-lg font-semibold">My Repairs</span>
                  </Button>
                </>
              )}

              {userRole === "admin" && (
                <>
                  <Button
                    onClick={() => navigate("/admin/overview")}
                    className="h-32 flex flex-col items-center justify-center gap-3"
                    size="lg"
                  >
                    <BarChart3 className="w-12 h-12" />
                    <span className="text-lg font-semibold">Overview</span>
                  </Button>
                  <Button
                    onClick={() => navigate("/admin/users")}
                    variant="outline"
                    className="h-32 flex flex-col items-center justify-center gap-3"
                    size="lg"
                  >
                    <ClipboardCheck className="w-12 h-12" />
                    <span className="text-lg font-semibold">Manage Users</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
