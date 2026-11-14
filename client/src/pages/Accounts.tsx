import { useEffect, useState } from "react";
import AccountList from "../components/AccountList";
import { PLATFORMS } from "../assets/assets";
import { PlusIcon } from "lucide-react";
import PlatformPickerModal from "../components/PlatformPickerModal";
import type { SocialAccount } from "../lib/storage";

const API_URL = "http://localhost:3000";
type FacebookPage = { id: string; name: string; profileImage?: string };
type RemoteAccount = {
  id: string;
  platform: string;
  platformUserId: string;
  username?: string;
  displayName: string;
  profileImage?: string;
  connected: boolean;
};

const Accounts = () => {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);
  const [pendingPages, setPendingPages] = useState<FacebookPage[]>([]);
  const [pendingState, setPendingState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAccounts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/social/accounts`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load connected accounts.");
      setAccounts(data.map((account: RemoteAccount) => ({
        _id: account.id,
        userId: "",
        platform: account.platform,
        handle: account.username || account.displayName,
        status: account.connected ? "connected" : "disconnected",
        createdAt: "",
        updatedAt: "",
      })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load connected accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      void loadAccounts();
    }, 0);
    return () => {
      clearTimeout(initialLoad);
    };
  }, []);

  const handleConnect = (platformId: string) => {
    setConnecting(platformId);
    
    // Close the picker so the user sees the main page while authorising
    setShowPlatformPicker(false);
    
    // Open OAuth in a popup — main tab stays on /accounts
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      `${API_URL}/api/${platformId}/connect`,
      `${platformId}_oauth`,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,noopener=no`
    );
    
    if (!popup) {
      // Popup was blocked — fall back to main-tab redirect
      window.location.assign(`${API_URL}/api/${platformId}/connect`);
      return;
    }
    
    // Poll every second so we can reset the spinner if the user closes
    // the popup without completing OAuth (postMessage will NOT fire).
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        setConnecting(null);
      }
    }, 1000);
  };

  // Listen for postMessage from the OAuth popup
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Only accept messages from our own frontend origin
      if (event.origin !== window.location.origin) return;
      if (!event.data || typeof event.data !== "object") return;

      if (event.data.type === "INSTAGRAM_CONNECTED") {
        setConnecting(null);
        setShowPlatformPicker(false);
        void loadAccounts();
      } else if (event.data.type === "INSTAGRAM_ERROR") {
        setConnecting(null);
        setError(typeof event.data.message === "string" ? event.data.message : "Instagram connection failed.");
      } else if (event.data.type === "FACEBOOK_CONNECTED") {
        setConnecting(null);
        setShowPlatformPicker(false);
        void loadAccounts();
      } else if (event.data.type === "FACEBOOK_ERROR") {
        setConnecting(null);
        setError(typeof event.data.message === "string" ? event.data.message : "Facebook connection failed.");
      } else if (event.data.type === "FACEBOOK_PAGES") {
        // Handle page selection in popup
        setPendingState(event.data.state);
        setPendingPages(event.data.pages || []);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleDisconnect = async (accountId: string) => {
    const account = accounts.find((item) => item._id === accountId);
    if (!account) return;
    const response = await fetch(`${API_URL}/api/${account.platform}/disconnect`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message || "Unable to disconnect account.");
      return;
    }
    setAccounts((prev) => prev.filter((item) => item._id !== accountId));
  };

  const selectFacebookPage = async (pageId: string) => {
    if (!pendingState) return;
    const response = await fetch(`${API_URL}/api/facebook/select-page`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: pendingState, pageId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message || "Unable to connect Facebook Page.");
      return;
    }
    setPendingPages([]);
    setPendingState(null);
    await loadAccounts();
  };

  const connectedIds = accounts.map((account) => account.platform);

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-row sm:flex-row items-start sm:items-center justify-between gap-4 text-sm">
        <div>
          <h2 className="text-xl text-slate-900">Connected Accounts</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {accounts.length} of {PLATFORMS.length} platforms connected
          </p>
        </div>
        <button
          onClick={() => setShowPlatformPicker(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium transition-all w-full sm:w-auto justify-center "
        >
          <PlusIcon className="size-4" /> Connect Account
        </button>
      </div>

      {showPlatformPicker && (
        <PlatformPickerModal
          connectedIds={connectedIds}
          connecting={connecting}
          onClose={() => setShowPlatformPicker(false)}
          onConnect={handleConnect}
        />
      )}

      {pendingPages.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-700">Choose a Facebook Page</h3>
            {pendingPages.map((page) => (
              <button key={page.id} onClick={() => selectFacebookPage(page.id)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-red-300 text-left">
                {page.profileImage && <img src={page.profileImage} alt="" className="size-10 rounded-full" />}
                <span className="text-sm text-slate-800">{page.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex gap-3">
            <div className="shrink-0">
              <svg className="size-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-800 mb-1">Connection Error</h4>
              <p className="text-sm text-red-700">{error}</p>
              {(error.includes("Instagram") || error.includes("Business")) && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-900 mb-2">Instagram Business Account Required:</p>
                  <ol className="text-xs text-amber-800 space-y-1 list-decimal list-inside">
                    <li>Convert your Instagram to a Business or Creator account</li>
                    <li>Link it to a Facebook Page in Instagram settings</li>
                    <li>In Meta Developer Dashboard, add Instagram Basic Display and Instagram Graph API products</li>
                    <li>Add valid OAuth redirect URI in Meta App settings</li>
                  </ol>
                </div>
              )}
            </div>
            <button onClick={() => setError("")} className="shrink-0 text-red-400 hover:text-red-600">
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {loading ? <p className="text-sm text-slate-500">Loading...</p> : <AccountList accounts={accounts} onDisconnect={handleDisconnect} />}
    </div>
  );
};

export default Accounts;
