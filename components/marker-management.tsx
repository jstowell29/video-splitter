"use client"

import { useState } from "react"
import { Play, Edit2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Marker } from "@/types/marker"

interface MarkerManagementProps {
  markers: Marker[]
  duration: number
  segmentNames: Record<number, string>
  onMarkersUpdate: (markers: Marker[]) => void
  onSegmentNameUpdate: (index: number, name: string) => void
  onSeek: (time: number) => void
  onPreview?: (time: number) => void
}

export function MarkerManagement({
  markers,
  duration,
  segmentNames,
  onMarkersUpdate,
  onSegmentNameUpdate,
  onSeek,
  onPreview,
}: MarkerManagementProps) {
  const [editingClipIndex, setEditingClipIndex] = useState<number | null>(null)
  const [editingClipName, setEditingClipName] = useState("")
  const [editingStartTime, setEditingStartTime] = useState("")
  const [editingEndTime, setEditingEndTime] = useState("")

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const parseTime = (timeString: string): number | null => {
    const parts = timeString.split(":").map((p) => Number.parseInt(p, 10))
    if (parts.length !== 3 || parts.some(isNaN)) return null

    const [hours, minutes, seconds] = parts
    const totalSeconds = hours * 3600 + minutes * 60 + seconds

    if (totalSeconds < 0 || totalSeconds > duration) return null
    return totalSeconds
  }

  const handleStartClipEdit = (index: number, segment: any) => {
    setEditingClipIndex(index)
    setEditingClipName(segment.name)
    setEditingStartTime(formatTime(segment.start.time))
    setEditingEndTime(formatTime(segment.end.time))
  }

  const handleSaveClipEdit = () => {
    if (editingClipIndex === null) return

    const newStartTime = parseTime(editingStartTime)
    const newEndTime = parseTime(editingEndTime)

    // Validate times
    if (newStartTime === null || newEndTime === null) {
      alert("Invalid time format. Please use HH:MM:SS")
      return
    }

    if (newStartTime >= newEndTime) {
      alert("Start time must be before end time")
      return
    }

    // Update segment name
    onSegmentNameUpdate(editingClipIndex, editingClipName)

    // Update markers - we need to update the start marker (index) and end marker (index + 1)
    const updatedMarkers = markers.map((marker, idx) => {
      if (idx === editingClipIndex) {
        return { ...marker, time: newStartTime }
      }
      if (idx === editingClipIndex + 1) {
        return { ...marker, time: newEndTime }
      }
      return marker
    })

    // Sort markers by time and update
    onMarkersUpdate(updatedMarkers.sort((a, b) => a.time - b.time))
    setEditingClipIndex(null)
  }

  const handleCancelClipEdit = () => {
    setEditingClipIndex(null)
    setEditingClipName("")
    setEditingStartTime("")
    setEditingEndTime("")
  }

  const handlePreview = (startTime: number) => {
    console.log("[v0] Preview clicked for time:", startTime)
    if (onPreview) {
      onPreview(startTime)
    } else {
      onSeek(startTime)
    }
  }

  // Calculate segments
  const segments = []
  for (let i = 0; i < markers.length - 1; i++) {
    segments.push({
      index: i,
      start: markers[i],
      end: markers[i + 1],
      duration: markers[i + 1].time - markers[i].time,
      name: segmentNames[i] || `Clip ${i + 1}`,
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Clips</h3>

        {segments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">No clips yet. Add markers to create clips.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {segments.map((segment) => {
              const isEditing = editingClipIndex === segment.index

              return (
                <div
                  key={segment.index}
                  className="rounded-lg border border-border bg-background p-4 transition-all hover:border-primary/50"
                >
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Clip Name</Label>
                        <Input
                          value={editingClipName}
                          onChange={(e) => setEditingClipName(e.target.value)}
                          placeholder="Clip name"
                          className="mt-1"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Start Time</Label>
                          <Input
                            value={editingStartTime}
                            onChange={(e) => setEditingStartTime(e.target.value)}
                            placeholder="HH:MM:SS"
                            className="mt-1 font-mono text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">End Time</Label>
                          <Input
                            value={editingEndTime}
                            onChange={(e) => setEditingEndTime(e.target.value)}
                            placeholder="HH:MM:SS"
                            className="mt-1 font-mono text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveClipEdit} className="flex-1">
                          <Check className="mr-1 h-4 w-4" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelClipEdit}
                          className="flex-1 bg-transparent"
                        >
                          <X className="mr-1 h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.start.color }} />
                        <h4 className="flex-1 font-semibold text-foreground">{segment.name}</h4>
                      </div>

                      <div className="mb-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Start:</span>
                          <span className="font-mono font-medium text-foreground">
                            {formatTime(segment.start.time)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">End:</span>
                          <span className="font-mono font-medium text-foreground">{formatTime(segment.end.time)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2">
                          <span className="font-semibold text-foreground">Duration:</span>
                          <span className="font-mono font-bold text-foreground">{formatTime(segment.duration)}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePreview(segment.start.time)}
                          className="flex-1"
                        >
                          <Play className="mr-1 h-4 w-4" />
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartClipEdit(segment.index, segment)}
                          className="flex-1"
                        >
                          <Edit2 className="mr-1 h-4 w-4" />
                          Edit
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
