import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Wrench, ClipboardCheck } from "lucide-react";

const RoleSelection = () => {
  const navigate = useNavigate();

  const roles = [
    {
      id: "admin",
      title: "Admin",
      description: "Monitor all activities, view metrics, and manage system",
      icon: Shield,
      color: "bg-gradient-to-br from-amber-500 to-amber-700"
    },
    {
      id: "tester",
      title: "Tester",
      description: "Scan products, report leakages, and submit inspections",
      icon: ClipboardCheck,
      color: "bg-gradient-to-br from-yellow-500 to-yellow-700"
    },
    {
      id: "repairman",
      title: "Repairman",
      description: "View repair queue and complete assigned repairs",
      icon: Wrench,
      color: "bg-gradient-to-br from-orange-500 to-orange-700"
    }
  ];

  const handleRoleSelect = (roleId: string) => {
    localStorage.setItem("selectedRole", roleId);
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Leakage Testing System</h1>
          <p className="text-muted-foreground">Select your role to continue</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <Card 
                key={role.id}
                className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary"
                onClick={() => handleRoleSelect(role.id)}
              >
                <CardHeader>
                  <div className={`${role.color} w-16 h-16 rounded-lg flex items-center justify-center mb-4 mx-auto`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-center">{role.title}</CardTitle>
                  <CardDescription className="text-center">{role.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <Button className="w-full" variant="outline">
                    Select {role.title}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
