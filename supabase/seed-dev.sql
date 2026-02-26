-- Raccourcis pour changer mon rôle à la volée sur Projet B
-- Remplacer les chaînes par les vrais UUIDs copiés à l'étape 1

-- 1. Me remettre Owner
UPDATE members SET role = 'owner' WHERE user_id = '387ca97e-68cf-44a1-b945-b51b59377181';

-- 2. Me rétrograder Trésorier
UPDATE members SET role = 'tresorier' WHERE user_id = '387ca97e-68cf-44a1-b945-b51b59377181';

-- 3. Me rétrograder simple Membre (pour tester les blocages)
UPDATE members SET role = 'membre' WHERE user_id = '387ca97e-68cf-44a1-b945-b51b59377181';