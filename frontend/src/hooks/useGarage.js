// /frontend/src/hooks/useGarage.js

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getGarageMovements } from '@/services/garageService';

export function useGarage(companyId) {
    const [filters, setFilters] = useState({
        tags: [],
        users: [],
        vehicles: [],
        types: [],
        dateFrom: null,
        dateTo: null,
        page: 1,
        pageSize: 50,
    });

    const updateFilter = useCallback((key, value) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value,
            page: 1,
        }));
    }, []);

    const addTag = useCallback((tag, key = 'tags') => {
        tag = String(tag).trim();
        if (!tag) return;

        setFilters((prev) => {
            const arr = Array.isArray(prev[key]) ? prev[key] : [];
            if (arr.includes(tag)) return prev;
            return {
                ...prev,
                [key]: [...arr, tag],
                page: 1,
            };
        });
    }, []);

    const removeTag = useCallback((tag, key = 'tags') => {
        setFilters((prev) => {
            const arr = Array.isArray(prev[key]) ? prev[key] : [];
            return {
                ...prev,
                [key]: arr.filter((t) => t !== tag),
                page: 1,
            };
        });
    }, []);

    const resetAllFilters = useCallback(() => {
        setFilters({
            tags: [],
            users: [],
            vehicles: [],
            types: [],
            dateFrom: null,
            dateTo: null,
            page: 1,
            pageSize: 50,
        });
    }, []);

    /* ------------------- QUERY API ------------------- */

    const query = useQuery({
        queryKey: ['garage', companyId, filters],
        enabled: !!companyId,
        queryFn: async () => {
            const params = {};

            if (filters.tags.length) params.tags = filters.tags.join(',');
            if (filters.types.length) params.types = filters.types.join(',');
            if (filters.users.length) params.users = filters.users.join(',');
            if (filters.vehicles.length) params.vehicles = filters.vehicles.join(',');

            if (filters.dateFrom) params.dateFrom = filters.dateFrom;
            if (filters.dateTo) params.dateTo = filters.dateTo;

            params.page = filters.page;
            params.pageSize = filters.pageSize;

            return await getGarageMovements(params);
        },
    });

    return useMemo(() => ({
        filters,
        updateFilter,
        addTag,
        removeTag,
        resetAllFilters,
        query
    }), [filters, updateFilter, addTag, removeTag, resetAllFilters, query]);
}
