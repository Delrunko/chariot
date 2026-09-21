import { useEffect, useRef, useState } from "react";

/**
 * Enveloppe générique : ajoute la classe "reveal-visible" à son enfant
 * dès qu'il entre dans le viewport, pour déclencher une animation CSS
 * d'apparition (fondu + léger déplacement vers le haut).
 *
 * Usage :
 *   <RevealOnScroll delai={idx * 60}>
 *     <BookCard ... />
 *   </RevealOnScroll>
 */
export default function RevealOnScroll({ children, delai = 0, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const noeud = ref.current;
    if (!noeud) return;

    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          setVisible(true);
          observateur.unobserve(noeud);
        }
      },
      { threshold: 0.15 }
    );

    observateur.observe(noeud);
    return () => observateur.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal-on-scroll ${visible ? "reveal-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delai}ms` }}
    >
      {children}
    </div>
  );
}