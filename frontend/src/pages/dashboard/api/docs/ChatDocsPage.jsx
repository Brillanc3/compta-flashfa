import { DocsLayout } from './_layout';
import { Endpoint } from './_components';

export default function ChatDocsPage() {
  const baseUrl = window.location.origin.replace(/:\d+$/, ':3000');

  return (
    <DocsLayout>
      <section className="space-y-4 scroll-mt-6">
        <h2 className="text-lg font-semibold text-cca-textPrimary border-b border-cca-border pb-2">Chat</h2>

        <Endpoint
          method="GET"
          path="/api/chat/channels"
          description="Liste des salons accessibles pour l'entreprise."
          example={`curl "${baseUrl}/api/chat/channels" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`[{ "id": 1, "name": "général", "type": "TEXT", "categoryId": 1 }]`}
          notes="Requiert un contexte utilisateur valide. Une clé API sans user associé peut retourner 500. Utiliser avec une session authentifiée."
        />

        <Endpoint
          method="GET"
          path="/api/chat/channels/:channelId/messages"
          description="Messages d'un salon, du plus récent au plus ancien."
          params={[{ name: 'channelId', type: 'integer', required: true, description: 'ID du salon.' }]}
          queryParams={[
            { name: 'limit',  type: 'integer', required: false, description: 'Nombre de messages. Défaut : 50.' },
            { name: 'before', type: 'integer', required: false, description: 'ID message — messages antérieurs.' },
            { name: 'after',  type: 'integer', required: false, description: 'ID message — messages postérieurs.' },
          ]}
          example={`curl "${baseUrl}/api/chat/channels/1/messages?limit=20" \\\n  -H "x-api-key: votre_cle_api"`}
          exampleResponse={`[{ "id": 500, "content": "Bonjour tout le monde", "createdAt": "2026-05-15T10:00:00.000Z", "author": { "id": 42, "name": "Alice Martin" } }]`}
          notes="Requiert la permission VIEW_CHANNEL sur le salon. L'accès dépend des permissions Discord-like du contexte utilisateur — 403 si absent."
        />
      </section>
    </DocsLayout>
  );
}
