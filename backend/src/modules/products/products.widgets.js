module.exports = [
  {
    type: 'DECLARE_PRODUCT',
    name: 'Déclarer un produit',
    description: "Widget pour déclarer la vente/déclaration d'un produit depuis le tableau de bord.",
    // pattern with {companyId} — remplacé côté UI/engine selon le contexte
    requiredPermission: 'PRODUCTS.{companyId}.DECLARE',
    // Nom exact de la fonction exportée par products.controller.js
    serviceFunction: 'getWidgetData_DeclareProductWidget',
    // Contexte ciblé (COMPANY, USER, GLOBAL...)
    targetContext: 'COMPANY'
  }
];