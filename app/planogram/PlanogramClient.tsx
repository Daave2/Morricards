
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, Bot, Check, X, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { planogramFlow, type PlanogramOutput } from '@/ai/flows/planogram-flow';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


const ImageUpload = ({ title, onImageSelect, selectedImage, disabled }: { title: string; onImageSelect: (file: File) => void; selectedImage: File | null, disabled?: boolean }) => {
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
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <Card className={cn(disabled && 'bg-muted/50')}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg  bg-card transition-colors ${
            isDragging ? 'border-primary' : 'border-border'
          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-accent'}`}
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
          <input id={`dropzone-file-${title}`} type="file" className="hidden" onChange={handleFileChange} accept="image/*" disabled={disabled} />
        </label>
      </CardContent>
    </Card>
  );
};

// Helper function to convert a file to a Base64 Data URI
const toDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};


const ResultsDisplay = ({ results }: { results: PlanogramOutput }) => {
    const { planogramProducts, shelfProducts } = results;

    const normalizeSku = (sku: string | null | undefined): string | null => {
        if (!sku) return null;
        return sku.trim();
    }

    const planSkus = new Set(planogramProducts.map(p => normalizeSku(p.sku)).filter(Boolean));
    const shelfSkus = new Set(shelfProducts.map(p => normalizeSku(p.sku)).filter(Boolean));

    const correctItems = planogramProducts.filter(p => {
        const pSku = normalizeSku(p.sku);
        if (!pSku) return false;
        const shelfItem = shelfProducts.find(s => normalizeSku(s.sku) === pSku);
        return shelfItem && shelfItem.shelf === p.shelf && shelfItem.position === p.position;
    });

    const misplacedItems = planogramProducts.filter(p => {
        const pSku = normalizeSku(p.sku);
        if (!pSku) return false;
        const shelfItem = shelfProducts.find(s => normalizeSku(s.sku) === pSku);
        // It's misplaced if it exists on the shelf but is not in the "correctItems" list
        return shelfItem && !correctItems.some(c => normalizeSku(c.sku) === pSku);
    });
    
    const missingItems = planogramProducts.filter(p => {
        const pSku = normalizeSku(p.sku);
        if (!pSku) return true; // Count items with no SKU on planogram as "missing" for review
        return !shelfSkus.has(pSku);
    });

    const extraItems = shelfProducts.filter(p => {
        const sSku = normalizeSku(p.sku);
        if (!sSku) return true; // Count items with no SKU on shelf as "extra" for review
        return !planSkus.has(sSku);
    });


    const renderTable = (items: typeof planogramProducts, title: string, variant: 'correct' | 'misplaced' | 'missing' | 'extra') => {
        if (items.length === 0) return null;
        
        let icon;
        let badgeVariant: "default" | "destructive" | "secondary" | "outline" = "secondary";
        
        switch(variant) {
            case 'correct': icon = <Check className="h-5 w-5 text-green-500" />; badgeVariant = "default"; break;
            case 'misplaced': icon = <ArrowRightLeft className="h-5 w-5 text-yellow-500" />; badgeVariant = "secondary"; break;
            case 'missing': icon = <X className="h-5 w-5 text-red-500" />; badgeVariant = "destructive"; break;
            case 'extra': icon = <AlertTriangle className="h-5 w-5 text-orange-500" />; badgeVariant = "outline"; break;
        }

        return (
            <div>
                 <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                    {icon} {title} <Badge variant={badgeVariant}>{items.length}</Badge>
                </h3>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead className="text-center">Shelf</TableHead>
                                <TableHead className="text-center">Position</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium">{item.productName}</TableCell>
                                    <TableCell>{item.sku || 'N/A'}</TableCell>
                                    <TableCell className="text-center">{item.shelf}</TableCell>
                                    <TableCell className="text-center">{item.position}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Validation Results</CardTitle>
                <CardDescription>Comparison of the planogram against the physical shelf.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {renderTable(correctItems, "Correctly Placed", "correct")}
                {renderTable(misplacedItems, "Misplaced Items", "misplaced")}
                {renderTable(missingItems, "Missing from Shelf", "missing")}
                {renderTable(extraItems, "Extra on Shelf (Not on Plan)", "extra")}
            </CardContent>
        </Card>
    )
}

export default function PlanogramClient() {
  const [planogramImage, setPlanogramImage] = useState<File | null>(null);
  const [shelfImage, setShelfImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<PlanogramOutput | null>(null);
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
    setResults(null);
    toast({ title: 'Starting Validation...', description: 'The AI is analyzing the images.' });
    
    try {
        const planogramImageDataUri = await toDataUri(planogramImage);
        const shelfImageDataUri = await toDataUri(shelfImage);

        const flowResult = await planogramFlow({ planogramImageDataUri, shelfImageDataUri });
        setResults(flowResult);

        toast({
            title: 'Validation Complete',
            description: 'The results are displayed below.',
        });

    } catch (error) {
         toast({
            variant: 'destructive',
            title: 'Validation Failed',
            description: `An error occurred during analysis: ${error instanceof Error ? error.message : String(error)}`,
        });
        console.error(error);
    }


    setIsLoading(false);
  };

  return (
    <main className="container mx-auto px-4 py-8 md:py-12">
      <div className="space-y-8 max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>AI Planogram Validator</CardTitle>
            <CardDescription>
              Upload an image of the planogram and a photo of the corresponding shelf. The AI will analyze them to find any differences.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ImageUpload title="1. Upload Planogram" onImageSelect={setPlanogramImage} selectedImage={planogramImage} disabled={isLoading} />
          <ImageUpload title="2. Upload Shelf Photo" onImageSelect={setShelfImage} selectedImage={shelfImage} disabled={isLoading} />
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

        {isLoading && (
            <div className="text-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">AI is analyzing the images, this may take a moment...</p>
            </div>
        )}

        {results && <ResultsDisplay results={results} />}
      </div>
    </main>
  );
}
