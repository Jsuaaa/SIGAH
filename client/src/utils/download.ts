// Dispara la descarga de un Blob en el navegador (para exportar reportes PDF/Excel
// recibidos por axios con responseType:'blob').
export function saveBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
