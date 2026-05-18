-- Clear legacy rows; repopulate DB mirror only via syncCatalogToDB from bty_elite_scenarios.json.
-- Arena runtime loads payloads from the JSON file (see eliteScenariosCanonical.server).

delete from public.scenarios;
