import { useEffect, useMemo, useState } from "react";
import { productImageService } from "@/services/ia/product-image.service";
import type { ProductImageAnalyzeResult } from "@/services/ia/product-image.service";
import type { ProductFormValues } from "@/modules/productos/schemas/product-form.schema";

const toFileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

const normalizeOptional = (value: string | null | undefined) => value?.trim() ?? "";

export const mapImageSuggestionsToProductForm = (
  result: ProductImageAnalyzeResult
): Partial<ProductFormValues> => {
  const suggestions = result.suggestions;

  return {
    name: normalizeOptional(suggestions.name),
    brand: normalizeOptional(suggestions.brand),
    barcode: normalizeOptional(suggestions.barcode),
    description: normalizeOptional(suggestions.description),
    category: normalizeOptional(suggestions.category),
    subcategory: normalizeOptional(suggestions.subcategory),
    saleMode: suggestions.sale_mode ?? "unit",
    price: suggestions.suggested_price ?? 0,
  };
};

export const useProductImageAnalysis = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ProductImageAnalyzeResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedKey, setLastAnalyzedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  const imageKey = imageFile ? toFileKey(imageFile) : null;
  const needsReanalyze = Boolean(imageKey && imageKey !== lastAnalyzedKey);

  const setImage = (file: File | null) => {
    setImageFile(file);
    setError(null);
    setResult(null);
    setLastAnalyzedKey(null);
  };

  const clearImage = () => setImage(null);

  const analyze = async (): Promise<ProductImageAnalyzeResult | null> => {
    if (!imageFile) {
      setError("Selecciona una foto antes de analizar.");
      return null;
    }

    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await productImageService.analyzeImage(imageFile);
      setResult(response);
      setLastAnalyzedKey(imageKey);
      return response;
    } catch (reason) {
      const message =
        reason instanceof Error && reason.message
          ? reason.message
          : "No se pudo analizar la imagen";
      setError(message);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const canAnalyze = Boolean(imageFile) && !isAnalyzing;

  const suggestedFormValues = useMemo(
    () => (result ? mapImageSuggestionsToProductForm(result) : null),
    [result]
  );

  return {
    imageFile,
    imageKey,
    previewUrl,
    result,
    suggestedFormValues,
    isAnalyzing,
    error,
    canAnalyze,
    needsReanalyze,
    setImage,
    clearImage,
    analyze,
    clearResult: () => setResult(null),
    clearError: () => setError(null),
  };
};
