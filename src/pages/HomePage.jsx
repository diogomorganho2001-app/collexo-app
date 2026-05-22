import React from 'react';

export default function HomePage({ onEnterWorldCup }) {
  return (
    <section id="homePage">
      <div className="home-hero">
        <svg className="hero-bg-svg" viewBox="0 0 400 180" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
          <ellipse cx="200" cy="220" rx="280" ry="160" stroke="white" strokeWidth="1.5" fill="none"/>
          <ellipse cx="200" cy="220" rx="220" ry="120" stroke="white" strokeWidth="1" fill="none"/>
          <ellipse cx="200" cy="220" rx="160" ry="80"  stroke="white" strokeWidth="1" fill="none"/>
          <line x1="200" y1="60"  x2="200" y2="220" stroke="white" strokeWidth="1"/>
          <line x1="0"   y1="140" x2="400" y2="140" stroke="white" strokeWidth="1"/>
          <circle cx="200" cy="140" r="30" stroke="white" strokeWidth="1" fill="none"/>
          <rect x="155" y="140" width="90" height="50"  stroke="white" strokeWidth="1" fill="none"/>
          <rect x="175" y="140" width="50" height="25" stroke="white" strokeWidth="1" fill="none"/>
        </svg>
        <h2 className="hero-title">COLLEXO<br /><span className="year">Collect-Connect-Complete</span></h2>
        <button className="btn-primary" onClick={onEnterWorldCup}>World Cup</button>
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
