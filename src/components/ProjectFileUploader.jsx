import {
  useRef,
  useState,
} from 'react';

import {
  FilePlus2,
  FileText,
  Trash2,
  UploadCloud,
} from 'lucide-react';

import {
  uploadProjectFiles,
} from '../lib/orders';

import {
  formatFileSize,
} from '../lib/projectOperations';

const MAX_BATCH_FILES = 6;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const allowedFileTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export default function ProjectFileUploader({
  orderId,
  disabled = false,
  onUploaded,
}) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const chooseFiles = (event) => {
    const incoming = Array.from(event.target.files || []);
    event.target.value = '';

    if (files.length + incoming.length > MAX_BATCH_FILES) {
      setError(`Upload up to ${MAX_BATCH_FILES} files at a time.`);
      return;
    }

    const invalid = incoming.find(
      (file) =>
        file.size <= 0 ||
        file.size > MAX_FILE_SIZE ||
        (file.type && !allowedFileTypes.has(file.type)),
    );

    if (invalid) {
      setError(
        invalid.size > MAX_FILE_SIZE
          ? `"${invalid.name}" is larger than 10 MB.`
          : `"${invalid.name}" is not a supported file type.`,
      );
      return;
    }

    setFiles((current) => {
      const existing = new Set(
        current.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
      );

      return [
        ...current,
        ...incoming.filter(
          (file) => !existing.has(`${file.name}:${file.size}:${file.lastModified}`),
        ),
      ];
    });
    setError('');
    setSuccess('');
  };

  const removeFile = (index) => {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const upload = async () => {
    if (files.length === 0) {
      setError('Select at least one file to upload.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setSuccess('');

      const result = await uploadProjectFiles({
        orderId,
        files,
        onStageChange: setStage,
      });

      setFiles(result.failedFiles);

      if (result.confirmed > 0) {
        setSuccess(
          `${result.confirmed} file${result.confirmed === 1 ? '' : 's'} uploaded. Management can now view ${result.confirmed === 1 ? 'it' : 'them'}.`,
        );
        await onUploaded?.();
      }

      if (result.failedFiles.length > 0) {
        setError(
          `${result.failedFiles.length} file${result.failedFiles.length === 1 ? '' : 's'} did not finish uploading. They remain selected so you can try again.`,
        );
      }
    } catch (uploadError) {
      setError(uploadError.message || 'The project files could not be uploaded.');
    } finally {
      setUploading(false);
      setStage('');
    }
  };

  if (disabled) {
    return null;
  }

  return (
    <div className="project-file-uploader">
      <div className="project-file-uploader-copy">
        <div>
          <FilePlus2 size={19} />
        </div>
        <div>
          <strong>Add more project files</strong>
          <p>
            Upload up to six references at a time. PNG, JPG, WEBP, PDF, DOC and
            DOCX files are accepted, up to 10 MB each.
          </p>
        </div>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <UploadCloud size={16} />
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx"
          onChange={chooseFiles}
        />
      </div>

      {files.length > 0 && (
        <div className="project-file-upload-selection">
          {files.map((file, index) => (
            <div key={`${file.name}-${file.size}-${file.lastModified}`}>
              <FileText size={16} />
              <div>
                <strong>{file.name}</strong>
                <span>{formatFileSize(file.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                disabled={uploading}
                aria-label={`Remove ${file.name}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          <button
            type="button"
            className="button button-primary project-file-upload-submit"
            onClick={upload}
            disabled={uploading}
          >
            <UploadCloud size={16} />
            {uploading ? stage || 'Uploading files...' : `Upload ${files.length} file${files.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {success && <div className="finance-success-message">{success}</div>}
      {error && <div className="finance-error-message">{error}</div>}
    </div>
  );
}
