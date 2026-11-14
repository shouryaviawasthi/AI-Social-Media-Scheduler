import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const FRONTEND_ORIGIN = window.location.origin;
const API_URL = "http://localhost:3000";

type FacebookPage = { id: string; name: string; profileImage?: string };

/**
 * Facebook OAuth callback page rendered inside the OAuth popup.
 * 
 * Handles page selection and notifies the opener window.
 */
const FacebookCallback = ({ result }: { result: "pages" | "success" | "error" }) => {
  const location = useLocation();
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [selectionState, setSelectionState] = useState<string>("");
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (result === "pages") {
      // Load available Facebook Pages for selection
      const state = params.get("state");
      if (!state) {
        setError("Invalid page selection state.");
        return;
      }
      
      setSelectionState(state);
      
      fetch(`${API_URL}/api/facebook/pending/${encodeURIComponent(state)}`, {
        credentials: "include"
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "Unable to load Facebook Pages.");
          setPages(data.pages || []);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to load Facebook Pages.");
        });
    } else if (result === "success") {
      // Notify opener and close
      if (window.opener) {
        window.opener.postMessage({ type: "FACEBOOK_CONNECTED" }, FRONTEND_ORIGIN);
      }
      setTimeout(() => window.close(), 300);
    } else if (result === "error") {
      // Notify opener about error
      const errorMessage = params.get("message") || "Facebook connection failed.";
      if (window.opener) {
        window.opener.postMessage(
          { type: "FACEBOOK_ERROR", message: errorMessage },
          FRONTEND_ORIGIN
        );
      }
      setTimeout(() => window.close(), 3000);
    }
  }, [result, location.search]);

  const selectPage = async (pageId: string) => {
    setSelecting(true);
    setError("");
    
    try {
      const response = await fetch(`${API_URL}/api/facebook/select-page`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: selectionState, pageId }),
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Unable to connect Facebook Page.");
      }
      
      // Success - notify opener and close
      if (window.opener) {
        window.opener.postMessage({ type: "FACEBOOK_CONNECTED" }, FRONTEND_ORIGIN);
      }
      setTimeout(() => window.close(), 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed.");
      setSelecting(false);
    }
  };

  if (result === "pages") {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        backgroundColor: "#F8FAFC",
        padding: "2rem"
      }}>
        <div style={{
          backgroundColor: "white",
          borderRadius: "16px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          padding: "2rem",
          maxWidth: "500px",
          width: "100%"
        }}>
          <h3 style={{
            fontSize: "1.25rem",
            fontWeight: "600",
            color: "#1E293B",
            marginBottom: "1.5rem",
            textAlign: "center"
          }}>
            Choose a Facebook Page
          </h3>
          
          {error && (
            <div style={{
              backgroundColor: "#FEF2F2",
              border: "1px solid #FCA5A5",
              borderRadius: "8px",
              padding: "0.75rem",
              marginBottom: "1rem",
              color: "#991B1B",
              fontSize: "0.875rem"
            }}>
              {error}
            </div>
          )}
          
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {pages.length === 0 && !error && (
              <div style={{
                textAlign: "center",
                padding: "2rem",
                color: "#64748B"
              }}>
                Loading pages...
              </div>
            )}
            
            {pages.map((page) => (
              <button
                key={page.id}
                onClick={() => selectPage(page.id)}
                disabled={selecting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  backgroundColor: selecting ? "#F1F5F9" : "white",
                  cursor: selecting ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  opacity: selecting ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!selecting) e.currentTarget.style.borderColor = "#EF4444";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#E2E8F0";
                }}
              >
                {page.profileImage && (
                  <img
                    src={page.profileImage}
                    alt=""
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      objectFit: "cover"
                    }}
                  />
                )}
                <span style={{
                  fontSize: "0.875rem",
                  color: "#1E293B",
                  flex: 1,
                  textAlign: "left"
                }}>
                  {page.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (result === "error") {
    const params = new URLSearchParams(location.search);
    const errorMessage = params.get("message") || "Facebook connection failed.";
    
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "system-ui, sans-serif",
        color: "#475569",
        padding: "2rem",
        textAlign: "center"
      }}>
        <div style={{
          maxWidth: "500px",
          backgroundColor: "#FEF2F2",
          border: "1px solid #FCA5A5",
          borderRadius: "12px",
          padding: "1.5rem",
          marginBottom: "1rem"
        }}>
          <h3 style={{ color: "#DC2626", marginBottom: "0.5rem" }}>Connection Failed</h3>
          <p style={{ color: "#991B1B", fontSize: "0.875rem" }}>
            {errorMessage}
          </p>
        </div>
        <p style={{ fontSize: "0.875rem", color: "#94A3B8" }}>
          This window will close automatically...
        </p>
      </div>
    );
  }

  // Success
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      fontFamily: "system-ui, sans-serif",
      color: "#475569"
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✓</div>
        <p>Facebook connected! Closing…</p>
      </div>
    </div>
  );
};

export default FacebookCallback;
