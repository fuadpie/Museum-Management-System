import { useState } from "react";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import MuseumDashboard from "./pages/MuseumDashboard";
import "./App.css";

function App() {
    const [authenticated, setAuthenticated] = useState(() => Boolean(localStorage.getItem("museumToken") || sessionStorage.getItem("museumToken")));
    const logout = () => {
        localStorage.clear();
        sessionStorage.clear();
        setAuthenticated(false);
    };
    const storedUser = JSON.parse(localStorage.getItem("museumUser") || sessionStorage.getItem("museumUser") || "null");
    return authenticated ? storedUser?.role === "MUSEUM_MANAGER" ? <MuseumDashboard onLogout={logout} /> : <Dashboard onLogout={logout} /> : <Auth onLoginSuccess={() => setAuthenticated(true)} />;
}

export default App;
