-- Etiquetas tomadas del croquis adjunto. No hay rutas reales verificadas.
insert into public.places (id,name,code,category,building,floor,x,y,description,source,verified) values
('entrada-lopez','Entrada Blvd. A. López Mateos','','Acceso','Acceso norte','Por confirmar',90,16,'Acceso señalado en la parte superior del croquis.','Croquis proporcionado por el usuario',false),
('entrada-faja','Entrada Av. Faja de Oro','','Acceso','Acceso sur','Por confirmar',12,95,'Acceso señalado en la parte inferior del croquis.','Croquis proporcionado por el usuario',false),
('auditorio-posgrado','Auditorio Posgrado','','Auditorio','Posgrado','Por confirmar',64,42,'Ubicado junto a las salas A y B en el croquis.','Croquis proporcionado por el usuario',false),
('sala-a','Sala A','','Sala','Posgrado','Por confirmar',71,40,'Sala identificada como A en el croquis proporcionado.','Croquis proporcionado por el usuario',false),
('sala-b','Sala B','','Sala','Posgrado','Por confirmar',71,45,'Sala identificada como B en el croquis proporcionado.','Croquis proporcionado por el usuario',false),
('aula-interactiva','Aula Interactiva FIT','','Aula','Por confirmar','Por confirmar',54,57.5,'Punto señalado al costado del campo de futbol.','Croquis proporcionado por el usuario',false),
('sala-negocios','Sala de Negocios','','Sala','Por confirmar','Por confirmar',74,80.7,'Espacio señalado hacia el acceso de Av. Faja de Oro.','Croquis proporcionado por el usuario',false),
('cafeteria','Cafetería de Ingeniería','','Servicio','Por confirmar','Por confirmar',84,73,'Espacio señalado en el costado derecho del croquis.','Croquis proporcionado por el usuario',false),
('campo-futbol','Campo de futbol','','Deportivo','Exterior','Por confirmar',35,39,'Área deportiva identificada en el croquis.','Croquis proporcionado por el usuario',false)
on conflict(id) do nothing;
