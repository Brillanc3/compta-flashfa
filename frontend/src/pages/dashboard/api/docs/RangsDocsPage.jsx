import { DocsLayout } from './_layout';
import { Endpoint } from './_components';

export default function RangsDocsPage() {
  const baseUrl = window.location.origin.replace(/:\d+$/, ':3000');

  return (
    <DocsLayout>
      <section className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Rangs</h2>

        <Endpoint
          method="GET"
          path="/api/employees/ranks"
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
          method="POST"
          path="/api/employees/ranks"
          description="Crée un nouveau rang."
          example={`curl -X POST "${baseUrl}/api/employees/ranks" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Chef d\\'équipe","position":3}'`}
          exampleResponse={`{ "id": 7, "name": "Chef d'équipe", "position": 3, "companyId": 1 }`}
          notes="Corps JSON — name (requis), position (optionnel, auto-incrémenté sinon), salaryCap, groupRankId, remunerationConfig, permissionTemplateIds."
        />

        <Endpoint
          method="PATCH"
          path="/api/employees/rank/:rankId"
          description="Modifie un rang existant."
          params={[{ name: 'rankId', type: 'integer', required: true, description: 'ID du rang.' }]}
          example={`curl -X PATCH "${baseUrl}/api/employees/rank/7" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Responsable","salaryCap":5000}'`}
          exampleResponse={`{ "id": 7, "name": "Responsable", "position": 3, "salaryCap": 5000 }`}
          notes="Tous les champs du corps sont optionnels. permissionTemplateIds remplace l'intégralité des templates (set complet)."
        />

        <Endpoint
          method="DELETE"
          path="/api/employees/rank/:rankId"
          description="Supprime un rang. Échoue si des employés y sont encore assignés."
          params={[{ name: 'rankId', type: 'integer', required: true, description: 'ID du rang.' }]}
          example={`curl -X DELETE "${baseUrl}/api/employees/rank/7" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "id": 7, "name": "Responsable", "position": 3 }`}
          notes="Retourne 400 si le rang est assigné à au moins un employé actif."
        />

        <Endpoint
          method="PATCH"
          path="/api/employees/ranks/order"
          description="Réordonne les rangs. Le corps est un tableau d'IDs dans l'ordre voulu."
          example={`curl -X PATCH "${baseUrl}/api/employees/ranks/order" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '[3, 7, 1]'`}
          exampleResponse={`{ "success": true }`}
          notes="Tableau ordonné d'IDs de rangs. Chaque rang reçoit une position correspondant à son index + 1."
        />
      </section>
    </DocsLayout>
  );
}
