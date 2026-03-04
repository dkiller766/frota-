-- Script para adicionar o tipo de veiculo (Carro / Moto)
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'CARRO';

-- Caso queira que os veiculos anteriores ja sejam marcados detalhadamente
UPDATE vehicles SET type = 'CARRO' WHERE type IS NULL;
