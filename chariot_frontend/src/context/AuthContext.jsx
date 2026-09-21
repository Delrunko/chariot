import { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../services/api";

const AuthContext = createContext(null);

export function isAdminRole(user) {
  if (!user) return false;
  const role = String(user.role ?? user.Role ?? "").trim().toLowerCase();
  return role === "admin" || user.est_admin === true || user.is_staff === true || user.is_superuser === true;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authService.isAuthenticated()) {
      authService
        .me()
        .then(({ data }) => setUser(data))
        .catch(() => authService.logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    await authService.login(username, password);
    const { data } = await authService.me();
    setUser(data);
    return data;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
