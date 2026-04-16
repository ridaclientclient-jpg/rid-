-- Migration: Add ride_type column to rides table
-- Adds support for multiple vehicle categories with price multipliers
-- Run this ONCE in Supabase SQL Editor

-- Add ride_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides' AND column_name = 'ride_type'
  ) THEN
    ALTER TABLE rides ADD COLUMN ride_type VARCHAR(20) DEFAULT 'standard';
  END IF;
END $$;

-- Add CHECK constraint for valid ride types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rides_ride_type_check'
  ) THEN
    ALTER TABLE rides ADD CONSTRAINT rides_ride_type_check
      CHECK (ride_type IN ('standard', 'premium', 'suv', 'moto', 'moto_express', 'grua', 'flete'));
  END IF;
END $$;

-- (Optional) Update any existing rides to have the default ride_type
-- UPDATE rides SET ride_type = 'standard' WHERE ride_type IS NULL;
