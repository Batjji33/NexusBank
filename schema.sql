-- BASE DE DONNÉES SUPABASE — TABLES POSTGRESQL

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  joined_parties UUID[] DEFAULT '{}',
  date_creation TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_username ON users(username);

CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  code_invitation TEXT UNIQUE NOT NULL,
  createur_id UUID NOT NULL REFERENCES users(id),
  joueurs UUID[] DEFAULT '{}',
  solde_initial NUMERIC NOT NULL CHECK (solde_initial > 0),
  salaire_journalier NUMERIC NOT NULL DEFAULT 0 CHECK (salaire_journalier >= 0),
  salaire_actif BOOLEAN DEFAULT TRUE,
  taxe_pourcentage NUMERIC NOT NULL DEFAULT 5,
  frais_fixe NUMERIC NOT NULL DEFAULT 2,
  derniere_distribution_salaire DATE DEFAULT NULL,
  solde_max NUMERIC NOT NULL,
  nb_joueurs_max INTEGER DEFAULT NULL,
  date_creation TIMESTAMPTZ DEFAULT NOW(),
  invitations_en_attente UUID[] DEFAULT '{}',
  est_archivee BOOLEAN DEFAULT FALSE,
  CONSTRAINT solde_max_superieur CHECK (solde_max > solde_initial)
);

CREATE UNIQUE INDEX idx_parties_code ON parties(code_invitation);

CREATE TABLE player_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  solde NUMERIC NOT NULL DEFAULT 0 CHECK (solde >= 0),
  derniere_maj TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, party_id)
);

CREATE INDEX idx_pb_user_id ON player_balances(user_id);
CREATE INDEX idx_pb_party_id ON player_balances(party_id);
CREATE INDEX idx_pb_composite ON player_balances(user_id, party_id);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partie_id UUID NOT NULL REFERENCES parties(id),
  emetteur_id UUID NOT NULL,
  receveur_id UUID NOT NULL,
  montant NUMERIC NOT NULL CHECK (montant > 0),
  frais_fixe NUMERIC NOT NULL DEFAULT 2,
  taxe NUMERIC NOT NULL,
  montant_recu NUMERIC NOT NULL,
  cout_total_emetteur NUMERIC NOT NULL,
  statut TEXT NOT NULL CHECK (statut IN ('validée', 'échouée')),
  raison_echec TEXT DEFAULT NULL,
  date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_partie ON transactions(partie_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_emetteur ON transactions(emetteur_id);
CREATE INDEX idx_transactions_receveur ON transactions(receveur_id);

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  invite_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inviteur_id UUID NOT NULL REFERENCES users(id),
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'acceptée', 'refusée')),
  date_envoi TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(party_id, invite_id)
);

CREATE INDEX idx_invitations_invite ON invitations(invite_id);
CREATE INDEX idx_invitations_statut ON invitations(statut);


-- FONCTIONS RPC POSTGRESQL

CREATE OR REPLACE FUNCTION register_user(
  p_username TEXT,
  p_password_hash TEXT
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE username = p_username) THEN
    RETURN json_build_object('success', false, 'error', 'username_taken');
  END IF;

  INSERT INTO users (username, password_hash)
  VALUES (p_username, p_password_hash)
  RETURNING id INTO v_user_id;

  RETURN json_build_object('success', true, 'user_id', v_user_id, 'username', p_username);
END;
$$;

CREATE OR REPLACE FUNCTION login_user(
  p_username TEXT,
  p_password_hash TEXT
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT id, username, password_hash
  INTO v_user
  FROM users
  WHERE username = p_username;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'user_not_found');
  END IF;

  IF v_user.password_hash != p_password_hash THEN
    RETURN json_build_object('success', false, 'error', 'wrong_password');
  END IF;

  RETURN json_build_object('success', true, 'user_id', v_user.id, 'username', v_user.username);
END;
$$;

