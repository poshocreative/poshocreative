import {
  useEffect,
  useState,
} from 'react';

import {
  Download,
  FileText,
} from 'lucide-react';

import BrandLoader from '../components/BrandLoader';

import {
  downloadProjectFile,
  getMyFiles,
} from '../lib/orders';

export default function DashboardFiles() {
  const [files, setFiles] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(null);

  useEffect(() => {
    document.title =
      'Files | Posho Creative';

    getMyFiles()
      .then(setFiles)
      .catch(console.error)
      .finally(() =>
        setLoading(false),
      );
  }, []);

  const download =
    async (file) => {
      try {
        setBusy(file.id);

        await downloadProjectFile(
          file,
        );
      } finally {
        setBusy(null);
      }
    };

  if (loading) {
    return (
      <div className="workspace-loading-panel">
        <BrandLoader label="Loading project files..." />
      </div>
    );
  }

  return (
    <div className="workspace-view page-reveal">
      <div className="workspace-view-heading">
        <div>
          <span className="workspace-kicker">
            FILES
          </span>

          <h2>
            Your project library.
          </h2>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="workspace-empty workspace-panel">
          <div className="workspace-empty-icon">
            <FileText size={27} />
          </div>

          <h3>
            No project files yet.
          </h3>

          <p>
            References and completed project deliverables will appear here.
          </p>
        </div>
      ) : (
        <div className="workspace-file-grid">
          {files.map(
            (file) => (
              <article
                key={file.id}
                className="workspace-file-card stagger-item"
              >
                <div className="workspace-file-icon">
                  <FileText size={24} />
                </div>

                <small>
                  {file.orders?.reference}
                </small>

                <h3>
                  {file.original_name}
                </h3>

                <p>
                  {file.orders?.project_title}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    download(file)
                  }
                  disabled={
                    busy === file.id
                  }
                >
                  <Download size={16} />

                  {busy === file.id
                    ? 'Preparing...'
                    : 'Download'}
                </button>
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}