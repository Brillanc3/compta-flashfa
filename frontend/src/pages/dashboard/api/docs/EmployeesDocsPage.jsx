import { useCompany } from '@/contexts/CompanyContext';
import { DocsLayout } from './_layout';
import { Endpoint } from './_components';

export default function EmployeesDocsPage() {
  const { activeCompanyId } = useCompany();
  const companyId = activeCompanyId ?? '<companyId>';
  const baseUrl = window.location.origin.replace(/:\d+$/, ':3000');

  return (
    <DocsLayout>
      <section className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Employees</h2>

        <Endpoint
          method="GET"
          path="/api/employees"
          description="Retourne la liste des employés actifs (et récemment partis) de l'entreprise liée à la clé, triés par nom."
          queryParams={[
            { name: 'year',   type: 'integer', required: false, description: 'Année ISO. Défaut : année en cours.' },
            { name: 'week',   type: 'integer', required: false, description: 'Semaine ISO. Défaut : semaine en cours.' },
            { name: 'fields', type: 'string',  required: false, description: 'Champs additionnels séparés par virgule (ex: salary,billCount).' },
          ]}
          example={`curl "${baseUrl}/api/employees" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`[
  {
    "id": 1,
    "userId": 42,
    "companyId": ${companyId},
    "rankId": 3,
    "status": "ACTIVE",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "statusUpdatedAt": null,
    "user": { "id": 42, "name": "Alice Martin", "status": "ACTIVE" },
    "rank": { "id": 3, "name": "Manager", "position": 2, "salaryCap": null }
  }
]`}
        />

        <Endpoint
          method="GET"
          path="/api/employees/employee/:employeeId"
          description="Profil complet d'un employé : informations utilisateur, rang actuel, 5 dernières factures, et historique des rangs paginé."
          params={[
            { name: 'employeeId', type: 'integer', required: true, description: "Identifiant de l'employé (champ id dans la liste)." },
          ]}
          queryParams={[
            { name: 'page',  type: 'integer', required: false, description: "Page de l'historique des rangs. Défaut : 1." },
            { name: 'limit', type: 'integer', required: false, description: 'Entrées par page. Défaut : 5.' },
          ]}
          example={`curl "${baseUrl}/api/employees/employee/1" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`{
  "id": 1,
  "userId": 42,
  "status": "ACTIVE",
  "user": {
    "id": 42,
    "name": "Alice Martin",
    "username": "alice.martin",
    "phoneNumber": "555-5555",
    "iban": "XXXXXX",
    "imageUrl": null,
    "status": "ACTIVE"
  },
  "rank": { "id": 3, "name": "Manager", "position": 2 },
  "bills": [
    { "id": 101, "date": "2026-05-10T09:30:00.000Z", "total": 250.00 }
  ],
  "rankHistory": {
    "data": [
      { "id": 5, "rankName": "Manager", "assignedAt": "2026-03-01T00:00:00.000Z", "leaveAt": null }
    ],
    "pagination": { "totalCount": 2, "currentPage": 1, "totalPages": 1 }
  }
}`}
          notes="L'employé doit appartenir à l'entreprise de la clé. Hors périmètre → 404."
        />
      </section>
    </DocsLayout>
  );
}