CREATE OR REPLACE FUNCTION create_party(
  p_user_id UUID,
  p_nom TEXT,
  p_solde_initial NUMERIC,
  p_salaire_journalier NUMERIC,
  p_solde_max NUMERIC,
  p_nb_joueurs_max INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_party_id UUID;
  v_code TEXT;
BEGIN
  LOOP
    v_code := upper(substring(md5(random()::text) from 1 for 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM parties WHERE code_invitation = v_code);
  END LOOP;

  INSERT INTO parties (nom, code_invitation, createur_id, joueurs, solde_initial, salaire_journalier, solde_max, nb_joueurs_max)
  VALUES (p_nom, v_code, p_user_id, ARRAY[p_user_id], p_solde_initial, p_salaire_journalier, p_solde_max, p_nb_joueurs_max)
  RETURNING id INTO v_party_id;

  INSERT INTO player_balances (user_id, party_id, solde)
  VALUES (p_user_id, v_party_id, p_solde_initial);

  UPDATE users SET joined_parties = array_append(joined_parties, v_party_id)
  WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'party_id', v_party_id, 'code_invitation', v_code, 'nom', p_nom);
END;
$$;

CREATE OR REPLACE FUNCTION join_party_by_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_party RECORD;
BEGIN
  SELECT * INTO v_party FROM parties WHERE code_invitation = upper(p_code);

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF p_user_id = ANY(v_party.joueurs) THEN
    RETURN json_build_object('success', false, 'error', 'already_member');
  END IF;

  IF v_party.nb_joueurs_max IS NOT NULL AND array_length(v_party.joueurs, 1) >= v_party.nb_joueurs_max THEN
    RETURN json_build_object('success', false, 'error', 'party_full');
  END IF;

  UPDATE parties SET joueurs = array_append(joueurs, p_user_id) WHERE id = v_party.id;

  INSERT INTO player_balances (user_id, party_id, solde)
  VALUES (p_user_id, v_party.id, v_party.solde_initial)
  ON CONFLICT (user_id, party_id) DO NOTHING;

  UPDATE users SET joined_parties = array_append(joined_parties, v_party.id)
  WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'party_id', v_party.id, 'nom', v_party.nom);
END;
$$;

