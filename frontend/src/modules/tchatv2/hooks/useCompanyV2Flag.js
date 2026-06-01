import { useEffect, useState } from 'react';
import apiClient from '@/services/api';

/**
 * Lit le flag useTchatV2 pour une company depuis l'API.
 * @param {number|string|null} companyId
 * @returns {{ isV2: boolean, loading: boolean }}
 */
export function useCompanyV2Flag(companyId) {
    const [isV2,   setIsV2]   = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!companyId) { setLoading(false); return; }
        let cancelled = false;

        apiClient.get(`/tchatv2/admin/companies/${companyId}/tchatv2-migrate`)
            .then(res => { if (!cancelled) setIsV2(!!res.data?.useTchatV2); })
            .catch(() => { if (!cancelled) setIsV2(false); })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [companyId]);

    return { isV2, loading };
}
