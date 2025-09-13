
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, FileImage, Bot } from 'lucide-react';
import Image from 'next/image';

const ImageUpload = ({ title, onImageSelect, selectedImage }: { title: string; onImageSelect: (file: File) => void; selectedImage: File | null }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageSelect(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-accent transition-colors ${
            isDragging ? 'border-primary' : 'border-border'
          }`}
        >
          {selectedImage ? (
            <Image
              src={URL.createObjectURL(selectedImage)}
              alt="Selected image"
              fill
              className="object-contain rounded-lg p-2"
            />
          ) : (
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <UploadCloud className="w-8 h-8 mb-4 text-muted-foreground" />
              <p className="mb-2 text-sm text-muted-foreground">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">PNG, JPG or WEBP</p>
            </div>
          )}
          <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
        </label>
      </CardContent>
    </Card>
  );
};


export default function PlanogramClient() {
  const [planogramImage, setPlanogramImage] = useState<File | null>(null);
  const [shelfImage, setShelfImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleValidation = async () => {
    if (!planogramImage || !shelfImage) {
      toast({
        variant: 'destructive',
        title: 'Missing Images',
        description: 'Please upload both a planogram and a shelf image.',
      });
      return;
    }

    setIsLoading(true);
    toast({ title: 'Starting Validation...', description: 'The AI is analyzing the images.' });

    // Here we will call the AI flow in the future.
    // For now, we'll just simulate a delay.
    await new Promise(resolve => setTimeout(resolve, 2000));

    toast({
      title: 'Validation Complete (Simulated)',
      description: 'This is where the results would be displayed.',
    });
    setIsLoading(false);
  };

  return (
    <main className="container mx-auto px-4 py-8 md:py-12">
      <div className="space-y-8 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>AI Planogram Validator</CardTitle>
            <CardDescription>
              Upload an image of the planogram and a photo of the corresponding shelf. The AI will analyze them to find any differences.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ImageUpload title="1. Upload Planogram" onImageSelect={setPlanogramImage} selectedImage={planogramImage} />
          <ImageUpload title="2. Upload Shelf Photo" onImageSelect={setShelfImage} selectedImage={shelfImage} />
        </div>

        <Button
          onClick={handleValidation}
          disabled={isLoading || !planogramImage || !shelfImage}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Bot className="mr-2 h-4 w-4" />
          )}
          Find Differences
        </Button>

        {/* Results will be displayed here in a future step */}
      </div>
    </main>
  );
}
