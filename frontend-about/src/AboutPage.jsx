export default function AboutPage() {
  return (
    <section className="about-page">
      <div className="about-hero">
        <div>
          <h1>A propos de Flotte Management</h1>
          <p>
            Cette page presente l'application Flotte Management, c'est une application de gestion de Flotte
          </p>
        </div>
        <a className="about-cta" href="/dashboard">Retour au dashboard</a>
      </div>

      <div className="about-grid">
        <div className="about-card">
          <h2>Objectif</h2>
          <p>Centraliser le suivi des vehicules, missions, conducteurs et maintenances.</p>
        </div>
        <div className="about-card">
          <h2>Architecture</h2>
          <p>Frontend modulaire avec micro-frontends pour evoluer sans impacter le coeur.</p>
        </div>
        <div className="about-card">
          <h2>Version</h2>
          <p>1.0</p>
        </div>
      </div>
    </section>
  )
}
