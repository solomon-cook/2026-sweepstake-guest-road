declare module 'heic-convert' {
  export default function convert(input: {
    buffer: ArrayBufferLike
    format: 'JPEG' | 'PNG'
    quality?: number
  }): Promise<ArrayBuffer>
}
