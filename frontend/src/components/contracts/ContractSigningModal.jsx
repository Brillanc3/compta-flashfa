import React from 'react';
import PropTypes from 'prop-types';
import ContractViewerModal from '@/components/contracts/ContractViewerModal.jsx';

export const ContractSigningModal = ({ isOpen, onClose, contractId }) => {
    return (
        <ContractViewerModal
            isOpen={isOpen}
            onClose={() => onClose?.(false)}
            contractId={contractId}
            titleOverride="Signature du contrat"
        />
    );
};

ContractSigningModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    contractId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

export default ContractSigningModal;
