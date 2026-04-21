import { useState } from 'react'

type Props = {
  encryptedFileUrl: string
  ownsBook: boolean
}

export default function DecryptBook({ encryptedFileUrl, ownsBook }: Props) {
  const [status, setStatus] = useState('')
  const [encryptedPreview, setEncryptedPreview] = useState<any>(null)

  const handleLoadEncrypted = async () => {
    try {
      if (!encryptedFileUrl) {
        setStatus('No hay encrypted_file configurado')
        return
      }

      setStatus('Cargando archivo cifrado...')

      const response = await fetch(encryptedFileUrl)
      if (!response.ok) {
        throw new Error(`No se pudo cargar encrypted_file: ${response.status}`)
      }

      const json = await response.json()
      setEncryptedPreview(json)

      setStatus('✅ Archivo cifrado cargado')
    } catch (error: any) {
      console.error(error)
      setStatus(`Error cargando archivo cifrado: ${error?.message || 'desconocido'}`)
    }
  }

  if (!ownsBook) {
    return (
      <div style={{ marginTop: 16 }}>
        <strong>Contenido del libro</strong>
        <p style={{ marginTop: 8 }}>
          Compra este libro para desbloquear el PDF completo.
        </p>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16 }}>
      <strong>Contenido del libro</strong>

      {!encryptedFileUrl ? (
        <p style={{ marginTop: 8 }}>No hay encrypted_file configurado.</p>
      ) : (
        <>
          <p style={{ marginTop: 8 }}>
            Este libro usa un archivo cifrado.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <button onClick={handleLoadEncrypted}>
              Cargar archivo cifrado
            </button>

            <a href={encryptedFileUrl} target="_blank" rel="noreferrer">
              Descargar encrypted JSON
            </a>
          </div>

          {status && <p style={{ marginTop: 12 }}><strong>Estado:</strong> {status}</p>}

          {encryptedPreview && (
            <div style={{ marginTop: 16 }}>
              <p><strong>Encrypted JSON cargado correctamente</strong></p>
              <pre
                style={{
                  background: '#f6f6f6',
                  padding: 12,
                  borderRadius: 8,
                  overflowX: 'auto',
                  maxHeight: 300,
                }}
              >
{JSON.stringify(encryptedPreview, null, 2)}
              </pre>

              <p style={{ marginTop: 12 }}>
                El siguiente paso es descifrar esto con Lit en un lector separado o una integración compatible.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}