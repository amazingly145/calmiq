import React, { useState } from 'react'; // <-- AÑADIR: Importa useState
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import MissionVision from './components/MissionVision';
import Product from './components/Product';
import Modelo from './components/Modelo';
import Datos from './components/Datos';
import LoginPage from './components/LoginPage';

function App() {

    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const handleLogin = () => {
        setIsLoggedIn(true);
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
    };

    return (
        <BrowserRouter>
            <Navbar isLoggedIn={isLoggedIn} onLogout={handleLogout} />

            <Routes>
                <Route path="/" element={
                    <>
                        <Hero />
                        <MissionVision />
                        <Product />
                        <Modelo />
                    </>
                } />

                <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
                <Route path="/signup" element={<LoginPage title="Crear Cuenta" />} />

            </Routes>

            <Datos />
        </BrowserRouter>
    )
}
export default App