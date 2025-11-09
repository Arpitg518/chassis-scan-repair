import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ScanBarcode, ArrowLeft, CheckCircle2 } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const ScanProduct = () => {
  const [chassisNo, setChassisNo] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);
  const [vehicleModels, setVehicleModels] = useState<any[]>([]);
  const [selectedVehicleType, setSelectedVehicleType] = useState("");
  const [selectedVehicleModel, setSelectedVehicleModel] = useState("");
  const [leakages, setLeakages] = useState<{ type: string; description: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const leakageTypes = [
    { value: "oil", label: "Oil Leakage" },
    { value: "coolant", label: "Coolant Leakage" },
    { value: "hydraulic", label: "Hydraulic Leakage" },
    { value: "fuel", label: "Fuel Leakage" },
    { value: "air", label: "Air Leakage" },
    { value: "other", label: "Other" },
  ];

  useEffect(() => {
    loadVehicleTypes();
  }, []);

  useEffect(() => {
    if (selectedVehicleType) {
      loadVehicleModels(selectedVehicleType);
    }
  }, [selectedVehicleType]);

  const loadVehicleTypes = async () => {
    const { data } = await supabase.from("vehicle_types").select("*");
    if (data) setVehicleTypes(data);
  };

  const loadVehicleModels = async (vehicleTypeId: string) => {
    const { data } = await supabase
      .from("vehicle_models")
      .select("*")
      .eq("vehicle_type_id", vehicleTypeId);
    if (data) setVehicleModels(data);
  };

  const handleScan = async () => {
    if (!chassisNo.trim()) {
      toast({
        title: "Error",
        description: "Please enter a chassis number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("chassis_no", chassisNo)
      .single();

    if (error || !data) {
      toast({
        title: "Product not found",
        description: "No product found with this chassis number",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setProduct(data);
    setStep(2);
    setLoading(false);
  };

  const handleAddLeakage = (type: string) => {
    const existing = leakages.find((l) => l.type === type);
    if (existing) {
      setLeakages(leakages.filter((l) => l.type !== type));
    } else {
      setLeakages([...leakages, { type, description: "" }]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedVehicleType || !selectedVehicleModel || leakages.length === 0) {
      toast({
        title: "Missing information",
        description: "Please select vehicle type, model and at least one leakage",
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

    const { data: report, error: reportError } = await supabase
      .from("leakage_reports")
      .insert({
        product_id: product.id,
        vehicle_type_id: selectedVehicleType,
        vehicle_model_id: selectedVehicleModel,
        tester_id: user.id,
        status: "pending",
      })
      .select()
      .single();

    if (reportError) {
      toast({
        title: "Error",
        description: reportError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const leakageInserts = leakages.map((l) => ({
      report_id: report.id,
      leakage_type: l.type as "oil" | "coolant" | "hydraulic" | "fuel" | "air" | "other",
      description: l.description,
    }));

    const { error: leakageError } = await supabase.from("leakages").insert(leakageInserts);

    if (leakageError) {
      toast({
        title: "Error",
        description: leakageError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    toast({
      title: "Report submitted!",
      description: "The leakage report has been submitted successfully",
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
                  Step 1: Scan Product
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="chassisNo">Chassis Number</Label>
                  <Input
                    ref={inputRef}
                    id="chassisNo"
                    type="text"
                    placeholder="Enter or scan chassis number"
                    value={chassisNo}
                    onChange={(e) => setChassisNo(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleScan();
                      }
                    }}
                    className="text-lg"
                  />
                  <p className="text-sm text-muted-foreground">
                    Use a barcode scanner or type the chassis number manually
                  </p>
                </div>
                <Button onClick={handleScan} disabled={loading} className="w-full" size="lg">
                  {loading ? "Scanning..." : "Scan Product"}
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && product && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Product Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Chassis No</p>
                      <p className="font-semibold">{product.chassis_no}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Product Name</p>
                      <p className="font-semibold">{product.product_name}</p>
                    </div>
                  </div>
                  {product.description && (
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="text-sm">{product.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Step 2: Vehicle Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Vehicle Type</Label>
                    <Select value={selectedVehicleType} onValueChange={setSelectedVehicleType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle type" />
                      </SelectTrigger>
                      <SelectContent className="bg-card z-50">
                        {vehicleTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedVehicleType && (
                    <div className="space-y-2">
                      <Label>Vehicle Model</Label>
                      <Select value={selectedVehicleModel} onValueChange={setSelectedVehicleModel}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle model" />
                        </SelectTrigger>
                        <SelectContent className="bg-card z-50">
                          {vehicleModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Step 3: Report Leakages</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {leakageTypes.map((type) => {
                      const isSelected = leakages.some((l) => l.type === type.value);
                      return (
                        <div key={type.value} className="flex items-start gap-3 p-3 border rounded-lg">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleAddLeakage(type.value)}
                            id={type.value}
                          />
                          <div className="flex-1">
                            <Label htmlFor={type.value} className="cursor-pointer font-medium">
                              {type.label}
                            </Label>
                            {isSelected && (
                              <Input
                                placeholder="Add description (optional)"
                                value={leakages.find((l) => l.type === type.value)?.description || ""}
                                onChange={(e) => {
                                  setLeakages(
                                    leakages.map((l) =>
                                      l.type === type.value ? { ...l, description: e.target.value } : l
                                    )
                                  );
                                }}
                                className="mt-2"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-4">
                    <Button onClick={handleSubmit} disabled={loading} className="w-full" size="lg">
                      {loading ? "Submitting..." : (
                        <>
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          Submit Report
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
};

export default ScanProduct;
