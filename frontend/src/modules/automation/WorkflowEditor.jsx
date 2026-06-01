import React, { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { AutomationTheme } from './utils/automationTheme';
import { Save, Play, Trash2, Info, Lock, LayoutTemplate } from 'lucide-react';
import { toast } from 'react-hot-toast';
import automationService from '../../services/automationService';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import TemplateCatalogModal from './TemplateCatalogModal';


const WorkflowEditor = () => {
  const blocklyRef = useRef(null);
  const workspaceRef = useRef(null);
  const [xmlData, setXmlData] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
  const [catalogOpen, setCatalogOpen] = useState(false);

  // Génère le XML de la toolbox à partir de la config backend
  const generateToolboxXML = (backendToolbox) => {
    let categoriesXml = '';
    
    (backendToolbox || []).forEach(cat => {
      let blocksXml = '';
      cat.blocks.forEach(block => {
        blocksXml += `<block type="${block.type}"></block>`;
      });
      categoriesXml += `<category name="${cat.name}" colour="${cat.colour}">${blocksXml}</category>`;
    });

    return `
      <xml xmlns="https://developers.google.com/blockly/xml">
        ${categoriesXml}
        <sep></sep>
        <category name="Standard" colour="#94A3B8">
          <block type="text"><field name="TEXT">ABC</field></block>
          <block type="math_number"><field name="NUM">0</field></block>
          <block type="logic_compare"></block>
          <block type="logic_operation"></block>
          <block type="logic_negate"></block>
        </category>
      </xml>
    `;
  };

  useEffect(() => {
    const init = async () => {
      try {
        const data = await automationService.getConfig();
        setConfig(data);
        
        // Enregistrer les blocs dynamiques (seulement s'ils ne le sont pas déjà)
        if (data.blocks && data.blocks.length > 0) {
          const newBlocks = data.blocks.filter(b => !Blockly.Blocks[b.type]);
          if (newBlocks.length > 0) {
            Blockly.defineBlocksWithJsonArray(newBlocks);
          }
        }
        
        setIsLoading(false);
      } catch (err) {
        setError(err.response?.data?.code || 'FETCH_ERROR');
        setIsLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isLoading && !error && config && blocklyRef.current && !workspaceRef.current) {
      const toolboxXML = generateToolboxXML(config.toolbox);
      
      workspaceRef.current = Blockly.inject(blocklyRef.current, {
        toolbox: toolboxXML,
        theme: AutomationTheme,
        grid: { spacing: 25, length: 3, colour: '#334155', snap: true },
        zoom: { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
        trashcan: true,
        move: { scrollbars: true, drag: true, wheel: true }
      });

      // Charger depuis le backend au lieu du localStorage
      const loadWorkflows = async () => {
        try {
          const workflows = await automationService.getWorkflows();
          if (workflows && workflows.length > 0) {
            // Pour l'instant on ne gère qu'un seul workflow principal
            const mainWorkflow = workflows[0];
            if (mainWorkflow.xml) {
              const xml = Blockly.utils.xml.textToDom(mainWorkflow.xml);
              Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
            }
          }
        } catch (e) {
          console.error("Erreur chargement workflows backend : ", e);
        }
      };

      loadWorkflows();

      workspaceRef.current.addChangeListener(() => {
        const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
        setXmlData(Blockly.Xml.domToText(xml));
      });
    }

    return () => {
      if (workspaceRef.current) {
        workspaceRef.current.dispose();
        workspaceRef.current = null;
      }
    };
  }, [isLoading, error, config]);

  const handleSave = async () => {
    try {
      if (!workspaceRef.current) return;
      
      // Trouver le type d'événement déclencheur
      const topBlocks = workspaceRef.current.getTopBlocks();
      const triggerBlock = topBlocks.find(b => b.type.startsWith('event_'));
      const trigger = triggerBlock ? triggerBlock.type.replace('event_', '').toUpperCase() : 'NONE';
      
      // Sérialisation JSON (plus facile à lire côté backend)
      const jsonState = Blockly.serialization.workspaces.save(workspaceRef.current);
      
      const workflows = [{
        id: 'main',
        name: 'Workflow Principal',
        active: true,
        trigger: trigger,
        xml: xmlData,
        json: jsonState
      }];

      await automationService.saveWorkflows(workflows);
      toast.success('Workflow sauvegardé en base de données !');
    } catch (e) {
      console.error("Erreur sauvegarde : ", e);
      if (e?.response?.status === 403) {
        toast.error("Vous n'avez pas la permission de modifier les automates.");
      } else {
        toast.error('Erreur lors de la sauvegarde.');
      }
    }
  };

  // Charge un modèle dans le workspace (remplace l'existant).
  const applyTemplate = (template) => {
    if (!workspaceRef.current || !template?.state) return;
    try {
      workspaceRef.current.clear();
      Blockly.serialization.workspaces.load(template.state, workspaceRef.current);
      toast.success(`Modèle « ${template.name} » chargé`);
    } catch (e) {
      console.error('Erreur chargement modèle :', e);
      toast.error('Impossible de charger ce modèle.');
    }
  };

  const handleSelectTemplate = (template) => {
    setCatalogOpen(false);
    const hasBlocks = workspaceRef.current && workspaceRef.current.getAllBlocks(false).length > 0;
    if (hasBlocks) {
      setConfirmModal({
        isOpen: true,
        message: `Charger « ${template.name} » remplacera le contenu actuel du workspace. Continuer ?`,
        onConfirm: () => {
          setConfirmModal((p) => ({ ...p, isOpen: false }));
          applyTemplate(template);
        },
      });
    } else {
      applyTemplate(template);
    }
  };

  const handleClear = () => {
    setConfirmModal({
      isOpen: true,
      message: 'Voulez-vous vraiment vider le workspace ?',
      onConfirm: () => {
        setConfirmModal(p => ({ ...p, isOpen: false }));
        workspaceRef.current.clear();
        toast.error('Workspace vidé');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0f172a]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error === 'SCRATCH_MODULE_REQUIRED') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0f172a] p-8 text-center">
        <div className="p-6 bg-slate-800/50 rounded-full mb-6 border border-slate-700 shadow-2xl">
          <Lock size={64} className="text-yellow-500" />
        </div>
        <h2 className="text-3xl font-black mb-4">Module Scratch Requis</h2>
        <p className="text-slate-400 max-w-md mb-8">
          Les automatisations avancées ne sont pas activées pour votre entreprise. 
          Contactez un administrateur pour débloquer cette fonctionnalité majeure.
        </p>
        <button className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
          Découvrir les offres
        </button>
      </div>
    );
  }

  if (error === 'AUTOMATION_FORBIDDEN') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0f172a] p-8 text-center">
        <div className="p-6 bg-slate-800/50 rounded-full mb-6 border border-slate-700 shadow-2xl">
          <Lock size={64} className="text-red-500" />
        </div>
        <h2 className="text-3xl font-black mb-4">Accès refusé</h2>
        <p className="text-slate-400 max-w-md">
          Vous n'avez pas la permission d'accéder aux automates de cette entreprise.
          Demandez la permission « Automation » à un responsable.
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col h-full bg-[#0f172a] text-white">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 bg-[#1e293b] border-b border-slate-700 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500 rounded-lg shadow-yellow-500/20 shadow-lg">
            <Play size={20} className="text-slate-900 fill-current" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Automates Scratch</h1>
            <p className="text-xs text-slate-400">Système modulaire dynamique</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCatalogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-300 transition-all hover:text-white bg-indigo-600/20 hover:bg-indigo-600/40 rounded-lg"
          >
            <LayoutTemplate size={16} />
            Catalogue
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-400 transition-all hover:text-red-400 bg-slate-800/50 rounded-lg"
          >
            <Trash2 size={16} />
            Effacer
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 text-sm font-extrabold text-white transition-all bg-indigo-600 rounded-lg hover:bg-indigo-500 hover:scale-105 active:scale-95 shadow-indigo-600/30 shadow-lg"
          >
            <Save size={16} />
            Sauvegarder
          </button>
        </div>
      </div>

      {/* Editor Main Area */}
      <div className="relative flex-1 overflow-hidden">
        <div 
          ref={blocklyRef} 
          className="absolute inset-0 blockly-custom-theme"
          style={{ width: '100%', height: '100%' }}
        />
        
        {/* Help Overlay (Optional) */}
        <div className="absolute top-4 right-4 p-4 max-w-xs bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700 text-xs text-slate-300 pointer-events-none shadow-2xl">
          <div className="flex items-center gap-2 mb-2 font-bold text-indigo-400">
            <Info size={14} />
            CONSEIL
          </div>
          Emboîtez les blocs pour créer une suite logique. Utilisez les blocs "Attendre" pour différer des actions dans le temps.
        </div>
      </div>
      
      <style jsx global>{`
        .blocklyTreeLabel {
          font-family: 'Inter', sans-serif !important;
          font-weight: 500 !important;
        }
        .blocklyToolboxDiv {
          background-color: #1e293b !important;
          border-right: 1px solid #334155 !important;
        }
        .blocklyFlyoutBackground {
          fill: #1e293b !important;
          fill-opacity: 0.95 !important;
        }
        .blocklyMainBackground {
          stroke: none !important;
        }
        .blocklyScrollbarHandle {
          fill: #475569 !important;
        }
        /* Custom styles for toolbox categories */
        .category-events {
          border-left: 4px solid #EAB308;
        }
      `}</style>
    </div>
    <ConfirmationModal
      isOpen={confirmModal.isOpen}
      onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
      onConfirm={confirmModal.onConfirm}
      message={confirmModal.message}
    />
    <TemplateCatalogModal
      isOpen={catalogOpen}
      onClose={() => setCatalogOpen(false)}
      onSelect={handleSelectTemplate}
    />
    </>
  );
};

export default WorkflowEditor;
