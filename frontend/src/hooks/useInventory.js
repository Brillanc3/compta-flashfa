// /frontend/src/hooks/useInventory.js

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInventory } from '@/services/inventoryService';

export function useInventory(companyId) {
    /* ------------------------------------------------------------
       STATE INITIAL — Tous les filtres doivent être présents ici
    ------------------------------------------------------------- */
    const [filters, setFilters] = useState({
        tags: [],
        coffre: [],    // 🔹 recherche par owner
        users: [],
        items: [],
        types: [],
        dateFrom: null,
        dateTo: null,
        page: 1,
        pageSize: 50,
    });

    /* ------------------------------------------------------------
       Ajout d'un tag (par défaut sur "tags", mais réutilisable)
    ------------------------------------------------------------- */
    const addTag = useCallback((tag, key = 'tags') => {
        tag = String(tag).trim();
        if (!tag) return;

        setFilters((prev) => {
            const current = Array.isArray(prev[key]) ? prev[key] : [];
            if (current.includes(tag)) return prev;

            return {
                ...prev,
                [key]: [...current, tag],
                page: 1,
            };
        });
    }, []);

    /* ------------------------------------------------------------
       Suppression d'un tag
    ------------------------------------------------------------- */
    const removeTag = useCallback((tag, key = 'tags') => {
        setFilters((prev) => {
            const current = Array.isArray(prev[key]) ? prev[key] : [];
            return {
                ...prev,
                [key]: current.filter((t) => t !== tag),
            };
        });
    }, []);

    /* ------------------------------------------------------------
       Mise à jour générique d'un filtre (select, dates, etc.)
    ------------------------------------------------------------- */
    const updateFilter = useCallback((key, value) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value,
        }));
    }, []);

    /* ------------------------------------------------------------
       Réinitialiser tous les filtres
    ------------------------------------------------------------- */
    const resetAllFilters = useCallback(() => {
        setFilters({
            tags: [],
            coffre: [],
            users: [],
            items: [],
            types: [],
            dateFrom: null,
            dateTo: null,
            page: 1,
            pageSize: 50,
        });
    }, []);

    /* ------------------------------------------------------------
       Requête vers l'API d'inventaire
    ------------------------------------------------------------- */
    const query = useQuery({
        queryKey: ['inventory', companyId, filters],
        enabled: !!companyId,
        queryFn: async () => {
            const params = {};

            if (filters.tags.length) params.tags = filters.tags.join(',');
            if (filters.types.length) params.types = filters.types.join(',');
            if (filters.items.length) params.items = filters.items.join(',');
            if (filters.users.length) params.users = filters.users.join(',');
            if (filters.coffre.length) params.coffre = filters.coffre.join(',');

            if (filters.dateFrom) params.dateFrom = filters.dateFrom;
            if (filters.dateTo) params.dateTo = filters.dateTo;

            params.page = filters.page;
            params.pageSize = filters.pageSize;

            return await getInventory(companyId, params);
        },
    });

    return {
        filters,
        addTag,
        removeTag,
        updateFilter,
        resetAllFilters,
        query,
    };
}
