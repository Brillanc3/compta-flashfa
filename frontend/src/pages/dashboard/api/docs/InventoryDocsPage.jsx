import { DocsLayout } from './_layout';
import { Endpoint } from './_components';

export default function InventoryDocsPage() {
  const baseUrl = window.location.origin.replace(/:\d+$/, ':3000');

  return (
    <DocsLayout>
      <section className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Inventory</h2>

        <Endpoint
          method="GET"
          path="/api/inventory"
          description="Mouvements d'inventaire paginés et filtrables."
          queryParams={[
            { name: 'page',     type: 'integer', required: false, description: 'Page. Défaut : 1.' },
            { name: 'pageSize', type: 'integer', required: false, description: 'Entrées par page. Défaut : 50.' },
            { name: 'types',    type: 'string',  required: false, description: 'Type(s) de mouvement, séparé par virgule.' },
            { name: 'coffre',   type: 'string',  required: false, description: 'Filtre coffre/owner, séparé par virgule.' },
            { name: 'users',    type: 'string',  required: false, description: 'Filtre par nom utilisateur.' },
            { name: 'items',    type: 'string',  required: false, description: 'Filtre par code/label item.' },
            { name: 'tags',     type: 'string',  required: false, description: 'Recherche globale texte.' },
            { name: 'dateFrom', type: 'string',  required: false, description: 'Date de début ISO.' },
            { name: 'dateTo',   type: 'string',  required: false, description: 'Date de fin ISO.' },
          ]}
          example={`curl "${baseUrl}/api/inventory?pageSize=20&types=ENTREE" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "page": 1, "pageSize": 20, "total": 3, "mode": "ALL", "results": [{ "id": 55, "type": "ENTREE", "itemCode": "ITEM-001", "itemLabel": "Écran 27 pouces", "occurredAt": "2026-05-12T08:00:00.000Z", "user": { "id": 42, "name": "Alice Martin" } }] }`}
          notes="Mode ALL ou SELF selon les permissions de la clé."
        />
      </section>
    </DocsLayout>
  );
}
