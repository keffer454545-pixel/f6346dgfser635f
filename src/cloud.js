export function exportToFile(data, filename = 'collection.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function importFromFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return resolve(null)
      const text = await file.text()
      try {
        resolve(JSON.parse(text))
      } catch {
        resolve(null)
      }
    }
    input.click()
  })
}