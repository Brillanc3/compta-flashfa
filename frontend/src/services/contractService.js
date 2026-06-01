// frontend/src/services/contractService.js
import apiClient from "./api";
import axios from "axios";

const publicApiClient = axios.create({
    baseURL: "/api",
    withCredentials: true,
});

const authNoCompanyApiClient = axios.create({
    baseURL: "/api",
    withCredentials: true,
});

authNoCompanyApiClient.interceptors.request.use(
    (config) => {
        config.headers = config.headers || {};

        const authHeader = apiClient.defaults?.headers?.common?.Authorization;
        if (authHeader) {
            config.headers.Authorization = authHeader;
        } else {
            delete config.headers.Authorization;
        }

        delete config.headers["x-company-id"];
        return config;
    },
    (error) => Promise.reject(error)
);

function getPrivateContractShareClient(options = {}) {
    return options?.companyScoped === false
        ? authNoCompanyApiClient
        : apiClient;
}

const CONTRACT_SIGNATURE_ROLE_ORDER = {
    SENDER: 0,
    RECIPIENT: 1,
};

function parseFieldValues(fieldValues) {
    if (!fieldValues) return {};

    if (typeof fieldValues === "string") {
        try {
            const parsed = JSON.parse(fieldValues);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }

    return typeof fieldValues === "object" && !Array.isArray(fieldValues) ? fieldValues : {};
}

function normalizeSignature(signature) {
    if (!signature || typeof signature !== "object") return null;

    return {
        ...signature,
        signerUser: signature.signerUser || null,
        signatureVersion: signature.signatureVersion || null,
        signatureSvgSnapshot: signature.signatureSvgSnapshot || null,
    };
}

function sortSignatures(signatures) {
    return [...(Array.isArray(signatures) ? signatures : [])]
        .map(normalizeSignature)
        .filter(Boolean)
        .sort((left, right) => {
            const leftOrder = CONTRACT_SIGNATURE_ROLE_ORDER[left?.role] ?? 99;
            const rightOrder = CONTRACT_SIGNATURE_ROLE_ORDER[right?.role] ?? 99;

            if (leftOrder !== rightOrder) {
                return leftOrder - rightOrder;
            }

            const leftTime = left?.signedAt ? new Date(left.signedAt).getTime() : 0;
            const rightTime = right?.signedAt ? new Date(right.signedAt).getTime() : 0;
            return leftTime - rightTime;
        });
}

function buildSigningProgress(senderSignature, recipientSignature, providedProgress = null) {
    if (providedProgress && typeof providedProgress === "object") {
        return {
            totalRequired: providedProgress.totalRequired ?? 2,
            completedCount: providedProgress.completedCount ?? (Number(Boolean(senderSignature)) + Number(Boolean(recipientSignature))),
            remainingCount: providedProgress.remainingCount ?? Math.max(0, 2 - (providedProgress.completedCount ?? (Number(Boolean(senderSignature)) + Number(Boolean(recipientSignature))))),
            isSenderSigned: providedProgress.isSenderSigned ?? Boolean(senderSignature),
            isRecipientSigned: providedProgress.isRecipientSigned ?? Boolean(recipientSignature),
            isFullySigned: providedProgress.isFullySigned ?? Boolean(senderSignature && recipientSignature),
        };
    }

    const completedCount = Number(Boolean(senderSignature)) + Number(Boolean(recipientSignature));

    return {
        totalRequired: 2,
        completedCount,
        remainingCount: Math.max(0, 2 - completedCount),
        isSenderSigned: Boolean(senderSignature),
        isRecipientSigned: Boolean(recipientSignature),
        isFullySigned: Boolean(senderSignature && recipientSignature),
    };
}

function normalizeAssignedContract(contract) {
    if (!contract || typeof contract !== "object") return contract;

    const signatures = sortSignatures(contract.signatures);
    const senderSignature = normalizeSignature(contract.senderSignature)
        || signatures.find((item) => item?.role === "SENDER")
        || null;
    const recipientSignature = normalizeSignature(contract.recipientSignature)
        || signatures.find((item) => item?.role === "RECIPIENT")
        || null;

    const currentUserRoles = Array.isArray(contract.currentUserRoles)
        ? contract.currentUserRoles.filter(Boolean)
        : contract.currentUserRole
            ? [contract.currentUserRole]
            : [];

    const signingProgress = buildSigningProgress(
        senderSignature,
        recipientSignature,
        contract.signingProgress
    );

    const title = contract.snapshotTitle || contract.title || contract.template?.title || "Contrat sans titre";
    const markdown = contract.snapshotMarkdown
        || contract.markdown
        || contract.template?.markdown
        || contract.template?.content
        || "";

    const signedRoles = new Set(signatures.map((item) => item?.role).filter(Boolean));
    const canCurrentUserSign = typeof contract.canCurrentUserSign === "boolean"
        ? contract.canCurrentUserSign
        : contract.status === "PENDING"
        && currentUserRoles.some((role) => !signedRoles.has(role));

    return {
        ...contract,
        title,
        markdown,
        fieldValues: parseFieldValues(contract.fieldValues),
        signatures,
        senderSignature,
        recipientSignature,
        signature: contract.signature || recipientSignature || senderSignature || null,
        signingProgress,
        currentUserRoles,
        currentUserRole: contract.currentUserRole || currentUserRoles[0] || null,
        canCurrentUserSign,
        template: contract.template
            ? {
                ...contract.template,
                title: contract.template.title || title,
                markdown: contract.template.markdown || markdown,
                content: contract.template.content || markdown,
            }
            : contract.template,
    };
}

function normalizeContractCollection(contracts) {
    return Array.isArray(contracts) ? contracts.map(normalizeAssignedContract) : contracts;
}

function normalizeContractSharePayload(payload) {
    if (!payload || typeof payload !== "object") return payload;

    const normalized = { ...payload };

    if (Array.isArray(payload.contracts)) {
        normalized.contracts = normalizeContractCollection(payload.contracts);
    }

    if (Array.isArray(payload.assignedContracts)) {
        normalized.assignedContracts = normalizeContractCollection(payload.assignedContracts);
    }

    if (Array.isArray(payload.items)) {
        normalized.items = payload.items.map((item) => {
            if (!item || typeof item !== "object") return item;

            const nextItem = { ...item };
            if (Array.isArray(item.contracts)) {
                nextItem.contracts = normalizeContractCollection(item.contracts);
            }
            if (Array.isArray(item.assignedContracts)) {
                nextItem.assignedContracts = normalizeContractCollection(item.assignedContracts);
            }
            return nextItem;
        });
    }

    return normalized;
}

/* ============================================================================
   TEMPLATES
============================================================================ */

export const getContractTemplates = async () => {
    try {
        const { data } = await apiClient.get("/contracts/templates");
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const getContractTemplateById = async (templateId) => {
    try {
        const { data } = await apiClient.get(`/contracts/templates/${templateId}`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const createContractTemplate = async (templateData) => {
    try {
        const { data } = await apiClient.post("/contracts/templates", templateData);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * ✅ NOUVEAU — mise à jour d’un template existant
 */
export const updateContractTemplate = async (templateId, templateData) => {
    try {
        const { data } = await apiClient.put(
            `/contracts/templates/${templateId}`,
            templateData
        );
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Articles
 */
export const updateTemplateArticles = async (templateId, articles) => {
    try {
        const { data } = await apiClient.put(
            `/contracts/templates/${templateId}/articles`,
            { articles }
        );
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/* ============================================================================
   TEMPLATE FIELDS
============================================================================ */

export const createTemplateField = async (templateId, { label, fieldType }) => {
    try {
        const { data } = await apiClient.post(
            `/contracts/templates/${templateId}/fields`,
            { label, fieldType }
        );
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const updateTemplateField = async (templateId, fieldId, payload) => {
    try {
        const { data } = await apiClient.patch(
            `/contracts/templates/${templateId}/fields/${fieldId}`,
            payload
        );
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const deleteTemplateField = async (templateId, fieldId) => {
    try {
        const { data } = await apiClient.delete(
            `/contracts/templates/${templateId}/fields/${fieldId}`
        );
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/* ============================================================================
   ASSIGNATION & CONTRATS
============================================================================ */

export const assignContract = async (assignmentData) => {
    try {
        const { data } = await apiClient.post("/contracts/assign", assignmentData);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const rejectContract = async (assignedContractId, rejectionData) => {
    try {
        const { data } = await authNoCompanyApiClient.post(
            `/contracts/assigned/${assignedContractId}/reject`,
            rejectionData
        );
        return normalizeAssignedContract(data);
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const getAssignedContractById = async (assignedContractId) => {
    try {
        const { data } = await apiClient.get(`/contracts/assigned/${assignedContractId}`);
        return normalizeAssignedContract(data);
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const signContract = async (assignedContractId, signatureData) => {
    try {
        const { data } = await authNoCompanyApiClient.post(
            `/contracts/assigned/${assignedContractId}/sign`,
            signatureData
        );
        return normalizeAssignedContract(data);
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const getMyAssignedContracts = async () => {
    try {
        const { data } = await apiClient.get("/contracts/assigned/me");
        return normalizeContractCollection(data);
    } catch (error) {
        throw error.response?.data || error;
    }
};


export const createContractShare = async ({ assignedContractIds, password }, options = {}) => {
    try {
        const client = getPrivateContractShareClient(options);

        const payload = {
            assignedContractIds: Array.isArray(assignedContractIds) ? assignedContractIds : [],
        };

        if (typeof password === "string" && password.trim()) {
            payload.password = password.trim();
        }

        const { data } = await client.post("/contracts/shares", payload);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const getContractShareById = async (shareId, options = {}) => {
    try {
        const client = getPrivateContractShareClient(options);
        const { data } = await client.get(`/contracts/shares/${shareId}`);
        return normalizeContractSharePayload(data);
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const regenerateContractShare = async (shareId, options = {}) => {
    try {
        const client = getPrivateContractShareClient(options);
        const { data } = await client.post(`/contracts/shares/${shareId}/regenerate`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const revokeContractShare = async (shareId, options = {}) => {
    try {
        const client = getPrivateContractShareClient(options);
        const { data } = await client.post(`/contracts/shares/${shareId}/revoke`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};


export const listContractShares = async (params = {}, options = {}) => {
    try {
        const client = getPrivateContractShareClient(options);
        const { data } = await client.get("/contracts/shares", { params });
        return normalizeContractSharePayload(data);
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const updateContractSharePassword = async (shareId, { password }, options = {}) => {
    try {
        const client = getPrivateContractShareClient(options);
        const { data } = await client.put(`/contracts/shares/${shareId}/password`, { password });
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const activateContractShare = async (shareId, options = {}) => {
    try {
        const client = getPrivateContractShareClient(options);
        const { data } = await client.post(`/contracts/shares/${shareId}/activate`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const deleteContractShare = async (shareId, options = {}) => {
    try {
        const client = getPrivateContractShareClient(options);
        const { data } = await client.delete(`/contracts/shares/${shareId}`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const getPublicContractShareMeta = async (publicId) => {
    try {
        const { data } = await publicApiClient.get(`/contracts/public/${publicId}/meta`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const accessPublicContractShare = async ({ publicId, password }) => {
    try {
        const payload = {};
        if (typeof password === "string") {
            payload.password = password;
        }

        const { data } = await publicApiClient.post(
            `/contracts/public/${publicId}/access`,
            payload
        );

        return normalizeContractSharePayload(data);
    } catch (error) {
        throw error.response?.data || error;
    }
};
