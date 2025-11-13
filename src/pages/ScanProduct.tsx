import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ScanBarcode, ArrowLeft, CheckCircle2, Camera } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";

const ScanProduct = () => {
  const [chassisNo, setChassisNo] = useState("");
  const [machine, setMachine] = useState<any>(null);
  const [productLines, setProductLines] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [leakageTypes, setLeakageTypes] = useState<any[]>([]);
  const [selectedProductLine, setSelectedProductLine] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedLeakageType, setSelectedLeakageType] = useState("");
  const [severity, setSeverity] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadProductLines();
  }, []);

  useEffect(() => {
    if (selectedProductLine) {
      loadModels(selectedProductLine);
      loadLeakageTypes(selectedProductLine);
    }
  }, [selectedProductLine]);

  const loadProductLines = async () => {
    const { data } = await (supabase as any).from("product_lines").select("*").order("name");
    if (data) setProductLines(data);
  };

  const loadModels = async (productLineId: string) => {
    const { data } = await (supabase as any)
      .from("models")
      .select("*")
      .eq("product_line_id", productLineId)
      .order("name");
    if (data) setModels(data);
  };

  const loadLeakageTypes = async (productLineId: string) => {
    const { data } = await (supabase as any)
      .from("leakage_types")
      .select("*")
      .eq("product_line_id", productLineId)
      .order("name");
    if (data) setLeakageTypes(data);
  };

  const startScan = async () => {
    try {
      setScanning(true);
      
      // Request camera permission
      const { camera } = await BarcodeScanner.requestPermissions();
      
      if (camera === 'granted' || camera === 'limited') {
        // Start scanning
        const result = await BarcodeScanner.scan();
        
        if (result.barcodes && result.barcodes.length > 0) {
          const scannedValue = result.barcodes[0].displayValue;
          setChassisNo(scannedValue);
          
          toast({
            title: "Scanned successfully!",
            description: `Chassis No: ${scannedValue}`,
          });
        }
      } else {
        toast({
          title: "Permission denied",
          description: "Camera permission is required to scan barcodes",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Scanning error:", error);
      toast({
        title: "Scan failed",
        description: "Unable to scan barcode. Please try again.",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  const handleNext = () => {
    if (!chassisNo.trim()) {
      toast({
        title: "Error",
        description: "Please scan a chassis number first",
        variant: "destructive",
      });
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedProductLine || !selectedModel || !selectedLeakageType || !severity) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // First, check if machine exists or create it
    let { data: existingMachine } = await (supabase as any)
      .from("machines")
      .select("id")
      .eq("chassis_number", chassisNo)
      .eq("model_id", selectedModel)
      .maybeSingle();

    let machineId = existingMachine?.id;

    if (!machineId) {
      const { data: newMachine, error: machineError } = await (supabase as any)
        .from("machines")
        .insert({
          chassis_number: chassisNo,
          model_id: selectedModel,
        })
        .select()
        .single();

      if (machineError) {
        toast({
          title: "Error",
          description: machineError.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      machineId = newMachine.id;
    }

    // Create inspection record
    const { error: inspectionError } = await (supabase as any)
      .from("inspection_data")
      .insert({
        tester_id: user.id,
        machine_id: machineId,
        leakage_type_id: selectedLeakageType,
        severity,
        remarks,
        status: "Pending",
      });

    if (inspectionError) {
      toast({
        title: "Error",
        description: inspectionError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    toast({
      title: "Report submitted!",
      description: "The inspection report has been submitted successfully",
    });
    setLoading(false);
    navigate("/dashboard");
  };

  return (
    <ProtectedRoute allowedRoles={["tester"]}>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card shadow-sm">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Scan & Report</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-2xl">
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScanBarcode className="w-6 h-6 text-primary" />
                  Step 1: Scan Chassis Number
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {chassisNo ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-status-repaired/10 border border-status-repaired rounded-lg">
                      <Label className="text-sm text-muted-foreground">Scanned Chassis Number</Label>
                      <p className="text-2xl font-bold text-foreground mt-1">{chassisNo}</p>
                    </div>
                    <div className="flex gap-3">
                      <Button 
                        onClick={() => setChassisNo("")} 
                        variant="outline" 
                        className="flex-1"
                      >
                        Scan Again
                      </Button>
                      <Button 
                        onClick={handleNext} 
                        disabled={loading} 
                        className="flex-1"
                        size="lg"
                      >
                        {loading ? "Loading..." : "Next"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center py-12 border-2 border-dashed border-border rounded-lg bg-muted/30">
                      <div className="text-center">
                        <Camera className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          Tap the button below to scan barcode
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={startScan} 
                      disabled={scanning} 
                      className="w-full" 
                      size="lg"
                    >
                      {scanning ? "Scanning..." : (
                        <>
                          <Camera className="w-5 h-5 mr-2" />
                          Scan Barcode
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Step 2: Select Product Line & Model</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Product Line *</Label>
                    <Select value={selectedProductLine} onValueChange={setSelectedProductLine}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product line (TLB, VC, SSL, CHEX)" />
                      </SelectTrigger>
                      <SelectContent className="bg-card z-50">
                        {productLines.map((line) => (
                          <SelectItem key={line.id} value={line.id}>
                            {line.code} - {line.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedProductLine && (
                    <div className="space-y-2">
                      <Label>Model *</Label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent className="bg-card z-50 max-h-[300px]">
                          {models.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.code} - {model.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedProductLine && selectedModel && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 3: Report Leakage</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Leakage Type *</Label>
                      <Select value={selectedLeakageType} onValueChange={setSelectedLeakageType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select leakage type" />
                        </SelectTrigger>
                        <SelectContent className="bg-card z-50 max-h-[300px]">
                          {leakageTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.code} - {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Severity *</Label>
                      <Select value={severity} onValueChange={setSeverity}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select severity level" />
                        </SelectTrigger>
                        <SelectContent className="bg-card z-50">
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Remarks (Optional)</Label>
                      <Input
                        placeholder="Add any additional notes..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                      />
                    </div>

                    <div className="pt-4">
                      <Button onClick={handleSubmit} disabled={loading} className="w-full" size="lg">
                        {loading ? "Submitting..." : (
                          <>
                            <CheckCircle2 className="w-5 h-5 mr-2" />
                            Submit Inspection Report
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default ScanProduct;
