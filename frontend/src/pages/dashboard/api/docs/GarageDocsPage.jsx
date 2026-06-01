import { DocsLayout } from './_layout';
import { Endpoint } from './_components';

const SECTIONS = [
  { id: 'vehicules',  label: 'Véhicules' },
  { id: 'mouvements', label: 'Mouvements' },
];

export default function GarageDocsPage() {
  const baseUrl = window.location.origin.replace(/:\d+$/, ':3000');

  return (
    <DocsLayout sections={SECTIONS}>
      <section id="vehicules" className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Véhicules</h2>

        <Endpoint
          method="GET"
          path="/api/garage/vehicles"
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
          method="POST"
          path="/api/garage/vehicles"
          description="Enregistre un nouveau véhicule et rattache rétroactivement les mouvements existants portant le même vehicleId."
          example={`curl -X POST "${baseUrl}/api/garage/vehicles" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{"vehicleId":"VEH-002","plate":"EF-456-GH","displayName":"Fourgon gris"}'`}
          exampleResponse={`{ "id": 2, "vehicleId": "VEH-002", "plate": "EF-456-GH", "displayName": "Fourgon gris", "companyId": 1 }`}
          notes="vehicleId requis. plate et displayName optionnels."
        />

        <Endpoint
          method="PATCH"
          path="/api/garage/vehicles/:id"
          description="Met à jour la plaque et/ou le nom d'affichage d'un véhicule."
          params={[{ name: 'id', type: 'integer', required: true, description: 'ID du véhicule (champ id dans la liste).' }]}
          example={`curl -X PATCH "${baseUrl}/api/garage/vehicles/2" \\\n  -H "x-api-key: votre_cle_api" \\\n  -H "Content-Type: application/json" \\\n  -d '{"plate":"EF-999-GH","displayName":"Fourgon gris (réparé)"}'`}
          exampleResponse={`{ "id": 2, "vehicleId": "VEH-002", "plate": "EF-999-GH", "displayName": "Fourgon gris (réparé)" }`}
          notes="Seuls plate et displayName sont modifiables. vehicleId ne peut pas être changé."
        />

        <Endpoint
          method="DELETE"
          path="/api/garage/vehicles/:id"
          description="Supprime un véhicule enregistré. Les mouvements liés sont conservés mais leur lien vehicleRefId est effacé."
          params={[{ name: 'id', type: 'integer', required: true, description: 'ID du véhicule.' }]}
          example={`curl -X DELETE "${baseUrl}/api/garage/vehicles/2" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{ "success": true, "deleted": { "id": 2, "vehicleId": "VEH-002" } }`}
        />
      </section>

      <section id="mouvements" className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Mouvements</h2>

        <Endpoint
          method="GET"
          path="/api/garage/movements"
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
    </DocsLayout>
  );
}
