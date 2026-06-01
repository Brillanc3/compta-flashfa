import React from 'react';
import { TrendingUp, BarChart, PieChart, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

const DashboardShowcase = () => {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900/50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
        {/* Left: Text Content */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="flex-1"
        >
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-6 leading-tight">
            Analyse prédictive.<br />
            <span className="text-blue-500">Ne devinez plus, sachez.</span>
          </h2>
          <p className="text-lg text-slate-400 mb-8 leading-relaxed">
            Clarity V4 ne se contente pas d'enregistrer vos chiffres. Notre moteur d'analyse identifie les tendances, anticipe vos flux de trésorerie et vous alerte sur les opportunités d'optimisation.
          </p>
          
          <ul className="space-y-4">
            {[
              { icon: TrendingUp, text: "Prévisions de trésorerie à 30, 60 et 90 jours" },
              { icon: Activity, text: "Alertes automatiques sur les seuils critiques" },
              { icon: BarChart, text: "Comparaison sectorielle en temps réel" }
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-slate-200">
                <div className="text-blue-500"><item.icon size={20} /></div>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Right: Visual Showcase */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="flex-1 relative"
        >
          <div className="glass-card p-1">
             <div className="bg-slate-950 rounded-xl p-6 border border-white/5">
                <div className="flex justify-between items-center mb-8">
                  <h4 className="font-bold text-white">Flux de Trésorerie</h4>
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                  </div>
                </div>
                
                {/* Simplified Chart Graphic */}
                <div className="h-48 w-full flex items-end gap-2 mb-4">
                  {[40, 60, 45, 70, 85, 65, 90].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                      className="flex-1 bg-gradient-to-t from-blue-600/20 to-blue-500 rounded-t-sm"
                    />
                  ))}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-white/5">
                    <p className="text-xs text-slate-500 mb-1">Prévision Mois Prochain</p>
                    <p className="text-xl font-bold text-green-400">+12.4%</p>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-white/5">
                    <p className="text-xs text-slate-500 mb-1">Score de Santé</p>
                    <p className="text-xl font-bold text-blue-400">94/100</p>
                  </div>
                </div>
             </div>
          </div>
          
          {/* Decorative blur */}
          <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl"></div>
        </motion.div>
      </div>
    </section>
  );
};

export default DashboardShowcase;
