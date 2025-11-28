import './Product.css'
import guante from "../assets/guante.png";

export default function Product() {
    return (

        <section className="product-section">

            <div className="product-header">
                <h2>Nuestro Producto</h2>
                <div className="white-line"></div>
            </div>

            <div className="product-container">
                <img src={guante} alt="Guante" className="product-image" />
            </div>
        </section>
    )
}