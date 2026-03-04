-- Adiciona coluna order_index para ordenar as rotas
ALTER TABLE routes ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Atualiza rotas existentes para terem um índice baseado na data de criação
-- Isso garante que as rotas atuais mantenham uma ordem inicial coerente
WITH numbered_routes AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
  FROM routes
)
UPDATE routes
SET order_index = numbered_routes.row_num
FROM numbered_routes
WHERE routes.id = numbered_routes.id;
