import { useEffect, useState } from "react";
import { apiFetch, API_URL } from "../lib/api";
import {
  FileTextIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
} from "lucide-react";

type Document = {
  _id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: "processing" | "completed" | "failed";
  error?: string;
  chunkCount: number;
  createdAt: string;
};

const Knowledge = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadDocuments = async () => {
    try {
      const docs = await apiFetch<Document[]>("/api/knowledge");
      setDocuments(docs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    // Poll for status updates every 5 seconds
    const interval = setInterval(loadDocuments, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file to upload.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      console.log("Uploading file:", selectedFile.name, selectedFile.type, selectedFile.size);

      const response = await fetch(`${API_URL}/api/knowledge/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      console.log("Upload response status:", response.status);
      console.log("Upload response headers:", Object.fromEntries(response.headers.entries()));

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      let data;
      
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
        console.log("Upload response data:", data);
      } else {
        // If not JSON, likely an HTML error page or authentication redirect
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 500) + "...");
        
        if (response.status === 401) {
          throw new Error("You must be signed in to upload documents. Please refresh the page and sign in again.");
        } else if (response.status === 404) {
          throw new Error("Upload endpoint not found. Please ensure the server is running the latest version.");
        } else {
          throw new Error(`Server error (${response.status}). Please check the server logs and try again.`);
        }
      }

      if (!response.ok) {
        throw new Error(data.message || `Upload failed with status ${response.status}`);
      }

      setDocuments((prev) => [data, ...prev]);
      setSelectedFile(null);
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
      console.log("Upload successful:", data);
    } catch (uploadError) {
      console.error("Upload error:", uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}"?`)) return;

    try {
      await apiFetch(`/api/knowledge/${id}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((doc) => doc._id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusIcon = (status: Document["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircleIcon className="size-5 text-emerald-500" />;
      case "failed":
        return <AlertCircleIcon className="size-5 text-red-500" />;
      case "processing":
        return <Loader2Icon className="size-5 text-amber-500 animate-spin" />;
    }
  };

  const getStatusText = (status: Document["status"]) => {
    switch (status) {
      case "completed":
        return "Ready";
      case "failed":
        return "Failed";
      case "processing":
        return "Processing...";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Knowledge Base</h1>
        <p className="text-sm text-slate-500">
          Upload documents to enhance AI-generated content with your company information, brand
          guidelines, and product details.
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h3 className="text-slate-700 font-medium">Upload Document</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-2">
              Select File (PDF, TXT, or DOCX)
            </label>
            <input
              type="file"
              accept=".pdf,.txt,.docx"
              onChange={handleFileSelect}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-red-50 file:text-red-600 hover:file:bg-red-100 cursor-pointer"
            />
          </div>

          {selectedFile && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <FileTextIcon className="size-5 text-slate-400" />
              <div className="flex-1">
                <p className="text-sm text-slate-900">{selectedFile.name}</p>
                <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {uploading ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadIcon className="size-4" />
                Upload Document
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-slate-700 font-medium">Your Documents</h3>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
            {documents.length} total
          </span>
        </div>

        <div className="divide-y divide-slate-50">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2Icon className="size-6 animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="size-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto">
                <FileTextIcon className="size-6 text-slate-300" />
              </div>
              <p className="text-slate-400 text-sm">
                No documents yet. Upload your first document to get started.
              </p>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc._id} className="p-4 hover:bg-slate-50/50 transition">
                <div className="flex items-start gap-4">
                  <div className="shrink-0">{getStatusIcon(doc.status)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-slate-900 truncate">
                          {doc.fileName}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span>{formatFileSize(doc.fileSize)}</span>
                          {doc.status === "completed" && (
                            <span>{doc.chunkCount} chunks</span>
                          )}
                          <span className="flex items-center gap-1">
                            <ClockIcon className="size-3" />
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(doc._id, doc.fileName)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Delete document"
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          doc.status === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : doc.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {getStatusText(doc.status)}
                      </span>
                    </div>

                    {doc.error && (
                      <p className="mt-2 text-xs text-red-600">{doc.error}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">How it works</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Upload company profiles, brand guidelines, or product information</li>
          <li>• Documents are processed and embedded for AI retrieval</li>
          <li>• Enable "Use Knowledge Base" in AI Composer to generate grounded content</li>
          <li>• AI will use your documents as factual context for content generation</li>
        </ul>
      </div>
    </div>
  );
};

export default Knowledge;
