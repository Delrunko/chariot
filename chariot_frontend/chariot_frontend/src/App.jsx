import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Catalog from "./pages/Catalog";
import BookDetail from "./pages/BookDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MyLibrary from "./pages/MyLibrary";
import About from "./pages/About";
import "./App.css";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/catalogue" element={<Catalog />} />
            <Route path="/livre/:slug" element={<BookDetail />} />
            <Route path="/connexion" element={<Login />} />
            <Route path="/inscription" element={<Register />} />
            <Route path="/ma-bibliotheque" element={<MyLibrary />} />
            <Route path="/a-propos" element={<About />} />
          </Routes>
        </main>
        <Footer />
      </BrowserRouter>
    </AuthProvider>
  );
}
