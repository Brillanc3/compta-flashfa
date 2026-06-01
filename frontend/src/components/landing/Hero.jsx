import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const Hero = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleDemoLogin = async () => {
    setIsLoggingIn(true);
    const toastId = toast.loading('Accès à la démo...');
    try {
      await login({ username: 'demo', password: 'demo' });
      toast.success('Bienvenue dans la démo !', { id: toastId });
      navigate('/dashboard');
    } catch (error) {
      console.error('Demo login failed:', error);
      toast.error('Erreur lors de l\'accès à la démo.', { id: toastId });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <section className="relative pt-32 pb-20 px-4 bg-neo-black overflow-hidden flex flex-col items-center">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 text-center max-w-5xl"
      >
        <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-8 uppercase tracking-widest">
          L'avenir de la comptabilité
        </span>
        
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-neo-white tracking-tighter mb-8 leading-[0.9]">
          Clarté Totale.<br />
          <span className="text-neo-blue text-glow-blue">Zéro Effort.</span>
        </h1>
        
        <p className="text-lg sm:text-xl text-neo-slate max-w-2xl mx-auto mb-12 font-medium">
          Reprenez le contrôle de vos finances avec une interface conçue pour la précision, la performance et le plaisir.
        </p>
        
        <div className="flex justify-center">
          <button 
            onClick={handleDemoLogin}
            disabled={isLoggingIn}
            className="px-12 py-6 bg-neo-blue text-white font-black rounded-2xl hover:scale-105 transition-all shadow-[0_0_40px_-5px_rgba(59,130,246,0.6)] flex items-center gap-3 disabled:opacity-70 disabled:hover:scale-100"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="animate-spin" size={24} />
                Connexion...
              </>
            ) : (
              'Voir la Démo'
            )}
          </button>
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;
