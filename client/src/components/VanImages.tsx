import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Trash2, Star, GripVertical, Info } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
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

interface VanImagesProps {
  vanId: string;
  images: string[];
  heroImage?: string | null;
}

function SortableImageCard({
  id,
  image,
  index,
  isHero,
  onSetHero,
  onDelete,
}: {
  id: string;
  image: string;
  index: number;
  isHero: boolean;
  onSetHero: () => void;
  onDelete: () => void;
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
    <Card ref={setNodeRef} style={style} className="overflow-hidden">
      <div className="aspect-video relative bg-muted">
        <img
          src={image}
          alt={`Van image ${index + 1}`}
          className="w-full h-full object-cover"
        />
        {isHero && (
          <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded text-xs font-bold shadow">
            <Star className="w-3 h-3 inline mr-1" />
            HERO
          </div>
        )}
        <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
          #{index + 1}
        </div>
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
      <div className="p-2 flex gap-2">
        {!isHero && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSetHero}
            className="flex-1 !border-2 !border-accent text-accent hover:bg-accent/10"
            data-testid={`button-set-hero-${index}`}
          >
            <Star className="w-3 h-3 mr-1" />
            Set Hero
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          onClick={onDelete}
          data-testid={`button-delete-${index}`}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </Card>
  );
}

export function VanImages({ vanId, images, heroImage }: VanImagesProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [localImages, setLocalImages] = useState<string[]>(images);
  const [localHero, setLocalHero] = useState<string | null | undefined>(heroImage);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update local state when props change
  useEffect(() => {
    setLocalImages(images);
  }, [images]);

  useEffect(() => {
    setLocalHero(heroImage);
  }, [heroImage]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const file = files[0]; // Upload one at a time

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/admin/vans/${vanId}/upload-image`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      // Refresh the van list
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/vans'] });

      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDelete = async (imageUrl: string) => {
    try {
      const response = await fetch(`/api/admin/vans/${vanId}/images`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ objectPath: imageUrl }),
      });

      if (!response.ok) throw new Error('Failed to delete');

      await queryClient.invalidateQueries({ queryKey: ['/api/admin/vans'] });

      toast({
        title: "Success",
        description: "Image deleted",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete image",
        variant: "destructive",
      });
    }
  };

  const handleSetHero = async (imageUrl: string) => {
    // Update local state immediately for instant feedback
    setLocalHero(imageUrl);

    try {
      const response = await fetch(`/api/admin/vans/${vanId}/hero-image`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ objectPath: imageUrl }),
      });

      if (!response.ok) throw new Error('Failed to set hero');

      await queryClient.invalidateQueries({ queryKey: ['/api/admin/vans'] });

      toast({
        title: "Success",
        description: "Hero image updated",
      });
    } catch (error) {
      // Revert on error
      setLocalHero(heroImage);
      toast({
        title: "Error",
        description: "Failed to set hero image",
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localImages.findIndex((_, i) => `image-${i}` === active.id);
      const newIndex = localImages.findIndex((_, i) => `image-${i}` === over.id);

      const reordered = arrayMove(localImages, oldIndex, newIndex);
      
      // Update local state immediately for instant feedback
      setLocalImages(reordered);
      
      // Save to backend
      saveReorder(reordered);
    }
  };

  const saveReorder = async (reordered: string[]) => {
    try {
      const response = await fetch(`/api/admin/vans/${vanId}/images/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ images: reordered }),
      });

      if (!response.ok) throw new Error('Failed to reorder');

      await queryClient.invalidateQueries({ queryKey: ['/api/admin/vans'] });

      toast({
        title: "Success",
        description: "Images reordered",
      });
    } catch (error) {
      // Revert on error
      setLocalImages(images);
      toast({
        title: "Error",
        description: "Failed to reorder images",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div className="flex items-center gap-4">
        <input
          type="file"
          id="van-image-upload"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
          disabled={uploading}
        />
        <Button
          type="button"
          onClick={() => document.getElementById('van-image-upload')?.click()}
          disabled={uploading}
          data-testid="button-upload-image"
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? "Uploading..." : "Upload Image"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {localImages.length} image(s)
        </span>
      </div>

      {/* Image Grid with Drag and Drop */}
      {localImages.length > 0 && (
        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-start gap-2 mb-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <p>Drag images to reorder • Click star to set hero • First image is the main display image</p>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localImages.map((_, i) => `image-${i}`)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {localImages.map((image, index) => (
                  <div key={`image-${index}`} className="group">
                    <SortableImageCard
                      id={`image-${index}`}
                      image={image}
                      index={index}
                      isHero={localHero === image}
                      onSetHero={() => handleSetHero(image)}
                      onDelete={() => {
                        if (confirm("Delete this image?")) {
                          handleDelete(image);
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {localImages.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No images uploaded yet</p>
        </div>
      )}
    </div>
  );
}
