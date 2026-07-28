import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminSwitch } from "@/components/AdminSwitch";
import { Textarea } from "@/components/ui/textarea";
import { Search, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Van } from "@shared/schema";
import { MultiImageUploader } from "@/components/MultiImageUploader";

interface VanFormProps {
  van?: Van;
  onSubmit: (formData: FormData, files?: File[]) => void;
  isLoading: boolean;
}

export function VanFormNew({ van, onSubmit, isLoading }: VanFormProps) {
  const { toast } = useToast();
  const [registration, setRegistration] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  // Refs for direct DOM manipulation
  const regRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const makeRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const mileageRef = useRef<HTMLInputElement>(null);
  const [transmission, setTransmission] = useState(van?.specs.transmission || 'Manual');
  const [size, setSize] = useState(van?.specs.size || 'MWB');
  const [fuel, setFuel] = useState(van?.specs.fuel || 'Diesel');
  const [euroStatus, setEuroStatus] = useState(van?.euroStatus || '');
  const doorsRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const handleLookup = async () => {
    if (!registration.trim()) return;
    
    setIsLookingUp(true);
    try {
      const response = await apiRequest('POST', '/api/admin/vehicle-lookup', { registration });
      const data = await response.json();
      
      const slug = `${data.make}-${data.model}-${data.year}`.toLowerCase().replace(/\s+/g, '-');
      
      // Directly update DOM values
      if (regRef.current) regRef.current.value = registration.toUpperCase().trim();
      if (titleRef.current) titleRef.current.value = data.title;
      if (slugRef.current) slugRef.current.value = slug;
      if (makeRef.current) makeRef.current.value = data.make;
      if (modelRef.current) modelRef.current.value = data.model;
      if (yearRef.current) yearRef.current.value = String(data.year);
      if (doorsRef.current) doorsRef.current.value = data.specs.doors ? String(data.specs.doors) : '';
      if (engineRef.current) engineRef.current.value = data.specs.engine || '';
      
      setTransmission(data.specs.transmission);
      setSize(data.specs.size);
      setFuel(data.specs.fuel);
      if (data.euroStatus) setEuroStatus(data.euroStatus);
      
      toast({
        title: "Vehicle found",
        description: `Details loaded for ${data.make} ${data.model}${data.euroStatus ? ` (${data.euroStatus})` : ''}`,
      });
    } catch (error: any) {
      const msg = error?.message || '';
      toast({
        title: "Lookup failed",
        description: msg.includes('404') || msg.includes('not found')
          ? "Registration not found in the vehicle database. You can still fill in the details manually below."
          : "Vehicle lookup service is currently unavailable. Please fill in the van details manually below.",
        variant: "destructive",
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleGenerateDescription = async () => {
    // Get current form values
    const make = makeRef.current?.value;
    const model = modelRef.current?.value;
    const year = yearRef.current?.value;
    const mileage = mileageRef.current?.value;
    const engine = engineRef.current?.value;

    if (!make || !model || !year) {
      toast({
        title: "Missing information",
        description: "Please fill in make, model, and year first",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const response = await apiRequest('POST', '/api/admin/generate-van-description', {
        make,
        model,
        year: parseInt(year),
        transmission,
        size,
        fuel,
        mileage: mileage ? parseInt(mileage) : undefined,
        engine: engine || undefined,
      });

      const data = await response.json();

      if (descriptionRef.current && data.description) {
        descriptionRef.current.value = data.description;
      }

      toast({
        title: "Description generated",
        description: "AI-powered description has been added to the field",
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: "Could not generate description. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onSubmit(formData, selectedFiles);
      }}
    >
      <div className="grid gap-4">
        {!van && (
          <Card className="bg-accent/5">
            <CardContent className="pt-6">
              <Label htmlFor="registration">Vehicle Registration Lookup</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="registration"
                  value={registration}
                  onChange={(e) => setRegistration(e.target.value.toUpperCase())}
                  placeholder="Enter reg e.g. AB12 CDE"
                  className="font-mono"
                  data-testid="input-registration"
                />
                <Button
                  type="button"
                  onClick={handleLookup}
                  disabled={!registration.trim() || isLookingUp}
                  data-testid="button-lookup"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {isLookingUp ? "Looking up..." : "Lookup"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Enter a UK vehicle registration to auto-fill vehicle details
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="reg">Reg Plate</Label>
            <Input
              ref={regRef}
              id="reg"
              name="reg"
              defaultValue={van?.reg || ''}
              placeholder="AB12 CDE"
              className="font-mono uppercase"
              onChange={e => { e.target.value = e.target.value.toUpperCase(); }}
              data-testid="input-van-reg"
            />
          </div>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              ref={titleRef}
              id="title"
              name="title"
              defaultValue={van?.title || ''}
              placeholder="Mobile Tyre Van - Ready to Go"
              required
              data-testid="input-van-title"
            />
          </div>
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input
              ref={slugRef}
              id="slug"
              name="slug"
              defaultValue={van?.slug || ''}
              placeholder="ford-transit-custom-2022"
              required
              data-testid="input-van-slug"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="make">Make</Label>
            <Input
              ref={makeRef}
              id="make"
              name="make"
              defaultValue={van?.make || ''}
              placeholder="Ford"
              required
              data-testid="input-van-make"
            />
          </div>
          <div>
            <Label htmlFor="model">Model</Label>
            <Input
              ref={modelRef}
              id="model"
              name="model"
              defaultValue={van?.model || ''}
              placeholder="Transit Custom"
              required
              data-testid="input-van-model"
            />
          </div>
          <div>
            <Label htmlFor="year">Year</Label>
            <Input
              ref={yearRef}
              id="year"
              name="year"
              type="number"
              defaultValue={van?.year || ''}
              placeholder="2022"
              required
              data-testid="input-van-year"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="mileage">Mileage</Label>
            <Input
              ref={mileageRef}
              id="mileage"
              name="mileage"
              type="number"
              defaultValue={van?.mileage || ''}
              placeholder="15000"
              required
              data-testid="input-van-mileage"
            />
          </div>
          <div>
            <Label htmlFor="price">Price (£)</Label>
            <Input
              id="price"
              name="price"
              type="number"
              defaultValue={van ? van.price / 100 : ''}
              placeholder="45000"
              required
              data-testid="input-van-price"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="transmission">Transmission</Label>
            <Select name="transmission" value={transmission} onValueChange={setTransmission}>
              <SelectTrigger data-testid="select-van-transmission">
                <SelectValue placeholder="Select transmission" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Manual">Manual</SelectItem>
                <SelectItem value="Automatic">Automatic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="size">Size</Label>
            <Select name="size" value={size} onValueChange={setSize}>
              <SelectTrigger data-testid="select-van-size">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SWB">SWB (Short Wheel Base)</SelectItem>
                <SelectItem value="MWB">MWB (Medium Wheel Base)</SelectItem>
                <SelectItem value="LWB">LWB (Long Wheel Base)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="fuel">Fuel</Label>
            <Select name="fuel" value={fuel} onValueChange={setFuel}>
              <SelectTrigger data-testid="select-van-fuel">
                <SelectValue placeholder="Select fuel type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Diesel">Diesel</SelectItem>
                <SelectItem value="Petrol">Petrol</SelectItem>
                <SelectItem value="Electric">Electric</SelectItem>
                <SelectItem value="Hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="euroStatus">Euro Emissions Standard</Label>
            <Select name="euroStatus" value={euroStatus} onValueChange={setEuroStatus}>
              <SelectTrigger data-testid="select-van-euro-status">
                <SelectValue placeholder="Select Euro standard" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Euro 6">Euro 6</SelectItem>
                <SelectItem value="Euro 5">Euro 5</SelectItem>
                <SelectItem value="Euro 4">Euro 4</SelectItem>
                <SelectItem value="Euro 3">Euro 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="doors">Doors (optional)</Label>
            <Input
              ref={doorsRef}
              id="doors"
              name="doors"
              type="number"
              defaultValue={van?.specs.doors || ''}
              placeholder="4"
              data-testid="input-van-doors"
            />
          </div>
          <div>
            <Label htmlFor="engine">Engine (optional)</Label>
            <Input
              ref={engineRef}
              id="engine"
              name="engine"
              defaultValue={van?.specs.engine || ''}
              placeholder="2.0L TDCi"
              data-testid="input-van-engine"
            />
          </div>
        </div>

        <div>
          <Label>Van Images (optional)</Label>
          <MultiImageUploader
            selectedFiles={selectedFiles}
            selectedImages={selectedImages}
            onFilesChange={(files, previews) => {
              setSelectedFiles(files);
              setSelectedImages(previews);
            }}
            maxFiles={20}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateDescription}
              disabled={isGeneratingDescription}
              className="!border-2 !border-accent text-accent hover:bg-accent/10"
              data-testid="button-generate-description"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              {isGeneratingDescription ? "Generating..." : "Generate with AI"}
            </Button>
          </div>
          <Textarea
            ref={descriptionRef}
            id="description"
            name="description"
            defaultValue={van?.description || ''}
            placeholder="Van description tailored for mobile tyre business..."
            rows={6}
            data-testid="input-van-description"
          />
          <p className="text-xs text-muted-foreground mt-2">
            AI generates descriptions tailored to mobile tyre van sales, highlighting space, reliability, and equipment capacity
          </p>
        </div>

        <div>
          <Label htmlFor="urgencyBadge">Urgency Badge (optional)</Label>
          <Select name="urgencyBadge" defaultValue={van?.urgencyBadge || "none"}>
            <SelectTrigger data-testid="select-van-urgency-badge">
              <SelectValue placeholder="No badge" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No badge</SelectItem>
              <SelectItem value="Only 1 Left">Only 1 Left</SelectItem>
              <SelectItem value="Selling Fast">Selling Fast</SelectItem>
              <SelectItem value="Hot Deal">Hot Deal</SelectItem>
              <SelectItem value="Just In">Just In</SelectItem>
              <SelectItem value="Nearly New">Nearly New</SelectItem>
              <SelectItem value="Reduced">Reduced</SelectItem>
              <SelectItem value="Price Drop">Price Drop</SelectItem>
              <SelectItem value="Reserved">Reserved</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">Shown as a badge on the van card in the stock listing</p>
        </div>

        <div>
          <Label htmlFor="expectedArrivalDate">Expected arrival date (optional)</Label>
          <Input
            id="expectedArrivalDate"
            name="expectedArrivalDate"
            type="date"
            defaultValue={van?.expectedArrivalDate ? new Date(van.expectedArrivalDate as any).toISOString().split("T")[0] : ""}
            data-testid="input-van-expected-arrival"
          />
          <p className="text-xs text-muted-foreground mt-1">When this van is due in from the supplier — shows on the admin calendar</p>
        </div>

        <div className="flex items-center space-x-2">
          <AdminSwitch
            id="vatIncluded"
            name="vatIncluded"
            defaultChecked={van?.vatIncluded || false}
            data-testid="switch-van-vat"
          />
          <Label htmlFor="vatIncluded">Price includes VAT</Label>
        </div>

        <div className="flex items-center space-x-2">
          <AdminSwitch
            id="published"
            name="published"
            defaultChecked={van ? van.published !== false : true}
            data-testid="switch-van-published"
          />
          <Label htmlFor="published">Published</Label>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isLoading} data-testid="button-submit-van">
            {isLoading ? "Saving..." : van ? "Update Van" : "Create Van"}
          </Button>
        </div>
      </div>
    </form>
  );
}
