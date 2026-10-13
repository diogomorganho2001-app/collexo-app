import React from 'react';

export default function HomePage({ onEnterCollection }) {
  return (
    <section id="homePage">
      <div className="home-hero">
        <img
          src="/Collexo_banner_pic.png"
          alt="Collexo hero"
          className="hero-bg-image"
        />
        <h2 className="hero-title">COLLEXO<br /><span className="year">Collect Connect Complete</span></h2>
      </div>

      <div className="info-section">
        <div className="section-title">📖 About Collexo</div>
        <div className="app-card">
          <div className="app-info">
            <h3>Sports card collecting, portfolio tracking, and trading.</h3>
            <p>
              Track your collection across sport, manufacturer, set, and season while keeping duplicates, wants, and trade activity in one place.
            </p>
            <button className="btn-gold" onClick={onEnterCollection}>Open your collection</button>
          </div>
        </div>
      </div>
    </section>
  );
}
