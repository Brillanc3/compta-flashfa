const fs = require('fs');

const questions = {
  "general": [
    { "id": 1, "q": "Quelle est la durée maximale d'un contrat At Will dans le secteur privé ?", "a": ["1 semaine", "2 semaines", "1 mois", "Illimitée"], "c": 1 },
    { "id": 2, "q": "À partir de quel montant un don reçu est-il imposable à 30% ?", "a": ["> 10 000$", "> 30 000$", "> 50 000$", "> 100 000$"], "c": 2 },
    { "id": 3, "q": "Quel est l'âge minimum légal pour travailler à San Andreas ?", "a": ["16 ans", "18 ans", "21 ans", "25 ans"], "c": 2 },
    { "id": 4, "q": "Quel est le plafond de rémunération hebdomadaire (hors primes) pour un gérant ?", "a": ["20 000$", "30 000$", "50 000$", "Sans limite"], "c": 0 },
    { "id": 5, "q": "Dans quel délai un licenciement doit-il être suivi du versement du solde de tout compte ?", "a": ["24h", "48h", "72h", "1 semaine"], "c": 2 },
    { "id": 6, "q": "Quelle est la durée maximale d'un stage ?", "a": ["2 jours", "4 jours", "1 semaine", "2 semaines"], "c": 1 },
    { "id": 7, "q": "Quel est le taux d'imposition pour la Tranche 2 (50 001$ à 100 000$) ?", "a": ["10%", "19%", "28%", "36%"], "c": 1 },
    { "id": 8, "q": "Combien de temps les factures doivent-elles être conservées en cas de contrôle ?", "a": ["2 semaines", "4 semaines", "6 semaines", "1 an"], "c": 2 },
    { "id": 9, "q": "Quel est le prix fixé pour une carte grise ?", "a": ["100$", "300$", "500$", "1 000$"], "c": 1 },
    { "id": 10, "q": "Un don versé est déductible des impôts à hauteur de :", "a": ["10%", "20%", "30%", "50%"], "c": 1 }
  ],
  "s1": [
    { "id": 11, "q": "Secteur 1 : Quel est le plafond pour un nouvel employé (< 1 semaine) ?", "a": ["11 000$", "13 000$", "15 000$", "18 000$"], "c": 0 },
    { "id": 12, "q": "Secteur 1 : Quel est le plafond après 3 semaines d'ancienneté ?", "a": ["13 000$", "15 000$", "18 000$", "20 000$"], "c": 1 },
    { "id": 13, "q": "Secteur 1 : Quel est le plafond pour les postes de gestion ?", "a": ["15 000$", "18 000$", "20 000$", "25 000$"], "c": 1 }
  ],
  "s2": [
    { "id": 21, "q": "Secteur 2 : Quel est le plafond hebdomadaire pour un employé (sans ancienneté requis) ?", "a": ["15 000$", "19 000$", "20 000$", "25 000$"], "c": 1 },
    { "id": 22, "q": "Secteur 2 : Quel est le plafond pour les postes de gestion ?", "a": ["19 000$", "20 000$", "25 000$", "30 000$"], "c": 1 }
  ],
  "s3": [
    { "id": 31, "q": "Secteur 3 : Quel est le plafond hebdomadaire pour un employé ?", "a": ["15 000$", "19 000$", "20 000$", "25 000$"], "c": 1 },
    { "id": 32, "q": "Secteur 3 : Quel est le plafond pour la direction ?", "a": ["19 000$", "20 000$", "25 000$", "30 000$"], "c": 1 }
  ],
  "s4": [
    { "id": 41, "q": "Secteur 4 : Quel pourcentage minimum des revenus un artiste doit-il percevoir ?", "a": ["20%", "50%", "60%", "80%"], "c": 2 },
    { "id": 42, "q": "Secteur 4 : Quel est le plafond hebdomadaire pour un artiste ?", "a": ["20 000$", "40 000$", "60 000$", "100 000$"], "c": 2 },
    { "id": 43, "q": "Secteur 4 : Quel est le plafond pour les fonctions de gestion ?", "a": ["19 000$", "20 000$", "25 000$", "30 000$"], "c": 1 }
  ]
};

fs.writeFileSync('backend/src/data/tte_questions.json', JSON.stringify(questions, null, 2));
console.log('Fichier questions.json généré avec succès.');
