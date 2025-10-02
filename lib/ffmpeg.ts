import { FFmpeg } from "@ffmpeg/ffmpeg"

let ffmpegInstance: FFmpeg | null = null

/**
 * IMPORTANT: FFmpeg Setup Instructions
 *
 * Due to CORS restrictions in the preview environment, FFmpeg core files must be served
 * from the same origin. To set this up:
 *
 * 1. Download the following files from https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/
 *    - ffmpeg-core.js
 *    - ffmpeg-core.wasm
 *    - ffmpeg-core.worker.js
 *
 * 2. Place these files in your project's /public directory
 *
 * 3. The code below will automatically load them from /ffmpeg-core.*
 *
 * Alternative: If deploying to production, ensure your server sends these headers:
 *    Cross-Origin-Opener-Policy: same-origin
 *    Cross-Origin-Embedder-Policy: require-corp
 */

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) {
    return ffmpegInstance
  }

  ffmpegInstance = new FFmpeg()

  try {
    await ffmpegInstance.load({
      coreURL: "/ffmpeg-core.js",
      wasmURL: "/ffmpeg-core.wasm",
      workerURL: "/ffmpeg-core.worker.js",
    })

    console.log("[v0] FFmpeg loaded successfully from local files")
  } catch (error) {
    console.error("[v0] Failed to load FFmpeg:", error)
    throw new Error(
      "FFmpeg failed to load. Please ensure ffmpeg-core.js, ffmpeg-core.wasm, and ffmpeg-core.worker.js " +
        "are placed in the /public directory. See lib/ffmpeg.ts for setup instructions.",
    )
  }

  return ffmpegInstance
}

export interface ExportProgress {
  clipIndex: number
  clipName: string
  status: "pending" | "processing" | "complete" | "error"
  progress: number
  error?: string
}

export async function splitVideo(
  videoFile: File,
  segments: Array<{ start: number; end: number; name: string }>,
  onProgress: (progress: ExportProgress[]) => void,
  aspectRatio: "original" | "9:16" | "16:9" = "original",
): Promise<Blob[]> {
  const ffmpeg = await getFFmpeg()

  // Initialize progress
  const progressArray: ExportProgress[] = segments.map((segment, index) => ({
    clipIndex: index,
    clipName: segment.name,
    status: "pending",
    progress: 0,
  }))
  onProgress([...progressArray])

  // Write input file to FFmpeg virtual file system
  const inputFileName = "input.mp4"
  const fileData = await videoFile.arrayBuffer()
  await ffmpeg.writeFile(inputFileName, new Uint8Array(fileData))

  const outputBlobs: Blob[] = []

  // Process each segment
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const outputFileName = `output_${i}.mp4`

    try {
      // Update status to processing
      progressArray[i].status = "processing"
      onProgress([...progressArray])

      // Calculate duration
      const duration = segment.end - segment.start

      // Build FFmpeg command based on aspect ratio
      const ffmpegArgs = ["-i", inputFileName, "-ss", segment.start.toString(), "-t", duration.toString()]

      if (aspectRatio === "original") {
        // Fast copy without re-encoding
        ffmpegArgs.push("-c", "copy", "-avoid_negative_ts", "make_zero")
      } else {
        // Need to re-encode for aspect ratio change
        const [targetWidth, targetHeight] = aspectRatio.split(":").map(Number)

        // Use pad filter to add black bars and maintain original aspect ratio
        // Scale to fit within target dimensions, then pad to exact aspect ratio
        ffmpegArgs.push(
          "-vf",
          `scale=w='if(gt(a,${targetWidth}/${targetHeight}),min(iw,1080),min(ih*${targetWidth}/${targetHeight},1080*${targetWidth}/${targetHeight}))':h='if(gt(a,${targetWidth}/${targetHeight}),min(iw*${targetHeight}/${targetWidth},1920*${targetHeight}/${targetWidth}),min(ih,1920))':force_original_aspect_ratio=decrease,pad='max(iw,ih*${targetWidth}/${targetHeight})':'max(ih,iw*${targetHeight}/${targetWidth})':'(ow-iw)/2':'(oh-ih)/2':color=black`,
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "23",
          "-c:a",
          "aac",
        )
      }

      ffmpegArgs.push(outputFileName)

      // Run FFmpeg command to extract segment
      await ffmpeg.exec(ffmpegArgs)

      // Read the output file
      const data = await ffmpeg.readFile(outputFileName)
      const blob = new Blob([data], { type: "video/mp4" })
      outputBlobs.push(blob)

      // Update progress to complete
      progressArray[i].status = "complete"
      progressArray[i].progress = 100
      onProgress([...progressArray])

      // Clean up output file
      await ffmpeg.deleteFile(outputFileName)
    } catch (error) {
      console.error(`Error processing segment ${i}:`, error)
      progressArray[i].status = "error"
      progressArray[i].error = error instanceof Error ? error.message : "Unknown error"
      onProgress([...progressArray])
    }
  }

  // Clean up input file
  await ffmpeg.deleteFile(inputFileName)

  return outputBlobs
}
