import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AppBootLoader } from "./components/LoadingState";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AppBootLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;

  return children;
}
