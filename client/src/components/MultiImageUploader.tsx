import { useState, useRef, useEffect } from 'react';
import { Upload, X, GripVertical, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import imageCompression from 'browser-image-compression';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface MultiImageUploaderProps {
  selectedFiles: File[];
  selectedImages: string[];
  onFilesChange: (files: File[], previews: string[]) => void;
  maxFiles?: number;
}

function SortableImage({ 
  id, 
  preview, 
  index, 
  isHero, 
  onRemove 
}: { 
  id: string;
  preview: string;
  index: number;
  isHero: boolean;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-video bg-muted rounded-lg overflow-hidden border-2 border-border group"
    >
      <img
        src={preview}
        alt={`Preview ${index + 1}`}
        className="w-full h-full object-cover"
      />
      
      {isHero && (
        <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded text-xs font-bold shadow">
          HERO IMAGE
        </div>
      )}
      
      <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
        #{index + 1}
      </div>
      
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove image ${index + 1}`}
        className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover-elevate active-elevate-2"
        data-testid={`button-remove-image-${index}`}
      >
        <X className="h-4 w-4" />
      </button>
      
      <div
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder image ${index + 1}`}
        className="absolute bottom-2 right-2 bg-black/70 text-white rounded p-1.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        data-testid={`button-drag-image-${index}`}
      >
        <GripVertical className="h-4 w-4" />
      </div>
    </div>
  );
}

export function MultiImageUploader({
  selectedFiles,
  selectedImages,
  onFilesChange,
  maxFiles = 10,
}: MultiImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousUrlsRef = useRef<string[]>([]);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Cleanup: revoke Object URLs only for removed images
  useEffect(() => {
    const previousUrls = previousUrlsRef.current;
    const currentUrls = selectedImages;

    // Find URLs that were removed (in previous but not in current)
    const removedUrls = previousUrls.filter(url => !currentUrls.includes(url));
    
    // Revoke only the removed blob URLs
    removedUrls.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    // Update the ref to current URLs
    previousUrlsRef.current = currentUrls;
  }, [selectedImages]);

  // Cleanup on unmount: revoke all remaining blob URLs
  useEffect(() => {
    return () => {
      previousUrlsRef.current.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    const combinedFiles = [...selectedFiles, ...newFiles];

    // Limit to max files
    const maxAllowed = Math.min(combinedFiles.length, maxFiles);
    const limitedFiles = combinedFiles.slice(0, maxAllowed);

    // Compress new images for better quality while reducing file size
    const compressedFiles: File[] = [];
    for (let i = 0; i < limitedFiles.length; i++) {
      const file = limitedFiles[i];
      
      // Skip already compressed files (from selectedFiles)
      if (selectedFiles.includes(file)) {
        compressedFiles.push(file);
        continue;
      }

      try {
        const options = {
          maxSizeMB: 3, // Higher quality than upgrade images (3MB vs 1MB)
          maxWidthOrHeight: 2560, // Higher resolution for showcase images (2560px vs 1920px)
          useWebWorker: true,
          fileType: file.type,
        };
        
        const compressedFile = await imageCompression(file, options);
        console.log(`📊 Van image - Original: ${(file.size / 1024 / 1024).toFixed(2)}MB, Compressed: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
        compressedFiles.push(compressedFile);
      } catch (error) {
        console.error('Image compression failed:', error);
        // Fallback to original file if compression fails
        compressedFiles.push(file);
      }
    }

    // Create preview URLs for all files
    const previews = compressedFiles.map(file => URL.createObjectURL(file));

    onFilesChange(compressedFiles, previews);

    if (combinedFiles.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxFiles} images allowed. Extra images were not added.`,
        variant: "destructive",
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = selectedImages.filter((_, i) => i !== index);
    onFilesChange(newFiles, newPreviews);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = selectedFiles.findIndex((_, i) => `image-${i}` === active.id);
      const newIndex = selectedFiles.findIndex((_, i) => `image-${i}` === over.id);

      const newFiles = arrayMove(selectedFiles, oldIndex, newIndex);
      const newPreviews = arrayMove(selectedImages, oldIndex, newIndex);
      
      onFilesChange(newFiles, newPreviews);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        data-testid="input-file-hidden"
      />

      {selectedImages.length === 0 ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center transition-colors
            ${isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }
          `}
          data-testid="dropzone-upload"
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Upload Van Images</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop up to {maxFiles} images here, or click the button below
          </p>
          <Button
            type="button"
            onClick={handleBrowse}
            size="lg"
            className="!border-2 !border-accent text-accent hover:bg-accent/10"
            variant="outline"
            data-testid="button-select-images"
          >
            <Upload className="h-5 w-5 mr-2" />
            Select Multiple Images
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            The first image will be the main hero image
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
              {selectedImages.length < maxFiles && (
                <span className="text-muted-foreground ml-2">
                  (max {maxFiles})
                </span>
              )}
            </p>
            <Button
              type="button"
              onClick={handleBrowse}
              size="sm"
              className="!border-2 !border-accent text-accent hover:bg-accent/10"
              variant="outline"
              data-testid="button-add-more-images"
            >
              <Upload className="h-4 w-4 mr-2" />
              Add More Images
            </Button>
          </div>

          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-start gap-2 mb-3 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <p>Drag images to reorder • Click X to remove • First image is the hero</p>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={selectedImages.map((_, i) => `image-${i}`)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {selectedImages.map((preview, index) => (
                    <SortableImage
                      key={`image-${index}`}
                      id={`image-${index}`}
                      preview={preview}
                      index={index}
                      isHero={index === 0}
                      onRemove={() => handleRemove(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </>
      )}
    </div>
  );
}
