const HTML_COMMENTS = /<!--[\s\S]*?-->/g
const HTML_TAGS = /<[^>]*>/g

function removeControlCharacters(value) {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0)
      return !(
        code <= 0x08 ||
        code === 0x0b ||
        code === 0x0c ||
        (code >= 0x0e && code <= 0x1f) ||
        code === 0x7f
      )
    })
    .join('')
}

export function sanitizePlainText(value) {
  return removeControlCharacters(
    String(value ?? '')
      .replace(HTML_COMMENTS, '')
      .replace(HTML_TAGS, ''),
  )
    .trim()
}
