import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogOut, Camera, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface InspectionRecord {
  id: string;
  created_at: string;
  status: string;
  severity: string;
  remarks: string;
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

const RepairmanQueue = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<InspectionRecord | null>(null);
  const [repairStatus, setRepairStatus] = useState("Repairable");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    checkAuth();
    loadPendingInspections();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
    } else {
      setUser(user);
    }
  };

  const loadPendingInspections = async () => {
    const { data, error } = await supabase
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
      .in("status", ["Pending", "Delayed"])
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to load inspections");
      return;
    }

    // Fetch tester profiles separately
    const testerIds = [...new Set(data?.map(i => i.tester_id) || [])];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", testerIds);

    // Map profiles to inspections
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const inspectionsWithProfiles = data?.map(i => ({
      ...i,
      profiles: profileMap.get(i.tester_id) || { full_name: "Unknown" }
    })) || [];

    setInspections(inspectionsWithProfiles);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0]);
    }
  };

  const handleSubmitRepair = async () => {
    if (!selectedInspection || !user) return;

    setLoading(true);
    try {
      let photoUrl = null;

      // Upload photo if provided
      if (photo) {
        const fileExt = photo.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from("repair-photos")
          .upload(filePath, photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("repair-photos")
          .getPublicUrl(filePath);

        photoUrl = publicUrl;
      }

      // Create repair record
      const { error: repairError } = await supabase
        .from("repair_data")
        .insert({
          inspection_id: selectedInspection.id,
          repairman_id: user.id,
          repair_status: repairStatus,
          notes,
          photo_url: photoUrl,
        });

      if (repairError) throw repairError;

      toast.success("Repair completed successfully");
      setDialogOpen(false);
      setSelectedInspection(null);
      setRepairStatus("Repairable");
      setNotes("");
      setPhoto(null);
      loadPendingInspections();
    } catch (error: any) {
      toast.error("Failed to submit repair: " + error.message);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">Repair Queue</h1>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {inspections.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No pending repairs at the moment
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {inspections.map((inspection) => (
              <Card key={inspection.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{inspection.machine.model.product_line.code}</Badge>
                        <CardTitle className="text-xl">{inspection.machine.model.name}</CardTitle>
                      </div>
                      <CardDescription>Chassis: {inspection.machine.chassis_number}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(inspection.status)}`} />
                      <span className="font-medium">{inspection.status}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    {inspection.leakage_type && (
                      <p className="text-sm">
                        <span className="font-medium">Leakage Type:</span> {inspection.leakage_type.name}
                      </p>
                    )}
                    <p className="text-sm">
                      <span className="font-medium">Severity:</span>{" "}
                      <Badge variant={inspection.severity === "High" ? "destructive" : "default"}>
                        {inspection.severity}
                      </Badge>
                    </p>
                    {inspection.remarks && (
                      <p className="text-sm">
                        <span className="font-medium">Tester Remarks:</span> {inspection.remarks}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Reported by {inspection.profiles.full_name} on{" "}
                      {new Date(inspection.created_at).toLocaleString()}
                    </p>
                  </div>

                  <Dialog open={dialogOpen && selectedInspection?.id === inspection.id} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        className="w-full"
                        onClick={() => setSelectedInspection(inspection)}
                      >
                        Start Repair
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Complete Repair</DialogTitle>
                        <DialogDescription>
                          Fill in the repair details and upload proof photo
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Repair Status</Label>
                          <Select value={repairStatus} onValueChange={setRepairStatus}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Repairable">Repairable</SelectItem>
                              <SelectItem value="Not Repairable">Not Repairable</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Repair Notes</Label>
                          <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Describe the repair work done..."
                            rows={4}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Upload Photo (Proof)</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="cursor-pointer"
                          />
                          {photo && (
                            <p className="text-sm text-muted-foreground">
                              Selected: {photo.name}
                            </p>
                          )}
                        </div>

                        <Button
                          onClick={handleSubmitRepair}
                          className="w-full"
                          disabled={loading || !notes}
                        >
                          {loading ? "Submitting..." : "Submit Repair"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RepairmanQueue;
