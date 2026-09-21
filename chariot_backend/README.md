# EDS — Backend (Django REST Framework)

Plateforme de vente en ligne de livres techniques (filière Maçonnerie / Bâtiment F4).

## Démarrage (Windows / PowerShell)

```powershell
# Environnement virtuel
python -m venv venv
venv\Scripts\Activate.ps1

# Dépendances
pip install -r requirements.txt

# Base de données
python manage.py migrate

# Catégories de départ (Maçonnerie F4, 1ère année → Terminale F4)
python manage.py seed_categories

# Compte admin
python manage.py createsuperuser

# Lancer le serveur
python manage.py runserver
```

L'API est disponible sur `http://127.0.0.1:8000/api/`
L'admin (gestion catégories, sous-catégories, livres) sur `http://127.0.0.1:8000/admin/`

## Structure des apps

| App | Rôle |
|---|---|
| `accounts` | Utilisateur personnalisé (admin / client), inscription, connexion JWT |
| `catalog` | Catégories, sous-catégories (dynamiques, gérées depuis l'admin), livres, vitrine |
| `purchases` | Achats (à brancher sur Orange Money via CamPay / Notch Pay) |
| `library` | Accès de lecture sécurisé, hors-ligne, revalidation périodique |

## Endpoints principaux

| Endpoint | Méthode | Description |
|---|---|---|
| `/api/categories/` | GET | Catégories + leurs sous-catégories imbriquées |
| `/api/books/` | GET | Catalogue, filtrable par `?categorie=` ou `?sous_categorie=` (slug) |
| `/api/books/vitrine/` | GET | Livres à afficher en bannière (public, pas besoin d'être connecté) |
| `/api/books/{slug}/` | GET | Détail d'un livre |
| `/api/auth/register/` | POST | Inscription |
| `/api/auth/login/` | POST | Connexion (retourne access + refresh JWT) |
| `/api/purchases/` | POST | Acheter un livre |
| `/api/purchases/mes-achats/` | GET | Historique des achats |
| `/api/library/` | GET | Ma bibliothèque (livres possédés) |
| `/api/library/{livre_id}/revalider/` | POST | Revalider l'accès hors-ligne pour un appareil |
| `/api/library/{livre_id}/read/` | GET | Lire le contenu (accès contrôlé, jamais d'URL directe) |

## Gérer les catégories/sous-catégories

Tout est dynamique — aucune classe ou filière n'est codée en dur. L'admin peut
en créer autant qu'il veut depuis `/admin/` → **Catégories** (avec les
sous-catégories directement en ligne dans le formulaire).

## Point de vigilance : hors-ligne + protection

Voir le cahier des charges §4.3. Le modèle `AccesLecture` (app `library`)
implémente la revalidation périodique (21 jours par défaut, modifiable dans
`library/models.py` — `DUREE_VALIDITE_HORS_LIGNE`). Le chiffrement du contenu
mis en cache côté PWA reste à implémenter côté frontend (itération suivante).
