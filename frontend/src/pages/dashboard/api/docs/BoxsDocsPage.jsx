import { DocsLayout } from './_layout';
import { Endpoint } from './_components';

export default function BoxsDocsPage() {
  const baseUrl = window.location.origin.replace(/:\d+$/, ':3000');

  return (
    <DocsLayout>
      <section className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Boxs</h2>

        <Endpoint
          method="GET"
          path="/api/boxs/carton-sales"
          description="Journal paginé des ventes de cartons."
          queryParams={[
            { name: 'page',                 type: 'integer', required: false, description: 'Page. Défaut : 1.' },
            { name: 'limit',                type: 'integer', required: false, description: 'Entrées par page. Défaut : 25. Max : 200.' },
            { name: 'startDate',            type: 'string',  required: false, description: 'Date de début ISO (ex: 2026-05-01).' },
            { name: 'endDate',              type: 'string',  required: false, description: 'Date de fin ISO (ex: 2026-05-31).' },
            { name: 'companyEmployeeId',    type: 'integer', required: false, description: 'Filtre par employé.' },
            { name: 'redistributionNumber', type: 'string',  required: false, description: 'Filtre par numéro de redistribution.' },
          ]}
          example={`curl "${baseUrl}/api/boxs/carton-sales?startDate=2026-05-01" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "data": [{ "id": 10, "occurredAt": "2026-05-05T14:00:00.000Z", "cartonCount": 5, "amount": 125.00, "reason": "Livraison client", "companyEmployee": { "id": 1, "user": { "id": 42, "name": "Alice Martin" } } }], "pagination": { "totalCount": 1, "totalPages": 1, "currentPage": 1, "limit": 25 } }`}
        />

        <Endpoint
          method="GET"
          path="/api/boxs/carton-sales/summary"
          description="Agrégat : nombre de ventes, total cartons et montant sur la période."
          queryParams={[
            { name: 'startDate',         type: 'string',  required: false, description: 'Date de début ISO.' },
            { name: 'endDate',           type: 'string',  required: false, description: 'Date de fin ISO.' },
            { name: 'companyEmployeeId', type: 'integer', required: false, description: 'Filtre par employé.' },
          ]}
          example={`curl "${baseUrl}/api/boxs/carton-sales/summary?startDate=2026-05-01" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "count": 12, "totalCartons": 58, "totalAmount": 1450.00 }`}
        />
      </section>
    </DocsLayout>
  );
}
