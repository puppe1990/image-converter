"use client"
import { useState } from "react"
import { Download, Info, AlertCircle, ChevronDown, ChevronUp, ArrowRight, Archive, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface ImageResult {
  format: string
  url: string
  size: number
  width: number
  height: number
  isPlaceholder?: boolean
  message?: string
  originalFile: string
  originalId: string
  originalDimensions?: string
  newDimensions?: string
}

export function ImageResults({ results }: { results: ImageResult[] }) {
  const [isDownloadingAll, setIsDownloadingAll] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)

  // Group results by original file
  const groupedResults = results.reduce(
    (acc, result) => {
      const key = result.originalId
      if (!acc[key]) {
        acc[key] = {
          fileName: result.originalFile,
          items: [],
          originalDimensions: result.originalDimensions,
        }
      }
      acc[key].items.push(result)
      return acc
    },
    {} as Record<string, { fileName: string; items: ImageResult[]; originalDimensions?: string }>,
  )

  // Track which groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    // Initialize with all groups open
    return Object.keys(groupedResults).reduce(
      (acc, key) => {
        acc[key] = true
        return acc
      },
      {} as Record<string, boolean>,
    )
  })

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // Update the downloadImage function to work with data URLs
  const downloadImage = (url: string, format: string, originalName: string, isPlaceholder?: boolean) => {
    if (isPlaceholder) {
      return // Don't allow downloading placeholders
    }

    // Get the file name without extension
    const baseName = originalName.substring(0, originalName.lastIndexOf(".")) || originalName

    const link = document.createElement("a")
    link.href = url
    link.download = `${baseName}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Function to download all formats of an image
  const downloadAllFormats = (groupId: string) => {
    const group = groupedResults[groupId]
    if (!group) return

    // Download each non-placeholder format
    group.items.forEach((result) => {
      if (!result.isPlaceholder) {
        downloadImage(result.url, result.format, group.fileName, result.isPlaceholder)
      }
    })
  }

  // Function to download all images as a zip file
  const downloadAllAsZip = async () => {
    setIsDownloadingAll(true)
    setDownloadProgress(0)

    try {
      // Dynamically import JSZip
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()

      // Count total files for progress tracking
      const validResults = results.filter((result) => !result.isPlaceholder)
      const totalFiles = validResults.length
      let processedFiles = 0

      // Process each result and add directly to the root of the zip
      for (const result of validResults) {
        try {
          // Get original filename without extension
          const originalFileName = result.originalFile
          const baseName = originalFileName.substring(0, originalFileName.lastIndexOf(".")) || originalFileName

          // Create a unique filename that includes the original filename
          const zipFileName = `${baseName}_${result.format}.${result.format}`

          // Convert data URL to blob
          const response = await fetch(result.url)
          const blob = await response.blob()

          // Add file directly to the root of the zip
          zip.file(zipFileName, blob)

          // Update progress
          processedFiles++
          setDownloadProgress(Math.round((processedFiles / totalFiles) * 100))
        } catch (error) {
          console.error("Error adding file to zip:", error)
        }
      }

      // Generate the zip file
      const content = await zip.generateAsync(
        {
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        },
        (metadata) => {
          // Update progress during zip generation
          setDownloadProgress(Math.round(metadata.percent))
        },
      )

      // Create download link
      const url = URL.createObjectURL(content)
      const link = document.createElement("a")
      link.href = url
      link.download = "converted-images.zip"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error creating zip file:", error)
    } finally {
      // Delay resetting state to show 100% completion
      setTimeout(() => {
        setIsDownloadingAll(false)
        setDownloadProgress(0)
      }, 500)
    }
  }

  // Count total valid (non-placeholder) images
  const totalValidImages = results.filter((result) => !result.isPlaceholder).length

  return (
    <div className="space-y-6 mt-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Converted Images</h2>

        {totalValidImages > 0 && (
          <Button onClick={downloadAllAsZip} disabled={isDownloadingAll} className="flex items-center gap-2" size="lg">
            {isDownloadingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating ZIP ({downloadProgress}%)</span>
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" />
                <span>Download All ({totalValidImages} images)</span>
              </>
            )}
          </Button>
        )}
      </div>

      {isDownloadingAll && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Preparing ZIP file</span>
            <span>{downloadProgress}%</span>
          </div>
          <Progress value={downloadProgress} className="h-2" />
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(groupedResults).map(([groupId, group]) => (
          <Collapsible
            key={groupId}
            open={openGroups[groupId]}
            onOpenChange={() => toggleGroup(groupId)}
            className="border rounded-lg overflow-hidden"
          >
            <div className="bg-muted/30 p-4 flex items-center justify-between">
              <div className="flex items-center">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-1 mr-2">
                    {openGroups[groupId] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <div>
                  <h3 className="text-lg font-medium truncate" title={group.fileName}>
                    {group.fileName}
                  </h3>
                  {group.originalDimensions && (
                    <p className="text-xs text-muted-foreground">Original: {group.originalDimensions}</p>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => downloadAllFormats(groupId)}>
                <Download className="mr-2 h-4 w-4" />
                Download All
              </Button>
            </div>

            <CollapsibleContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                {group.items.map((result, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between">
                        <span className="uppercase">{result.format}</span>
                        {!result.isPlaceholder && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Info className="h-4 w-4" />
                                  <span className="sr-only">Image info</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Size: {formatBytes(result.size)}</p>
                                <p>
                                  Dimensions: {result.width}x{result.height}
                                </p>
                                {result.originalDimensions &&
                                  result.newDimensions &&
                                  result.originalDimensions !== result.newDimensions && (
                                    <p>
                                      Resized: {result.originalDimensions} → {result.newDimensions}
                                    </p>
                                  )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                        <img
                          src={result.url || "/placeholder.svg"}
                          alt={`Converted to ${result.format}`}
                          className="object-contain w-full h-full"
                        />
                      </div>
                      {result.isPlaceholder && result.message && (
                        <Alert variant="warning" className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{result.message}</AlertDescription>
                        </Alert>
                      )}
                      {result.originalDimensions &&
                        result.newDimensions &&
                        result.originalDimensions !== result.newDimensions && (
                          <div className="mt-2 flex items-center justify-center text-xs text-muted-foreground">
                            <span>{result.originalDimensions}</span>
                            <ArrowRight className="mx-1 h-3 w-3" />
                            <span>{result.newDimensions}</span>
                            {result.width && result.height && (
                              <Badge variant="outline" className="ml-2">
                                {result.width}x{result.height}
                              </Badge>
                            )}
                          </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <div className="text-sm text-muted-foreground">
                        {result.isPlaceholder ? "N/A" : formatBytes(result.size)}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadImage(result.url, result.format, group.fileName, result.isPlaceholder)}
                        disabled={result.isPlaceholder}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {result.isPlaceholder ? "Not Available" : "Download"}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  )
}
