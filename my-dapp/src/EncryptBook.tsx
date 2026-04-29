import { useState } from 'react'

export default function EncryptBook() {
  const [pdf, setPdf] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [bookId, setBookId] = useState('')
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [status, setStatus] = useState('')
  const [metadataURI, setMetadataURI] = useState('')

  const handleUpload = async () => {
    try {
      if (!pdf) {
        setStatus('Falta PDF')
        return
      }

      if (!cover) {
        setStatus('Falta portada')
        return
      }

      if (!bookId.trim()) {
        setStatus('Falta bookId')
        return
      }

      setStatus('Cifrando y subiendo...')

      const form = new FormData()
      form.append('pdf', pdf)
      form.append('cover', cover)
      form.append('bookId', bookId.trim())
      form.append('title', title.trim())
      form.append('author', author.trim())

      const res = await fetch('https://soliditybookmp-1.onrender.com/api/upload-book', {//fetch('http://localhost:4000/api/upload-book', {
        method: 'POST',
        body: form,
      })

      const json = await res.json()

      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Error subiendo libro')
      }

      setMetadataURI(json.metadataURI)
      setStatus('✅ Libro cifrado y subido correctamente')
    } catch (err: any) {
      console.error(err)
      setStatus(err?.message || 'Error')
    }
  }

  const copyMetadataURI = async () => {
    if (!metadataURI) return
    await navigator.clipboard.writeText(metadataURI)
    setStatus('✅ Metadata URI copiada')
  }

  return (
    <div style={{ border: '1px solid #ccc', padding: 16, borderRadius: 8 }}>
      <h2>Owner: cifrar y subir libro</h2>

      <div style={{ display: 'grid', gap: 8 }}>
        <input
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
          placeholder="Book ID esperado, ej: 11"
          style={{ padding: 8 }}
        />

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          style={{ padding: 8 }}
        />

        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Autor"
          style={{ padding: 8 }}
        />

        <label>
          PDF:
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setPdf(e.target.files?.[0] || null)}
          />
        </label>

        <label>
          Portada:
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setCover(e.target.files?.[0] || null)}
          />
        </label>

        <button onClick={handleUpload}>Cifrar + subir a IPFS</button>

        {metadataURI && (
          <div>
            <p>
              <strong>Metadata URI:</strong> {metadataURI}
            </p>
            <button onClick={copyMetadataURI}>Copiar metadata URI</button>
          </div>
        )}

        {status && (
          <p>
            <strong>Estado:</strong> {status}
          </p>
        )}
      </div>
    </div>
  )
}