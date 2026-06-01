// /frontend/src/components/chat/RdvInputForm.jsx
import React, { useState, useEffect } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { fr } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import { X, Send } from 'lucide-react';

registerLocale('fr', fr);

const RdvInputForm = ({ parameters, onSubmit, onCancel }) => {
    const initialFormState = parameters.reduce((acc, param) => {
        acc[param.name] = param.default || (param.type === 'datetime' ? null : '');
        return acc;
    }, {});
    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        setFormData(initialFormState);
        setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parameters]);

    const validateForm = () => {
        const newErrors = {};
        let isValid = true;
        parameters.forEach(param => {
            if (param.required && !formData[param.name]) {
                newErrors[param.name] = `${param.label} est requis.`;
                isValid = false;
            }
        });
        if (formData.startTime && formData.endTime && formData.endTime <= formData.startTime) {
            newErrors.endTime = 'L\'heure de fin doit être après l\'heure de début.';
            isValid = false;
        }
        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // LOG AJOUTÉ ICI pour confirmer que preventDefault est appelé
        console.log("RdvInputForm: handleSubmit called, preventDefault executed.");
        if (validateForm()) {
            const argsToSend = { ...formData };
            if (argsToSend.startTime) argsToSend.startTime = argsToSend.startTime.toISOString();
            if (argsToSend.endTime) argsToSend.endTime = argsToSend.endTime.toISOString();
            console.log("RdvInputForm: Calling onSubmit with:", argsToSend); // Log des données envoyées
            onSubmit(argsToSend);
        } else {
            console.log("RdvInputForm: Validation failed.", errors); // Log si validation échoue
        }
    };

    const handleDateChange = (date, fieldName) => {
        setFormData(prev => ({ ...prev, [fieldName]: date }));
        if (errors[fieldName]) { setErrors(prev => ({...prev, [fieldName]: null})); }
        if (fieldName === 'startTime' && errors.endTime && formData.endTime && date < formData.endTime) { setErrors(prev => ({...prev, endTime: null})); }
        if (fieldName === 'endTime' && errors.endTime && formData.startTime && date > formData.startTime) { setErrors(prev => ({...prev, endTime: null})); }
    };

    const handleInputChange = (e, fieldName) => {
        setFormData(prev => ({ ...prev, [fieldName]: e.target.value }));
        if (errors[fieldName]) { setErrors(prev => ({...prev, [fieldName]: null})); }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-4 z-20 space-y-3 animate-slideUp"
        >
            <style>{`.animate-slideUp { animation: slideUp 0.2s ease-out forwards; } @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold text-indigo-300">Proposer un rendez-vous (/rdv)</h4>
                <button type="button" onClick={onCancel} className="p-1 rounded-full hover:bg-slate-700 text-slate-400"> <X size={16} /> </button>
            </div>

            {parameters.map(param => (
                <div key={param.name}>
                    <label htmlFor={`rdv-${param.name}`} className="block text-xs font-medium text-slate-400 mb-1">
                        {param.label} {param.required && <span className="text-red-400">*</span>}
                    </label>
                    {param.type === 'datetime' ? (
                        <DatePicker
                            id={`rdv-${param.name}`}
                            selected={formData[param.name]}
                            onChange={(date) => handleDateChange(date, param.name)}
                            showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="dd/MM/yyyy HH:mm"
                            locale="fr" placeholderText="Sélectionner date et heure"
                            className={`w-full bg-slate-700 border ${errors[param.name] ? 'border-red-500' : 'border-slate-600'} rounded-md p-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none`}
                            required={param.required} autoComplete="off"
                        />
                    ) : (
                        <input
                            type="text" id={`rdv-${param.name}`} value={formData[param.name]}
                            onChange={(e) => handleInputChange(e, param.name)} placeholder={param.default || ''}
                            className={`w-full bg-slate-700 border ${errors[param.name] ? 'border-red-500' : 'border-slate-600'} rounded-md p-2 text-white text-sm focus:ring-1 focus:ring-indigo-500 outline-none`}
                            required={param.required} autoComplete="off"
                        />
                    )}
                    {errors[param.name] && <p className="text-red-400 text-xs mt-1">{errors[param.name]}</p>}
                </div>
            ))}

            <div className="flex justify-end pt-2">
                <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md flex items-center gap-2"
                >
                    <Send size={14}/> Proposer
                </button>
            </div>
        </form>
    );
};

export default RdvInputForm;