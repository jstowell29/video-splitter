"use client"

import type React from "react"

import { useRef, useState, useEffect, useCallback } from "react"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Download,
  X,
  Plus,
  Pencil,
  Check,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Package,
  MoreVertical,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Marker } from "@/types/marker"
import { splitVideo, type ExportProgress } from "@/lib/ffmpeg"
import JSZip from "jszip"

interface VideoPlayerProps {
  videoUrl: string
  videoFile: File | null
  onNewVideo?: () => void
}

export function VideoPlayer({ videoUrl, videoFile, onNewVideo }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  // Video state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  // Timeline state
  const [markers, setMarkers] = useState<Marker[]>([])
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null)
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null)

  // Preview state
  const [previewingSegment, setPreviewingSegment] = useState<number | null>(null)
  const [previewEndTime, setPreviewEndTime] = useState<number | null>(null)

  // Edit state
  const [editingSegment, setEditingSegment] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: "", startTime: "", endTime: "" })

  // Export state
  const [exportOpen, setExportOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<ExportProgress[]>([])
  const [exportedBlobs, setExportedBlobs] = useState<Blob[]>([])
  const [quality, setQuality] = useState<"original" | "compressed">("original")

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)

      if (previewingSegment !== null && previewEndTime !== null) {
        if (video.currentTime >= previewEndTime) {
          video.pause()
          setIsPlaying(false)
          setPreviewingSegment(null)
          setPreviewEndTime(null)
        }
      }
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setMarkers([
        { id: "start", time: 0, color: "oklch(0.696 0.17 162.48)", name: "Clip 1" },
        { id: "end", time: video.duration, color: "oklch(0.696 0.17 162.48)", name: "End" },
      ])
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setPreviewingSegment(null)
      setPreviewEndTime(null)
    }

    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("ended", handleEnded)

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("ended", handleEnded)
    }
  }, [previewingSegment, previewEndTime])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable

      if (isTyping) return

      if (e.code === "Space") {
        e.preventDefault()
        togglePlay()
      } else if (e.code === "ArrowLeft") {
        e.preventDefault()
        seekRelative(-5)
      } else if (e.code === "ArrowRight") {
        e.preventDefault()
        seekRelative(5)
      } else if (e.code === "KeyM") {
        e.preventDefault()
        addMarkerAtCurrentTime()
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [currentTime, duration, markers])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (value: number[]) => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = value[0]
    setCurrentTime(value[0])
  }

  const seekRelative = (seconds: number) => {
    const video = videoRef.current
    if (!video) return

    const newTime = Math.max(0, Math.min(duration, currentTime + seconds))
    video.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current
    if (!video) return

    const newVolume = value[0]
    video.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    if (isMuted) {
      video.volume = volume || 0.5
      setIsMuted(false)
    } else {
      video.volume = 0
      setIsMuted(true)
    }
  }

  const toggleFullscreen = () => {
    const video = videoRef.current
    if (!video) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen()
    }
  }

  const addMarkerAtCurrentTime = () => {
    const colors = [
      "oklch(0.696 0.17 162.48)",
      "oklch(0.769 0.188 70.08)",
      "oklch(0.627 0.265 303.9)",
      "oklch(0.645 0.246 16.439)",
      "oklch(0.488 0.243 264.376)",
    ]

    const clipCount = markers.filter((m) => m.name.startsWith("Clip")).length

    const newMarker: Marker = {
      id: `marker-${Date.now()}`,
      time: currentTime,
      color: colors[markers.length % colors.length],
      name: `Clip ${clipCount + 1}`,
    }

    setMarkers((prev) => [...prev, newMarker].sort((a, b) => a.time - b.time))
  }

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const parseTimeString = (timeStr: string): number => {
    const parts = timeStr.split(":").map((p) => Number.parseInt(p, 10))
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    }
    return 0
  }

  const getTimeFromPosition = (clientX: number) => {
    if (!timelineRef.current) return 0

    const rect = timelineRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    return percentage * duration
  }

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (draggingMarkerId) return
    const time = getTimeFromPosition(e.clientX)
    const video = videoRef.current
    if (!video) return
    video.currentTime = time
    setCurrentTime(time)
  }

  const handleMarkerMouseDown = (e: React.MouseEvent, markerId: string) => {
    e.stopPropagation()
    setDraggingMarkerId(markerId)
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingMarkerId) return

      const time = getTimeFromPosition(e.clientX)
      const video = videoRef.current
      if (video) {
        video.currentTime = time
        setCurrentTime(time)
      }

      const updatedMarkers = markers.map((marker) => (marker.id === draggingMarkerId ? { ...marker, time } : marker))
      setMarkers(updatedMarkers.sort((a, b) => a.time - b.time))
    },
    [draggingMarkerId, markers, duration],
  )

  const handleMouseUp = useCallback(() => {
    setDraggingMarkerId(null)
  }, [])

  useEffect(() => {
    if (draggingMarkerId) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [draggingMarkerId, handleMouseMove, handleMouseUp])

  const handleRemoveMarker = (markerId: string) => {
    if (markerId === "start" || markerId === "end") return
    const updatedMarkers = markers.filter((m) => m.id !== markerId)
    setMarkers(updatedMarkers)
  }

  const handlePreviewSegment = (startTime: number, endTime: number, segmentIndex: number) => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = startTime
    setCurrentTime(startTime)
    setPreviewingSegment(segmentIndex)
    setPreviewEndTime(endTime)
    video.play()
    setIsPlaying(true)
  }

  const handlePausePreview = () => {
    const video = videoRef.current
    if (!video) return

    video.pause()
    setIsPlaying(false)
    setPreviewingSegment(null)
    setPreviewEndTime(null)
  }

  const handleEditSegment = (index: number, segment: any) => {
    setEditingSegment(index)
    setEditForm({
      name: segment.start.name || `Clip ${index + 1}`,
      startTime: formatTime(segment.start.time),
      endTime: formatTime(segment.end.time),
    })
  }

  const handleSaveEdit = (index: number) => {
    const segment = segments[index]
    const newStartTime = parseTimeString(editForm.startTime)
    const newEndTime = parseTimeString(editForm.endTime)

    if (newStartTime >= newEndTime) {
      alert("Start time must be before end time")
      return
    }

    if (newStartTime < 0 || newEndTime > duration) {
      alert("Times must be within video duration")
      return
    }

    const updatedMarkers = markers.map((marker) => {
      if (marker.id === segment.start.id) {
        return { ...marker, time: newStartTime, name: editForm.name }
      }
      if (marker.id === segment.end.id) {
        return { ...marker, time: newEndTime }
      }
      return marker
    })

    setMarkers(updatedMarkers.sort((a, b) => a.time - b.time))
    setEditingSegment(null)
  }

  const handleDeleteSegment = (index: number) => {
    if (index === 0) {
      alert("Cannot delete the first segment")
      return
    }

    const markerToRemove = markers[index]
    const updatedMarkers = markers.filter((m) => m.id !== markerToRemove.id)
    setMarkers(updatedMarkers)
  }

  const handleClearAllMarkers = () => {
    if (confirm("Are you sure you want to clear all markers? This will remove all clips.")) {
      const startMarker = markers.find((m) => m.id === "start")
      const endMarker = markers.find((m) => m.id === "end")
      if (startMarker && endMarker) {
        setMarkers([startMarker, endMarker])
      }
    }
  }

  const handleNewVideo = () => {
    // Check if user has created any clips (more than just start/end markers)
    const hasClips = markers.length > 2

    if (hasClips) {
      if (confirm("Start new video? Current clips will be lost.")) {
        onNewVideo?.()
      }
    } else {
      onNewVideo?.()
    }
  }

  const handlePreviewClick = (segment: any, index: number) => {
    if (previewingSegment === index) {
      handlePausePreview()
    } else {
      handlePreviewSegment(segment.start.time, segment.end.time, index)
    }
  }

  const segments = []
  for (let i = 0; i < markers.length - 1; i++) {
    segments.push({
      start: markers[i],
      end: markers[i + 1],
      duration: markers[i + 1].time - markers[i].time,
    })
  }

  const handleExport = async () => {
    if (!videoFile || segments.length === 0) return

    setIsExporting(true)
    setExportedBlobs([])

    try {
      const exportSegments = segments.map((seg) => ({
        start: seg.start.time,
        end: seg.end.time,
        name: seg.start.name || `clip_${segments.indexOf(seg) + 1}`,
      }))
      const blobs = await splitVideo(videoFile, exportSegments, setExportProgress)
      setExportedBlobs(blobs)
    } catch (error) {
      console.error("Export error:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const downloadClip = (blob: Blob, index: number) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${segments[index].start.name || `clip_${index + 1}`}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadAllAsZip = async () => {
    if (exportedBlobs.length === 0) return

    const zip = new JSZip()

    exportedBlobs.forEach((blob, index) => {
      zip.file(`${segments[index].start.name || `clip_${index + 1}`}.mp4`, blob)
    })

    const zipBlob = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = "video_clips.zip"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const allComplete = exportProgress.length > 0 && exportProgress.every((p) => p.status === "complete")

  const timeMarkers = []
  const interval = duration > 300 ? 60 : duration > 60 ? 30 : 10
  for (let i = 0; i <= duration; i += interval) {
    timeMarkers.push(i)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Video Clip Splitter</h1>
            <div className="flex items-center gap-4">
              <p className="hidden text-xs text-slate-500 sm:block">
                Space = Play/Pause • Arrow keys = Seek ±5s • M = Add marker
              </p>
              <Button onClick={handleNewVideo} size="sm" variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                New Video
              </Button>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-4">
          {/* Video and Clips Container - side by side on desktop */}
          <div className="flex flex-col md:flex-row gap-4 items-start">
            {/* Video Preview - order-1 on mobile, left side on desktop */}
            <section className="order-1 w-full md:w-[40%] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3">
                <h2 className="text-base font-semibold">Video Preview</h2>
                <p className="text-xs text-slate-500">
                  {videoFile?.name} • {formatTime(duration)}
                </p>
              </div>

              <div className="mb-3 overflow-hidden rounded-xl bg-slate-900 aspect-video">
                <video ref={videoRef} src={videoUrl} className="h-full w-full object-contain" onClick={togglePlay} />
              </div>

              <div className="space-y-2">
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer"
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={togglePlay} className="h-8 w-8">
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8">
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </Button>
                      <div className="w-16">
                        <Slider value={[isMuted ? 0 : volume]} max={1} step={0.01} onValueChange={handleVolumeChange} />
                      </div>
                    </div>

                    <span className="font-mono text-xs text-slate-600">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8">
                    <Maximize className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </section>

            {/* Clips Section - order-3 on mobile, right side on desktop */}
            <section className="order-3 md:order-2 w-full md:w-[60%] rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col h-[300px]">
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold">Clips</h2>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {segments.length} {segments.length === 1 ? "clip" : "clips"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Preview, edit or delete your clips</p>
                  </div>
                  <Button onClick={() => setExportOpen(true)} size="sm" className="flex-shrink-0">
                    <Download className="mr-2 h-4 w-4" />
                    Export All Clips
                  </Button>
                </div>
              </div>

              {/* Scrollable clips grid */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {segments.map((segment, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50"
                      onMouseEnter={() => setHoveredSegment(index)}
                      onMouseLeave={() => setHoveredSegment(null)}
                    >
                      {editingSegment === index ? (
                        <div className="space-y-2">
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="h-8 text-xs"
                            placeholder="Clip name"
                          />
                          <Input
                            value={editForm.startTime}
                            onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                            className="h-8 font-mono text-xs"
                            placeholder="Start (MM:SS)"
                          />
                          <Input
                            value={editForm.endTime}
                            onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                            className="h-8 font-mono text-xs"
                            placeholder="End (MM:SS)"
                          />
                          <div className="flex gap-1">
                            <Button onClick={() => handleSaveEdit(index)} size="sm" className="h-8 flex-1 text-xs">
                              <Check className="mr-1 h-3 w-3" />
                              Save
                            </Button>
                            <Button
                              onClick={() => setEditingSegment(null)}
                              size="sm"
                              variant="outline"
                              className="h-8 flex-1 text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.start.color }} />
                              <span className="text-xs font-semibold text-foreground">
                                {segment.start.name || `Clip ${index + 1}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditSegment(index, segment)
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteSegment(index)
                                }}
                                disabled={index === 0}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="mb-3 space-y-0.5 text-[10px] text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Start:</span>
                              <span className="font-mono">{formatTime(segment.start.time)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>End:</span>
                              <span className="font-mono">{formatTime(segment.end.time)}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-foreground">
                              <span>Duration:</span>
                              <span className="font-mono">{formatTime(segment.duration)}</span>
                            </div>
                          </div>
                          <Button
                            onClick={() => handlePreviewClick(segment, index)}
                            size="sm"
                            variant="outline"
                            className="h-8 w-full text-xs"
                          >
                            {previewingSegment === index ? (
                              <>
                                <Pause className="mr-1 h-3 w-3" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="mr-1 h-3 w-3" />
                                Preview
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Timeline - order-2 on mobile (appears between video and clips) */}
            <section className="order-2 md:hidden w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Timeline</h3>
                  <p className="text-xs text-slate-500">Click to seek, drag handles to adjust split points.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={addMarkerAtCurrentTime} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Marker
                  </Button>
                  <Button onClick={handleClearAllMarkers} size="sm" variant="outline" className="text-destructive">
                    <XCircle className="mr-2 h-4 w-4" />
                    Clear All
                  </Button>
                </div>
              </div>

              <div className="mb-2 flex justify-between text-[10px] text-slate-500">
                {timeMarkers.map((time) => (
                  <span key={time} className="font-mono">
                    {formatTime(time)}
                  </span>
                ))}
              </div>

              <div
                ref={timelineRef}
                className="relative h-24 cursor-pointer overflow-hidden rounded-lg bg-slate-100"
                onClick={handleTimelineClick}
              >
                {segments.map((segment, index) => {
                  const startPercent = (segment.start.time / duration) * 100
                  const widthPercent = ((segment.end.time - segment.start.time) / duration) * 100

                  return (
                    <div
                      key={index}
                      className="absolute top-0 h-full transition-opacity hover:opacity-80"
                      style={{
                        left: `${startPercent}%`,
                        width: `${widthPercent}%`,
                        backgroundColor: segment.start.color,
                        opacity: hoveredSegment === index ? 0.8 : 0.3,
                      }}
                      onMouseEnter={() => setHoveredSegment(index)}
                      onMouseLeave={() => setHoveredSegment(null)}
                    >
                      <div className="flex h-full items-center justify-center">
                        <span className="text-[10px] font-semibold text-white drop-shadow-md">
                          {segment.start.name || `Clip ${index + 1}`}
                        </span>
                      </div>
                    </div>
                  )
                })}

                <div
                  className="absolute top-0 h-full w-0.5 bg-primary"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                >
                  <div className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-primary" />
                </div>

                {markers.map((marker) => {
                  const isStartOrEnd = marker.id === "start" || marker.id === "end"

                  return (
                    <div
                      key={marker.id}
                      className="group absolute top-0 h-full"
                      style={{ left: `${(marker.time / duration) * 100}%` }}
                    >
                      <div
                        className="absolute top-0 h-full w-1 cursor-ew-resize rounded-full"
                        style={{ backgroundColor: marker.color }}
                        onMouseDown={(e) => handleMarkerMouseDown(e, marker.id)}
                      />

                      <div
                        className="absolute -top-2 left-1/2 flex h-6 w-6 -translate-x-1/2 cursor-ew-resize items-center justify-center rounded-full border-2 border-background shadow-lg transition-transform hover:scale-110"
                        style={{ backgroundColor: marker.color }}
                        onMouseDown={(e) => handleMarkerMouseDown(e, marker.id)}
                      >
                        {!isStartOrEnd && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveMarker(marker.id)
                            }}
                            className="flex h-full w-full items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <X className="h-3 w-3 text-white" />
                          </button>
                        )}
                      </div>

                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 font-mono text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                        {formatTime(marker.time)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          {/* Timeline - hidden on mobile, shown below on desktop */}
          <section className="hidden md:block w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Timeline</h3>
                <p className="text-xs text-slate-500">Click to seek, drag handles to adjust split points.</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleClearAllMarkers} size="sm" variant="outline" className="text-destructive">
                  <XCircle className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
                <Button onClick={addMarkerAtCurrentTime} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Marker
                </Button>
              </div>
            </div>

            <div className="mb-2 flex justify-between text-[10px] text-slate-500">
              {timeMarkers.map((time) => (
                <span key={time} className="font-mono">
                  {formatTime(time)}
                </span>
              ))}
            </div>

            <div
              ref={timelineRef}
              className="relative h-24 cursor-pointer overflow-hidden rounded-lg bg-slate-100"
              onClick={handleTimelineClick}
            >
              {segments.map((segment, index) => {
                const startPercent = (segment.start.time / duration) * 100
                const widthPercent = ((segment.end.time - segment.start.time) / duration) * 100

                return (
                  <div
                    key={index}
                    className="absolute top-0 h-full transition-opacity hover:opacity-80"
                    style={{
                      left: `${startPercent}%`,
                      width: `${widthPercent}%`,
                      backgroundColor: segment.start.color,
                      opacity: hoveredSegment === index ? 0.8 : 0.3,
                    }}
                    onMouseEnter={() => setHoveredSegment(index)}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    <div className="flex h-full items-center justify-center">
                      <span className="text-[10px] font-semibold text-white drop-shadow-md">
                        {segment.start.name || `Clip ${index + 1}`}
                      </span>
                    </div>
                  </div>
                )
              })}

              <div
                className="absolute top-0 h-full w-0.5 bg-primary"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-primary" />
              </div>

              {markers.map((marker) => {
                const isStartOrEnd = marker.id === "start" || marker.id === "end"

                return (
                  <div
                    key={marker.id}
                    className="group absolute top-0 h-full"
                    style={{ left: `${(marker.time / duration) * 100}%` }}
                  >
                    <div
                      className="absolute top-0 h-full w-1 cursor-ew-resize rounded-full"
                      style={{ backgroundColor: marker.color }}
                      onMouseDown={(e) => handleMarkerMouseDown(e, marker.id)}
                    />

                    <div
                      className="absolute -top-2 left-1/2 flex h-6 w-6 -translate-x-1/2 cursor-ew-resize items-center justify-center rounded-full border-2 border-background shadow-lg transition-transform hover:scale-110"
                      style={{ backgroundColor: marker.color }}
                      onMouseDown={(e) => handleMarkerMouseDown(e, marker.id)}
                    >
                      {!isStartOrEnd && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveMarker(marker.id)
                          }}
                          className="flex h-full w-full items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      )}
                    </div>

                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 font-mono text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                      {formatTime(marker.time)}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      {exportOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setExportOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h3 className="text-sm font-semibold">Export Options</h3>
              <button onClick={() => setExportOpen(false)} className="rounded-md p-1 hover:bg-slate-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <Label className="mb-3 block text-sm font-medium">Quality Settings</Label>
                <RadioGroup value={quality} onValueChange={(value) => setQuality(value as "original" | "compressed")}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                    <RadioGroupItem value="original" id="original" className="mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Original Quality</span>
                        <span className="text-xs text-slate-500">Best quality</span>
                      </div>
                      <p className="text-xs text-slate-500">Best for editing & archiving</p>
                    </div>
                  </label>

                  <label className="flex cursor-not-allowed items-start gap-3 rounded-lg border border-slate-200 p-3 opacity-60">
                    <RadioGroupItem value="compressed" id="compressed" disabled className="mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Compressed (Coming soon)</span>
                        <span className="text-xs text-slate-500">—</span>
                      </div>
                      <p className="text-xs text-slate-500">Faster, smaller file</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <div>
                <Label className="mb-1 block text-xs font-medium text-slate-600">Total clips to export</Label>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span>Selected clips</span>
                  <span className="rounded-md bg-white px-2 py-0.5 text-xs">{segments.length}</span>
                </div>
              </div>

              <Button
                onClick={handleExport}
                disabled={isExporting || segments.length === 0 || !videoFile}
                className="w-full"
                size="lg"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-5 w-5" />
                    Export All Clips
                  </>
                )}
              </Button>

              {exportProgress.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Export Progress</h4>
                    {allComplete && (
                      <Button onClick={downloadAllAsZip} size="sm" variant="outline">
                        <Package className="mr-2 h-4 w-4" />
                        Download ZIP
                      </Button>
                    )}
                  </div>

                  {exportProgress.map((progress, index) => (
                    <div key={index} className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {progress.status === "pending" && (
                            <div className="h-5 w-5 rounded-full border-2 border-slate-300" />
                          )}
                          {progress.status === "processing" && (
                            <Loader2 className="h-5 w-5 animate-spin text-slate-900" />
                          )}
                          {progress.status === "complete" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                          {progress.status === "error" && <XCircle className="h-5 w-5 text-red-500" />}
                          <span className="text-sm font-medium">{progress.clipName}</span>
                        </div>

                        {progress.status === "complete" && (
                          <Button onClick={() => downloadClip(exportedBlobs[index], index)} size="sm" variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        )}
                      </div>

                      {progress.status === "processing" && (
                        <div className="mt-2">
                          <Progress value={50} className="h-2" />
                        </div>
                      )}

                      {progress.status === "complete" && (
                        <p className="mt-1 text-xs text-green-600">Ready to download</p>
                      )}

                      {progress.status === "error" && (
                        <p className="mt-1 text-xs text-red-600">Error: {progress.error || "Unknown error"}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {segments.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-sm text-slate-500">Add at least 2 markers to create clips for export</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
