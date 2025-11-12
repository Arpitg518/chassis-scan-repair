import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogOut, Camera, Scan } from "lucide-react";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";

interface ProductLine {
  id: string;
  name: string;
  code: string;
}

interface Model {
  id: string;
  name: string;
  code: string;
}

interface LeakageType {
  id: string;
  name: string;
}

const TesterInspection = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [leakageTypes, setLeakageTypes] = useState<LeakageType[]>([]);
  
  const [selectedProductLine, setSelectedProductLine] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [selectedLeakageType, setSelectedLeakageType] = useState("");
  const [severity, setSeverity] = useState("None");
  const [remarks, setRemarks] = useState("");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAuth();
    loadProductLines();
  }, []);

  useEffect(() => {
    if (selectedProductLine) {
      loadModels(selectedProductLine);
      loadLeakageTypes(selectedProductLine);
    }
  }, [selectedProductLine]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
    } else {
      setUser(user);
    }
  };

  const loadProductLines = async () => {
    const { data, error } = await supabase
      .from("product_lines")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load product lines");
    } else {
      setProductLines(data || []);
    }
  };

  const loadModels = async (productLineId: string) => {
    const { data, error } = await supabase
      .from("models")
      .select("*")
      .eq("product_line_id", productLineId)
      .order("name");

    if (error) {
      toast.error("Failed to load models");
    } else {
      setModels(data || []);
    }
  };

  const loadLeakageTypes = async (productLineId: string) => {
    const { data, error } = await supabase
      .from("leakage_types")
      .select("*")
      .eq("product_line_id", productLineId)
      .order("name");

    if (error) {
      toast.error("Failed to load leakage types");
    } else {
      setLeakageTypes(data || []);
    }
  };

  const startScan = async () => {
    setScanning(true);
    try {
      const permission = await BarcodeScanner.requestPermissions();
      if (permission.camera === "granted" || permission.camera === "limited") {
        const result = await BarcodeScanner.scan();
        if (result.barcodes && result.barcodes.length > 0) {
          setChassisNumber(result.barcodes[0].displayValue || result.barcodes[0].rawValue);
          toast.success("Chassis number scanned successfully");
        }
      } else {
        toast.error("Camera permission denied");
      }
    } catch (error: any) {
      toast.error("Scan failed: " + error.message);
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if machine exists, create if not
      let { data: existingMachine } = await supabase
        .from("machines")
        .select("id")
        .eq("chassis_number", chassisNumber)
        .single();

      let machineId = existingMachine?.id;

      if (!machineId) {
        const { data: newMachine, error: machineError } = await supabase
          .from("machines")
          .insert({
            model_id: selectedModel,
            chassis_number: chassisNumber,
          })
          .select()
          .single();

        if (machineError) throw machineError;
        machineId = newMachine.id;
      }

      // Create inspection record
      const { error: inspectionError } = await supabase
        .from("inspection_data")
        .insert({
          machine_id: machineId,
          leakage_type_id: selectedLeakageType || null,
          tester_id: user.id,
          severity,
          remarks,
          status: severity === "None" ? "Completed" : "Pending",
        });

      if (inspectionError) throw inspectionError;

      toast.success("Inspection submitted successfully");
      
      // Reset form
      setSelectedProductLine("");
      setSelectedModel("");
      setChassisNumber("");
      setSelectedLeakageType("");
      setSeverity("None");
      setRemarks("");
    } catch (error: any) {
      toast.error("Failed to submit inspection: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("selectedRole");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">Tester Inspection</h1>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submit Inspection</CardTitle>
            <CardDescription>Scan product and report leakage details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Product Line</Label>
                <Select value={selectedProductLine} onValueChange={setSelectedProductLine}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product line" />
                  </SelectTrigger>
                  <SelectContent>
                    {productLines.map((pl) => (
                      <SelectItem key={pl.id} value={pl.id}>
                        {pl.name} ({pl.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel} disabled={!selectedProductLine}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Chassis Number</Label>
                <div className="flex gap-2">
                  <Input
                    value={chassisNumber}
                    onChange={(e) => setChassisNumber(e.target.value)}
                    placeholder="Enter or scan chassis number"
                    required
                  />
                  <Button type="button" onClick={startScan} disabled={scanning}>
                    {scanning ? <Camera className="animate-pulse" /> : <Scan />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None (Leakage-Free)</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {severity !== "None" && (
                <div className="space-y-2">
                  <Label>Leakage Type</Label>
                  <Select value={selectedLeakageType} onValueChange={setSelectedLeakageType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select leakage type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leakageTypes.map((lt) => (
                        <SelectItem key={lt.id} value={lt.id}>
                          {lt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Remarks (Optional)</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Submitting..." : "Submit Inspection"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TesterInspection;
