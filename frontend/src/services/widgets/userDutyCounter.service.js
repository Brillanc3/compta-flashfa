import api from '@/services/api';

export async function getWidgetData_UserDutyCounter(companyId, config = {}) {
    const response = await api.get('/comptabilite/widgets/user_duty_counter', {
        params: {
            contextId: companyId,
            config: JSON.stringify(config),
        },
    });
    return response.data;
}

export async function getWidgetData_UsersDutyCounter(companyId, config = {}) {
    const response = await api.get('/comptabilite/widgets/users_duty_counter', {
        params: {
            contextId: companyId,
            config: JSON.stringify(config),
        },
    });
    return response.data;
}