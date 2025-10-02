export interface Marker {
  id: string
  time: number
  color: string
  name?: string // Added optional name field for clip naming
}

export interface Segment {
  id: string
  startMarker: Marker
  endMarker: Marker
  duration: number
  name: string
}
