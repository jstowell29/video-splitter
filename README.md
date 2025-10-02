# Video Clip Splitter

A web-based video clip splitter that allows you to split videos into multiple clips using timeline markers.

## Setup Instructions

### FFmpeg Configuration

This application uses FFmpeg.wasm to process videos in the browser. Due to CORS restrictions, you need to download the FFmpeg core files and place them in your project:

1. Download the following files from [unpkg.com/@ffmpeg/core@0.12.6/dist/esm/](https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/):
   - `ffmpeg-core.js`
   - `ffmpeg-core.wasm`
   - `ffmpeg-core.worker.js`

2. Place these three files in your project's `/public` directory

3. The application will automatically load them from there

### Running the Application

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to use the application.

## Features

- Upload video files
- Add timeline markers to create clips
- Preview clips before exporting
- Export all clips as individual files or as a ZIP archive
- Automatic download when export completes

## Technology Stack

- Next.js 15
- React 19
- FFmpeg.wasm for video processing
- Tailwind CSS for styling
