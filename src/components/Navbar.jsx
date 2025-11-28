import './Navbar.css'
import { Link } from 'react-router-dom';
export default function Navbar({ isLoggedIn, onLogout }) {
    return (
        <nav className="navbar">
            <div className="nav-right">
                {isLoggedIn ? (
                    <button onClick={onLogout} className="btn-light">
                        Cerrar Sesión
                    </button>
                ) : (
                    <>
                        <Link to="/login" className="btn-light">
                            Ingresar
                        </Link>
                        <Link to="/signup" className="btn-dark">
                            Crear cuenta
                        </Link>
                    </>
                )}
            </div>
        </nav>
    )
}