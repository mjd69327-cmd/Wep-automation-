import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const hasProcessed = React.useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = location.hash || window.location.hash;
    const match = /session_id=([^&]+)/.exec(hash || "");
    const sessionId = match ? match[1] : null;

    if (!sessionId) {
      navigate("/login");
      return;
    }

    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", { session_id: sessionId });
        localStorage.setItem("df_token", data.session_token);
        setUser(data.user);
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { state: { user: data.user } });
      } catch (e) {
        console.error(e);
        navigate("/login");
      }
    })();
  }, [location, navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-gray-600 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
