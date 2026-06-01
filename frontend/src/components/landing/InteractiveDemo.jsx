import React, { useState } from 'react';
import { Reorder } from 'framer-motion';
import { LayoutGrid, TrendingUp, ListTodo } from 'lucide-react';

const INITIAL_WIDGETS = [
  { id: 'balance', title: 'Solde Total', icon: TrendingUp, color: 'text-blue-400' },
  { id: 'transactions', title: 'Activités Récentes', icon: ListTodo, color: 'text-indigo-400' },
  { id: 'stats', title: 'Statistiques', icon: LayoutGrid, color: 'text-emerald-400' },
];

const InteractiveDemo = () => {
  const [items, setItems] = useState(INITIAL_WIDGETS);

  return (
    <section id="demo" className="py-24 bg-neo-black relative px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-neo-blue font-black uppercase tracking-widest text-sm mb-4">La Solution</h2>
          <p className="text-4xl sm:text-6xl font-black text-neo-white tracking-tight">Votre Dashboard, vos règles.</p>
          <p className="text-neo-slate mt-4 max-w-xl mx-auto text-lg">Essayez de réorganiser vos widgets préférés par simple glisser-déposer.</p>
        </div>

        <div className="glass-morphism rounded-[32px] p-8 md:p-12 border-neo-white-10 relative overflow-hidden">
          <div className="absolute top-4 right-8 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Sandbox Active</span>
          </div>

          <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-4 max-w-3xl mx-auto">
            {items.map((item) => (
              <Reorder.Item
                key={item.id}
                value={item}
                className="glass-morphism p-6 rounded-2xl border-white/5 cursor-grab active:cursor-grabbing flex items-center justify-between group hover:border-blue-500/30 transition-colors"
              >
                <div className="flex items-center gap-6">
                  <div className={`p-4 rounded-xl bg-white/5 group-hover:bg-blue-500/10 transition-colors ${item.color}`}>
                    <item.icon size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{item.title}</h3>
                    <p className="text-neo-slate text-sm">Données synchronisées en temps réel</p>
                  </div>
                </div>
                <div className="text-white/20 group-hover:text-blue-500/50 transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      </div>
    </section>
  );
};

export default InteractiveDemo;
