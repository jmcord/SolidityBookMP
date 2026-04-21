import { useState } from 'react'

export default function EncryptBook() {
  const [file, setFile] = useState<File | null>(null)
  const [encrypted, setEncrypted] = useState<Uint8Array | null>(null)

  const handleEncrypt = async () => {
    if (!file) return

    const buffer = await file.arrayBuffer()

    // 🔐 cifrado simple (para demo)
    const key = 123
    const encryptedBytes = new Uint8Array(buffer).map(b => b ^ key)

    setEncrypted(encryptedBytes)

    console.log('PDF cifrado:', encryptedBytes)
  }

  const handleDecrypt = () => {
    if (!encrypted) return

    const key = 123
    const decryptedBytes = encrypted.map(b => b ^ key)

    const blob = new Blob([decryptedBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    window.open(url)
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h2>🔐 Demo cifrado libro</h2>

      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <div style={{ marginTop: 10 }}>
        <button onClick={handleEncrypt}>
          Cifrar PDF
        </button>

        <button onClick={handleDecrypt} style={{ marginLeft: 10 }}>
          Descifrar y abrir
        </button>
      </div>
    </div>
  )
}