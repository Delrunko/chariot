# EDS — Frontend (React + Vite)

## Démarrage (Windows / PowerShell)

```powershell
npm install
npm run dev
```

L'application tourne sur `http://localhost:5173` et consomme l'API sur
`http://127.0.0.1:8000/api` (backend Django à lancer en parallèle).

## Structure

- `src/services/api.js` — service central (auth JWT, catalogue, achats, bibliothèque)
- `src/context/AuthContext.jsx` — état de connexion global
- `src/components/Navbar.jsx` — menu dynamique alimenté par `/api/categories/`
- `src/components/BookCard.jsx` — carte livre (verrouillée si non acheté = effet vitrine)
- `src/pages/Home.jsx` — accueil / vitrine publicitaire
- `src/pages/Catalog.jsx` — catalogue filtrable par catégorie
- `src/pages/BookDetail.jsx` — fiche livre + achat Orange Money
- `src/pages/MyLibrary.jsx` — bibliothèque personnelle + statut hors-ligne

## À faire en itération suivante

- Lecteur intégré (visionneuse) consommant `/api/library/{id}/read/`
- Passage en PWA (service worker) pour le cache chiffré hors-ligne réel
- Intégration réelle Orange Money (actuellement simulée côté backend)
