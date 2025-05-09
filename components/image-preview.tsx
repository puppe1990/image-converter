"use client"

import { useState, useEffect, useRef } from "react"
import { Maximize, ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ImagePreviewProps {
  imageFile: {
    id: string
    file: File
    preview: string
    width?: number
    height?: number
  }
  resizeMode: "none" | "dimensions" | "percentage" | "preset"
  resizeDimensions: { width: number; height: number }
  resizePercentage: number
  presetSize: string
  maintainAspectRatio: boolean
  presetSizes: Record<string, { width: number; height: number }>
}

export function ImagePreview({
  imageFile,
  resizeMode,
  resizeDimensions,
  resizePercentage,
  presetSize,
  maintainAspectRatio,
  presetSizes,
}: ImagePreviewProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [previewCanvas, setPreviewCanvas] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewDimensions, setPreviewDimensions] = useState<{ width: number; height: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewUrlRef = useRef<string | null>(null)

  // Clean up preview canvas URL when component unmounts or when a new preview is generated
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [])

  // Calculate target dimensions based on resize settings
  const calculateTargetDimensions = () => {
    if (!imageFile.width || !imageFile.height) return null

    let targetWidth = imageFile.width
    let targetHeight = imageFile.height

    if (resizeMode === "none") {
      return { width: targetWidth, height: targetHeight }
    }

    if (resizeMode === "dimensions") {
      targetWidth = resizeDimensions.width || imageFile.width
      targetHeight = resizeDimensions.height || imageFile.height

      if (maintainAspectRatio) {
        // If only width is specified, calculate height
        if (resizeDimensions.width && !resizeDimensions.height) {
          targetHeight = Math.round((imageFile.height / imageFile.width) * targetWidth)
        }
        // If only height is specified, calculate width
        else if (!resizeDimensions.width && resizeDimensions.height) {
          targetWidth = Math.round((imageFile.width / imageFile.height) * targetHeight)
        }
        // If both are specified, use the one that results in a smaller image
        else {
          const widthRatio = targetWidth / imageFile.width
          const heightRatio = targetHeight / imageFile.height
          const ratio = Math.min(widthRatio, heightRatio)
          targetWidth = Math.round(imageFile.width * ratio)
          targetHeight = Math.round(imageFile.height * ratio)
        }
      }
    } else if (resizeMode === "percentage") {
      targetWidth = Math.round((imageFile.width * resizePercentage) / 100)
      targetHeight = Math.round((imageFile.height * resizePercentage) / 100)
    } else if (resizeMode === "preset") {
      const preset = presetSizes[presetSize]
      targetWidth = preset.width
      targetHeight = preset.height

      if (maintainAspectRatio) {
        const widthRatio = targetWidth / imageFile.width
        const heightRatio = targetHeight / imageFile.height
        const ratio = Math.min(widthRatio, heightRatio)
        targetWidth = Math.round(imageFile.width * ratio)
        targetHeight = Math.round(imageFile.height * ratio)
      }
    }

    return { width: targetWidth, height: targetHeight }
  }

  // Generate preview when settings change
  useEffect(() => {
    if (!showPreview) return

    const generatePreview = async () => {
      setIsGenerating(true)
      const dimensions = calculateTargetDimensions()
      if (!dimensions) {
        setIsGenerating(false)
        return
      }

      setPreviewDimensions(dimensions)

      const canvas = canvasRef.current
      if (!canvas) {
        setIsGenerating(false)
        return
      }

      canvas.width = dimensions.width
      canvas.height = dimensions.height

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        setIsGenerating(false)
        return
      }

      const img = new Image()
      img.crossOrigin = "anonymous" // Add this to avoid CORS issues
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height)

        // Clean up previous preview URL if it exists
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current)
        }

        const newPreviewUrl = canvas.toDataURL("image/jpeg", 0.9)
        setPreviewCanvas(newPreviewUrl)
        setIsGenerating(false)
      }
      img.src = imageFile.preview
    }

    generatePreview()
  }, [showPreview, resizeMode, resizeDimensions, resizePercentage, presetSize, maintainAspectRatio, imageFile.preview])

  // Toggle preview
  const togglePreview = () => {
    setShowPreview(!showPreview)
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Image Preview</h3>
        <Button variant="outline" size="sm" onClick={togglePreview}>
          {showPreview ? (
            <>
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span>Show Original</span>
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4 mr-1" />
              <span>Show Preview</span>
            </>
          )}
        </Button>
      </div>

      <div className="relative border rounded-lg overflow-hidden bg-muted/30">
        <div className="aspect-video relative">
          {/* Original Image */}
          <img
            src={imageFile.preview || "/placeholder.svg"}
            alt="Original"
            className={cn(
              "absolute inset-0 w-full h-full object-contain transition-opacity duration-300",
              showPreview ? "opacity-0" : "opacity-100",
            )}
          />

          {/* Preview Image */}
          {previewCanvas && (
            <img
              src={previewCanvas || "/placeholder.svg"}
              alt="Preview"
              className={cn(
                "absolute inset-0 w-full h-full object-contain transition-opacity duration-300",
                showPreview ? "opacity-100" : "opacity-0",
              )}
            />
          )}

          {/* Hidden canvas for generating preview */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Loading indicator */}
          {isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {/* Dimension badge */}
          <div className="absolute bottom-2 right-2 flex flex-col gap-1 items-end">
            {imageFile.width && imageFile.height && (
              <Badge variant="secondary" className="bg-background/80">
                Original: {imageFile.width}x{imageFile.height}
              </Badge>
            )}
            {showPreview && previewDimensions && (
              <Badge variant="default" className="bg-primary/80">
                Preview: {previewDimensions.width}x{previewDimensions.height}
              </Badge>
            )}
          </div>
        </div>

        {/* Toggle fullscreen button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 hover:bg-background"
          onClick={() => {
            // This would be expanded in a real implementation
            alert("Fullscreen preview would open here")
          }}
        >
          <Maximize className="h-4 w-4" />
          <span className="sr-only">Fullscreen</span>
        </Button>
      </div>

      {/* Preview info */}
      {showPreview && resizeMode !== "none" && (
        <div className="text-xs text-muted-foreground text-center">
          This is a preview of how your image will look after resizing. The actual quality may vary based on the output
          format and quality settings.
        </div>
      )}
    </div>
  )
}
