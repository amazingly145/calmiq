import './MissionVision.css'
import dogChip from "../assets/dog2.png";
import chipBg from "../assets/chip-bg.jpg";

export default function MissionVision() {
    return (
        <section className="mv-section">
            <div className="mv-grid">

                <div className="card-container">
                    <h2 className="mv-title">Misión</h2>
                    <div className="mv-card">
                        <p>
                            Cuidar, guiar y acompañar al usuario en su manejo del estrés diario
                            a través de un dispositivo electrónico incorporado a la vestimenta,
                            acompañado de una aplicación móvil y una mascota virtual.
                        </p>
                    </div>
                </div>

                <div className="card-container">
                    <h2 className="mv-title">Visión</h2>
                    <div className="mv-card">
                        <p>
                            Generar un ambiente donde nuestros usuarios tengan herramientas
                            y el conocimiento para manejar su estrés, creando una comunidad
                            más eficiente, productiva y feliz.
                        </p>
                    </div>
                </div>
            </div>

            <div className="images-container">
                <img src={dogChip} alt="Dog" className="dog-chip-img" />
                <div
                    className="chip-bg"
                    style={{ backgroundImage: `url(${chipBg})` }}
                ></div>
            </div>

        </section>
    )
}