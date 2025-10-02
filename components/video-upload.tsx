"use client"

import type React from "react"

import { useCallback, useState } from "react"
import { Upload, Film, Scissors } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VideoUploadProps {
  onVideoUpload: (file: File) => void
}

export function VideoUpload({ onVideoUpload }: VideoUploadProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      const videoFile = files.find((file) => file.type.startsWith("video/"))

      if (videoFile) {
        onVideoUpload(videoFile)
      }
    },
    [onVideoUpload],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && file.type.startsWith("video/")) {
        onVideoUpload(file)
      }
    },
    [onVideoUpload],
  )

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-bold text-foreground">Upload Your Video</h2>
        <p className="text-muted-foreground">Drag and drop your video file or click to browse</p>
        <p className="mt-1 text-sm text-muted-foreground">Supports MP4, WebM, and MOV formats</p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-xl border-2 border-dashed transition-all
          ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-primary/50 hover:bg-card/80"
          }
        `}
      >
        <input
          type="file"
          accept="video/*"
          onChange={handleFileInput}
          className="absolute inset-0 z-10 cursor-pointer opacity-0"
          id="video-upload"
        />

        <div className="flex flex-col items-center justify-center px-6 py-16">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            {isDragging ? <Film className="h-10 w-10 text-primary" /> : <Upload className="h-10 w-10 text-primary" />}
          </div>

          <p className="mb-2 text-lg font-medium text-foreground">
            {isDragging ? "Drop your video here" : "Drop video file here"}
          </p>

          <p className="mb-4 text-sm text-muted-foreground">or</p>

          <Button asChild>
            <label htmlFor="video-upload" className="cursor-pointer">
              Browse Files
            </label>
          </Button>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg bg-card p-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Scissors className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h3 className="mb-2 font-semibold text-foreground">Precise Splitting</h3>
          <p className="text-sm text-muted-foreground">Place markers exactly where you want to split your video</p>
        </div>

        <div className="rounded-lg bg-card p-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Film className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h3 className="mb-2 font-semibold text-foreground">Browser-Based</h3>
          <p className="text-sm text-muted-foreground">All processing happens in your browser, no uploads needed</p>
        </div>

        <div className="rounded-lg bg-card p-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Upload className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h3 className="mb-2 font-semibold text-foreground">Export Multiple Clips</h3>
          <p className="text-sm text-muted-foreground">Download all clips individually or as a ZIP file</p>
        </div>
      </div>
    </div>
  )
}
