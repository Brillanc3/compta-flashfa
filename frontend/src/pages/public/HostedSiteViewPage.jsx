import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicPage } from '@/services/hostingService';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSrcdoc(page, assets) {
  const cssBlocks = assets
    .filter((a) => a.kind === 'CSS')
    .map((a) => `<style data-file="${a.filename}">\n${a.content}\n</style>`)
    .join('\n');

  const jsBlocks = assets
    .filter((a) => a.kind === 'JS')
    .map((a) => `<script data-file="${a.filename}">\n${a.content}\n</script>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(page.title)}</title>
${cssBlocks}
</head>
<body>
${page.htmlContent}
${jsBlocks}
</body>
</html>`;
}

export default function HostedSiteViewPage() {
  const { slug } = useParams();
  const wildcard = useParams()['*'] || '';
  const route = wildcard.replace(/^\/+/, '');

  const [srcdoc, setSrcdoc] = useState(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getPublicPage(slug, route)
      .then(({ page, assets }) => {
        setTitle(page.title);
        setSrcdoc(buildSrcdoc(page, assets));
      })
      .catch((e) => {
        const msg = e?.response?.data?.message || e.message || 'Erreur';
        setError(e?.response?.status === 404 ? 'Page introuvable' : msg);
      })
      .finally(() => setLoading(false));
  }, [slug, route]);

  useEffect(() => {
    if (title) document.title = title;
  }, [title]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        Chargement...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: '#374151' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>404</h1>
        <p style={{ color: '#6b7280' }}>{error}</p>
      </div>
    );
  }

  return (
    <iframe
      title={title}
      srcDoc={srcdoc}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
    />
  );
}
