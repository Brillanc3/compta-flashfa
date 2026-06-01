// backend/src/modules/automation/automationRegistry.js

const fs = require('fs');
const path = require('path');

class AutomationRegistry {
  constructor() {
    this.modules = {};
    this.blocks = [];
    this.toolbox = [];
    this.templates = [];
  }

  async scan() {
    const modulesDir = path.join(__dirname, '..');
    const moduleNames = fs.readdirSync(modulesDir).filter(file =>
      fs.statSync(path.join(modulesDir, file)).isDirectory()
    );

    this.modules = {};
    this.blocks = [];
    this.toolbox = [];
    this.templates = [];

    for (const name of moduleNames) {
      const scratchFile = path.join(modulesDir, name, `${name}.scratch.js`);
      if (fs.existsSync(scratchFile)) {
        try {
          const config = require(scratchFile);
          this.modules[name] = config;
          
          if (config.blocks) {
            config.blocks.forEach(block => {
              const originalType = block.type;
              // Si le type existe déjà dans une autre catégorie
              if (this.blocks.find(b => b.type === block.type)) {
                block.type = `${block.type}_${name}`;
                console.warn(`[AutomationRegistry] Typo conflict: ${originalType} changed to ${block.type}`);
                
                // On met à jour la toolbox si elle contient cet ancien type
                if (config.toolbox) {
                  const updateToolbox = (tb) => {
                    const t = Array.isArray(tb) ? tb : [tb];
                    t.forEach(cat => {
                      if (cat.blocks) {
                        cat.blocks.forEach(tbBlock => {
                          if (tbBlock.type === originalType) tbBlock.type = block.type;
                        });
                      }
                    });
                  };
                  updateToolbox(config.toolbox);
                }
              }
              this.blocks.push(block);
            });
          }
          
          if (config.toolbox) {
            if (Array.isArray(config.toolbox)) {
              this.toolbox.push(...config.toolbox);
            } else {
              this.toolbox.push(config.toolbox);
            }
          }
          
          console.log(`[AutomationRegistry] Registered module: ${name}`);
        } catch (e) {
          console.error(`[AutomationRegistry] Error loading ${scratchFile}:`, e);
        }
      }

      // Modèles prêts à l'emploi (optionnels) : `<name>.templates.js`
      const templatesFile = path.join(modulesDir, name, `${name}.templates.js`);
      if (fs.existsSync(templatesFile)) {
        try {
          const tpls = require(templatesFile);
          if (Array.isArray(tpls)) {
            this.templates.push(...tpls);
            console.log(`[AutomationRegistry] Loaded ${tpls.length} templates from: ${name}`);
          }
        } catch (e) {
          console.error(`[AutomationRegistry] Error loading ${templatesFile}:`, e);
        }
      }
    }
  }

  getConfig() {
    return {
      blocks: this.blocks,
      toolbox: this.toolbox,
      moduleDefinitions: this.modules
    };
  }

  getTemplates() {
    return this.templates;
  }
}

module.exports = new AutomationRegistry();
