# Image Converter App

A Next.js application for converting images between different formats and optimizing them for the web.

<img width="1673" alt="Screenshot 2025-05-09 at 14 20 26" src="https://github.com/user-attachments/assets/b6976e5a-de01-4ba0-a2b6-d41d269d1599" />


## Features

- Convert images to JPEG, PNG, WebP formats
- Support for HEIC input files
- Resize images with multiple options
- Batch process multiple images
- Download all converted images as a ZIP file
- Live preview of resizing effects
- Drag and drop file upload

## Getting Started

### Prerequisites

- Node.js 16.8 or later
- npm or yarn

### Installation

1. Clone this repository:
\`\`\`bash
git clone https://github.com/yourusername/image-converter.git
cd image-converter
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
# or
yarn install
\`\`\`

3. Start the development server:
\`\`\`bash
npm run dev
# or
yarn dev
\`\`\`

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Dependencies

- Next.js
- React
- Tailwind CSS
- shadcn/ui components
- JSZip (for downloading all images)
- heic2any (for HEIC file support)

## Browser Compatibility

This application uses browser APIs like Canvas and File API. It works best in modern browsers:
- Chrome
- Firefox
- Safari
- Edge

## License

MIT
