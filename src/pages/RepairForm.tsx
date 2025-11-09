import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, CheckCircle2 } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const RepairForm = () => {
  const { reportId } = useParams();
  const [report, setReport] = useState<any>(null);
  const [problemDescription, setProblemDescription] = useState("");
  const [repairDescription, setRepairDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadReport();
  }, [reportId]);

  const loadReport = async () => {
    const { data, error } = await supabase
      .from("leakage_reports")
      .select(`
        *,
        products(chassis_no, product_name, description),
        vehicle_types(name),
        vehicle_models(name),
        leakages(leakage_type, description),
        profiles(full_name)
      `)
      .eq("id", reportId)
      .single();

    if (data) {
      setReport(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!problemDescription.trim() || !repairDescription.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
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
      const fileName = `${reportId}-${Date.now()}.${fileExt}`;
      
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

    const { error } = await supabase.from("repairs").insert({
      report_id: reportId,
      repairman_id: user.id,
      problem_description: problemDescription,
      repair_description: repairDescription,
      photo_url: photoUrl,
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
      description: "The repair has been submitted successfully. All users have been notified.",
    });
    setSubmitting(false);
    navigate("/dashboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Report not found</p>
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
                <CardTitle>Report Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Product</p>
                    <p className="font-semibold">{report.products?.product_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Chassis No</p>
                    <p className="font-semibold">{report.products?.chassis_no}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle</p>
                    <p className="font-semibold">
                      {report.vehicle_types?.name} - {report.vehicle_models?.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Reported by</p>
                    <p className="font-semibold">{report.profiles?.full_name}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Reported Leakages</p>
                  <div className="space-y-2">
                    {report.leakages?.map((leak: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-muted rounded">
                        <Badge variant="outline">{leak.leakage_type}</Badge>
                        {leak.description && (
                          <p className="text-sm text-muted-foreground">{leak.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Repair Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="problem">Problem Identified *</Label>
                    <Textarea
                      id="problem"
                      placeholder="Describe the problem you identified..."
                      value={problemDescription}
                      onChange={(e) => setProblemDescription(e.target.value)}
                      required
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="repair">Repair Performed *</Label>
                    <Textarea
                      id="repair"
                      placeholder="Describe what you did to fix the problem..."
                      value={repairDescription}
                      onChange={(e) => setRepairDescription(e.target.value)}
                      required
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="photo">Upload Photo (Optional)</Label>
                    <Input
                      id="photo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    />
                    {photoFile && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        {photoFile.name}
                      </p>
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
