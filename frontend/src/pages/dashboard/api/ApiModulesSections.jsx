import { AlertCircle } from 'lucide-react';

// ─── UI primitives ────────────────────────────────────────────────────────────

export function CodeBlock({ children, lang }) {
  return (
    <div className="rounded-xl overflow-hidden border border-cca-border">
      {lang && (
        <div className="bg-cca-surface px-4 py-1.5 text-[11px] font-mono text-cca-textSecondary border-b border-cca-border">
          {lang}
        </div>
      )}
      <pre className="bg-cca-base p-4 overflow-x-auto text-xs font-mono text-cca-textPrimary leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function Param({ name, type, required, description }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-cca-border/50 last:border-0">
      <div className="min-w-[160px]">
        <span className="font-mono text-xs text-brand-primary">{name}</span>
        {required && <span className="ml-1 text-[10px] text-red-400 font-semibold">requis</span>}
      </div>
      <span className="text-[10px] font-mono text-amber-400 min-w-[90px]">{type}</span>
      <span className="text-xs text-cca-textSecondary flex-1">{description}</span>
    </div>
  );
}

export function Endpoint({ method, path, description, params, queryParams, example, exampleResponse, notes }) {
  const colors = {
    GET:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
    POST:   'bg-green-500/20 text-green-400 border-green-500/30',
    PATCH:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
    DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return (
    <div className="rounded-xl border border-cca-border bg-cca-surface overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-cca-border bg-cca-base/50">
        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${colors[method]}`}>{method}</span>
        <code className="font-mono text-sm text-cca-textPrimary">{path}</code>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-sm text-cca-textSecondary">{description}</p>
        {notes && (
          <div className="flex gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{notes}</span>
          </div>
        )}
        {params?.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cca-textSecondary mb-2">Paramètres URL</p>
            <div className="rounded-lg border border-cca-border overflow-hidden">
              {params.map((p) => <Param key={p.name} {...p} />)}
            </div>
          </div>
        )}
        {queryParams?.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cca-textSecondary mb-2">Query string</p>
            <div className="rounded-lg border border-cca-border overflow-hidden">
              {queryParams.map((p) => <Param key={p.name} {...p} />)}
            </div>
          </div>
        )}
        {example && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cca-textSecondary mb-2">Requête</p>
            <CodeBlock lang="bash">{example}</CodeBlock>
          </div>
        )}
        {exampleResponse && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cca-textSecondary mb-2">Réponse</p>
            <CodeBlock lang="json">{exampleResponse}</CodeBlock>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Module sections ──────────────────────────────────────────────────────────

export function ClientsSection({ baseUrl }) {
  return (
    <section id="clients" className="space-y-4 scroll-mt-6">
      <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Clients</h2>
      <Endpoint
        method="GET" path="/api/clients"
        description="Liste paginée des clients de l'entreprise."
        queryParams={[
          { name: 'page',   type: 'integer', required: false, description: 'Page. Défaut : 1.' },
          { name: 'limit',  type: 'integer', required: false, description: 'Entrées par page. Défaut : 15.' },
          { name: 'search', type: 'string',  required: false, description: 'Recherche par nom.' },
        ]}
        example={`curl "${baseUrl}/api/clients?page=1&limit=15" \\\n  -H "x-api-key: votre_cle_api"`}
        exampleResponse={`{ "data": [{ "id": 1, "name": "Jean Dupont", "createdAt": "2026-01-10T00:00:00.000Z" }], "totalCount": 42, "currentPage": 1, "pageSize": 15, "totalPages": 3 }`}
      />
      <Endpoint
        method="GET" path="/api/clients/:clientId"
        description="Détails complets d'un client."
        params={[{ name: 'clientId', type: 'integer', required: true, description: 'ID du client.' }]}
        example={`curl "${baseUrl}/api/clients/1" \\\n  -H "x-api-key: votre_cle_api"`}
        exampleResponse={`{ "id": 1, "name": "Jean Dupont", "phoneNumber": "+33600000000", "createdAt": "2026-01-10T00:00:00.000Z" }`}
        notes="Le client doit appartenir à l'entreprise de la clé. Hors périmètre → 404."
      />
      <Endpoint
        method="POST" path="/api/clients"
        description="Crée un nouveau client."
        example={`curl -X POST "${baseUrl}/api/clients" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Marie Martin","phoneNumber":"+33600000001"}'`}
        exampleResponse={`{ "id": 2, "name": "Marie Martin", "createdAt": "2026-05-15T12:00:00.000Z" }`}
      />
      <Endpoint
        method="PATCH" path="/api/clients/:clientId"
        description="Met à jour les informations d'un client."
        params={[{ name: 'clientId', type: 'integer', required: true, description: 'ID du client.' }]}
        example={`curl -X PATCH "${baseUrl}/api/clients/1" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{"phoneNumber":"+33611223344"}'`}
        exampleResponse={`{ "id": 1, "name": "Jean Dupont", "phoneNumber": "+33611223344" }`}
      />
    </section>
  );
}

export function ComptabiliteSection({ baseUrl }) {
  return (
    <section id="comptabilite" className="space-y-4 scroll-mt-6">
      <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Comptabilité</h2>
      <Endpoint
        method="GET" path="/api/comptabilite/bills"
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
      />
      <Endpoint
        method="GET" path="/api/comptabilite/bills/:billId"
        description="Détails d'une facture (lignes, partages, commentaires)."
        params={[{ name: 'billId', type: 'integer', required: true, description: 'ID de la facture.' }]}
        example={`curl "${baseUrl}/api/comptabilite/bills/101" \\\n  -H "x-api-key: votre_cle_api"`}
        exampleResponse={`{ "id": 101, "date": "2026-05-10T09:30:00.000Z", "total": 250.00, "status": "PAID", "lines": [{ "label": "Prestation", "amount": 250.00 }] }`}
        notes="Accès restreint à l'entreprise de la clé. Hors périmètre → 404."
      />
      <Endpoint
        method="GET" path="/api/comptabilite/balance/solde"
        description="Solde courant de la balance comptable."
        example={`curl "${baseUrl}/api/comptabilite/balance/solde" \\\n  -H "x-api-key: votre_cle_api"`}
        exampleResponse={`{ "solde": 12450.75, "currency": "USD" }`}
      />
    </section>
  );
}

export function ChatSection({ baseUrl }) {
  return (
    <section id="chat" className="space-y-4 scroll-mt-6">
      <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Chat</h2>
      <Endpoint
        method="GET" path="/api/chat/channels"
        description="Liste des salons accessibles pour l'entreprise."
        example={`curl "${baseUrl}/api/chat/channels" \\\n  -H "x-api-key: votre_cle_api"`}
        exampleResponse={`[{ "id": 1, "name": "général", "type": "TEXT", "categoryId": 1 }]`}
        notes="Résultats filtrés selon les permissions Discord-like de la clé."
      />
      <Endpoint
        method="GET" path="/api/chat/channels/:channelId/messages"
        description="Messages d'un salon, du plus récent au plus ancien."
        params={[{ name: 'channelId', type: 'integer', required: true, description: 'ID du salon.' }]}
        queryParams={[
          { name: 'limit',  type: 'integer', required: false, description: 'Nombre de messages. Défaut : 50.' },
          { name: 'before', type: 'integer', required: false, description: 'ID message — messages antérieurs.' },
          { name: 'after',  type: 'integer', required: false, description: 'ID message — messages postérieurs.' },
        ]}
        example={`curl "${baseUrl}/api/chat/channels/1/messages?limit=20" \\\n  -H "x-api-key: votre_cle_api"`}
        exampleResponse={`[{ "id": 500, "content": "Bonjour tout le monde", "createdAt": "2026-05-15T10:00:00.000Z", "author": { "id": 42, "name": "Alice Martin" } }]`}
      />
    </section>
  );
}

export function BoxsSection({ baseUrl }) {
  return (
    <section id="boxs" className="space-y-4 scroll-mt-6">
      <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Boxs</h2>
      <Endpoint
        method="GET" path="/api/boxs/carton-sales"
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
        method="GET" path="/api/boxs/carton-sales/summary"
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
  );
}

export function RangsSection({ baseUrl }) {
  return (
    <section id="rangs" className="space-y-4 scroll-mt-6">
      <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Rangs</h2>

      <Endpoint
        method="GET" path="/api/employees/ranks"
        description="Liste tous les rangs de l'entreprise, triés par position croissante."
        example={`curl "${baseUrl}/api/employees/ranks" \\\n  -H "x-api-key: votre_cle_api"`}
        exampleResponse={`[
  {
    "id": 3,
    "name": "Manager",
    "position": 2,
    "salaryCap": null,
    "groupRankId": null,
    "remunerationConfig": null,
    "companyId": 1,
    "permissionTemplates": []
  }
]`}
      />

      <Endpoint
        method="POST" path="/api/employees/ranks"
        description="Crée un nouveau rang."
        example={`curl -X POST "${baseUrl}/api/employees/ranks" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Chef d\\'équipe","position":3}'`}
        exampleResponse={`{ "id": 7, "name": "Chef d'équipe", "position": 3, "companyId": 1 }`}
        notes='Corps JSON — name (requis), position (optionnel, auto-incrémenté sinon), salaryCap, groupRankId, remunerationConfig, permissionTemplateIds.'
      />

      <Endpoint
        method="PATCH" path="/api/employees/rank/:rankId"
        description="Modifie un rang existant."
        params={[{ name: 'rankId', type: 'integer', required: true, description: 'ID du rang.' }]}
        example={`curl -X PATCH "${baseUrl}/api/employees/rank/7" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Responsable","salaryCap":5000}'`}
        exampleResponse={`{ "id": 7, "name": "Responsable", "position": 3, "salaryCap": 5000 }`}
        notes="Tous les champs du corps sont optionnels. permissionTemplateIds remplace l'intégralité des templates existants (set complet)."
      />

      <Endpoint
        method="DELETE" path="/api/employees/rank/:rankId"
        description="Supprime un rang. Échoue si des employés y sont encore assignés."
        params={[{ name: 'rankId', type: 'integer', required: true, description: 'ID du rang.' }]}
        example={`curl -X DELETE "${baseUrl}/api/employees/rank/7" \\\n  -H "x-api-key: votre_cle_api"`}
        exampleResponse={`{ "id": 7, "name": "Responsable", "position": 3 }`}
        notes="Retourne 400 si le rang est assigné à au moins un employé actif."
      />

      <Endpoint
        method="PATCH" path="/api/employees/ranks/order"
        description="Réordonne les rangs. Le corps est un tableau d'IDs dans l'ordre voulu."
        example={`curl -X PATCH "${baseUrl}/api/employees/ranks/order" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '[3, 7, 1]'`}
        exampleResponse={`{ "success": true }`}
        notes="Tableau ordonné d'IDs de rangs. Chaque rang reçoit une position correspondant à son index + 1."
      />
    </section>
  );
}

export function GarageSection({ baseUrl }) {
  return (
    <section id="garage" className="space-y-4 scroll-mt-6">
      <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Garage</h2>

      <Endpoint
        method="GET" path="/api/garage/vehicles"
        description="Liste tous les véhicules enregistrés de l'entreprise, triés par date de mise à jour décroissante."
        example={`curl "${baseUrl}/api/garage/vehicles" \\\n  -H "x-api-key: votre_cle_api"`}
        exampleResponse={`{
  "vehicles": [
    {
      "id": 1,
      "vehicleId": "VEH-001",
      "plate": "AB-123-CD",
      "displayName": "Camion blanc",
      "createdAt": "2026-01-10T08:00:00.000Z",
      "updatedAt": "2026-05-10T14:00:00.000Z",
      "createdBy": { "id": 42, "name": "Alice Martin", "imageUrl": null },
      "updatedBy": { "id": 42, "name": "Alice Martin", "imageUrl": null }
    }
  ]
}`}
      />

      <Endpoint
        method="POST" path="/api/garage/vehicles"
        description="Enregistre un nouveau véhicule et rattache rétroactivement les mouvements existants portant le même vehicleId."
        example={`curl -X POST "${baseUrl}/api/garage/vehicles" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{"vehicleId":"VEH-002","plate":"EF-456-GH","displayName":"Fourgon gris"}'`}
        exampleResponse={`{ "id": 2, "vehicleId": "VEH-002", "plate": "EF-456-GH", "displayName": "Fourgon gris", "companyId": 1 }`}
        notes="vehicleId requis. plate et displayName optionnels."
      />

      <Endpoint
        method="PATCH" path="/api/garage/vehicles/:id"
        description="Met à jour la plaque et/ou le nom d'affichage d'un véhicule."
        params={[{ name: 'id', type: 'integer', required: true, description: 'ID du véhicule (champ id dans la liste).' }]}
        example={`curl -X PATCH "${baseUrl}/api/garage/vehicles/2" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{"plate":"EF-999-GH","displayName":"Fourgon gris (réparé)"}'`}
        exampleResponse={`{ "id": 2, "vehicleId": "VEH-002", "plate": "EF-999-GH", "displayName": "Fourgon gris (réparé)" }`}
        notes="Seuls plate et displayName sont modifiables. vehicleId ne peut pas être changé."
      />

      <Endpoint
        method="DELETE" path="/api/garage/vehicles/:id"
        description="Supprime un véhicule enregistré. Les mouvements liés sont conservés mais leur lien vehicleRefId est effacé."
        params={[{ name: 'id', type: 'integer', required: true, description: 'ID du véhicule.' }]}
        example={`curl -X DELETE "${baseUrl}/api/garage/vehicles/2" \\\n  -H "x-api-key: votre_cle_api"`}
        exampleResponse={`{ "success": true, "deleted": { "id": 2, "vehicleId": "VEH-002" } }`}
      />

      <Endpoint
        method="GET" path="/api/garage/movements"
        description="Liste tous les mouvements (entrées/sorties) de véhicules de l'entreprise, du plus récent au plus ancien."
        example={`curl "${baseUrl}/api/garage/movements" \\\n  -H "x-api-key: votre_cle_api"`}
        exampleResponse={`{
  "movements": [
    {
      "id": 10,
      "vehicleId": "VEH-001",
      "occurredAt": "2026-05-14T09:30:00.000Z",
      "user": { "id": 42, "name": "Alice Martin", "imageUrl": null, "characterId": null, "discordId": null },
      "vehicleRef": { "id": 1, "displayName": "Camion blanc", "plate": "AB-123-CD" }
    }
  ]
}`}
        notes="vehicleRef est null si aucun véhicule enregistré ne correspond au mouvement."
      />
    </section>
  );
}

export function InventorySection({ baseUrl }) {
  return (
    <section id="inventory" className="space-y-4 scroll-mt-6">
      <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Inventory</h2>
      <Endpoint
        method="GET" path="/api/inventory"
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
  );
}
