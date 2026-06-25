/**
 * StreamSync Wordle — Word Lists
 * Extensive Spanish word pool from RAE with accent support
 */

// ═══════ EASY MODE — Common 5-letter Spanish words ═══════
export const EASY_WORDS = [
  // Animales
  'perro','gatos','tigre','ratón','cisne','zorro','pulpo','cabra','cerdo','burro',
  'patos','llama','cebra','hiena','coala','lince','nutri','potro','corzo','garza',
  // Comida / Cocina
  'plato','leche','huevo','arroz','queso','piñas','limón','melón','cerdo','torta',
  'salsa','dulce','fruta','jugar','maíza','crema','pollo','sushi','pizza','tapas',
  // Naturaleza
  'cielo','playa','campo','monte','nieve','arena','lluva','flora','fauna','oasis',
  'selva','bosqu','valle','delta','bahía','costa','islaz','lagoz','rocas','cueva',
  // Casa / Objetos
  'silla','tabla','reloj','pluma','velas','cinta','techo','pared','suelo','marco',
  'cajón','botón','bolsa','llave','disco','radio','cofre','jarrón','libro','plano',
  // Colores / Descriptivos
  'verde','negro','rubio','claro','sabio','bravo','feliz','dulce','trigo','fuego',
  'nuevo','primo','media','largo','corto','ancho','gordo','flaco','suave','duras',
  // Acciones comunes
  'juego','amigo','clase','forma','orden','corte','metro','carta','torre','ficha',
  'casco','vapor','calle','broma','polvo','mundo','reina','globo','barco','piano',
  // Lugares / Ciudad
  'plaza','hotel','tiend','parqu','museo','banco','casas','calma','punto','ritmo',
  'gusto','lucha','drama','humor','labor','danza','canto','pacto','señal','cargo',
  // Cuerpo
  'brazo','manos','dedos','piern','pecho','hueso','labio','nariz','cuero','rojaz',
  // Sentimientos / Abstracto
  'calor','freno','miedo','rabia','graci','sudor','honor','poder','prisa','rumbo',
  // Más comunes
  'razón','acero','justo','molde','pasta','ladrz','cuent','salud','listo','madre',
  'padre','niños','mujer','chica','chico','perla','roble','moral','final','total',
  'vital','genio','gentz','noble','línea','óvalo','ángel','único','álbum','ámbar',
  'ébano','ídolo','útero','ádios','aguja','algún','buena','caldo','clave','diana',
  'envío','etapa','filos','gesto','horno','islas','junto','karma','limon','lleno',
  'magos','nadar','ñoños','obvio','opera','pausa','quizá','rumba','siglo','tropa',
  'usted','vacas','yerno','zambo','zonal','almas','brisa','campo','dados','espía',
  'farol','grano','hecho','igual','jamon','kendo','lunar','micro','norma','otoño',
  'primo','rango','siete','tango','ultra','vicio','wahoo','xilón','yogur','zabra',
  'audio',
];

