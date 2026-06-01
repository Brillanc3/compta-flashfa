// frontend/src/pages/HomePage.jsx

import React from 'react';
import Navbar from '../components/Navbar';
import PricingCalculator from '../components/PricingCalculator';
import Hero from '../components/landing/Hero';
import BentoGrid from '../components/landing/BentoGrid';
import InteractiveDemo from '../components/landing/InteractiveDemo';

const PainSection = () => (
  <section className="py-24 bg-neo-black text-center px-4">
    <div className="max-w-3xl mx-auto border-y border-white/5 py-16">
      <p className="text-neo-slate text-2xl font-medium italic">
        "Marre de passer des heures sur des tableaux illisibles ?"
      </p>
      <p className="text-white mt-6 text-xl font-bold">
        Clarity transforme le chaos en évidence.
      </p>
    </div>
  </section>
);

const Footer = () => (
    <footer className="bg-neo-black border-t border-white/5 py-12 text-center text-neo-slate text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p>&copy; {new Date().getFullYear()} Caillou's Clarity Accounting. Tous droits réservés.</p>
        </div>
    </footer>
);

const HomePage = () => {
    return (
        <div className="bg-neo-black min-h-screen text-neo-white font-outfit selection:bg-neo-blue selection:text-white">
            <Navbar />
            
            <main>
                <Hero />
                <PainSection />
                <InteractiveDemo />
                <BentoGrid />
                <PricingCalculator />
            </main>

            <Footer />
        </div>
    );
};

export default HomePage;
