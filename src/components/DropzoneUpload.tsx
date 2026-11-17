import { useId, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

interface DropzoneUploadProps {
  title: string;
  hint: string;
  accept?: string;
  multiple?: boolean;
  badgeText?: string;
  onFiles: (files: File[]) => void;
}

export function DropzoneUpload({
  title,
  hint,
  accept = 'image/*,video/*',
  multiple = true,
  badgeText,
  onFiles,
}: DropzoneUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleList = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleList(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-labelledby={inputId}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="visually-hidden"
        onChange={(e) => {
          handleList(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="dropzone-icon" aria-hidden="true">
        <UploadCloud size={24} />
      </div>
      <div className="dropzone-body">
        <div id={inputId} className="dropzone-title">
          {title}
          {badgeText && <span className="pill ok">{badgeText}</span>}
        </div>
        <p className="hint" style={{ margin: 0 }}>
          {hint}
        </p>
      </div>
    </div>
  );
}

