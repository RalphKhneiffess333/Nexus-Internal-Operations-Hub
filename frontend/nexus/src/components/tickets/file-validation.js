export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const MAX_FILES_PER_EVENT = 5

const allowedFileTypes = {
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv'],
  '.json': ['application/json'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.zip': ['application/zip'],
  '.md': ['text/markdown', 'text/plain'],
  '.avif': ['image/avif'],
  '.bmp': ['image/bmp'],
  '.ico': ['image/x-icon', 'image/vnd.microsoft.icon'],
  '.tif': ['image/tiff'],
  '.tiff': ['image/tiff'],
  '.rtf': ['application/rtf', 'text/rtf'],
  '.odt': ['application/vnd.oasis.opendocument.text'],
  '.ods': ['application/vnd.oasis.opendocument.spreadsheet'],
  '.odp': ['application/vnd.oasis.opendocument.presentation'],
  '.xml': ['application/xml', 'text/xml'],
  '.yaml': ['application/x-yaml', 'text/yaml'],
  '.yml': ['application/x-yaml', 'text/yaml'],
  '.log': ['text/plain'],
  '.7z': ['application/x-7z-compressed'],
  '.rar': ['application/vnd.rar', 'application/x-rar-compressed'],
  '.tar': ['application/x-tar'],
  '.gz': ['application/gzip', 'application/x-gzip'],
  '.mp3': ['audio/mpeg'],
  '.wav': ['audio/wav', 'audio/x-wav'],
  '.ogg': ['audio/ogg'],
  '.m4a': ['audio/mp4'],
  '.mp4': ['video/mp4'],
  '.webm': ['video/webm'],
  '.mov': ['video/quicktime'],
}

export const ACCEPTED_FILE_TYPES = Object.entries(allowedFileTypes)
  .flatMap(([extension, mimeTypes]) => [extension, ...mimeTypes])
  .join(',')

function getFileName(file) {
  return file.name.replace(/\\/g, '/').split('/').pop() || 'file'
}

export function validateFile(file) {
  const fileName = getFileName(file)
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
  const allowedMimeTypes = allowedFileTypes[extension]

  if (file.size > MAX_FILE_SIZE) {
    return `File "${fileName}" must be 10 MB or smaller.`
  }
  if (!allowedMimeTypes || !allowedMimeTypes.includes(file.type)) {
    return `File "${fileName}" has an unsupported file type.`
  }

  return ''
}

export function attachmentCountError(count, maxFiles = MAX_FILES_PER_EVENT) {
  return count > maxFiles ? `You can attach up to ${maxFiles} files.` : ''
}
