INSERT OR REPLACE INTO vehicles
(apparatus_number, raw_name, primary_assignment, current_assignment, vehicle_type, home_station, fleet_active, dashboard_visible)
VALUES
('F115','Vehicle F115 (2019 Pierce)','Engine 44',NULL,'Engine','Station 44',1,1),
('F137','Vehicle F137 (2018 Freightliner)','Vehicle F137',NULL,'Medic','Station 44',1,1),
('F138','Vehicle F138 (2021 Freightliner)','Medic 45',NULL,'Medic','Headquarters',1,1),
('F108','Vehicle F108 (2012 Pierce)','Vehicle F108',NULL,'Engine','Headquarters',1,1),
('F112','Vehicle F112 (2023 Silverado)','Training 40',NULL,'Battalion','Headquarters',1,1),
('F118','Vehicle F118','Engine 45',NULL,'Engine','Headquarters',1,1),
('F121','Vehicle F121','Chief 40',NULL,'Chief','Headquarters',1,1),
('F123','Vehicle F123 (2026 F550)','Medic 43',NULL,'Medic','Station 43',1,1),
('F116','Vehicle F116 (2026 Spartan)','Engine 43',NULL,'Engine','Station 43',1,1),
('F103','Vehicle F103','Battalion 40',NULL,'Battalion','Headquarters',1,1),
('F104','Vehicle F104','Chief 41',NULL,'Chief','Headquarters',1,1),
('F107','Vehicle F107','Prevention 42',NULL,'CRRD','Headquarters',1,1),
('F109','Vehicle F109','Chief 42',NULL,'Chief','Headquarters',1,1),
('F119','Vehicle F119','Vehicle F119',NULL,'Engine','Headquarters',0,0),
('F122','Vehicle F122','Medic 144',NULL,'Medic','Station 44',1,1),
('F126','Vehicle F126','Medic 41',NULL,'Medic','Station 41',1,1),
('F129','Vehicle F129','Engine 42',NULL,'Engine','Station 42',1,1),
('F130','Vehicle F130','Prevention 43',NULL,'CRRD','Headquarters',1,1),
('F131','Vehicle F131','Safety 40',NULL,'Battalion','Headquarters',1,1),
('F132','Vehicle F132','Marshal 40',NULL,'CRRD','Headquarters',1,1),
('F133','Vehicle F133','Prevention 41',NULL,'CRRD','Headquarters',1,1),
('F136','Vehicle F136','Vehicle F136',NULL,'CRRD','Headquarters',0,0),
('F139','Vehicle F139','Medic 42',NULL,'Medic','Station 42',1,1),
('F141','Vehicle F141','Ladder 41',NULL,'Ladder','Station 41',1,1),
('F117','Vehicle F117','Vehicle F117',NULL,'Medic','Station 42',0,0),
('F124','Vehicle F124','Engine 143',NULL,'Engine','Station 43',1,1);

INSERT OR REPLACE INTO facilities
(facility_key, display_name, latitude, longitude, radius_feet, category, color)
VALUES
('Headquarters','Headquarters',39.623191,-84.1881687,600,'Headquarters','#2563eb'),
('Station 41','Station 41',39.628222,-84.145032,1200,'Station','#16a34a'),
('Station 42','Station 42',39.65937,-84.161163,1200,'Station','#16a34a'),
('Station 43','Station 43',39.59141,-84.163203,1500,'Station','#16a34a'),
('Station 44','Station 44',39.64911,-84.13615,1200,'Station','#16a34a'),
('Station 45','Station 45',39.623017,-84.188465,600,'Station','#16a34a'),
('KHWT','KHWT',39.635638,-84.202823,1200,'Hospital','#7c3aed'),
('Fire Maintenance','Fire Maintenance',39.62514,-84.188212,350,'Maintenance','#ea580c'),
('Kroger - Cornerstone','Kroger - Cornerstone',39.66232,-84.103548,1200,'Grocery','#08872c'),
('Kroger Wilmington Pk','Kroger Wilmington Pk',39.63992,-84.108007,1200,'Grocery','#08872c'),
('Dots Market','Dots Market',39.64505,-84.154635,1200,'Grocery','#08872c'),
('Kroger S Main St','Kroger S Main St',39.60693,-84.162815,1200,'Grocery','#08872c'),
('Miami Valley Hospital South','Miami Valley Hospital South',39.65243,-84.114875,1200,'Hospital','#7c3aed'),
('Kettering Health Miamisburg','Kettering Health Miamisburg',39.63754,-84.248745,1200,'Hospital','#7c3aed'),
('Miami Valley Hospital','Miami Valley Hospital',39.74509,-84.185834,1200,'Hospital','#7c3aed'),
('Premier Health Austin Landing','Premier Health Austin Landing',39.59739,-84.242901,1200,'Hospital','#7c3aed'),
('Childrens Dayton South','Childrens Dayton South',39.58961,-84.238305,1200,'Hospital','#7c3aed'),
('Dayton Childrens','Dayton Childrens',39.77409,-84.168382,1200,'Hospital','#7c3aed'),
('Kettering Hospital Main','Kettering Hospital Main',39.69641,-84.191611,1200,'Hospital','#7c3aed'),
('Cummins Service','Cummins Service',39.3305295,-84.445606,1200,'Shop','#ea580c');

INSERT OR REPLACE INTO public_settings(setting_key, setting_value) VALUES
('RefreshSeconds','60'),
('DashboardCenterLat','39.62309'),
('DashboardCenterLon','-84.18822'),
('DashboardZoom','12');

