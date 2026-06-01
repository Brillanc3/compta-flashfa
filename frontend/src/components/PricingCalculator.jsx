// frontend/src/components/PricingCalculator.jsx

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// --- Données et Règles métier ---
const PRICING_DATA = {
    // MODIFIÉ : Le secteur 4 est maintenant un prix fixe.
    sud: { 1: 16000, 2: 16000, 3: 14000, 4: 14000 },
    nord: { 1: 16000, 2: 16000, 3: 12000, 4: 14000 },
    association: 4000,
};
const DISCOUNT_RATES = { creation: 0.18, reprise: 0.15 };
const MIN_PRICE_AFTER_DISCOUNT = 4000;

const PricingCalculator = () => {
    // --- États pour les choix de l'utilisateur ---
    const [businessType, setBusinessType] = useState(null);
    const [dealType, setDealType] = useState(null);
    const [location, setLocation] = useState(null);
    const [sector, setSector] = useState(null);

    // --- États pour les prix calculés ---
    const [basePrice, setBasePrice] = useState(null);
    const [discountedPrice, setDiscountedPrice] = useState(null);
    const [showDiscountText, setShowDiscountText] = useState(false);

    // --- Logique de calcul qui se déclenche à chaque changement ---
    useEffect(() => {
        let currentPrice = null;

        if (businessType === 'association') {
            currentPrice = PRICING_DATA.association;
        } else if (businessType === 'entreprise' && location && sector) {
            currentPrice = PRICING_DATA[location][sector];
        }

        setBasePrice(currentPrice);

        if (typeof currentPrice === 'number') {
            const discountRate = DISCOUNT_RATES[dealType];
            const isDiscountApplicable = businessType === 'entreprise' && dealType;

            if (isDiscountApplicable) {
                const finalPrice = currentPrice * (1 - discountRate);

                if (finalPrice >= MIN_PRICE_AFTER_DISCOUNT) {
                    setDiscountedPrice(finalPrice);
                    setShowDiscountText(true);
                } else {
                    setDiscountedPrice(null);
                    setShowDiscountText(false);
                }
            } else {
                setDiscountedPrice(null);
                setShowDiscountText(false);
            }
        } else {
            setDiscountedPrice(null);
            setShowDiscountText(false);
        }

    }, [businessType, dealType, location, sector]);

    const formatPrice = (p) => p?.toLocaleString('fr-FR');

    const resetSelections = (type) => {
        setBusinessType(type);
        setDealType(null);
        setLocation(null);
        setSector(null);
    };

    const getBtnClass = (active) => 
        `w-full p-4 rounded-xl text-center font-bold transition-all border ${
            active 
            ? 'bg-neo-blue border-neo-blue text-white shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] scale-105' 
            : 'bg-white/5 border-white/10 hover:bg-white/10 text-neo-slate'
        }`;

    return (
        <div className="bg-neo-black text-white py-24 px-4 font-outfit" id="pricing">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h2 className="text-3xl sm:text-5xl font-black text-neo-white mb-4 tracking-tight">Une tarification <span className="text-neo-blue text-glow-blue">claire.</span></h2>
                    <p className="text-neo-slate max-w-lg mx-auto text-lg">Suivez les étapes pour obtenir votre tarif hebdomadaire estimé en quelques clics.</p>
                </div>

                <div className="glass-morphism rounded-[32px] p-8 md:p-12 border-neo-white-10 relative overflow-hidden">
                    {/* Background glow */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-neo-blue/10 rounded-full blur-3xl pointer-events-none"></div>
                    
                    {/* Étape 1: Catégorie */}
                    <div className="mb-12 relative z-10">
                        <h3 className="text-lg font-bold mb-6 text-center text-white uppercase tracking-widest text-xs">1. Votre projet est :</h3>
                        <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                            <button onClick={() => resetSelections('entreprise')} className={getBtnClass(businessType === 'entreprise')}>Une entreprise</button>
                            <button onClick={() => resetSelections('association')} className={getBtnClass(businessType === 'association')}>Une association</button>
                        </div>
                    </div>

                    {/* Étapes pour les entreprises (conditionnel) */}
                    {businessType === 'entreprise' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <div className="mb-12">
                                <h3 className="text-lg font-bold mb-6 text-center text-white uppercase tracking-widest text-xs">2. Est-ce une création ou une reprise ?</h3>
                                <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                                    <button onClick={() => setDealType('creation')} className={getBtnClass(dealType === 'creation')}>Création</button>
                                    <button onClick={() => setDealType('reprise')} className={getBtnClass(dealType === 'reprise')}>Reprise</button>
                                </div>
                            </div>

                            {dealType && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
                                    <h3 className="text-lg font-bold mb-6 text-center text-white uppercase tracking-widest text-xs">3. Où se situe votre entreprise ?</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
                                        <button onClick={() => setLocation('sud')} className={getBtnClass(location === 'sud')}>Sud</button>
                                        <button onClick={() => setLocation('nord')} className={getBtnClass(location === 'nord')}>Nord</button>
                                    </div>
                                </motion.div>
                            )}

                            {location && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
                                    <h3 className="text-lg font-bold mb-6 text-center text-white uppercase tracking-widest text-xs">4. Quel est votre secteur d'activité ?</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-lg mx-auto">
                                        {[1, 2, 3, 4].map((s) => (
                                            <button key={s} onClick={() => setSector(s)} className={getBtnClass(sector === s)}>{`Secteur ${s}`}</button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    )}

                    {/* Affichage du résultat final */}
                    {basePrice && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center bg-neo-blue/10 rounded-2xl p-8 mt-8 max-w-2xl mx-auto border border-neo-blue/20"
                        >
                            <p className="text-neo-slate mb-2 uppercase tracking-widest text-xs font-bold">Estimation hebdomadaire</p>
                            <div className="flex items-center justify-center gap-4">
                                {discountedPrice && (
                                    <del className="text-2xl font-bold text-neo-slate/50">
                                        ${formatPrice(basePrice)}.00
                                    </del>
                                )}
                                <p className="text-5xl sm:text-6xl font-black text-white text-glow-blue">
                                    ${formatPrice(discountedPrice || basePrice)}.00
                                </p>
                            </div>
                            {showDiscountText && (
                                <p className="text-sm text-emerald-400 mt-4 font-bold uppercase tracking-wider">
                                    Remise {dealType === 'creation' ? 'Création (18%)' : 'Reprise (15%)'} incluse.
                                </p>
                            )}
                            {businessType === 'association' && (
                                <p className="text-sm text-neo-slate mt-4 italic">
                                    Tarif forfaitaire pour les associations.
                                </p>
                            )}
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PricingCalculator;