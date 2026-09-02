import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AppBootLoader } from "./components/LoadingState";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <AppBootLoader />;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