CREATE OR REPLACE FUNCTION send_transaction(
  p_emetteur_id UUID,
  p_party_id UUID,
  p_receveur_username TEXT,
  p_montant NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_receveur RECORD;
  v_solde_emetteur NUMERIC;
  v_solde_receveur NUMERIC;
  v_party RECORD;
  v_taxe NUMERIC;
  v_montant_recu NUMERIC;
  v_cout_total NUMERIC;
  v_transaction_id UUID;
BEGIN
  SELECT id INTO v_receveur FROM users WHERE username = p_receveur_username;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'receveur_introuvable');
  END IF;

  IF p_emetteur_id = v_receveur.id THEN
    RETURN json_build_object('success', false, 'error', 'auto_envoi_interdit');
  END IF;

  IF p_montant <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'montant_invalide');
  END IF;

  SELECT * INTO v_party FROM parties WHERE id = p_party_id;
  IF NOT (p_emetteur_id = ANY(v_party.joueurs)) OR NOT (v_receveur.id = ANY(v_party.joueurs)) THEN
    RETURN json_build_object('success', false, 'error', 'joueurs_pas_meme_partie');
  END IF;

  SELECT solde INTO v_solde_emetteur FROM player_balances WHERE user_id = p_emetteur_id AND party_id = p_party_id;
  SELECT solde INTO v_solde_receveur FROM player_balances WHERE user_id = v_receveur.id AND party_id = p_party_id;

  v_taxe := round(p_montant * 0.05, 2);
  v_montant_recu := p_montant - v_taxe;
  v_cout_total := p_montant + 2;

  IF v_solde_emetteur < v_cout_total THEN
    INSERT INTO transactions (partie_id, emetteur_id, receveur_id, montant, taxe, montant_recu, cout_total_emetteur, statut, raison_echec)
    VALUES (p_party_id, p_emetteur_id, v_receveur.id, p_montant, v_taxe, v_montant_recu, v_cout_total, 'échouée', 'solde_insuffisant');
    RETURN json_build_object('success', false, 'error', 'solde_insuffisant');
  END IF;

  IF v_solde_receveur + v_montant_recu > v_party.solde_max THEN
    INSERT INTO transactions (partie_id, emetteur_id, receveur_id, montant, taxe, montant_recu, cout_total_emetteur, statut, raison_echec)
    VALUES (p_party_id, p_emetteur_id, v_receveur.id, p_montant, v_taxe, v_montant_recu, v_cout_total, 'échouée', 'plafond_receveur_atteint');
    RETURN json_build_object('success', false, 'error', 'plafond_receveur_atteint');
  END IF;

  UPDATE player_balances SET solde = solde - v_cout_total, derniere_maj = NOW()
  WHERE user_id = p_emetteur_id AND party_id = p_party_id;

  UPDATE player_balances SET solde = solde + v_montant_recu, derniere_maj = NOW()
  WHERE user_id = v_receveur.id AND party_id = p_party_id;

  INSERT INTO transactions (partie_id, emetteur_id, receveur_id, montant, taxe, montant_recu, cout_total_emetteur, statut)
  VALUES (p_party_id, p_emetteur_id, v_receveur.id, p_montant, v_taxe, v_montant_recu, v_cout_total, 'validée')
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'montant_recu', v_montant_recu,
    'taxe', v_taxe,
    'frais_fixe', 2,
    'nouveau_solde_emetteur', v_solde_emetteur - v_cout_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION distribute_salaries(p_party_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_party RECORD;
  v_player_id UUID;
  v_solde_actuel NUMERIC;
  v_nouveau_solde NUMERIC;
  v_gain_reel NUMERIC;
BEGIN
  -- Verrouillage pour éviter les doublons si plusieurs utilisateurs chargent le dashboard en même temps
  SELECT * INTO v_party FROM parties WHERE id = p_party_id FOR UPDATE;

  IF v_party.salaire_actif = TRUE 
     AND v_party.est_archivee = FALSE 
     AND (v_party.derniere_distribution_salaire IS NULL OR v_party.derniere_distribution_salaire < CURRENT_DATE) THEN
    
    FOREACH v_player_id IN ARRAY v_party.joueurs LOOP
      SELECT solde INTO v_solde_actuel
      FROM player_balances
      WHERE user_id = v_player_id AND party_id = p_party_id;

      IF v_solde_actuel IS NOT NULL THEN
        v_nouveau_solde := LEAST(v_solde_actuel + v_party.salaire_journalier, v_party.solde_max);
        v_gain_reel := v_nouveau_solde - v_solde_actuel;

        IF v_gain_reel > 0 THEN
          UPDATE player_balances SET solde = v_nouveau_solde, derniere_maj = NOW()
          WHERE user_id = v_player_id AND party_id = p_party_id;

          INSERT INTO transactions (partie_id, emetteur_id, receveur_id, montant, taxe, montant_recu, cout_total_emetteur, statut)
          VALUES (p_party_id, '00000000-0000-0000-0000-000000000000', v_player_id, v_party.salaire_journalier, 0, v_gain_reel, 0, 'validée');
        END IF;
      END IF;
    END LOOP;

    UPDATE parties SET derniere_distribution_salaire = CURRENT_DATE WHERE id = p_party_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION update_party_settings(
  p_user_id UUID,
  p_party_id UUID,
  p_salaire_journalier NUMERIC,
  p_taxe_pourcentage NUMERIC,
  p_frais_fixe NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM parties WHERE id = p_party_id AND createur_id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'non_autorisé');
  END IF;

  UPDATE parties 
  SET salaire_journalier = p_salaire_journalier,
      taxe_pourcentage = p_taxe_pourcentage,
      frais_fixe = p_frais_fixe
  WHERE id = p_party_id;

  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION toggle_salaire(
  p_user_id UUID,
  p_party_id UUID
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_party RECORD;
BEGIN
  SELECT * INTO v_party FROM parties WHERE id = p_party_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'partie_introuvable');
  END IF;

  IF v_party.createur_id != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'non_autorisé');
  END IF;

  UPDATE parties SET salaire_actif = NOT salaire_actif WHERE id = p_party_id;

  RETURN json_build_object('success', true, 'salaire_actif', NOT v_party.salaire_actif);
