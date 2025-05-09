"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Upload, FileUp, Loader2, AlertCircle, X, ImageIcon, Lock, Unlock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { ImageResults } from "./image-results"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ImagePreview } from "./image-preview"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { PDFGenerator } from "./pdf-generator"

type FormatOption = "jpeg" | "png" | "webp" | "heic"
type ResizeMode = "none" | "dimensions" | "percentage" | "preset"
type PresetSize = "small" | "medium" | "large" | "hd" | "fullhd" | "4k"

interface ImageFile {
  id: string
  file: File
  preview: string
  isHeic: boolean
  isLoading: boolean
  width?: number
  height?: number
}

interface ResizeDimensions {
  width: number
  height: number
}

const PRESET_SIZES: Record<PresetSize, ResizeDimensions> = {
  small: { width: 640, height: 480 },
  medium: { width: 1024, height: 768 },
  large: { width: 1600, height: 1200 },
  hd: { width: 1280, height: 720 },
  fullhd: { width: 1920, height: 1080 },
  "4k": { width: 3840, height: 2160 },
}

// Client-side image processing functions
const processImageInBrowser = async (
  imageFile: ImageFile,
  formats: FormatOption[],
  quality: number,
  resizeMode: ResizeMode,
  resizeDimensions: ResizeDimensions,
  resizePercentage: number,
  presetSize: PresetSize,
  maintainAspectRatio: boolean,
  onProgress: (progress: number) => void,
): Promise<any[]> => {
  return new Promise(async (resolve) => {
    // Update progress to indicate start
    onProgress(5)

    // Check if we need to convert from HEIC first
    let processableFile = imageFile.file
    if (imageFile.file.type === "image/heic" || imageFile.file.name.toLowerCase().endsWith(".heic")) {
      try {
        // Dynamically import heic2any
        onProgress(10)
        const heic2any = (await import("heic2any")).default
        onProgress(20)
        const convertedBlob = await heic2any({
          blob: imageFile.file,
          toType: "image/jpeg",
          quality: quality / 100,
        })
        onProgress(30)

        processableFile = new File([convertedBlob as Blob], imageFile.file.name.replace(/\.heic$/i, ".jpg"), {
          type: "image/jpeg",
        })
      } catch (error) {
        console.error("Error converting HEIC:", error)
        // Continue with original file if conversion fails
      }
    } else {
      // Skip HEIC conversion progress steps
      onProgress(30)
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      onProgress(40)
      const img = new Image()
      img.onload = () => {
        onProgress(50)

        // Calculate dimensions based on resize mode
        let targetWidth = img.width
        let targetHeight = img.height

        if (resizeMode !== "none") {
          if (resizeMode === "dimensions") {
            targetWidth = resizeDimensions.width || img.width
            targetHeight = resizeDimensions.height || img.height

            if (maintainAspectRatio) {
              // If only width is specified, calculate height
              if (resizeDimensions.width && !resizeDimensions.height) {
                targetHeight = Math.round((img.height / img.width) * targetWidth)
              }
              // If only height is specified, calculate width
              else if (!resizeDimensions.width && resizeDimensions.height) {
                targetWidth = Math.round((img.width / img.height) * targetHeight)
              }
              // If both are specified, use the one that results in a smaller image
              else {
                const widthRatio = targetWidth / img.width
                const heightRatio = targetHeight / img.height
                const ratio = Math.min(widthRatio, heightRatio)
                targetWidth = Math.round(img.width * ratio)
                targetHeight = Math.round(img.height * ratio)
              }
            }
          } else if (resizeMode === "percentage") {
            targetWidth = Math.round((img.width * resizePercentage) / 100)
            targetHeight = Math.round((img.height * resizePercentage) / 100)
          } else if (resizeMode === "preset") {
            const preset = PRESET_SIZES[presetSize]
            targetWidth = preset.width
            targetHeight = preset.height

            if (maintainAspectRatio) {
              const widthRatio = targetWidth / img.width
              const heightRatio = targetHeight / img.height
              const ratio = Math.min(widthRatio, heightRatio)
              targetWidth = Math.round(img.width * ratio)
              targetHeight = Math.round(img.height * ratio)
            }
          }
        }

        onProgress(60)

        // Process each format with progress updates
        const totalFormats = formats.length
        const results: any[] = []
        let completedFormats = 0

        const processFormat = (formatIndex: number) => {
          if (formatIndex >= totalFormats) {
            onProgress(100)
            resolve(results)
            return
          }

          const format = formats[formatIndex]
          const canvas = document.createElement("canvas")
          const ctx = canvas.getContext("2d")

          canvas.width = targetWidth
          canvas.height = targetHeight

          // Draw image on canvas with resizing
          ctx?.drawImage(img, 0, 0, targetWidth, targetHeight)

          // Convert to desired format
          let mimeType = "image/jpeg"
          switch (format) {
            case "jpeg":
              mimeType = "image/jpeg"
              break
            case "png":
              mimeType = "image/png"
              break
            case "webp":
              mimeType = "image/webp"
              break
            case "heic":
              mimeType = "image/heic"
              break
          }

          // For HEIC, we can't actually convert to it in the browser
          // So we'll just return a placeholder with information
          if (format === "heic") {
            results.push({
              format,
              url: "/heic-preview-unavailable.png",
              size: 0,
              width: targetWidth,
              height: targetHeight,
              isPlaceholder: true,
              message: "HEIC conversion not supported in browsers",
              originalFile: imageFile.file.name,
              originalId: imageFile.id,
              originalDimensions: `${img.width}x${img.height}`,
              newDimensions: `${targetWidth}x${targetHeight}`,
            })

            completedFormats++
            // Calculate progress: 60% base + up to 40% for formats
            const formatProgress = Math.floor(60 + (completedFormats / totalFormats) * 40)
            onProgress(formatProgress)

            // Process next format
            processFormat(formatIndex + 1)
          } else {
            // Get data URL with quality setting
            const dataUrl = canvas.toDataURL(mimeType, quality / 100)

            // Calculate approximate size (this is an estimation)
            const approximateSize = Math.round((dataUrl.length - 22) * 0.75)

            results.push({
              format,
              url: dataUrl,
              size: approximateSize,
              width: targetWidth,
              height: targetHeight,
              isPlaceholder: false,
              originalFile: imageFile.file.name,
              originalId: imageFile.id,
              originalDimensions: `${img.width}x${img.height}`,
              newDimensions: `${targetWidth}x${targetHeight}`,
            })

            completedFormats++
            // Calculate progress: 60% base + up to 40% for formats
            const formatProgress = Math.floor(60 + (completedFormats / totalFormats) * 40)
            onProgress(formatProgress)

            // Process next format
            processFormat(formatIndex + 1)
          }
        }

        // Start processing formats
        processFormat(0)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(processableFile)
  })
}

export function ImageUploader() {
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([])
  const [formats, setFormats] = useState<FormatOption[]>(["jpeg", "webp"])
  const [quality, setQuality] = useState(80)
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<any[] | null>(null)
  const [heicLibLoaded, setHeicLibLoaded] = useState(false)
  const [hasHeicFiles, setHasHeicFiles] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const objectUrlsRef = useRef<string[]>([])

  // Resize options
  const [resizeMode, setResizeMode] = useState<ResizeMode>("none")
  const [resizeDimensions, setResizeDimensions] = useState<ResizeDimensions>({ width: 800, height: 600 })
  const [resizePercentage, setResizePercentage] = useState<number>(50)
  const [presetSize, setPresetSize] = useState<PresetSize>("medium")
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true)

  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const dragCounterRef = useRef(0)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const addMoreRef = useRef<HTMLLabelElement>(null)

  // Load HEIC library dynamically
  useEffect(() => {
    if (hasHeicFiles && !heicLibLoaded) {
      import("heic2any")
        .then(() => setHeicLibLoaded(true))
        .catch((err) => console.error("Failed to load HEIC library:", err))
    }
  }, [hasHeicFiles, heicLibLoaded])

  // Reset selected image index when images change
  useEffect(() => {
    if (imageFiles.length === 0) {
      setSelectedImageIndex(0)
    } else if (selectedImageIndex >= imageFiles.length) {
      setSelectedImageIndex(imageFiles.length - 1)
    }
  }, [imageFiles, selectedImageIndex])

  // Clean up object URLs when component unmounts or on page refresh
  useEffect(() => {
    // Function to clean up object URLs
    const cleanupObjectUrls = () => {
      objectUrlsRef.current.forEach((url) => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url)
        }
      })
      objectUrlsRef.current = []
    }

    // Add beforeunload event listener to clean up on page refresh
    window.addEventListener("beforeunload", cleanupObjectUrls)

    // Return cleanup function for component unmount
    return () => {
      window.removeEventListener("beforeunload", cleanupObjectUrls)
      cleanupObjectUrls()
    }
  }, [])

  // Set up drag and drop event listeners
  useEffect(() => {
    // Prevent default behavior for drag events on the entire document
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    // Handle dragenter event
    const handleDragEnter = (e: DragEvent) => {
      preventDefaults(e)
      dragCounterRef.current++
      setIsDragging(true)
    }

    // Handle dragleave event
    const handleDragLeave = (e: DragEvent) => {
      preventDefaults(e)
      dragCounterRef.current--
      if (dragCounterRef.current === 0) {
        setIsDragging(false)
      }
    }

    // Handle dragover event
    const handleDragOver = (e: DragEvent) => {
      preventDefaults(e)
      setIsDragging(true)
    }

    // Handle drop event
    const handleDrop = async (e: DragEvent) => {
      preventDefaults(e)
      setIsDragging(false)
      dragCounterRef.current = 0

      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        await processFiles(files)
      }
    }

    // Add event listeners to document
    document.addEventListener("dragenter", handleDragEnter)
    document.addEventListener("dragleave", handleDragLeave)
    document.addEventListener("dragover", handleDragOver)
    document.addEventListener("drop", handleDrop)

    // Clean up event listeners
    return () => {
      document.removeEventListener("dragenter", handleDragEnter)
      document.removeEventListener("dragleave", handleDragLeave)
      document.removeEventListener("dragover", handleDragOver)
      document.removeEventListener("drop", handleDrop)
    }
  }, [])

  // Handle dragover for specific drop zones
  const handleDragOver = (e: React.DragEvent<HTMLDivElement | HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(true)
  }

  // Handle dragleave for specific drop zones
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement | HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
  }

  // Handle drop for specific drop zones
  const handleDrop = async (e: React.DragEvent<HTMLDivElement | HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    setIsDraggingOver(false)
    dragCounterRef.current = 0

    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      await processFiles(files)
    }
  }

  const createPreviewForFile = async (file: File): Promise<ImageFile> => {
    const id = Math.random().toString(36).substring(2, 9)
    const isHeic = file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")

    let preview = ""
    let isLoading = false
    let width: number | undefined
    let height: number | undefined

    if (isHeic) {
      isLoading = true
      try {
        // Dynamically import heic2any
        const heic2any = (await import("heic2any")).default
        const convertedBlob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.8,
        })

        // Create a URL for the converted blob
        preview = URL.createObjectURL(convertedBlob as Blob)
        // Store the object URL for cleanup
        objectUrlsRef.current.push(preview)
        isLoading = false

        // Get dimensions
        const img = new Image()
        await new Promise((resolve) => {
          img.onload = () => {
            width = img.width
            height = img.height
            resolve(null)
          }
          img.src = preview
        })
      } catch (error) {
        console.error("Error previewing HEIC:", error)
        isLoading = false
        // Fallback to a placeholder
        preview = "/heic-image-preview.png"
      }
    } else {
      // Regular image file
      preview = URL.createObjectURL(file)
      // Store the object URL for cleanup
      objectUrlsRef.current.push(preview)

      // Get dimensions
      const img = new Image()
      await new Promise((resolve) => {
        img.onload = () => {
          width = img.width
          height = img.height
          resolve(null)
        }
        img.src = preview
      })
    }

    return {
      id,
      file,
      preview,
      isHeic,
      isLoading,
      width,
      height,
    }
  }

  const processFiles = async (fileList: FileList) => {
    setResults(null)
    setIsUploading(true)
    setUploadProgress(0)

    // Convert FileList to array
    const filesArray = Array.from(fileList)

    // Filter out non-image files
    const imageFiles = filesArray.filter(
      (file) => file.type.startsWith("image/") || file.name.toLowerCase().endsWith(".heic"),
    )

    if (imageFiles.length === 0) {
      setIsUploading(false)
      return
    }

    // Check if any HEIC files
    const containsHeic = imageFiles.some(
      (file) => file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic"),
    )
    setHasHeicFiles((prevHasHeic) => prevHasHeic || containsHeic)

    // Process each file to create previews
    const newImageFiles: ImageFile[] = []
    const totalFiles = imageFiles.length

    for (let i = 0; i < totalFiles; i++) {
      const file = imageFiles[i]
      const imageFile = await createPreviewForFile(file)
      newImageFiles.push(imageFile)

      // Update progress
      setUploadProgress(Math.round(((i + 1) / totalFiles) * 100))
    }

    setImageFiles((prev) => [...prev, ...newImageFiles])

    // Delay hiding the loading indicator slightly to ensure UI updates
    setTimeout(() => {
      setIsUploading(false)
      setUploadProgress(0)
    }, 300)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    await processFiles(selectedFiles)
  }

  const removeImage = (id: string) => {
    setImageFiles((prev) => {
      // Find the image to remove
      const imageToRemove = prev.find((img) => img.id === id)

      // Revoke the object URL if it exists and is a blob URL
      if (imageToRemove && imageToRemove.preview.startsWith("blob:")) {
        URL.revokeObjectURL(imageToRemove.preview)
        // Remove from the objectUrlsRef array
        objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== imageToRemove.preview)
      }

      const updatedFiles = prev.filter((img) => img.id !== id)

      // If we removed all images, clear results
      if (updatedFiles.length === 0) {
        setResults(null)
      }

      // Check if we still have HEIC files
      const stillHasHeic = updatedFiles.some((img) => img.isHeic)
      setHasHeicFiles(stillHasHeic)

      return updatedFiles
    })
  }

  // Function to clear all images and reset state
  const clearAllImages = () => {
    // Revoke all object URLs
    imageFiles.forEach((img) => {
      if (img.preview.startsWith("blob:")) {
        URL.revokeObjectURL(img.preview)
      }
    })

    // Clear the objectUrlsRef array
    objectUrlsRef.current = []

    // Reset state
    setImageFiles([])
    setResults(null)
    setHasHeicFiles(false)
    setSelectedImageIndex(0)
  }

  const handleFormatChange = (format: FormatOption) => {
    setFormats((prev) => {
      if (prev.includes(format)) {
        return prev.filter((f) => f !== format)
      } else {
        return [...prev, format]
      }
    })
  }

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const width = Number.parseInt(e.target.value) || 0
    setResizeDimensions((prev) => ({
      ...prev,
      width,
      ...(maintainAspectRatio &&
      imageFiles.length > 0 &&
      imageFiles[selectedImageIndex]?.width &&
      imageFiles[selectedImageIndex]?.height
        ? {
            height: Math.round(
              (imageFiles[selectedImageIndex].height! / imageFiles[selectedImageIndex].width!) * width,
            ),
          }
        : {}),
    }))
  }

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const height = Number.parseInt(e.target.value) || 0
    setResizeDimensions((prev) => ({
      ...prev,
      height,
      ...(maintainAspectRatio &&
      imageFiles.length > 0 &&
      imageFiles[selectedImageIndex]?.width &&
      imageFiles[selectedImageIndex]?.height
        ? {
            width: Math.round(
              (imageFiles[selectedImageIndex].width! / imageFiles[selectedImageIndex].height!) * height,
            ),
          }
        : {}),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (imageFiles.length === 0 || formats.length === 0) return

    setIsProcessing(true)
    setProgress(0)
    setResults(null)

    try {
      // Process each image
      const allResults = []
      const totalImages = imageFiles.length

      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i]
        const imageIndex = i

        // Calculate base progress for this image
        const imageBaseProgress = (imageIndex / totalImages) * 100
        const imageMaxProgress = ((imageIndex + 1) / totalImages) * 100
        const imageProgressRange = imageMaxProgress - imageBaseProgress

        // Progress callback for this image
        const updateImageProgress = (imageProgress: number) => {
          // Scale the image's internal progress (0-100) to its portion of the overall progress
          const scaledProgress = imageBaseProgress + (imageProgress / 100) * imageProgressRange
          setProgress(Math.round(scaledProgress))
        }

        const imageResults = await processImageInBrowser(
          imageFile,
          formats,
          quality,
          resizeMode,
          resizeDimensions,
          resizePercentage,
          presetSize,
          maintainAspectRatio,
          updateImageProgress,
        )

        allResults.push(...imageResults)
      }

      setResults(allResults)
      setProgress(100)
    } catch (error) {
      console.error("Error processing images:", error)
    } finally {
      // Keep the progress bar at 100% for a moment before hiding it
      setTimeout(() => {
        setIsProcessing(false)
        setProgress(0)
      }, 500)
    }
  }

  return (
    <div className="space-y-6">
      {/* Global drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 bg-primary/10 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-background border-2 border-dashed border-primary rounded-lg p-8 text-center">
            <Upload className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-medium">Drop images here</h3>
            <p className="text-muted-foreground">Drop your images to start converting</p>
          </div>
        </div>
      )}

      {/* Processing overlay with percentage */}
      {isProcessing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="bg-card border rounded-lg p-8 shadow-lg max-w-md w-full">
            <div className="text-center mb-4">
              <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin mb-4" />
              <h3 className="text-xl font-medium mb-2">Processing Images</h3>
              <p className="text-muted-foreground mb-6">Please wait while your images are being processed...</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />

              <p className="text-xs text-muted-foreground text-center mt-4">
                Processing {imageFiles.length} image{imageFiles.length !== 1 ? "s" : ""} with {formats.length} format
                {formats.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload loading overlay */}
      {isUploading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="bg-card border rounded-lg p-8 shadow-lg max-w-md w-full">
            <div className="text-center mb-4">
              <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin mb-4" />
              <h3 className="text-xl font-medium mb-2">Preparing Images</h3>
              <p className="text-muted-foreground mb-6">Please wait while your images are being loaded...</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Loading</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          </div>
        </div>
      )}

      <div className="grid w-full items-center gap-1.5 mx-auto">
        <div className="flex justify-between items-center mb-2">
          <Label htmlFor="image" className="text-center">
            {imageFiles.length > 0
              ? `${imageFiles.length} image${imageFiles.length !== 1 ? "s" : ""} selected`
              : "Choose image(s)"}
          </Label>

          {imageFiles.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllImages}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        {imageFiles.length > 0 ? (
          <div className="space-y-4">
            <ScrollArea className="h-64 w-full border rounded-lg p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {imageFiles.map((img, index) => (
                  <div
                    key={img.id}
                    className={cn(
                      "relative group cursor-pointer",
                      selectedImageIndex === index && "ring-2 ring-primary rounded-md",
                    )}
                    onClick={() => setSelectedImageIndex(index)}
                  >
                    <div className="aspect-square bg-muted rounded-md overflow-hidden relative">
                      {img.isLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                        </div>
                      ) : (
                        <img
                          src={img.preview || "/placeholder.svg"}
                          alt={img.file.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeImage(img.id)
                      }}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove</span>
                    </Button>
                    {img.isHeic && (
                      <Badge variant="secondary" className="absolute bottom-1 right-1">
                        HEIC
                      </Badge>
                    )}
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs truncate" title={img.file.name}>
                        {img.file.name}
                      </p>
                      {img.width && img.height && (
                        <span className="text-xs text-muted-foreground">
                          {img.width}x{img.height}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-center">
              <label
                ref={addMoreRef}
                htmlFor="image"
                className={cn(
                  "flex items-center justify-center px-4 py-2 border border-dashed rounded-lg cursor-pointer transition-colors",
                  isDraggingOver ? "bg-primary/20 border-primary" : "bg-muted/30 hover:bg-muted/50",
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                <span>Add more images</span>
                <input
                  id="image"
                  type="file"
                  accept="image/*,.heic"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {/* Image Preview */}
            {imageFiles.length > 0 && (
              <ImagePreview
                imageFile={imageFiles[selectedImageIndex]}
                resizeMode={resizeMode}
                resizeDimensions={resizeDimensions}
                resizePercentage={resizePercentage}
                presetSize={presetSize}
                maintainAspectRatio={maintainAspectRatio}
                presetSizes={PRESET_SIZES}
              />
            )}
          </div>
        ) : (
          <div
            ref={dropZoneRef}
            className={cn("flex items-center justify-center w-full", isDraggingOver && "ring-2 ring-primary")}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <label
              htmlFor="image"
              className={cn(
                "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-all",
                isDraggingOver ? "bg-primary/20 border-primary" : "bg-muted/30 hover:bg-muted/50",
              )}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload
                  className={cn(
                    "h-10 w-10 mb-2 transition-colors",
                    isDraggingOver ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">SVG, PNG, JPG, WEBP, HEIC or GIF</p>
                <p className="text-xs text-muted-foreground mt-1">Select multiple files to batch process</p>
              </div>
              <input
                id="image"
                type="file"
                accept="image/*,.heic"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
        )}
      </div>

      {hasHeicFiles && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>HEIC File(s) Detected</AlertTitle>
          <AlertDescription>
            HEIC files are supported for input but will be converted to JPEG for processing.
          </AlertDescription>
        </Alert>
      )}

      {imageFiles.length > 0 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="formats" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="formats">Formats & Quality</TabsTrigger>
              <TabsTrigger value="resize">Resize Options</TabsTrigger>
              <TabsTrigger value="pdf">Create PDF</TabsTrigger>
            </TabsList>
            <TabsContent value="formats" className="space-y-4 pt-4">
              <div className="space-y-4">
                <Label>Output Formats</Label>
                <div className="flex flex-wrap gap-4">
                  {(["jpeg", "png", "webp", "heic"] as const).map((format) => (
                    <div key={format} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={format}
                        checked={formats.includes(format)}
                        onChange={() => handleFormatChange(format)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor={format} className="capitalize">
                        {format}
                      </Label>
                    </div>
                  ))}
                </div>
                {formats.includes("heic") && (
                  <Alert variant="warning" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>HEIC Output Limitation</AlertTitle>
                    <AlertDescription>
                      Converting to HEIC format is not supported in browsers. A placeholder will be shown instead.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Quality: {quality}%</Label>
                </div>
                <Slider value={[quality]} min={10} max={100} step={5} onValueChange={(value) => setQuality(value[0])} />
              </div>
            </TabsContent>
            <TabsContent value="resize" className="space-y-6 pt-4">
              <div className="space-y-4">
                <Label>Resize Mode</Label>
                <RadioGroup
                  value={resizeMode}
                  onValueChange={(value) => setResizeMode(value as ResizeMode)}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="none" />
                    <Label htmlFor="none">No Resizing</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dimensions" id="dimensions" />
                    <Label htmlFor="dimensions">Custom Dimensions</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentage" id="percentage" />
                    <Label htmlFor="percentage">Scale by Percentage</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="preset" id="preset" />
                    <Label htmlFor="preset">Preset Sizes</Label>
                  </div>
                </RadioGroup>
              </div>

              {resizeMode === "dimensions" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Custom Dimensions</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMaintainAspectRatio(!maintainAspectRatio)}
                      className="h-8 px-2"
                    >
                      {maintainAspectRatio ? (
                        <>
                          <Lock className="h-4 w-4 mr-1" />
                          <span>Aspect Ratio Locked</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="h-4 w-4 mr-1" />
                          <span>Aspect Ratio Unlocked</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="width">Width (px)</Label>
                      <Input
                        id="width"
                        type="number"
                        min="1"
                        value={resizeDimensions.width || ""}
                        onChange={handleWidthChange}
                        placeholder="Width in pixels"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="height">Height (px)</Label>
                      <Input
                        id="height"
                        type="number"
                        min="1"
                        value={resizeDimensions.height || ""}
                        onChange={handleHeightChange}
                        placeholder="Height in pixels"
                      />
                    </div>
                  </div>
                  {imageFiles.length > 0 &&
                    imageFiles[selectedImageIndex]?.width &&
                    imageFiles[selectedImageIndex]?.height && (
                      <div className="text-sm text-muted-foreground">
                        Original size: {imageFiles[selectedImageIndex].width}x{imageFiles[selectedImageIndex].height}
                        {imageFiles.length > 1 && " (selected image)"}
                      </div>
                    )}
                </div>
              )}

              {resizeMode === "percentage" && (
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label>Scale to {resizePercentage}% of original size</Label>
                  </div>
                  <Slider
                    value={[resizePercentage]}
                    min={1}
                    max={100}
                    step={1}
                    onValueChange={(value) => setResizePercentage(value[0])}
                  />
                  {imageFiles.length > 0 &&
                    imageFiles[selectedImageIndex]?.width &&
                    imageFiles[selectedImageIndex]?.height && (
                      <div className="text-sm text-muted-foreground">
                        Original: {imageFiles[selectedImageIndex].width}x{imageFiles[selectedImageIndex].height}{" "}
                        {imageFiles.length > 1 && "(selected image)"} <ArrowRight className="inline h-3 w-3 mx-1" />{" "}
                        New: {Math.round((imageFiles[selectedImageIndex].width! * resizePercentage) / 100)}x
                        {Math.round((imageFiles[selectedImageIndex].height! * resizePercentage) / 100)}
                      </div>
                    )}
                </div>
              )}

              {resizeMode === "preset" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Preset Size</Label>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="maintain-ratio-preset"
                        checked={maintainAspectRatio}
                        onChange={() => setMaintainAspectRatio(!maintainAspectRatio)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary mr-2"
                      />
                      <Label htmlFor="maintain-ratio-preset" className="text-sm">
                        Maintain aspect ratio
                      </Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(PRESET_SIZES) as PresetSize[]).map((size) => (
                      <Button
                        key={size}
                        type="button"
                        variant={presetSize === size ? "default" : "outline"}
                        className="justify-between"
                        onClick={() => setPresetSize(size)}
                      >
                        <span className="capitalize">{size}</span>
                        <span className="text-xs">
                          {PRESET_SIZES[size].width}x{PRESET_SIZES[size].height}
                        </span>
                      </Button>
                    ))}
                  </div>
                  {imageFiles.length > 0 &&
                    imageFiles[selectedImageIndex]?.width &&
                    imageFiles[selectedImageIndex]?.height &&
                    maintainAspectRatio && (
                      <div className="text-sm text-muted-foreground">
                        With aspect ratio maintained, the actual size will be adjusted to fit within the preset
                        dimensions while preserving proportions.
                      </div>
                    )}
                </div>
              )}
            </TabsContent>
            <TabsContent value="pdf" className="space-y-4 pt-4">
              <PDFGenerator imageFiles={imageFiles} />
            </TabsContent>
          </Tabs>

          {/* Only show the Convert & Optimize button when not on the PDF tab */}
          <div className="pdf-tab-hidden">
            <Button type="submit" className="w-full py-6 text-lg font-medium" disabled={isProcessing} size="lg">
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-5 w-5" />
                  Convert & Optimize {imageFiles.length > 1 ? `(${imageFiles.length} images)` : ""}
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {results && <ImageResults results={results} />}
    </div>
  )
}
