// frontend/src/services/employeesHrService.js

import apiClient from './api';

function headers(companyId) {
    return companyId ? { 'x-company-id': String(companyId) } : {};
}

export const listHREvents = async (companyId, employeeId) => {
    const { data } = await apiClient.get(
        `/employees-hr/employee/${employeeId}/events`,
        { headers: headers(companyId) }
    );
    return data;
};

export const listPrimesForWeek = async (companyId, employeeId, isoWeek, isoYear) => {
    const { data } = await apiClient.get(
        `/employees-hr/employee/${employeeId}/primes`,
        { headers: headers(companyId), params: { isoWeek, isoYear } }
    );
    return data;
};

export const createHREvent = async (companyId, employeeId, payload) => {
    const { data } = await apiClient.post(
        `/employees-hr/employee/${employeeId}/events`,
        payload,
        { headers: headers(companyId) }
    );
    return data;
};

export const updateHREvent = async (companyId, employeeId, eventId, payload) => {
    const { data } = await apiClient.patch(
        `/employees-hr/employee/${employeeId}/events/${eventId}`,
        payload,
        { headers: headers(companyId) }
    );
    return data;
};

export const deleteHREvent = async (companyId, employeeId, eventId) => {
    await apiClient.delete(
        `/employees-hr/employee/${employeeId}/events/${eventId}`,
        { headers: headers(companyId) }
    );
};

export const uploadHRAttachment = async (companyId, employeeId, eventId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post(
        `/employees-hr/employee/${employeeId}/events/${eventId}/attachments`,
        formData,
        { headers: { ...headers(companyId), 'Content-Type': 'multipart/form-data' } }
    );
    return data;
};

export const getAttachmentUrl = (publicId) =>
    `${apiClient.defaults.baseURL}/employees-hr/attachments/${publicId}`;
