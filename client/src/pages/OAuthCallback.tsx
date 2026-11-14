import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const FRONTEND_ORIGIN = window.location.origin; // e.g. http://localhost:5173

/**
 * Lightweight relay page rendered inside the OAuth popup.
 *
 * Routes:
 *   /oauth/instagram/success → posts INSTAGRAM_CONNECTED to opener
 *   /oauth/instagram/error   → posts INSTAGRAM_ERROR   to opener
 *
 * After posting the message the popup closes itself.
 */
const OAuthCallback = ({ result }: { result: "success" | "error" }) => {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorMessage = params.get("message") || "Instagram connection failed.";
    
    const message =
      result === "success"
        ? { type: "INSTAGRAM_CONNECTED" }
        : { type: "INSTAGRAM_ERROR", message: errorMessage };

    if (window.opener) {
      window.opener.postMessage(message, FRONTEND_ORIGIN);
    }

    // Give the message a moment to deliver, then close
    const timer = setTimeout(() => {
      window.close();
    }, result === "success" ? 300 : 3000); // Keep error open longer so user can read it

    return () => clearTimeout(timer);
  }, [result, location.search]);

  if (result === "error") {
    const params = new URLSearchParams(location.search);
    const errorMessage = params.get("message") || "Instagram connection failed.";
    
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
          <p style={{ color: "#991B1B", fontSize: "0.875rem", marginBottom: "1rem" }}>
            {errorMessage}
          </p>
          
          {errorMessage.includes("Instagram Business") && (
            <div style={{ 
              backgroundColor: "#FFFBEB",
              border: "1px solid #FCD34D",
              borderRadius: "8px",
              padding: "1rem",
              textAlign: "left",
              fontSize: "0.813rem",
              color: "#92400E"
            }}>
              <strong style={{ display: "block", marginBottom: "0.5rem" }}>Required Setup:</strong>
              <ol style={{ margin: "0", paddingLeft: "1.25rem", lineHeight: "1.6" }}>
                <li>Convert your Instagram account to a Business or Creator account</li>
                <li>Link it to a Facebook Page</li>
                <li>Configure Instagram products in Meta Developer Dashboard</li>
                <li>Add this redirect URI: {window.location.origin}/api/instagram/callback</li>
              </ol>
            </div>
          )}
        </div>
        <p style={{ fontSize: "0.875rem", color: "#94A3B8" }}>This window will close automatically...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui, sans-serif", color: "#475569" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✓</div>
        <p>Instagram connected! Closing…</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
