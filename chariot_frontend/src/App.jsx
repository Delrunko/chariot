import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth, isAdminRole } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Catalog from "./pages/Catalog";
import BookDetail from "./pages/BookDetail";
import ServiceDetail from "./pages/ServiceDetail";
import CategoryPage from "./pages/CategoryPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MyLibrary from "./pages/MyLibrary";
import About from "./pages/About";
import ReaderModal from "./components/ReaderModal";
import AdminDashboard from "./pages/AdminDashboard";
// import VisitorAlert from "./components/VisitorAlert";
import "./App.css";
import "./components/reveal-and-cards.css";

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Le tableau de bord admin a sa propre interface complète (sidebar +
  // en-tête) : on n'affiche pas le Navbar/Footer du site public par-dessus,
  // sinon ils se superposent à la sidebar fixe et cassent la mise en page.
  const estEspaceAdmin = location.pathname.startsWith("/espace-admin");

  if (loading) {
    return <main className="app-loading">Chargement...</main>;
  }

  if (estEspaceAdmin) {
    return (
      <Routes>
        <Route
          path="/espace-admin"
          element={
            isAdminRole(user) ? (
              <AdminDashboard />
            ) : (
              <Navigate to="/connexion" replace />
            )
          }
        />
      </Routes>
    );
  }

  return (
    <>
      <Navbar />
      {/* La clé sur location.pathname force un remontage à chaque
          changement de page, ce qui relance l'animation CSS d'entrée
          définie dans App.css (page-transition-enter). */}
      <main key={location.pathname} className="page-transition-enter">
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/catalogue" element={<Catalog />} />
          <Route path="/categorie/:slug" element={<CategoryPage />} />
          <Route path="/livre/:slug" element={<BookDetail />} />
          <Route path="/service/:slug" element={<ServiceDetail />} />
          <Route path="/connexion" element={<Login />} />
          <Route path="/inscription" element={<Register />} />
          <Route path="/ma-bibliotheque" element={<MyLibrary />} />
          <Route path="/lire/:id" element={<ReaderModal open={true} />} />
          <Route path="/a-propos" element={<About />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}