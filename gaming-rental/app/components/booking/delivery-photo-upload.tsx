import { useState, useRef } from "react";
import { Button } from "@heroui/react";
import { Camera, Upload, X } from "lucide-react";

interface DeliveryPhotoUploadProps {
  bookingId: string;
  onUploaded?: () => void;
}

export default function DeliveryPhotoUpload({ bookingId, onUploaded }: DeliveryPhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!preview) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", preview);
      const res = await fetch(`/api/bookings/${bookingId}/confirm-delivery`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        onUploaded?.();
        window.location.reload();
      }
    } catch {
      // Handle error
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Upload a photo of the delivered equipment to confirm setup.</p>

      {!preview ? (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
          <Camera className="h-10 w-10 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 mb-3">Take a photo or select from files</p>
          <div className="flex gap-2 justify-center">
            <Button
              size="sm"
              variant="flat"
              startContent={<Camera className="h-4 w-4" />}
              onPress={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.capture = "environment";
                  fileInputRef.current.click();
                }
              }}
            >
              Camera
            </Button>
            <Button
              size="sm"
              variant="flat"
              startContent={<Upload className="h-4 w-4" />}
              onPress={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute("capture");
                  fileInputRef.current.click();
                }
              }}
            >
              Upload
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      ) : (
        <div className="relative">
          <img src={preview} alt="Preview" className="w-full rounded-xl max-h-64 object-cover" />
          <Button
            size="sm"
            isIconOnly
            color="danger"
            variant="flat"
            className="absolute top-2 right-2"
            onPress={() => setPreview(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {preview && (
        <Button
          color="primary"
          fullWidth
          isLoading={uploading}
          onPress={handleSubmit}
        >
          Confirm Delivery
        </Button>
      )}
    </div>
  );
}
