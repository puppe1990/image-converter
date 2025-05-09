import { ImageUploader } from "@/components/image-uploader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="container mx-auto py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2">Image Converter & Optimizer</h1>
        <p className="text-center text-muted-foreground mb-8">
          Convert your images to different formats and optimize them for the web
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Upload Images</CardTitle>
            <CardDescription>
              Select one or multiple images to convert and optimize. Supported formats: JPG, PNG, WEBP, HEIC (input
              only).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageUploader />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
