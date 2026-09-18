import { useRef, useState } from 'react'

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

  function handleChange(event) {
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ''

    const nextFiles = [...files]
    selectedFiles.forEach((file) => {
      if (
        nextFiles.length < maxFiles &&
        !nextFiles.some((existingFile) => isSameFile(existingFile, file))
      ) {
        nextFiles.push(file)
      }
    })

    setFiles(nextFiles)
    onChange(nextFiles)
  }

  function removeFile(fileToRemove) {
    const nextFiles = files.filter((file) => file !== fileToRemove)
    setFiles(nextFiles)
    onChange(nextFiles)
  }

  return (
    <div className="file-picker">
      <input
        ref={inputRef}
        className="file-picker-input"
        type="file"
        multiple
        onChange={handleChange}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        className="file-picker-button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || files.length >= maxFiles}
      >
        <span className="file-picker-icon" aria-hidden="true">＋</span>
        Choose files
      </button>
      <span className="file-picker-hint">
        {files.length > 0
          ? `${files.length} of ${maxFiles} files selected`
          : `Up to ${maxFiles} files, 10 MB each`}
      </span>

      {files.length > 0 ? (
        <ul className="file-list">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`}>
              <span className="file-name">
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
