import { useRef, useState } from 'react'
import {
  ACCEPTED_FILE_TYPES,
  attachmentCountError,
  validateFile,
} from './file-validation'

function isSameFile(left, right) {
  return (
    left.name === right.name &&
    left.size === right.size &&
    left.lastModified === right.lastModified
  )
}

export function FilePicker({ onChange, maxFiles = 5, disabled = false }) {
  const inputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [errors, setErrors] = useState([])

  function handleChange(event) {
    event.preventDefault()
    event.stopPropagation()
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ''

    const nextFiles = [...files]
    const nextErrors = []
    selectedFiles.forEach((file) => {
      if (nextFiles.some((existingFile) => isSameFile(existingFile, file))) return

      const validationError = validateFile(file)
      if (validationError) {
        nextErrors.push(validationError)
      } else if (nextFiles.length >= maxFiles) {
        nextErrors.push(attachmentCountError(nextFiles.length + 1, maxFiles))
      } else {
        nextFiles.push(file)
      }
    })

    setFiles(nextFiles)
    setErrors([...new Set(nextErrors.filter(Boolean))])
    onChange(nextFiles)
  }

  function openFilePicker(event) {
    event.preventDefault()
    event.stopPropagation()
    const input = inputRef.current
    if (!input) return

    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }
    input.click()
  }

  function removeFile(fileToRemove) {
    const nextFiles = files.filter((file) => file !== fileToRemove)
    setFiles(nextFiles)
    setErrors([])
    onChange(nextFiles)
  }

  return (
    <div className="file-picker">
      <input
        ref={inputRef}
        className="file-picker-input"
        type="file"
        multiple
        accept={ACCEPTED_FILE_TYPES}
        onChange={handleChange}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        className="file-picker-button"
        onClick={openFilePicker}
        disabled={disabled || files.length >= maxFiles}
      >
        <span className="file-picker-icon" aria-hidden="true">＋</span>
        Choose files
      </button>
      <span className="file-picker-hint">
        {files.length > 0
          ? `${files.length} of ${maxFiles} files selected`
          : maxFiles > 0 ? `Up to ${maxFiles} files, 10 MB each` : 'No additional files can be attached'}
      </span>
      {errors.length > 0 ? (
        <div className="field-error" role="alert">
          {errors.map((error) => <div key={error}>{error}</div>)}
        </div>
      ) : null}

      {files.length > 0 ? (
        <ul className="file-list">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`}>
              <span className="file-name" title={file.name}>
                <span aria-hidden="true">📎</span>
                {file.name}
              </span>
              <button
                type="button"
                className="file-remove"
                onClick={() => removeFile(file)}
                disabled={disabled}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
