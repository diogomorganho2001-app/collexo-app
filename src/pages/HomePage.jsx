import React from 'react';

export default function HomePage({ onEnterWorldCup }) {
  return (
    <section id="homePage">
      <div className="home-hero">
        <img
          src="/Collexo_banner_pic.png"
          alt="Collexo hero"
          className="hero-bg-image"
        />
        <h2 className="hero-title">COLLEXO<br /><span className="year">Collect-Connect-Complete</span></h2>
      </div>

      <div className="info-section">
        <div className="section-title">📖 About the App</div>
        <div className="app-card">
          <div className="app-info">
            <h3>Collexo</h3>
            <p>
              App made for collecting and managing sticker albums.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
