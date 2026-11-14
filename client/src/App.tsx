import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Scheduler from "./pages/Scheduler";
import AIComposer from "./pages/AIComposer";
import Knowledge from "./pages/Knowledge";
import OAuthCallback from "./pages/OAuthCallback";
import FacebookCallback from "./pages/FacebookCallback";
import Layout from "./components/Layout";
import { setCurrentUser } from "./lib/storage";
import { apiFetch } from "./lib/api";

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
    const [checking, setChecking] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        apiFetch<{ user: { id: string; name: string; email: string } }>("/api/auth/me")
            .then(({ user }) => {
                setCurrentUser(user);
                setAuthenticated(true);
            })
            .catch(() => {
                setCurrentUser(null);
                setAuthenticated(false);
            })
            .finally(() => setChecking(false));
    }, []);

    if (checking) return null;
    return authenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

export default function App() {
    return (
        <>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/oauth/instagram/success" element={<OAuthCallback result="success" />} />
                <Route path="/oauth/instagram/error" element={<OAuthCallback result="error" />} />
                <Route path="/oauth/facebook/pages" element={<FacebookCallback result="pages" />} />
                <Route path="/oauth/facebook/success" element={<FacebookCallback result="success" />} />
                <Route path="/oauth/facebook/error" element={<FacebookCallback result="error" />} />
                <Route
                    element={
                        <RequireAuth>
                            <Layout />
                        </RequireAuth>
                    }
                >
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/accounts" element={<Accounts />} />
                    <Route path="/knowledge" element={<Knowledge />} />
                    <Route path="/scheduler" element={<Scheduler />} />
                    <Route path="/schedule" element={<Navigate to="/scheduler" replace />} />
                    <Route path="/ai-composer" element={<AIComposer />} />
                </Route>
            </Routes>
        </>
    );
}
