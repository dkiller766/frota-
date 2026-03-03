-- Schema update to add performer name and signature to the checklists table
ALTER TABLE checklists
ADD COLUMN performer_name TEXT,
ADD COLUMN signature TEXT;
