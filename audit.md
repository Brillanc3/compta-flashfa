# Audit compta-flashfa

Suivi des bugs et fonctionnalités non terminées relevés pendant l'audit du projet.

## Légende

| Statut | Signification |
|---|---|
| `[ ]` | À faire |
| `[~]` | En cours |
| `[PR #n]` | Corrigé dans une PR ouverte, pas encore mergé |
| `[x]` | Terminé (mergé dans `main`) |
| `[-]` | Abandonné / ne sera pas traité |

Colonne **Testé** : `oui` = vérifié en conditions réelles (Laragon / navigateur), `auto` = vérifié par test automatisé ou headless uniquement, `-` = pas encore testé.

---

## Avancement global

- [x] Audit initial (bugs + fonctionnalités non terminées)
- [PR #5] Lot 1 de correctifs : https://github.com/Brillanc3/compta-flashfa/pull/5
- [ ] Merge de la PR #5 dans `main`

---

## 🔴 Bugs critiques (sécurité)

| # | Statut | Bug | Fichier(s) | Testé |
|---|---|---|---|---|
| 1 | `[PR #5]` | Une clé API contourne `authenticate` / `checkPermission` : accès au panel admin, à la création de clés, à d'autres entreprises | `backend/src/middleware/apiKeyAuth.js`, `backend/src/middleware/auth.js` | oui |
| 2 | `[ ]` | `mycalendar` fait confiance au header `x-company-id` sans vérifier que l'utilisateur est employé : lecture / modification / suppression des événements d'une autre entreprise. `isAdmin` lit `request.user.permissions`, absent du JWT | `backend/src/modules/mycalendar/mycalendar.controller.js` | - |
| 3 | `[ ]` | IDOR garage : `updateVehicle` / `deleteVehicle` sans filtre `companyId` | `backend/src/modules/garage/garage.service.js` | - |
| 4 | `[ ]` | IDOR catégories calendrier : pas de vérification d'appartenance à l'entreprise (TODO dans le code) | `backend/src/modules/calendar/calendar.controller.js` | - |
| 5 | `[ ]` | Upload CNI public sans authentification : n'importe qui avec le slug peut écraser la pièce d'identité d'un client en devinant `clientId`. Pas de rate limit | `backend/src/modules/pawnshop/pawnshop.public.routes.js` | - |
| 6 | `[ ]` | Secrets par défaut codés en dur (`JWT_SECRET`, `SESSION_SECRET`, `REFRESH_TOKEN_SALT`) : tokens forgeables si le `.env` est incomplet | `middleware/auth.js`, `controllers/authController.js`, `onboarding`, `tchatv2/sockets`, `events/auth.events.js`, `shards/server.js`, `auth.service.js` | - |
| 6b | `[ ]` | Clés API stockées en clair en base (à hasher) | `backend/src/modules/api/api.service.js`, `apiKeyAuth.js` | - |

## 🟠 Bugs fonctionnels

| # | Statut | Bug | Fichier(s) | Testé |
|---|---|---|---|---|
| 7 | `[ ]` | `prisma` utilisé sans import : crash en production (`NODE_ENV=production`, mis par l'installeur) sur `/auth/me`, `/auth/permissions`, `/auth/register` | `backend/src/modules/auth/auth.controller.js`, `partenariat.controller.js`, `services/userService.js` | - |
| 8 | `[ ]` | Page détail d'un rang : appelle `/companies/ranks` (route inexistante, 404) et affiche des employés fictifs codés en dur | `frontend/src/pages/dashboard/RankDetailPage.jsx`, `services/rankService.js` | - |
| 9 | `[ ]` | 2 tests KO : mocks plus à jour (`cache.del`, `companyEmployee`) | `backend/tests/modules/tchatv2/guild/guild.service.test.js` | auto |
| 10 | `[ ]` | Fonctions dupliquées (`safeModuleName`, `deepMerge`, `tryLoadModuleSettings`) | `backend/src/modules/comptabilite/comptabilite.service.js` | - |
| 11 | `[PR #5]` | Page blanche au chargement : cycle entre les chunks `core-react` et `vendor` (`reading 'createContext'`) | `frontend/vite.config.js` | oui |
| 12 | `[PR #5]` | Vhosts nginx / Apache générés par l'installeur : `/api` non retiré (404 partout) et `/ws/` envoyé au Master au lieu du gateway | `backend/scripts/setup.js` | oui (Apache) |
| 13 | `[PR #5]` | `crypto.randomUUID is not a function` en HTTP simple : connexion impossible, envoi de messages du tchat v2 cassé | `frontend/src/utils/uuid.js`, `services/authService.js`, `tchatv2/.../Composer.jsx` | oui |
| 14 | `[PR #5]` | Utilisateur sans entreprise : logo en chargement infini, lien "Panel Admin" masqué malgré `ADMIN.*`, `/admin` bloqué sur "Chargement..." | `frontend/src/contexts/PermissionsContext.jsx`, `permissions/ProtectedCompanyRoute.jsx`, `App.jsx` | oui |
| 15 | `[ ]` | F5 sur une URL protégée (ex. `/admin`) renvoie vers `/dashboard` : pendant le refresh du token, `isAuthenticated` vaut brièvement `false` et le garde redirige vers `/login` | `frontend/src/permissions/ProtectedCompanyRoute.jsx`, `contexts/AuthContext.jsx` | - |
| 16 | `[ ]` | Utilisateur sans entreprise sur une page "entreprise" : `ProtectedCompanyRoute` reste sur "Chargement..." au lieu d'expliquer qu'il faut une entreprise | `frontend/src/permissions/ProtectedCompanyRoute.jsx` | - |

## 🟡 Fonctionnalités non terminées

| # | Statut | Fonctionnalité | Fichier(s) |
|---|---|---|---|
| F1 | `[ ]` | Filtre `activeAt` désactivé dans la liste des employés (`@TODO Fix pour que ça prenne l'intégralité`) | `backend/src/modules/employees/employees.service.js:1416` |
| F2 | `[ ]` | Templates de rémunération pour un non-gérant : renvoie toujours `[]` | `backend/src/modules/employees/employees.service.js:1629` |
| F3 | `[ ]` | Mode SELF des déclarations produits (`@TODO Fix le SELF`) | `backend/src/modules/products/products.controller.js:398` |
| F4 | `[ ]` | Modules `mecano` et `immobilier` sans aucune route (config paiement uniquement) | `backend/src/modules/mecano`, `backend/src/modules/immobilier` |
| F5 | `[ ]` | Nouvelle conversation : l'envoi aux rangs est ignoré, seuls les utilisateurs sont pris | `frontend/src/components/chat/NewConversationModal.jsx:83` |
| F6 | `[ ]` | Menu contextuel chat : "Répondre" et "Supprimer" non implémentés (fichier par ailleurs inutilisé) | `frontend/src/components/chat/ChatMessageContextMenu.jsx` |
| F7 | `[ ]` | Widgets backend sans composant frontend : affichage "Composant non implémenté" | `frontend/src/components/dashboard/WidgetGrid.jsx:462` |

## 🧹 Dette technique / code mort

| # | Statut | Élément |
|---|---|---|
| D1 | `[ ]` | `backend/src/routes/*` (15 fichiers) et une grande partie de `src/controllers/*` / `src/services/*` jamais chargés (ancienne architecture) |
| D2 | `[ ]` | ~50 composants frontend orphelins (ex. `CompanyDetailPage.jsx` doublon de `CompanyDetailsPage.jsx`, `NotificationsPage`, `ProductCreatePage`, `ContractAssignPage`, `components/admin/company/*`) |
| D3 | `[ ]` | 3 implémentations du chat (`components/chat` v1, `chat/`, `modules/tchatv2`) |
| D4 | `[ ]` | Fichiers de test / debug à la racine backend : `testRedis.js`, `test_log_fix.js`, `regie/test_rtmp.js`, `scripts/debug_automation.js` |
| D5 | `[ ]` | CORS par défaut codé en dur (`https://react.jipeg-corporation.eu`) et URLs `jipeg-corporation.eu` en dur dans le frontend (CDN tchat v2, tablette) |
| D6 | `[ ]` | Pas de lint configuré côté backend |
| D7 | `[ ]` | 32 erreurs ESLint frontend (variables inutilisées) |
| D8 | `[ ]` | `npm run setup` ne fonctionne que sous Linux (apt, systemctl, certbot) : documenter l'installation manuelle Windows |

---

## Ordre de traitement conseillé

1. `[PR #5]` Merger la PR #5
2. `[ ]` #7 crash `prisma` en production
3. `[ ]` #2, #3, #4, #5 (IDOR et upload public)
4. `[ ]` #6 et #6b (secrets par défaut, hash des clés API)
5. `[ ]` #15, #16 (gardes de routes frontend)
6. `[ ]` Reste des bugs fonctionnels, puis fonctionnalités et dette
