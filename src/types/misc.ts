export type ByteArray = Uint8Array
export type Hex = `0x${string}`
export type Hash = `0x${string}`
export type LogTopic = Hex | readonly Hex[] | null
export type SignableMessage =
  | string
  | {
      /** Raw data representation of the message. */
      raw: Hex | ByteArray
    }
export type CompactSignature = {
  r: Hex
  yParityAndS: Hex
}
