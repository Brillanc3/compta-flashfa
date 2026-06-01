import { DocsLayout } from './_layout';
import { Endpoint } from './_components';

const SECTIONS = [
  { id: 'factures',               label: 'Factures' },
  { id: 'commentaires-factures',  label: 'Commentaires' },
  { id: 'transactions',           label: 'Transactions' },
  { id: 'balance',                label: 'Balance' },
  { id: 'notes-de-frais',         label: 'Notes de frais' },
  { id: 'categories-frais',       label: 'Catégories de frais' },
  { id: 'widgets',                label: 'Widgets' },
  { id: 'parametres',             label: 'Paramètres' },
];

export default function ComptabiliteDocsPage() {
  const baseUrl = window.location.origin.replace(/:\d+$/, ':3000');

  return (
    <DocsLayout sections={SECTIONS}>
      {/* ── Factures ── */}
      <section id="factures" className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Factures</h2>

        <Endpoint
          method="GET"
          path="/api/comptabilite/bills"
          description="Liste paginée des factures. Filtrée selon les droits de la clé (toutes ou uniquement les siennes)."
          queryParams={[
            { name: 'page',       type: 'integer', required: false, description: 'Page. Défaut : 1.' },
            { name: 'limit',      type: 'integer', required: false, description: 'Entrées par page. Défaut : 20.' },
            { name: 'status',     type: 'string',  required: false, description: 'Filtre par statut : PAID, PENDING, CANCELLED.' },
            { name: 'employeeId', type: 'integer', required: false, description: 'Filtre par employé.' },
            { name: 'startDate',  type: 'string',  required: false, description: 'Date de début ISO (ex: 2026-01-01).' },
            { name: 'endDate',    type: 'string',  required: false, description: 'Date de fin ISO (ex: 2026-05-31).' },
          ]}
          example={`curl "${baseUrl}/api/comptabilite/bills?page=1&limit=20&status=PAID" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "data": [{ "id": 101, "date": "2026-05-10T09:30:00.000Z", "total": 250.00, "status": "PAID", "employeeId": 1 }], "pagination": { "totalCount": 84, "currentPage": 1, "totalPages": 5, "limit": 20 } }`}
          notes="Cette route requiert une session authentifiée (cookie JWT) en plus de la clé API. Une requête avec x-api-key seul retourne 401."
        />

        <Endpoint
          method="GET"
          path="/api/comptabilite/bills/:billId"
          description="Détails d'une facture (lignes, partages, commentaires)."
          params={[{ name: 'billId', type: 'integer', required: true, description: 'ID de la facture.' }]}
          example={`curl "${baseUrl}/api/comptabilite/bills/101" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "id": 101, "date": "2026-05-10T09:30:00.000Z", "total": 250.00, "status": "PAID", "lines": [{ "label": "Prestation", "amount": 250.00 }] }`}
          notes="Requiert une session authentifiée (cookie JWT). Accès restreint à l'entreprise de la clé. Hors périmètre → 404."
        />

        <Endpoint
          method="PATCH"
          path="/api/comptabilite/bills/:billId/shares"
          description="Met à jour les partages (répartitions) d'une facture."
          params={[{ name: 'billId', type: 'integer', required: true, description: 'ID de la facture.' }]}
          example={`curl -X PATCH "${baseUrl}/api/comptabilite/bills/101/shares" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "shares": [{ "employeeId": 1, "amount": 125.00 }, { "employeeId": 2, "amount": 125.00 }] }'`}
          exampleResponse={`{ "success": true }`}
        />
      </section>

      {/* ── Commentaires de factures ── */}
      <section id="commentaires-factures" className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Commentaires de factures</h2>

        <Endpoint
          method="GET"
          path="/api/comptabilite/bills/:billId/comments"
          description="Liste les commentaires d'une facture."
          params={[{ name: 'billId', type: 'integer', required: true, description: 'ID de la facture.' }]}
          example={`curl "${baseUrl}/api/comptabilite/bills/101/comments" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`[{ "id": 5, "content": "Vérifié.", "createdAt": "2026-05-10T10:00:00.000Z", "userId": 2 }]`}
        />

        <Endpoint
          method="POST"
          path="/api/comptabilite/bills/:billId/comments"
          description="Ajoute un commentaire sur une facture."
          params={[{ name: 'billId', type: 'integer', required: true, description: 'ID de la facture.' }]}
          example={`curl -X POST "${baseUrl}/api/comptabilite/bills/101/comments" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "content": "Facture approuvée." }'`}
          exampleResponse={`{ "id": 6, "content": "Facture approuvée.", "createdAt": "2026-05-16T08:00:00.000Z" }`}
        />

        <Endpoint
          method="PATCH"
          path="/api/comptabilite/bills/comments/:commentId"
          description="Modifie un commentaire existant."
          params={[{ name: 'commentId', type: 'integer', required: true, description: 'ID du commentaire.' }]}
          example={`curl -X PATCH "${baseUrl}/api/comptabilite/bills/comments/6" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "content": "Contenu corrigé." }'`}
          exampleResponse={`{ "id": 6, "content": "Contenu corrigé." }`}
        />

        <Endpoint
          method="DELETE"
          path="/api/comptabilite/bills/comments/:commentId"
          description="Supprime un commentaire."
          params={[{ name: 'commentId', type: 'integer', required: true, description: 'ID du commentaire.' }]}
          example={`curl -X DELETE "${baseUrl}/api/comptabilite/bills/comments/6" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "success": true }`}
        />
      </section>

      {/* ── Transactions ── */}
      <section id="transactions" className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Transactions</h2>

        <Endpoint
          method="GET"
          path="/api/comptabilite/transaction-categories"
          description="Liste toutes les catégories de transactions disponibles pour l'entreprise."
          example={`curl "${baseUrl}/api/comptabilite/transaction-categories" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`[{ "id": 1, "name": "Fournitures", "type": "EXPENSE" }, { "id": 2, "name": "Vente", "type": "INCOME" }]`}
        />

        <Endpoint
          method="POST"
          path="/api/comptabilite/transactions/journal"
          description="Retourne le journal comptable filtré selon les critères fournis."
          example={`curl -X POST "${baseUrl}/api/comptabilite/transactions/journal" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "startDate": "2026-01-01", "endDate": "2026-05-31", "page": 1, "limit": 50 }'`}
          exampleResponse={`{ "data": [{ "id": 200, "date": "2026-04-01T00:00:00.000Z", "amount": 500.00, "type": "INCOME", "category": "Vente" }], "pagination": { "totalCount": 120, "currentPage": 1, "totalPages": 3 } }`}
        />

        <Endpoint
          method="POST"
          path="/api/comptabilite/transactions/summary"
          description="Retourne un résumé agrégé des transactions (totaux par catégorie, soldes)."
          example={`curl -X POST "${baseUrl}/api/comptabilite/transactions/summary" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "startDate": "2026-01-01", "endDate": "2026-05-31" }'`}
          exampleResponse={`{ "totalIncome": 15000.00, "totalExpense": 4200.00, "balance": 10800.00, "byCategory": [{ "category": "Vente", "total": 15000.00 }] }`}
        />

        <Endpoint
          method="PATCH"
          path="/api/comptabilite/transactions/:transactionId"
          description="Met à jour la catégorie d'une transaction."
          params={[{ name: 'transactionId', type: 'integer', required: true, description: 'ID de la transaction.' }]}
          example={`curl -X PATCH "${baseUrl}/api/comptabilite/transactions/200" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "categoryId": 3 }'`}
          exampleResponse={`{ "id": 200, "categoryId": 3 }`}
        />
      </section>

      {/* ── Balance ── */}
      <section id="balance" className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Balance</h2>

        <Endpoint
          method="GET"
          path="/api/comptabilite/balance/solde"
          description="Solde courant de la balance comptable."
          example={`curl "${baseUrl}/api/comptabilite/balance/solde" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "companyId": 1, "balance": "8491561" }`}
          notes="balance est exprimé dans l'unité monétaire interne (entier, pas de décimales)."
        />

        <Endpoint
          method="GET"
          path="/api/comptabilite/declaration"
          description="Retourne la déclaration fiscale de l'entreprise pour la période courante."
          example={`curl "${baseUrl}/api/comptabilite/declaration" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "period": "2026-Q1", "taxableIncome": 30000.00, "taxAmount": 6000.00, "status": "DRAFT" }`}
        />
      </section>

      {/* ── Notes de frais ── */}
      <section id="notes-de-frais" className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Notes de frais</h2>

        <Endpoint
          method="POST"
          path="/api/comptabilite/expense-reports"
          description="Crée une nouvelle note de frais."
          example={`curl -X POST "${baseUrl}/api/comptabilite/expense-reports" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "title": "Déplacement client", "amount": 85.50, "categoryId": 4, "date": "2026-05-15" }'`}
          exampleResponse={`{ "id": 10, "title": "Déplacement client", "amount": 85.50, "status": "PENDING" }`}
        />

        <Endpoint
          method="GET"
          path="/api/comptabilite/expense-reports"
          description="Liste toutes les notes de frais de l'entreprise."
          queryParams={[
            { name: 'status',     type: 'string',  required: false, description: 'Filtre : PENDING, APPROVED, REIMBURSED, REJECTED.' },
            { name: 'employeeId', type: 'integer', required: false, description: 'Filtre par employé.' },
            { name: 'page',       type: 'integer', required: false, description: 'Page. Défaut : 1.' },
            { name: 'limit',      type: 'integer', required: false, description: 'Entrées par page. Défaut : 20.' },
          ]}
          example={`curl "${baseUrl}/api/comptabilite/expense-reports?status=PENDING" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "data": [{ "id": 10, "title": "Déplacement client", "amount": 85.50, "status": "PENDING", "employeeId": 3 }], "pagination": { "totalCount": 5, "currentPage": 1, "totalPages": 1 } }`}
        />

        <Endpoint
          method="PATCH"
          path="/api/comptabilite/expense-reports/:reportId/status"
          description="Met à jour le statut d'une note de frais (approbation, rejet, remboursement)."
          params={[{ name: 'reportId', type: 'integer', required: true, description: 'ID de la note de frais.' }]}
          example={`curl -X PATCH "${baseUrl}/api/comptabilite/expense-reports/10/status" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "status": "APPROVED" }'`}
          exampleResponse={`{ "id": 10, "status": "APPROVED" }`}
        />

        <Endpoint
          method="PATCH"
          path="/api/comptabilite/expense-reports/:reportId"
          description="Modifie les informations d'une note de frais existante."
          params={[{ name: 'reportId', type: 'integer', required: true, description: 'ID de la note de frais.' }]}
          example={`curl -X PATCH "${baseUrl}/api/comptabilite/expense-reports/10" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "title": "Déplacement client (corrigé)", "amount": 90.00 }'`}
          exampleResponse={`{ "id": 10, "title": "Déplacement client (corrigé)", "amount": 90.00 }`}
        />

        <Endpoint
          method="DELETE"
          path="/api/comptabilite/expense-reports/:reportId"
          description="Supprime une note de frais."
          params={[{ name: 'reportId', type: 'integer', required: true, description: 'ID de la note de frais.' }]}
          example={`curl -X DELETE "${baseUrl}/api/comptabilite/expense-reports/10" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "success": true }`}
        />
      </section>

      {/* ── Catégories de frais ── */}
      <section id="categories-frais" className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Catégories de frais</h2>

        <Endpoint
          method="GET"
          path="/api/comptabilite/expense-categories"
          description="Liste toutes les catégories de notes de frais."
          example={`curl "${baseUrl}/api/comptabilite/expense-categories" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`[{ "id": 4, "name": "Transport" }, { "id": 5, "name": "Repas" }]`}
        />

        <Endpoint
          method="POST"
          path="/api/comptabilite/expense-categories"
          description="Crée une nouvelle catégorie de notes de frais."
          example={`curl -X POST "${baseUrl}/api/comptabilite/expense-categories" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "name": "Hébergement" }'`}
          exampleResponse={`{ "id": 6, "name": "Hébergement" }`}
        />

        <Endpoint
          method="PATCH"
          path="/api/comptabilite/expense-categories/:categoryId"
          description="Modifie une catégorie de notes de frais."
          params={[{ name: 'categoryId', type: 'integer', required: true, description: 'ID de la catégorie.' }]}
          example={`curl -X PATCH "${baseUrl}/api/comptabilite/expense-categories/6" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "name": "Hôtel" }'`}
          exampleResponse={`{ "id": 6, "name": "Hôtel" }`}
        />

        <Endpoint
          method="DELETE"
          path="/api/comptabilite/expense-categories/:categoryId"
          description="Supprime une catégorie de notes de frais."
          params={[{ name: 'categoryId', type: 'integer', required: true, description: 'ID de la catégorie.' }]}
          example={`curl -X DELETE "${baseUrl}/api/comptabilite/expense-categories/6" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "success": true }`}
        />
      </section>

      {/* ── Widgets ── */}
      <section id="widgets" className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Widgets</h2>

        <Endpoint
          method="GET"
          path="/api/comptabilite/widgets/user_bills_by_status"
          description="Répartition des factures de l'utilisateur courant par statut."
          example={`curl "${baseUrl}/api/comptabilite/widgets/user_bills_by_status" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "PAID": 42, "PENDING": 5, "CANCELLED": 2 }`}
        />

        <Endpoint
          method="GET"
          path="/api/comptabilite/widgets/expense_report_stats"
          description="Statistiques globales des notes de frais pour l'entreprise."
          example={`curl "${baseUrl}/api/comptabilite/widgets/expense_report_stats" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "total": 1200.00, "pending": 300.00, "reimbursed": 800.00, "rejected": 100.00 }`}
        />

        <Endpoint
          method="GET"
          path="/api/comptabilite/widgets/my_recent_expense_reports"
          description="Notes de frais récentes de l'utilisateur courant."
          example={`curl "${baseUrl}/api/comptabilite/widgets/my_recent_expense_reports" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`[{ "id": 10, "title": "Déplacement client", "amount": 85.50, "status": "PENDING", "date": "2026-05-15" }]`}
        />

        <Endpoint
          method="GET"
          path="/api/comptabilite/widgets/user_duty_counter"
          description="Compteur de service (temps de service) de l'utilisateur courant."
          example={`curl "${baseUrl}/api/comptabilite/widgets/user_duty_counter" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "totalMinutes": 480, "week": "2026-W20" }`}
        />

        <Endpoint
          method="GET"
          path="/api/comptabilite/widgets/users_duty_counter"
          description="Compteurs de service de tous les employés. Nécessite la permission USERS_DUTY."
          example={`curl "${baseUrl}/api/comptabilite/widgets/users_duty_counter" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`[{ "employeeId": 1, "name": "Alice", "totalMinutes": 480 }, { "employeeId": 2, "name": "Bob", "totalMinutes": 360 }]`}
        />

        <Endpoint
          method="GET"
          path="/api/comptabilite/widgets/transaction_log"
          description="Journal des transactions récentes sous forme de widget."
          example={`curl "${baseUrl}/api/comptabilite/widgets/transaction_log" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`[{ "id": 200, "date": "2026-05-15T14:00:00.000Z", "amount": 500.00, "type": "INCOME", "category": "Vente" }]`}
        />
      </section>

      {/* ── Paramètres ── */}
      <section id="parametres" className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Paramètres</h2>

        <Endpoint
          method="GET"
          path="/api/comptabilite/settings"
          description="Retourne les paramètres comptables de l'entreprise."
          example={`curl "${baseUrl}/api/comptabilite/settings" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "companyName": "Acme Corp", "currency": "EUR", "fiscalYearStart": "01-01" }`}
        />

        <Endpoint
          method="PATCH"
          path="/api/comptabilite/settings/update-settings"
          description="Met à jour les paramètres comptables de l'entreprise."
          example={`curl -X PATCH "${baseUrl}/api/comptabilite/settings/update-settings" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "currency": "USD", "fiscalYearStart": "04-01" }'`}
          exampleResponse={`{ "success": true }`}
        />

        <Endpoint
          method="PATCH"
          path="/api/comptabilite/settings/update-name"
          description="Met à jour le nom de l'entreprise."
          example={`curl -X PATCH "${baseUrl}/api/comptabilite/settings/update-name" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "name": "Nouveau Nom SARL" }'`}
          exampleResponse={`{ "success": true, "name": "Nouveau Nom SARL" }`}
        />

        <Endpoint
          method="POST"
          path="/api/comptabilite/settings/regenerate-api-key"
          description="Régénère la clé API de l'entreprise. L'ancienne clé est immédiatement invalidée."
          example={`curl -X POST "${baseUrl}/api/comptabilite/settings/regenerate-api-key" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "apiKey": "new_key_abc123" }`}
          notes="Action irréversible. L'ancienne clé cesse de fonctionner immédiatement."
        />

        <Endpoint
          method="POST"
          path="/api/comptabilite/settings/regenerate-onboarding-key"
          description="Régénère la clé d'onboarding de l'entreprise."
          example={`curl -X POST "${baseUrl}/api/comptabilite/settings/regenerate-onboarding-key" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "onboardingKey": "onb_xyz789" }`}
        />
      </section>
    </DocsLayout>
  );
}
