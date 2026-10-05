# EDS — Frontend (React + Vite)

## Démarrage (Windows / PowerShell)

```powershell
npm install
Copy-Item chariot_frontend\.env.example chariot_frontend\.env.local
npm run dev
```

L'application tourne sur `http://localhost:5173`. En développement, elle utilise
les variables Supabase `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, à définir
dans `chariot_frontend\.env.local`.

Les opérations de commande et de paiement simulé nécessitent les Edge Functions
Supabase. Depuis la racine du dépôt, copiez la configuration et démarrez-les :

```powershell
Copy-Item supabase\functions\.env.example supabase\functions\.env
supabase start
supabase functions serve --env-file supabase\functions\.env
```

### Inscription sans confirmation par email

L'inscription crée une session immédiatement lorsque la confirmation email est
désactivée pour le fournisseur Email du projet Supabase. Dans Supabase Studio,
ouvrez **Authentication → Providers → Email** et désactivez **Confirm email**.
Ce réglage appartient au projet Auth et ne peut pas être changé depuis le
frontend sans exposer une clé privilégiée.

Appliquez également les migrations Supabase depuis la racine du dépôt : elles
réparent le trigger d'inscription et permettent à un utilisateur connecté de
recréer uniquement son propre profil si celui-ci est absent. Le rôle admin n'est
jamais modifiable par cette procédure.

```powershell
supabase db push
```

Pour tester la simulation locale, définissez `DEMO_PAYMENT_ENABLED=true` dans
`supabase\functions\.env` et `VITE_DEMO_PAYMENT_ENABLED=true` dans
`chariot_frontend\.env.local`. La simulation est désactivée par défaut et ne doit
jamais être activée dans un environnement de production : elle confirme une
commande sans vérifier de transaction auprès d'un opérateur de paiement.

Pour déployer les fonctions de commande, exécutez depuis la racine :

```powershell
supabase functions deploy create-order
supabase functions deploy confirm-payment
```

Ne configurez pas `DEMO_PAYMENT_ENABLED=true` dans le projet Supabase distant.

## Structure

- `src/lib/supabaseClient.js` — client Supabase utilisé par l'application
- `src/services/orderService.js` — création de commandes dans Supabase
- `src/context/AuthContext.jsx` — état de connexion global
- `src/components/Navbar.jsx` — navigation alimentée par Supabase
- `src/components/BookCard.jsx` — carte livre (verrouillée si non acheté = effet vitrine)
- `src/pages/Home.jsx` — accueil / vitrine publicitaire
- `src/pages/Catalog.jsx` — catalogue filtrable par catégorie
- `src/pages/BookDetail.jsx` — fiche livre Supabase + création de commande
- `src/pages/ServiceDetail.jsx` — fiche service Supabase + création de commande
- `src/pages/MyLibrary.jsx` — bibliothèque personnelle Supabase

## Utilisation hors connexion

Après une première ouverture avec Internet, l'application installe un service
worker et prépare en arrière-plan un instantané du catalogue public, des
catégories et des fiches. Ces données sont conservées sur cet appareil et
restent accessibles après une coupure réseau ou l'actualisation d'une page.
Les couvertures sont mises en cache lorsqu'elles sont affichées. Les données
hors ligne correspondent à la dernière version chargée; les achats, paiements,
formulaires et authentifications nécessitent toujours une connexion.

Pour lire un document acheté hors connexion, ouvrez-le au moins une fois en
étant connecté et autorisé. Le PDF est alors conservé dans le stockage local
du navigateur, séparément pour chaque compte utilisateur. La bibliothèque
personnelle est également enregistrée après son chargement en ligne. Le cache
est propre à l'appareil et peut être supprimé par le navigateur ou l'utilisateur.

## À faire en itération suivante
- Intégration d'un fournisseur de paiement et confirmation par webhook signé
