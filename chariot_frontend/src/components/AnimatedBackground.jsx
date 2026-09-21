import { useEffect, useRef } from "react";
import "./AnimatedBackground.css";

/**
 * Fond animé en canvas : particules douces qui dérivent et se relient par
 * de fines lignes quand elles sont proches, avec un effet de parallaxe
 * léger au mouvement de la souris. Pensé pour rester discret derrière le
 * contenu (faible opacité) sans nuire à la lisibilité ni aux performances.
 */
export default function AnimatedBackground({
  couleur = "212, 175, 55", // doré (r,g,b) — ajuste selon la charte du site
  nombreParticules = 60,
}) {
  const canvasRef = useRef(null);
  const sourisRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let largeur = (canvas.width = canvas.offsetWidth);
    let hauteur = (canvas.height = canvas.offsetHeight);

    const particules = Array.from({ length: nombreParticules }, () => ({
      x: Math.random() * largeur,
      y: Math.random() * hauteur,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      rayon: Math.random() * 1.8 + 0.6,
    }));

    const onResize = () => {
      largeur = canvas.width = canvas.offsetWidth;
      hauteur = canvas.height = canvas.offsetHeight;
    };

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      sourisRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);

    const distanceMaxLiaison = 130;

    const animer = () => {
      ctx.clearRect(0, 0, largeur, hauteur);

      // Léger effet de parallaxe : les particules dérivent doucement vers la souris
      const souris = sourisRef.current;

      particules.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > largeur) p.vx *= -1;
        if (p.y < 0 || p.y > hauteur) p.vy *= -1;

        const dxSouris = souris.x - p.x;
        const dySouris = souris.y - p.y;
        const distSouris = Math.hypot(dxSouris, dySouris);
        if (distSouris < 160 && distSouris > 0) {
          p.x -= (dxSouris / distSouris) * 0.15;
          p.y -= (dySouris / distSouris) * 0.15;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.rayon, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${couleur}, 0.55)`;
        ctx.fill();
      });

      for (let i = 0; i < particules.length; i++) {
        for (let j = i + 1; j < particules.length; j++) {
          const a = particules[i];
          const b = particules[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < distanceMaxLiaison) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${couleur}, ${0.12 * (1 - dist / distanceMaxLiaison)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      animationRef.current = requestAnimationFrame(animer);
    };

    animer();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [couleur, nombreParticules]);

  return (
    <div className="animated-background-wrapper" aria-hidden="true">
      <canvas ref={canvasRef} className="animated-background-canvas" />
      <div className="animated-background-glow animated-background-glow-1" />
      <div className="animated-background-glow animated-background-glow-2" />
    </div>
  );
}