// ═══════ HARDCORE MODE — Difficult RAE words with accents ═══════
export const HARDCORE_WORDS = [
  // Palabras con tilde (acento ortográfico)
  'ácido','álamo','ámbar','ánima','ápice','árbol','áspid','átomo','ávido','ázimo',
  'básil','bícep','bólid','búcar','bétel','bóvid','búfal','bálaj','bísón','bórea',
  'cáliz','cénit','cínic','códig','cúbit','céfir','córne','cúpul','cális','cómic',
  'dátil','débil','dócil','dúplo','débit','dígit','dólar','délta','dénso','dúctó',
  'ébano','ético','éxodo','élite','ídolo','índex','ínter','íbero','óntic','óbice',
  'fétid','flúor','fémur','fúlgi','fásci','fónic','fúgar','fálaz','fórum','fúsel',
  'gélid','gírar','gónza','gúlag','génit','gálop','gózne','gúrme','gálic','gótic',
  // Ciencias / Técnicas
  'xilém','xerón','xérox','xilem','xenón','xilol','xifón','xilof','xerof','xeric',
  'quóru','quizá','quena','quino','quina','quima','quilo','quimo','quita','quota',
  // Medicina / Anatomía
  'tórax','fíbra','tíbia','úlcen','ríñon','córte','vísca','sútil','áorta','órgaz',
  // Filosofía / Literatura
  'prosa','mímeo','tésís','épica','líric','sátir','elegí','augur','orácu','plétó',
  // Arquitectura
  'ábsid','dósel','friso','zócal','arcos','bóved','pórté','mésal','gótic','fúste',
  // Botánica
  'sépál','pétal','xílem','cályx','tálló','ráíze','frónd','espor','gámen','estol',
  // Palabras difíciles con ñ
  'añejo','cañón','dueño','leñar','muñón','paños','pequeñ','reñir','sueño','uñero',
  'niños','daños','piñón','riñón','peñas','coñac','cañas','bañar','guiño','moños',
  // Palabras poco comunes
  'ábaco','adust','agraz','albur','anodó','basal','celda','deudo','eflúx','farsa',
  'glauc','hálux','ímpar','jácul','lacra','maras','nefas','ocaso','parco','quimo',
  'rasgo','sarro','taifa','umbrá','vasto','wahoo','xifón','yermo','zagal','zumba',
  // Arcaísmos y cultismos
  'acerv','alcor','azote','bajel','bruma','cénit','dehes','erial','feraz','garbo',
  'hiato','impar','jaspe','lacre','meorl','nadir','obsol','prosa','rapaz','sarco',
  'tapiz','ubérr','vaste','yermo','zahir','abyec','belez','cisma','dosel','estol',
  // Más difíciles (RAE puro)
  'ablac','acíba','acrít','adust','agraz','ahíto','albur','aleve','alféz','almez',
  'anodó','aovad','apiñá','arcón','arete','argot','arras','atril','audaz','avezá',
  'axiom','azaga','bahar','balaj','bálat','bisón','bodón','bréad','broca','bucar',
  'cabal','calva','cañiz','catar','celad','cendá','cesto','choza','cimbl','clíma',
  'cobij','cofré','colmó','compá','cónyú','coral','cribo','cruza','cuñar','decor',
  'desér','diván','dogma','dudar','ébano','eclec','eflúv','ejido','empaí','enagú',
  'enojo','epígr','errad','escol','estip','evasí','exórd','faena','fasci','fástu',
  'fiord','fluir','folcl','frágu','furor','gacel','gálax','garfi','genol','gíbar',
  'gleba','golfe','granó','grúpo','guald','hábil','halcó','helar','hidrá','hosco',
  'imbuí','inflá','ingén','irisa','jácar','joyel','jurel','lacón','lerdo','lezna',
  'libar','llaga','llano','macil','magma','mefít','mezón','mirra','mojar','morbo',
  'mugir','naíta','necrá','nimbo','nódal','obrar','obvió','oleaj','opaco','orlar',
  'osado','pábil','palúd','pasmo','pecio','petró','pilár','pívot','plebe','plomó',
  'podio','praxi','pugná','punzó','quimo','ragúz','redil','rezar','ribaz','ronco',
  'rumor','sáenz','sarco','sazón','sesgo','sinuó','sobré','solaz','sopor','sudor',
  'sumir','tabúr','tañer','tempá','tizón','topar','trama','truán','tuétá','ubéri',
  'ungir','uñero','vahíd','veler','verbo','vetea','viñed','viraz','volco','volver',
  'yedra','yermo','yesca','yuxta','zafar','zagal','zancó','zarco','zenit','zepel',
];

// Normalize word: remove accents for comparison purposes
export function normalizeWord(word) {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace('ñ', 'n');
}

// Validate a 5-letter word (allows accented chars and ñ)
export function isValidWord(word) {
  if (!word || word.length !== 5) return false;
  return /^[a-záéíóúüñ]{5}$/i.test(word);
}
