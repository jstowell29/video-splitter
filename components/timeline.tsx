"use client"

import type React from "react"

import { useRef, useState, useCallback, useEffect } from "react"
import { Plus, X, Play, Pause, Pencil, Check, Trash2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Marker } from "@/types/marker"

interface TimelineProps {
  duration: number
  currentTime: number
  markers: Marker[]
  onSeek: (time: number) => void
  onMarkersUpdate: (markers: Marker[]) => void
  onAddMarker: () => void
  onPreview?: (startTime: number, endTime: number, segmentIndex: number) => void
  onPausePreview?: () => void
  previewingSegment: number | null
}

export function Timeline({
  duration,
  currentTime,
  markers,
  onSeek,
  onMarkersUpdate,
  onAddMarker,
  onPreview,
  onPausePreview,
  previewingSegment,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null)
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null)
  const [editingSegment, setEditingSegment] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: "", startTime: "", endTime: "" })

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
    onSeek(time)
  }

  const handleMarkerMouseDown = (e: React.MouseEvent, markerId: string) => {
    e.stopPropagation()
    setDraggingMarkerId(markerId)
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingMarkerId) return

      const time = getTimeFromPosition(e.clientX)
      const updatedMarkers = markers.map((marker) => (marker.id === draggingMarkerId ? { ...marker, time } : marker))
      onMarkersUpdate(updatedMarkers.sort((a, b) => a.time - b.time))
    },
    [draggingMarkerId, markers, duration, onMarkersUpdate],
  )

  const handleMouseUp = useCallback(() => {
    setDraggingMarkerId(null)
  }, [])

  const handleRemoveMarker = (markerId: string) => {
    if (markerId === "start" || markerId === "end") return

    const updatedMarkers = markers.filter((m) => m.id !== markerId)
    onMarkersUpdate(updatedMarkers)
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

    onMarkersUpdate(updatedMarkers.sort((a, b) => a.time - b.time))
    setEditingSegment(null)
  }

  const handleDeleteSegment = (index: number) => {
    // Can't delete the first segment (it starts with the "start" marker)
    if (index === 0) {
      alert("Cannot delete the first segment")
      return
    }

    // Remove the marker that starts this segment
    const markerToRemove = markers[index]
    const updatedMarkers = markers.filter((m) => m.id !== markerToRemove.id)
    onMarkersUpdate(updatedMarkers)
  }

  const handleClearAllMarkers = () => {
    if (confirm("Are you sure you want to clear all markers? This will remove all clips.")) {
      // Keep only the start and end markers
      const startMarker = markers.find((m) => m.id === "start")
      const endMarker = markers.find((m) => m.id === "end")
      if (startMarker && endMarker) {
        onMarkersUpdate([startMarker, endMarker])
      }
    }
  }

  const handlePreviewClick = (segment: any, index: number) => {
    if (previewingSegment === index) {
      if (onPausePreview) {
        onPausePreview()
      }
    } else {
      if (onPreview) {
        onPreview(segment.start.time, segment.end.time, index)
      }
    }
  }

  const timeMarkers = []
  const interval = duration > 300 ? 60 : duration > 60 ? 30 : 10
  for (let i = 0; i <= duration; i += interval) {
    timeMarkers.push(i)
  }

  const segments = []
  for (let i = 0; i < markers.length - 1; i++) {
    segments.push({
      start: markers[i],
      end: markers[i + 1],
      duration: markers[i + 1].time - markers[i].time,
    })
  }

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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Timeline</h3>
          <p className="text-xs text-slate-500">Click to seek, drag handles to adjust split points.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleClearAllMarkers} size="sm" variant="outline" className="text-destructive hover:bg-destructive hover:text-destructive-foreground">
            <XCircle className="mr-2 h-4 w-4" />
            Clear All
          </Button>
          <Button onClick={onAddMarker} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Marker
          </Button>
        </div>
      </div>

      <div className="mb-2 flex justify-between text-xs text-slate-500">
        {timeMarkers.map((time) => (
          <span key={time} className="font-mono">
            {formatTime(time)}
          </span>
        ))}
      </div>

      <div
        ref={timelineRef}
        className="relative h-20 cursor-pointer rounded-lg bg-slate-100"
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
                <span className="text-xs font-semibold text-white drop-shadow-md">
                  {segment.start.name || `Clip ${index + 1}`}
                </span>
              </div>
            </div>
          )
        })}

        <div className="absolute top-0 h-full w-0.5 bg-primary" style={{ left: `${(currentTime / duration) * 100}%` }}>
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

              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs font-mono text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                {formatTime(marker.time)}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((segment, index) => (
          <div
            key={index}
            className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50"
            onMouseEnter={() => setHoveredSegment(index)}
            onMouseLeave={() => setHoveredSegment(null)}
          >
            {editingSegment === index ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Clip Name</label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="Clip name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Start Time (MM:SS)</label>
                  <Input
                    value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                    className="h-8 font-mono text-sm"
                    placeholder="0:00"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">End Time (MM:SS)</label>
                  <Input
                    value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                    className="h-8 font-mono text-sm"
                    placeholder="0:00"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleSaveEdit(index)} size="sm" className="flex-1">
                    <Check className="mr-1 h-3 w-3" />
                    Save
                  </Button>
                  <Button onClick={() => setEditingSegment(null)} size="sm" variant="outline" className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.start.color }} />
                  <span className="font-semibold text-foreground">{segment.start.name || `Clip ${index + 1}`}</span>
                </div>
                <div className="mb-3 space-y-1 text-xs text-muted-foreground">
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
                <div className="flex gap-2">
                  <Button
                    onClick={() => handlePreviewClick(segment, index)}
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
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
                  <Button
                    onClick={() => handleEditSegment(index, segment)}
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDeleteSegment(index)}
                    size="sm"
                    variant="outline"
                    className="text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    disabled={index === 0}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
