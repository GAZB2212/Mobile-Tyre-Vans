import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Check, Upload, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface VehicleData {
  title: string;
  make: string;
  model: string;
  year: number;
  fuel: string;
  body: string;
  mileage?: number;
  transmission?: string;
  engine?: string;
}

interface VanWizardProps {
  onComplete: (formData: FormData, files: File[]) => void;
  isLoading: boolean;
}

export function VanWizard({ onComplete, isLoading }: VanWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"lookup" | "confirm" | "setup">("lookup");
  const [registration, setRegistration] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  
  // Track editable form values
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");
  const [published, setPublished] = useState(true); // Default to published
  const [vatIncluded, setVatIncluded] = useState(false);

  const handleLookup = async () => {
    if (!registration.trim()) return;

    setIsLookingUp(true);
    try {
      const response = await apiRequest("POST", "/api/admin/vehicle-lookup", {
        registration,
      });
      const data = await response.json();

      setVehicleData({
        title: data.title,
        make: data.make,
        model: data.model,
        year: data.year,
        fuel: data.specs.fuel,
        body: data.specs.size,
        mileage: data.mileage,
        transmission: data.specs.transmission,
        engine: data.specs.engine,
      });

      setStep("confirm");
    } catch (error: any) {
      toast({
        title: "Lookup failed",
        description: "Registration not found or vehicle data service unavailable. You can continue and enter the van details manually.",
        variant: "destructive",
      });
      // Pre-fill the registration so the user doesn't have to re-type it, then skip to manual entry
      setVehicleData({ title: "", make: "", model: "", year: new Date().getFullYear(), fuel: "Diesel", body: "MWB", transmission: "Manual" });
      setStep("confirm");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleConfirm = () => {
    // Initialize form values from vehicle data
    if (vehicleData) {
      setTitle(vehicleData.title);
      setSlug(vehicleData.title.toLowerCase().replace(/[\/\s]+/g, "-"));
      setMileage(vehicleData.mileage?.toString() || "");
      setPrice(""); // User must enter price
    }
    setStep("setup");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onComplete(formData, selectedFiles);
  };

  // Step 1: Vehicle Lookup
  if (step === "lookup") {
    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold mb-2">Vehicle Lookup</h3>
          <p className="text-sm text-muted-foreground">
            Enter registration number to find vehicle details
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="reg-lookup">Registration Number</Label>
            <Input
              id="reg-lookup"
              value={registration}
              onChange={(e) => setRegistration(e.target.value.toUpperCase())}
              placeholder="NL72XVC"
              className="font-mono text-center text-lg"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLookup();
                }
              }}
            />
          </div>

          <Button
            type="button"
            onClick={handleLookup}
            disabled={!registration.trim() || isLookingUp}
            className="w-full"
            size="lg"
          >
            <Search className="w-4 h-4 mr-2" />
            {isLookingUp ? "Searching DVLA database..." : "Search"}
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Confirm Vehicle Details
  if (step === "confirm" && vehicleData) {
    const lookupSucceeded = !!vehicleData.title;
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${lookupSucceeded ? "bg-green-100 dark:bg-green-900/20" : "bg-yellow-100 dark:bg-yellow-900/20"}`}>
            <Check className={`w-5 h-5 ${lookupSucceeded ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}`} />
          </div>
          <div className="flex-1">
            {lookupSucceeded ? (
              <>
                <h3 className="font-semibold text-lg">{vehicleData.title}</h3>
                <p className="text-sm text-muted-foreground">
                  Registration: {registration} — is this the correct vehicle?
                </p>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-lg">Enter details manually</h3>
                <p className="text-sm text-muted-foreground">
                  Registration <span className="font-mono">{registration}</span> could not be found automatically. You can fill in the details on the next screen.
                </p>
              </>
            )}
          </div>
        </div>

        {lookupSucceeded && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-accent/5 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Year</p>
              <p className="font-semibold">{vehicleData.year}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Fuel</p>
              <p className="font-semibold">{vehicleData.fuel}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Body</p>
              <p className="font-semibold">{vehicleData.body}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep("lookup")}
            className="flex-1"
          >
            Search Different Vehicle
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="flex-1"
          >
            {lookupSucceeded ? "Confirm & Continue" : "Continue Manually"}
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: Complete Vehicle Setup
  return (
    <form onSubmit={handleSubmit} className="space-y-6 relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
          <div className="flex flex-col items-center gap-4 p-8 bg-card rounded-lg border shadow-lg">
            <div className="relative">
              <Upload className="w-16 h-16 text-primary animate-pulse" />
              <Loader2 className="w-8 h-8 text-primary animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-semibold text-lg">Uploading Van to Inventory</p>
              <p className="text-sm text-muted-foreground">
                Uploading {selectedFiles.length} {selectedFiles.length === 1 ? 'image' : 'images'} and saving details...
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="border-b pb-4 mb-4">
        <h3 className="font-semibold text-lg">Complete Vehicle Setup</h3>
        <p className="text-sm text-muted-foreground">{vehicleData?.title}</p>
      </div>

      {/* Hidden fields - MUST be outside tabs so they're always included in FormData */}
      <input type="hidden" name="registration" value={registration} />
      <input type="hidden" name="make" value={vehicleData?.make || ""} />
      <input type="hidden" name="model" value={vehicleData?.model || ""} />
      <input type="hidden" name="year" value={vehicleData?.year || ""} />
      <input type="hidden" name="transmission" value={vehicleData?.transmission || "Manual"} />
      <input type="hidden" name="fuel" value={vehicleData?.fuel || "Diesel"} />
      <input type="hidden" name="size" value={vehicleData?.body || "MWB"} />
      <input type="hidden" name="engine" value={vehicleData?.engine || ""} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="price" value={price} />
      <input type="hidden" name="mileage" value={mileage} />
      <input type="hidden" name="published" value={published ? "on" : ""} />
      <input type="hidden" name="vatIncluded" value={vatIncluded ? "on" : ""} />

      <Tabs defaultValue="pricing" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="docs">Docs</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="space-y-4 pt-4">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title-visible">Vehicle Title</Label>
              <Input 
                id="title-visible" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="slug-visible">URL Slug</Label>
              <Input
                id="slug-visible"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price-visible">Selling Price (£)</Label>
              <Input 
                id="price-visible" 
                type="number" 
                placeholder="25000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mileage-visible">Mileage</Label>
              <Input
                id="mileage-visible"
                type="number"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="images" className="space-y-4 pt-4">
          <div>
            <Label htmlFor="image-upload">Upload Images</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Select up to 10 images. First image will be the hero image.
              {selectedImages.length > 0 && (
                <span className="font-medium text-foreground ml-2">
                  ({selectedImages.length} selected)
                </span>
              )}
            </p>
            <Input
              id="image-upload"
              type="file"
              accept="image/*"
              multiple
              className="cursor-pointer"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  const newFiles = Array.from(files);
                  const combinedFiles = [...selectedFiles, ...newFiles];
                  const limitedFiles = combinedFiles.slice(0, 10);
                  const previews = limitedFiles.map((file) =>
                    URL.createObjectURL(file)
                  );
                  setSelectedFiles(limitedFiles);
                  setSelectedImages(previews);
                  if (combinedFiles.length > 10) {
                    toast({
                      title: "Too many files",
                      description: "Maximum 10 images allowed",
                      variant: "destructive",
                    });
                  }
                }
                e.target.value = "";
              }}
            />
          </div>

          {selectedImages.length > 0 && (
            <div className="grid grid-cols-3 gap-3 max-h-96 overflow-y-auto p-2 border rounded">
              {selectedImages.map((preview, index) => (
                <div key={index} className="relative aspect-video">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover rounded border"
                  />
                  {index === 0 && (
                    <div className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded text-xs font-bold">
                      Hero
                    </div>
                  )}
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white px-1.5 py-0.5 rounded text-xs">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="docs" className="space-y-4 pt-4">
          <div>
            <Label htmlFor="description">Vehicle Description</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Optional: Add a description for this vehicle
            </p>
            <textarea
              id="description"
              name="description"
              className="w-full min-h-32 p-3 rounded-md border bg-background"
              placeholder="Enter vehicle description or generate one using AI..."
            />
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="doors">Doors (optional)</Label>
              <Input id="doors" name="doors" type="number" placeholder="4" />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="vatIncluded-visible"
                checked={vatIncluded}
                onChange={(e) => setVatIncluded(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="vatIncluded-visible">Price includes VAT</Label>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="published-visible"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="published-visible">Publish immediately</Label>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep("confirm")}
        >
          Back
        </Button>
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? "Saving to Inventory..." : "Save to Inventory"}
        </Button>
      </div>
    </form>
  );
}
