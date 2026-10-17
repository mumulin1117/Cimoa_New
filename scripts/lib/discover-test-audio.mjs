// Valid, bounded PCM test tone; never shipped as a user's voice introduction.
export function discover_test_audio() {
  const bytes = Buffer.alloc(32044)
  bytes.write('RIFF',0); bytes.writeUInt32LE(32036,4); bytes.write('WAVE',8); bytes.write('fmt ',12); bytes.writeUInt32LE(16,16); bytes.writeUInt16LE(1,20); bytes.writeUInt16LE(1,22); bytes.writeUInt32LE(16000,24); bytes.writeUInt32LE(32000,28); bytes.writeUInt16LE(2,32); bytes.writeUInt16LE(16,34); bytes.write('data',36); bytes.writeUInt32LE(32000,40)
  for(let i=0;i<16000;i++)bytes.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/16000)*5000),44+i*2)
  return { base64: bytes.toString('base64'), mime:'audio/wav', byte_size:bytes.length, duration_ms:1000 }
}
