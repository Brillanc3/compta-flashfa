import api from '@/services/api';

export async function getWidgetData_PawnshopEmployeeRanking(companyId, config = {}) {
    const response = await api.get('/pawnshop/widgets/pawnshop_employee_ranking', {
        params: {
            contextId: companyId,
            config: JSON.stringify(config),
        },
    });
    return response.data;
}
