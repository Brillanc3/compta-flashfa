import { useEffect, useState, useCallback } from 'react';
import { getRanks, getCompanyEmployees } from '@/services/employeesService';
import { usePresenceStore } from '../store/usePresenceStore';

export function useMentionData(companyId) {
    const [users, setUsers] = useState([]);
    const [ranks, setRanks] = useState([]);
    const presences = usePresenceStore(s => s.presences);

    const load = useCallback(async () => {
        if (!companyId) return;
        try {
            const [emps, rnks] = await Promise.all([
                getCompanyEmployees(companyId),
                getRanks(companyId),
            ]);
            const list = Array.isArray(emps) ? emps : (emps?.employees ?? []);
            setUsers(list.map(e => ({
                id: e.userId ?? e.id,
                name: e.user?.name ?? e.fullName ?? e.characterName ?? e.username ?? `Utilisateur ${e.userId ?? e.id}`,
            })));
            setRanks(Array.isArray(rnks) ? rnks.map(r => ({ id: r.id, name: r.name })) : []);
        } catch { /* empty */ }
    }, [companyId]);

    useEffect(() => { load(); }, [load]);

    const usersWithStatus = users.map(u => ({
        ...u,
        status: presences[u.id]?.status ?? 'OFFLINE',
    }));

    return { users: usersWithStatus, ranks, reload: load };
}