END;
$$;

-- NOUVELLES FONCTIONS D'AFFICHAGE

CREATE OR REPLACE FUNCTION get_my_parties(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'nom', p.nom,
      'solde_initial', p.solde_initial,
      'solde_max', p.solde_max,
      'nb_joueurs', array_length(p.joueurs, 1),
      'solde_actuel', pb.solde
    )
  ) INTO result
  FROM parties p
  JOIN player_balances pb ON pb.party_id = p.id AND pb.user_id = p_user_id
  WHERE p_user_id = ANY(p.joueurs);
  
  RETURN coalesce(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION get_party_dashboard(p_user_id UUID, p_party_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_party RECORD;
  v_solde_actuel NUMERIC;
  v_classement JSON;
  v_historique JSON;
BEGIN
  -- Déclenchement automatique de la distribution du salaire si nécessaire
  PERFORM distribute_salaries(p_party_id);

  SELECT * INTO v_party FROM parties WHERE id = p_party_id;
  
  IF NOT FOUND OR NOT (p_user_id = ANY(v_party.joueurs)) THEN
    RETURN json_build_object('success', false, 'error', 'non_autorisé');
  END IF;

  SELECT solde INTO v_solde_actuel FROM player_balances WHERE user_id = p_user_id AND party_id = p_party_id;

  SELECT json_agg(
    json_build_object(
      'user_id', u.id,
      'username', u.username,
      'solde', pb.solde
    ) ORDER BY pb.solde DESC
  ) INTO v_classement
  FROM player_balances pb
  JOIN users u ON u.id = pb.user_id
  WHERE pb.party_id = p_party_id;

  SELECT json_agg(
    json_build_object(
      'id', t.id,
      'emetteur_username', (SELECT username FROM users WHERE id = t.emetteur_id),
      'emetteur_id', t.emetteur_id,
      'receveur_username', (SELECT username FROM users WHERE id = t.receveur_id),
      'receveur_id', t.receveur_id,
      'montant', t.montant,
      'montant_recu', t.montant_recu,
      'cout_total_emetteur', t.cout_total_emetteur,
      'statut', t.statut,
      'raison_echec', t.raison_echec,
      'date', t.date
    ) ORDER BY t.date DESC
  ) INTO v_historique
  FROM transactions t
  WHERE t.partie_id = p_party_id AND (t.emetteur_id = p_user_id OR t.receveur_id = p_user_id)
  LIMIT 10;

  RETURN json_build_object(
    'success', true,
    'party', json_build_object(
      'nom', v_party.nom,
      'solde_max', v_party.solde_max,
      'code_invitation', v_party.code_invitation,
      'salaire_actif', v_party.salaire_actif,
      'salaire_journalier', v_party.salaire_journalier,
      'taxe_pourcentage', v_party.taxe_pourcentage,
      'frais_fixe', v_party.frais_fixe
    ),
    'solde_actuel', v_solde_actuel,
    'classement', coalesce(v_classement, '[]'::json),
    'historique', coalesce(v_historique, '[]'::json)
  );
END;
$$;


-- ROW LEVEL SECURITY (RLS)

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_direct_access_users" ON users FOR ALL USING (false);
CREATE POLICY "no_direct_access_parties" ON parties FOR ALL USING (false);
CREATE POLICY "no_direct_access_balances" ON player_balances FOR ALL USING (false);
CREATE POLICY "no_direct_access_transactions" ON transactions FOR ALL USING (false);
CREATE POLICY "no_direct_access_invitations" ON invitations FOR ALL USING (false);
