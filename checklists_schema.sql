-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create checklists table
CREATE TABLE IF NOT EXISTS checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Checklist Items
    tires TEXT, -- 'Bom', 'Ruim'
    oil TEXT, -- 'OK', 'Baixo'
    fuel_level TEXT, -- 'Reserva', '1/4', '1/2', '3/4', 'Cheio'
    lights BOOLEAN, -- true = Funcionando, false = Problema
    windows_mirrors TEXT, -- 'OK', 'Avariado'
    cleanliness TEXT, -- 'Limpo', 'Sujo'
    
    -- Visual Damages (Base64 or JSON)
    damages_diagram TEXT,
    
    observations TEXT,

    -- Performer tracking
    performer_name TEXT,
    signature TEXT
);

-- Enable RLS
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view checklists from their company" ON checklists;
CREATE POLICY "Users can view checklists from their company" ON checklists
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert checklists for their company" ON checklists;
CREATE POLICY "Users can insert checklists for their company" ON checklists
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );
