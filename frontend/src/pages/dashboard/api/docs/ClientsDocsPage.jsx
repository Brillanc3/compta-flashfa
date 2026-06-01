import { DocsLayout } from './_layout';
import { Endpoint } from './_components';

export default function ClientsDocsPage() {
  const baseUrl = window.location.origin.replace(/:\d+$/, ':3000');

  return (
    <DocsLayout>
      <section className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Clients</h2>

        <Endpoint
          method="GET"
          path="/api/clients"
          description="Liste paginée des clients de l'entreprise."
          queryParams={[
            { name: 'page',   type: 'integer', required: false, description: 'Page. Défaut : 1.' },
            { name: 'limit',  type: 'integer', required: false, description: 'Entrées par page. Défaut : 15.' },
            { name: 'search', type: 'string',  required: false, description: 'Recherche par nom.' },
          ]}
          example={`curl "${baseUrl}/api/clients?page=1&limit=15" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "data": [{ "id": 1, "name": "Jean Dupont", "createdAt": "2026-01-10T00:00:00.000Z", "phoneNumber": null, "address": null, "kind": "PERSON" }], "pagination": { "totalCount": 42, "currentPage": 1, "pageSize": 15, "totalPages": 3 } }`}
        />

        <Endpoint
          method="GET"
          path="/api/clients/:clientId"
          description="Détails complets d'un client."
          params={[{ name: 'clientId', type: 'integer', required: true, description: 'ID du client.' }]}
          example={`curl "${baseUrl}/api/clients/1" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "id": 1, "name": "Jean Dupont", "phoneNumber": "555-5555", "createdAt": "2026-01-10T00:00:00.000Z" }`}
          notes="Le client doit appartenir à l'entreprise de la clé. Hors périmètre → 404."
        />

        <Endpoint
          method="POST"
          path="/api/clients"
          description="Crée un nouveau client. Retourne HTTP 201."
          example={`curl -X POST "${baseUrl}/api/clients" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Marie Martin","phoneNumber":"555-5555"}'`}
          exampleResponse={`{ "id": 2, "name": "Marie Martin", "createdAt": "2026-05-15T12:00:00.000Z", "phoneNumber": "555-5555", "address": null, "kind": "PERSON", "companyId": 1 }`}
        />

        <Endpoint
          method="PATCH"
          path="/api/clients/:clientId"
          description="Met à jour les informations d'un client."
          params={[{ name: 'clientId', type: 'integer', required: true, description: 'ID du client.' }]}
          example={`curl -X PATCH "${baseUrl}/api/clients/1" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{"phoneNumber":"555-5556"}'`}
          exampleResponse={`{ "id": 1, "name": "Jean Dupont", "phoneNumber": "555-5556" }`}
        />
      </section>
    </DocsLayout>
  );
}
