import './Hero.css'
import dog from "../assets/dog1.png";

export default function Hero() {
    return (
        <section className="hero">
            <div className="hero-background" style={{ backgroundImage: `url(${dog})` }}></div>
            <div className="hero-content-container">
                <div className="hero-content">
                    <h1>Calmiq</h1>
                </div>
                <div className="hero-content">
                    <p>
                        Una acercamiento inteligente al acompañamiento, guía y monitoreo del estrés
                    </p>
                </div>
            </div>
        </section>
    )
}