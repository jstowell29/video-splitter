"use client"

import { useState, useEffect, useRef } from "react"
import { Download, Loader2, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { splitVideo, type ExportProgress } from "@/lib/ffmpeg"
import type { Marker } from "@/types/marker"
import JSZip from "jszip"

interface ExportPanelProps {
  videoFile: File | null
  markers: Marker[]
}

export function ExportPanel({ videoFile, markers }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<ExportProgress[]>([])
  const [exportedBlobs, setExportedBlobs] = useState<Blob[]>([])
  const [quality, setQuality] = useState<"original" | "compressed">("original")
  const hasAutoDownloaded = useRef(false)

  const segments = []
  for (let i = 0; i < markers.length - 1; i++) {
    segments.push({
      start: markers[i].time,
      end: markers[i + 1].time,
      name: markers[i].name || `clip_${i + 1}`,
    })
  }

  const handleExport = async () => {
    if (!videoFile || segments.length === 0) return

    setIsExporting(true)
    setExportedBlobs([])

    try {
      const blobs = await splitVideo(videoFile, segments, setExportProgress)
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
    a.download = `${segments[index].name}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadAllAsZip = async () => {
    if (exportedBlobs.length === 0) return

    const zip = new JSZip()

    exportedBlobs.forEach((blob, index) => {
      zip.file(`${segments[index].name}.mp4`, blob)
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
  const completedCount = exportProgress.filter((p) => p.status === "complete").length
  const totalCount = exportProgress.length
  const overallProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  useEffect(() => {
    if (allComplete && exportedBlobs.length === totalCount && !hasAutoDownloaded.current) {
      hasAutoDownloaded.current = true
      setTimeout(() => {
        downloadAllAsZip()
      }, 500)
    }
  }, [allComplete, exportedBlobs.length, totalCount])

  useEffect(() => {
    if (isExporting) {
      hasAutoDownloaded.current = false
    }
  }, [isExporting])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="mb-1 text-lg font-semibold">Export Clips</h2>
        <p className="text-xs text-slate-500">Process and download your video clips.</p>
      </div>

      {/* Quality Settings */}
      <div className="mb-4">
        <Label className="mb-3 block text-sm font-medium">Quality Settings</Label>
        <RadioGroup value={quality} onValueChange={(value) => setQuality(value as "original" | "compressed")}>
          <div className="mb-3 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
            <RadioGroupItem value="original" id="original" className="mt-0.5" />
            <Label htmlFor="original" className="flex-1 cursor-pointer">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Original quality</span>
                <span className="text-xs text-slate-500">Best quality</span>
              </div>
              <p className="text-xs text-slate-500">Best for editing & archiving</p>
            </Label>
          </div>

          <div className="flex cursor-not-allowed items-start gap-3 rounded-lg border border-slate-200 p-3 opacity-60">
            <RadioGroupItem value="compressed" id="compressed" disabled className="mt-0.5" />
            <Label htmlFor="compressed" className="flex-1 cursor-not-allowed">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Compressed (coming soon)</span>
                <span className="text-xs text-slate-500">—</span>
              </div>
              <p className="text-xs text-slate-500">Faster, smaller file</p>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Export Summary */}
      <div className="mb-4">
        <Label className="mb-1 block text-xs font-medium text-slate-600">Total clips to export</Label>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span>Selected clips</span>
          <span className="rounded-md bg-white px-2 py-0.5 text-xs">{segments.length}</span>
        </div>
      </div>

      {/* Export Button */}
      <div className="space-y-2">
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
      </div>

      {/* Progress Display */}
      {exportProgress.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Export Progress</h4>
            {allComplete && (
              <Button onClick={downloadAllAsZip} size="sm" variant="outline">
                <Package className="mr-2 h-4 w-4" />
                Download ZIP
              </Button>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">
                {allComplete ? "Export Complete!" : "Exporting clips..."}
              </span>
              <span className="text-slate-600">
                {completedCount} of {totalCount}
              </span>
            </div>
            <Progress value={overallProgress} className="h-2" />
            {allComplete && <p className="mt-2 text-xs text-green-600">ZIP file will download automatically</p>}
          </div>
        </div>
      )}

      {segments.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">Add at least 2 markers to create clips for export</p>
        </div>
      )}
    </div>
  )
}
