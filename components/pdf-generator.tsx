"use client"

import { useState, useEffect } from "react"
import { jsPDF } from "jspdf"
import { FileDown, Loader2, Settings, FileText, Trash2, MoveVertical, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface ImageFile {
  id: string
  file: File
  preview: string
  isHeic: boolean
  isLoading: boolean
  width?: number
  height?: number
}

interface PDFGeneratorProps {
  imageFiles: ImageFile[]
}

type PageSize = "a4" | "letter" | "legal" | "tabloid"
type PageOrientation = "portrait" | "landscape"
type ImageLayout = "1" | "2" | "4" | "custom"

interface PageDimensions {
  width: number
  height: number
}

const PAGE_SIZES: Record<PageSize, PageDimensions> = {
  a4: { width: 210, height: 297 },
  letter: { width: 216, height: 279 },
  legal: { width: 216, height: 356 },
  tabloid: { width: 279, height: 432 },
}

export function PDFGenerator({ imageFiles }: PDFGeneratorProps) {
  const [pageSize, setPageSize] = useState<PageSize>("a4")
  const [orientation, setOrientation] = useState<PageOrientation>("portrait")
  const [imageLayout, setImageLayout] = useState<ImageLayout>("1")
  const [imageQuality, setImageQuality] = useState<number>(80)
  const [margin, setMargin] = useState<number>(10)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [showSettings, setShowSettings] = useState<boolean>(false)
  const [title, setTitle] = useState<string>("My Photo Collection")
  const [arrangedImages, setArrangedImages] = useState<ImageFile[]>([])
  const [customRows, setCustomRows] = useState<number>(2)
  const [customCols, setCustomCols] = useState<number>(2)
  const [pdfFilename, setPdfFilename] = useState<string>("photo-collection")

  // Initialize arranged images when imageFiles changes
  useEffect(() => {
    setArrangedImages([...imageFiles])
  }, [imageFiles])

  // Move image up in the arrangement
  const moveImageUp = (index: number) => {
    if (index === 0) return
    const newArrangement = [...arrangedImages]
    const temp = newArrangement[index]
    newArrangement[index] = newArrangement[index - 1]
    newArrangement[index - 1] = temp
    setArrangedImages(newArrangement)
  }

  // Move image down in the arrangement
  const moveImageDown = (index: number) => {
    if (index === arrangedImages.length - 1) return
    const newArrangement = [...arrangedImages]
    const temp = newArrangement[index]
    newArrangement[index] = newArrangement[index + 1]
    newArrangement[index + 1] = temp
    setArrangedImages(newArrangement)
  }

  // Remove image from the arrangement
  const removeImage = (index: number) => {
    const newArrangement = [...arrangedImages]
    newArrangement.splice(index, 1)
    setArrangedImages(newArrangement)
  }

  // Generate PDF
  const generatePDF = async () => {
    if (arrangedImages.length === 0) return

    setIsGenerating(true)
    setProgress(0)

    try {
      // Get page dimensions based on size and orientation
      let pageWidth = PAGE_SIZES[pageSize].width
      let pageHeight = PAGE_SIZES[pageSize].height

      // Swap dimensions if landscape
      if (orientation === "landscape") {
        ;[pageWidth, pageHeight] = [pageHeight, pageWidth]
      }

      // Create new PDF
      const pdf = new jsPDF({
        orientation: orientation,
        unit: "mm",
        format: pageSize,
      })

      // Add title
      if (title) {
        pdf.setFontSize(18)
        pdf.text(title, pageWidth / 2, margin + 10, { align: "center" })
      }

      // Calculate layout
      let imagesPerPage: number
      let cols: number
      let rows: number

      switch (imageLayout) {
        case "1":
          imagesPerPage = 1
          cols = 1
          rows = 1
          break
        case "2":
          imagesPerPage = 2
          cols = 1
          rows = 2
          break
        case "4":
          imagesPerPage = 4
          cols = 2
          rows = 2
          break
        case "custom":
          cols = customCols
          rows = customRows
          imagesPerPage = cols * rows
          break
        default:
          imagesPerPage = 1
          cols = 1
          rows = 1
      }

      // Calculate available space for images
      const titleSpace = title ? 20 : 0
      const availableWidth = pageWidth - 2 * margin
      const availableHeight = pageHeight - 2 * margin - titleSpace

      // Calculate image dimensions
      const imageWidth = availableWidth / cols
      const imageHeight = availableHeight / rows

      // Calculate spacing
      const horizontalSpacing = margin
      const verticalSpacing = margin + titleSpace

      // Process each image
      const totalImages = arrangedImages.length
      const totalPages = Math.ceil(totalImages / imagesPerPage)

      for (let i = 0; i < totalImages; i++) {
        // Calculate position
        const pageIndex = Math.floor(i / imagesPerPage)
        const imageIndexOnPage = i % imagesPerPage
        const rowIndex = Math.floor(imageIndexOnPage / cols)
        const colIndex = imageIndexOnPage % cols

        // Add new page if needed
        if (imageIndexOnPage === 0 && i > 0) {
          pdf.addPage()

          // Add title to new page
          if (title) {
            pdf.setFontSize(18)
            pdf.text(title, pageWidth / 2, margin + 10, { align: "center" })
          }
        }

        // Calculate x and y position
        const x = margin + colIndex * imageWidth
        const y = verticalSpacing + rowIndex * imageHeight

        // Get image
        const image = arrangedImages[i]

        try {
          // Add image to PDF
          pdf.addImage(
            image.preview,
            "JPEG",
            x,
            y,
            imageWidth - horizontalSpacing / 2,
            imageHeight - horizontalSpacing / 2,
            `img-${i}`,
            "MEDIUM",
            0,
          )

          // Update progress
          setProgress(Math.round(((i + 1) / totalImages) * 100))
        } catch (error) {
          console.error("Error adding image to PDF:", error)
        }
      }

      // Ensure we have a valid filename, fallback to "photo-collection" if empty
      const filename = pdfFilename.trim() ? sanitizeFilename(pdfFilename.trim()) : "photo-collection"
      pdf.save(`${filename}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
    } finally {
      // Delay resetting state to show 100% completion
      setTimeout(() => {
        setIsGenerating(false)
        setProgress(0)
      }, 500)
    }
  }

  // Sanitize filename to remove invalid characters
  const sanitizeFilename = (name: string): string => {
    // Remove characters that are invalid in filenames
    return name.replace(/[/\\?%*:|"<>]/g, "-")
  }

  return (
    <div className="space-y-6">
      {/* PDF Generation Settings */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings} className="w-full">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">PDF Settings</h3>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              {showSettings ? "Hide Settings" : "Show Settings"}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PDF Title */}
            <div className="space-y-2">
              <Label htmlFor="pdf-title">PDF Title</Label>
              <Input
                id="pdf-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for your PDF"
              />
            </div>

            {/* PDF Filename */}
            <div className="space-y-2">
              <Label htmlFor="pdf-filename">PDF Filename</Label>
              <Input
                id="pdf-filename"
                value={pdfFilename}
                onChange={(e) => setPdfFilename(sanitizeFilename(e.target.value))}
                placeholder="Enter a filename for your PDF"
              />
              <p className="text-xs text-muted-foreground">The .pdf extension will be added automatically</p>
            </div>

            {/* Page Size */}
            <div className="space-y-2">
              <Label>Page Size</Label>
              <RadioGroup
                value={pageSize}
                onValueChange={(value) => setPageSize(value as PageSize)}
                className="grid grid-cols-2 gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="a4" id="a4" />
                  <Label htmlFor="a4">A4</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="letter" id="letter" />
                  <Label htmlFor="letter">Letter</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="legal" id="legal" />
                  <Label htmlFor="legal">Legal</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tabloid" id="tabloid" />
                  <Label htmlFor="tabloid">Tabloid</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Orientation */}
            <div className="space-y-2">
              <Label>Page Orientation</Label>
              <RadioGroup
                value={orientation}
                onValueChange={(value) => setOrientation(value as PageOrientation)}
                className="grid grid-cols-2 gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="portrait" id="portrait" />
                  <Label htmlFor="portrait">Portrait</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="landscape" id="landscape" />
                  <Label htmlFor="landscape">Landscape</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Image Layout */}
            <div className="space-y-2">
              <Label>Images Per Page</Label>
              <RadioGroup
                value={imageLayout}
                onValueChange={(value) => setImageLayout(value as ImageLayout)}
                className="grid grid-cols-2 gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1" id="layout-1" />
                  <Label htmlFor="layout-1">1 Image</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="2" id="layout-2" />
                  <Label htmlFor="layout-2">2 Images</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="4" id="layout-4" />
                  <Label htmlFor="layout-4">4 Images</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="layout-custom" />
                  <Label htmlFor="layout-custom">Custom Grid</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Custom Grid Layout */}
            {imageLayout === "custom" && (
              <div className="space-y-4 col-span-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="custom-rows">Rows</Label>
                    <Input
                      id="custom-rows"
                      type="number"
                      min="1"
                      max="5"
                      value={customRows}
                      onChange={(e) => setCustomRows(Number.parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-cols">Columns</Label>
                    <Input
                      id="custom-cols"
                      type="number"
                      min="1"
                      max="5"
                      value={customCols}
                      onChange={(e) => setCustomCols(Number.parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  This will create a {customRows}×{customCols} grid with {customRows * customCols} images per page.
                </div>
              </div>
            )}

            {/* Image Quality */}
            <div className="space-y-2 col-span-2">
              <div className="flex justify-between">
                <Label>Image Quality: {imageQuality}%</Label>
              </div>
              <Slider
                value={[imageQuality]}
                min={10}
                max={100}
                step={5}
                onValueChange={(value) => setImageQuality(value[0])}
              />
              <div className="text-xs text-muted-foreground">Higher quality results in larger PDF file sizes.</div>
            </div>

            {/* Margin */}
            <div className="space-y-2 col-span-2">
              <div className="flex justify-between">
                <Label>Page Margin: {margin}mm</Label>
              </div>
              <Slider value={[margin]} min={5} max={30} step={5} onValueChange={(value) => setMargin(value[0])} />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Image Arrangement */}
      {arrangedImages.length > 0 ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Arrange Images</h3>
            <div className="text-sm text-muted-foreground">
              {arrangedImages.length} image{arrangedImages.length !== 1 ? "s" : ""} in PDF
            </div>
          </div>

          <ScrollArea className="h-64 border rounded-lg p-4">
            <div className="space-y-2">
              {arrangedImages.map((image, index) => (
                <Card key={image.id} className="overflow-hidden">
                  <CardContent className="p-2">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 h-16 w-16 bg-muted rounded-md overflow-hidden">
                        <img
                          src={image.preview || "/placeholder.svg"}
                          alt={`Image ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex-grow">
                        <p className="text-sm truncate" title={image.file.name}>
                          {image.file.name}
                        </p>
                        {image.width && image.height && (
                          <p className="text-xs text-muted-foreground">
                            {image.width}×{image.height}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveImageUp(index)}
                          disabled={index === 0}
                        >
                          <MoveVertical className="h-4 w-4 rotate-180" />
                          <span className="sr-only">Move up</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveImageDown(index)}
                          disabled={index === arrangedImages.length - 1}
                        >
                          <MoveVertical className="h-4 w-4" />
                          <span className="sr-only">Move down</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeImage(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          {/* PDF Layout Preview */}
          <div className="border rounded-lg p-4">
            <h4 className="text-sm font-medium mb-2">PDF Layout Preview</h4>
            <div className="bg-muted/30 rounded-lg p-4 flex justify-center">
              <div
                className={cn(
                  "border border-dashed rounded-lg relative",
                  orientation === "portrait" ? "w-[210px] h-[297px]" : "w-[297px] h-[210px]",
                )}
                style={{ aspectRatio: orientation === "portrait" ? "210/297" : "297/210" }}
              >
                {/* Title area */}
                {title && <div className="absolute top-2 left-0 right-0 text-center text-xs font-medium">{title}</div>}

                {/* Grid layout */}
                <div
                  className="absolute inset-4 grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${imageLayout === "custom" ? customCols : imageLayout === "4" ? 2 : 1}, 1fr)`,
                    gridTemplateRows: `repeat(${
                      imageLayout === "custom" ? customRows : imageLayout === "4" ? 2 : imageLayout === "2" ? 2 : 1
                    }, 1fr)`,
                  }}
                >
                  {Array.from({
                    length: imageLayout === "custom" ? customRows * customCols : Number.parseInt(imageLayout),
                  }).map((_, i) => (
                    <div key={i} className="bg-muted rounded-sm flex items-center justify-center">
                      <LayoutGrid className="h-4 w-4 text-muted-foreground opacity-50" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            Upload images first to create a PDF. You can arrange the order of images before generating the PDF.
          </AlertDescription>
        </Alert>
      )}

      {/* PDF Filename (Quick Access) */}
      {arrangedImages.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <Label htmlFor="quick-pdf-filename" className="sm:w-auto w-full">
            Save PDF as:
          </Label>
          <div className="flex-1 w-full">
            <Input
              id="quick-pdf-filename"
              value={pdfFilename}
              onChange={(e) => setPdfFilename(sanitizeFilename(e.target.value))}
              placeholder="Enter filename (without .pdf)"
              className="w-full"
            />
          </div>
          <div className="text-sm text-muted-foreground whitespace-nowrap">.pdf</div>
        </div>
      )}

      {/* Generate PDF Button */}
      <Button
        onClick={generatePDF}
        className="w-full py-6 text-lg font-medium"
        disabled={isGenerating || arrangedImages.length === 0}
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Generating PDF...
          </>
        ) : (
          <>
            <FileDown className="mr-2 h-5 w-5" />
            Generate PDF
          </>
        )}
      </Button>

      {/* Progress Bar */}
      {isGenerating && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Generating PDF</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
    </div>
  )
}
