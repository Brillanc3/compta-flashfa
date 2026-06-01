import React from 'react';
import { Shield, Zap, Globe, Bell } from 'lucide-react';

const BentoGrid = () => {
  return (
    <section id="features" className="py-24 px-4 bg-neo-black overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-neo-blue font-black uppercase tracking-widest text-sm mb-4">Bénéfices</h2>
          <p className="text-4xl sm:text-6xl font-black text-neo-white tracking-tight">Plus qu'un simple outil.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
          {/* Tile 1: Security */}
          <div className="md:col-span-2 glass-morphism rounded-[32px] p-10 flex flex-col justify-between group overflow-hidden relative">
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-blue-500/5 rounded-full group-hover:bg-blue-500/10 transition-colors" />
            <Shield className="text-neo-blue mb-4" size={48} />
            <div>
              <h3 className="text-3xl font-black text-white mb-4">Sécurité Bancaire</h3>
              <p className="text-neo-slate text-lg">Vos données sont chiffrées de bout en bout avec les standards les plus élevés du marché.</p>
            </div>
          </div>

          {/* Tile 2: Performance */}
          <div className="glass-morphism rounded-[32px] p-10 flex flex-col justify-between group">
            <Zap className="text-amber-400 mb-4" size={48} />
            <div>
              <h3 className="text-2xl font-black text-white mb-2">Ultra Rapide</h3>
              <p className="text-neo-slate">Vitesse d'exécution inégalée pour une productivité décuplée.</p>
            </div>
          </div>

          {/* Tile 3: Multi-company */}
          <div className="glass-morphism rounded-[32px] p-10 flex flex-col justify-between group">
            <Globe className="text-emerald-400 mb-4" size={48} />
            <div>
              <h3 className="text-2xl font-black text-white mb-2">Multi-Société</h3>
              <p className="text-neo-slate">Gérez toutes vos entités juridiques depuis un seul compte centralisé.</p>
            </div>
          </div>

          {/* Tile 4: Notifications */}
          <div className="md:col-span-2 glass-morphism rounded-[32px] p-10 flex flex-col justify-between group overflow-hidden relative">
            <div className="absolute -right-10 -top-10 w-60 h-60 bg-indigo-500/5 rounded-full group-hover:bg-indigo-500/10 transition-colors" />
            <Bell className="text-indigo-400 mb-4" size={48} />
            <div>
              <h3 className="text-3xl font-black text-white mb-4">Alertes Intelligentes</h3>
              <p className="text-neo-slate text-lg">Soyez notifié instantanément pour chaque événement critique de votre entreprise.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BentoGrid;
