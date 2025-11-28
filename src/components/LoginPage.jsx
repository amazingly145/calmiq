import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './LoginPage.css';

export default function LoginPage({ onLogin }) {
    const navigate = useNavigate();
    const handleLoginClick = (e) => {
        e.preventDefault();
        if (onLogin) {
            onLogin();
        }
        navigate('/');
    };

    return (
        <div className="login-page-container">

            <div className="form-background">
                <h2>BIENVENIDO A CALMIQ</h2>
                <h1>INICIAR SESIÓN</h1>

                <form className="login-form">
                    <label htmlFor="usuario">Usuario</label>
                    <input type="text" id="usuario" placeholder="Nombre Completo" />
                    <label htmlFor="password">Contraseña</label>
                    <input type="password" id="password" placeholder="***********" />
                    <button type="submit" onClick={handleLoginClick} className="submit-button">
                        Ingresar
                    </button>
                </form>

                <div className="link-group">
                    <Link to="/forgot-password">
                        Olvidé mi contraseña
                    </Link>
                    <Link to="/signup">
                        Registrarme
                    </Link>
                </div>
            </div>
        </div>
    );
}