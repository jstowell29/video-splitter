"use client"

import { useState } from "react"
import { VideoUpload } from "@/components/video-upload"
import { VideoPlayer } from "@/components/video-player"
import { Scissors } from "lucide-react"

export default function VideoSplitterPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const handleVideoUpload = (file: File) => {
    setVideoFile(file)
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
  }

  const handleNewVideo = () => {
    // Clean up old URL to avoid memory leaks
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
    }
    setVideoFile(null)
    setVideoUrl(null)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Scissors className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Video Clip Splitter</h1>
              <p className="text-sm text-muted-foreground">Split a video into multiple clips</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!videoUrl ? (
          <VideoUpload onVideoUpload={handleVideoUpload} />
        ) : (
          <VideoPlayer videoUrl={videoUrl} videoFile={videoFile} onNewVideo={handleNewVideo} />
        )}
      </main>
    </div>
  )
}
