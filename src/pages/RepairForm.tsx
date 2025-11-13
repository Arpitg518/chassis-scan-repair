import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, CheckCircle2, Camera } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const RepairForm = () => {
  const { inspectionId } = useParams();
  const [inspection, setInspection] = useState<any>(null);
  const [repairStatus, setRepairStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadInspection();
  }, [inspectionId]);

  const loadInspection = async () => {
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
      .eq("id", inspectionId)
      .single();

    if (data) {
      setInspection(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!repairStatus || !notes.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in repair status and notes",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    let photoUrl = null;

    if (photoFile) {
      const fileExt = photoFile.name.split(".").pop();
      const fileName = `${inspectionId}-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("repair-photos")
        .upload(fileName, photoFile);

      if (uploadError) {
        toast({
          title: "Upload failed",
          description: "Failed to upload photo. Continuing without photo.",
          variant: "destructive",
        });
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from("repair-photos")
          .getPublicUrl(fileName);
        photoUrl = publicUrl;
      }
    }

    const { error } = await (supabase as any).from("repair_data").insert({
      inspection_id: inspectionId,
      repairman_id: user.id,
      repair_status: repairStatus,
      notes,
      photo_url: photoUrl,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    toast({
      title: "Repair completed!",
      description: "The repair has been submitted successfully. Admin has been notified.",
    });
    setSubmitting(false);
    navigate("/repair-queue");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Inspection not found</p>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["repairman"]}>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card shadow-sm">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/repair-queue")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Complete Repair</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Inspection Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Product Line</p>
                    <p className="font-semibold">{inspection.machines?.models?.product_lines?.code} - {inspection.machines?.models?.product_lines?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Model</p>
                    <p className="font-semibold">{inspection.machines?.models?.code} - {inspection.machines?.models?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Chassis No</p>
                    <p className="font-semibold">{inspection.machines?.chassis_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Reported by</p>
                    <p className="font-semibold">{inspection.profiles?.full_name}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Leakage Type</p>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium">{inspection.leakage_types?.code} - {inspection.leakage_types?.name}</p>
                  </div>
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
                    <p className="text-sm bg-muted p-3 rounded-lg">{inspection.remarks}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Repair Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Repair Status *</Label>
                    <Select value={repairStatus} onValueChange={setRepairStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select repair status" />
                      </SelectTrigger>
                      <SelectContent className="bg-card z-50">
                        <SelectItem value="Repairable">Repairable</SelectItem>
                        <SelectItem value="Not Repairable">Not Repairable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes on Fix *</Label>
                    <Textarea
                      id="notes"
                      placeholder="Describe what you did to fix the problem..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      required
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="photo">Upload Photo as Proof (Optional)</Label>
                    <Input
                      id="photo"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    />
                    {photoFile && (
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <Camera className="w-5 h-5 text-primary" />
                        <p className="text-sm font-medium">{photoFile.name}</p>
                      </div>
                    )}
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full" size="lg">
                    {submitting ? "Submitting..." : (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Submit Repair
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default RepairForm;