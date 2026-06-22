const fs = require('fs');

function normLen(w) {
  return w.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[ñÑ]/g,'n').replace(/[üÜ]/g,'u').toLowerCase();
}
function isValid(w) {
  if (typeof w !== 'string') return false;
  const n = normLen(w);
  return n.length === 5 && /^[a-z]{5}$/.test(n);
}

// ════════════════════════════════════════════════════════════
// EASY WORDS — Vocabulario cotidiano español ~2200 palabras
// ════════════════════════════════════════════════════════════
const EASY_RAW = [
  // Animales domésticos y comunes
  'perro','gatos','tigre','ratón','cisne','zorro','pulpo','cabra','cerdo','burro',
  'patos','llama','cebra','hiena','lince','potro','corzo','garza','morsa','cobra',
  'ranas','sapos','lobos','vacas','toros','yegua','mulas','buhos','oveja','ganso',
  'mosca','abeja','bicho','koala','panda','nutri','coyot','grajo','mirlo','loro',
  'oruga','gamba','pulga','liñon','lecón','alces','pumas','cóndor','tapir','llamo',
  'ciervo','gato','perro','burra','potro','potro','rocín','corcel','alazán','palio',
  // Partes del cuerpo
  'brazo','manos','dedos','pecho','hueso','labio','nariz','cuero','cejas','pierna',
  'cabeza','ojos','boca','cuello','hombro','codo','rodilla','tobillo','muñeca','uñas',
  'diente','lengua','frente','pelo','piel','sangre','nervio','músculo','pulmón','corazón',
  'cadera','espalda','nuca','mentón','talón','tendón','vena','sien','codo','pulso',
  'muslo','planta','palma','dorso','torso','tronco','cintura','axila',
  // Comida y bebida
  'plato','leche','huevo','arroz','queso','limón','melón','torta','salsa','dulce',
  'fruta','crema','pollo','tapas','pasta','pizza','jugos','sopas','tacos','carne',
  'panes','vinos','copas','tazas','menta','fresa','mango','papas','cocos','higos',
  'pasas','trigo','avena','moras','peras','setas','oliva','natas','jalea','masas',
  'caldo','piñas','chile','mochi','sushi','cacao','atole','pozol','porra','birra',
  'cocoa','dátil','sopón','tosta','porra','pollo','ducha','guiso','asado','filete',
  'estofado','trucha','chivo','birria','menudo','pozole','chilote','enchilada',
  'taco','burro','sope','torta','birria','atole','nixte','tamale','elote',
  'naranjada','limonada','horchata','jamaica','tepache','tejuino',
  'espiga','malta','cebada','lúpulo','uva','vino','ron','ginebra','tequila','vodka',
  'licor','ponche','sidra','mezcal','pulque','chicha',
  'tomate','chile','ajo','cebolla','apio','zanahoria','rábano','betabel','pepino',
  'brócoli','coliflor','espinaca','acelga','col','lechuga','ejote','chícharo',
  'garbanzo','frijol','lenteja','alverjón',
  'mandarina','toronja','guayaba','papaya','sandía','melón','kiwi','coco','piña',
  'manzana','pera','durazno','ciruela','zapote','mamey','nectarina','frambuesa',
  'zarzamora','arándano','grosella','tamarindo','carambola','maracuyá',
  // Naturaleza
  'cielo','playa','campo','monte','nieve','arena','selva','valle','bahía','costa',
  'rocas','cueva','prado','cerro','brisa','marea','cañón','oasis','delta','golfo',
  'dunas','llano','lomas','flora','fauna','tallo','hojas','nubes','solar','senda',
  'barro','polvo','llano','pampa','sabana','tundra','estepa','páramo',
  'volcán','meseta','arroyo','pantano','glaciar','desierto','pradera','llanura',
  'cumbre','fiordo','marisma','laguna','bosque','sierra','selva','manantial',
  'arrecife','acantilado','estuario','meandro','cascada','catarata','raíces',
  'semilla','corteza','madera','musgo','helecho','liquen','hongo','alga',
  'espiga','raíz','tronco','rama','flor','hoja','fruto','bulbo','tubérculo',
  'pétalo','sépalo','estambre','pistilo','néctar','savia','resina','látex',
  'manada','colonia','cardumen','bandada','enjambre','jauría','piara','rebaño',
  // Casa, hogar y objetos
  'silla','tabla','reloj','pluma','velas','cinta','techo','pared','suelo','marco',
  'bolsa','llave','disco','radio','cofre','libro','plano','cajón','botón','cajas',
  'jarra','camas','vasos','horno','fogón','patio','muros','pisos','funda','clavo',
  'pinza','aguja','hilo','tela','manta','jabón','peine','rueda','motor','cable',
  'espejo','cojín','mantel','cortina','alfombra','cerrojo','bisagra','gancho',
  'tornillo','tuerca','perno','clamps','lijar','lija','brocha','pincel','paleta',
  'cubeta','escoba','trapeador','jerga','trapo','tamiz','colador','embudo',
  'cacerola','sartén','olla','cazuela','comal','tazón','tarro','frasco','botella',
  'vaso','copa','taza','jarro','tetera','cafetera','licuadora','batidora',
  'nevera','estufa','horno','microondas','lavavajillas','lavadora','secadora',
  'plancha','aspiradora','ventilador','calefactor','purificador',
  'sofá','sillón','mecedora','banqueta','taburete','cama','colchón','almohada',
  'edredón','sábana','manta','frazada','cobija','toalla','paño','trapo',
  'puerta','ventana','balcón','escalera','pasillo','vestíbulo','recibidor',
  'sala','comedor','cocina','baño','recámara','estudio','bodega','garaje',
  'jardín','terraza','azotea','ático','sótano','pórtico','enrejado',
  // Ropa y accesorios
  'falda','blusa','gorra','botas','anillo','collar','bufanda','chaleco','traje',
  'lazo','manga','bolso','pañuelo','camisa','abrigo','guante','zapato','joya',
  'pulsera','capucha','overol','bikini','bata','camisp','pijama','calzón',
  'sostén','medias','calcetín','pantuflas','tacones','sandalias','tenis','mocasín',
  'cinto','cinturón','hebilla','broche','imperdible','cartera','monedero','mochila',
  'maleta','bolsillo','capucha','solapa','cuello','dobladillo','cremallera',
  'botón','ojal','costura','tela','lino','seda','algodón','lana','polar',
  // Ciudad y lugares
  'plaza','hotel','museo','banco','casas','punto','ritmo','gusto','lucha','drama',
  'humor','labor','danza','canto','pacto','señal','cargo','calle','broma','polvo',
  'mundo','globo','barco','piano','cines','salas','aulas','parque','feria','puerto',
  'barrio','aldea','villa','paseo','atajo','túnel','puente','torre','chalet','palco',
  'ciudad','pueblo','capital','campus','avenida','camino','sendero',
  'iglesia','templo','capilla','catedral','basílica','mezquita','sinagoga',
  'escuela','colegio','universidad','biblioteca','laboratorio','gimnasio',
  'clínica','hospital','farmacia','consultorio','laboratorio',
  'tienda','mercado','supermercado','panadería','carnicería','frutería','taquería',
  'restaurante','cafetería','bar','cantina','discoteca','cine','teatro','circo',
  'estadio','cancha','pista','velódromo','alberca','gymnasium',
  'estación','aeropuerto','terminal','muelle','embarcadero','aduana','andén',
  'autopista','carretera','boulevar','glorieta','intersección','semáforo',
  'parque','jardín','bosque','selva','zoológico','acuario','planetario',
  // Transporte
  'carro','coche','moto','bici','avión','barco','tren','metro','camión','autobús',
  'taxi','ferry','yate','lancha','canoa','kayak','velero','submarino',
  'helicóptero','dron','cohete','satélite','tranvía','góndola','teleférico',
  // Colores y descriptivos
  'verde','negro','rubio','claro','sabio','bravo','feliz','fuego','nuevo','primo',
  'largo','corto','ancho','gordo','flaco','suave','tibio','vacío','pleno','veloz',
  'mejor','mayor','menor','ciego','calvo','justo','bueno','malos','bello','noble',
  'digno','crudo','limpio','sucio','listo','bruto','amargo','salado','blando','duro',
  'viejo','joven','sano','leal','fiel','lento','recto','curvo','liso','tosco',
  'lerdo','torpe','ágil','sabio','sabido','necio','vivo','muerto','fresco',
  'rojo','azul','rosa','gris','café','ocre','lila','cyan','beige','turquesa',
  'dorado','plateado','olivo','coral','salmón','marfil','crema','borgoña',
  'intenso','pálido','oscuro','brillante','mate','opaco','traslúcido','transparente',
  'suave','áspero','rugoso','pulido','esponjoso','elástico','rígido','frágil',
  // Verbos comunes
  'jugar','comer','vivir','andar','abrir','subir','mirar','salir','traer','poner',
  'saber','poder','decir','venir','tener','hacer','pedir','tocar','tirar','meter',
  'sacar','ganar','crear','pintar','coser','tejer','lavar','cortar','romper','doblar',
  'cerrar','girar','tomar','beber','rezar','amar','temer','soñar','nadar','correr',
  'volar','gritar','llorar','cantar','bailar','saltar','buscar','hallar','barrer',
  'cocinar','leer','escribir','dibujar','pintar','colorear','borrar','trazar',
  'medir','pesar','contar','sumar','restar','dividir','multiplicar',
  'llamar','visitar','encontrar','conocer','aprender','enseñar','estudiar',
  'trabajar','descansar','dormir','despertar','levantarse','sentarse','pararse',
  'hablar','escuchar','cantar','silbar','tocar','aplaudir','gritar','susurrar',
  'sonreír','reír','llorar','besar','abrazar','saludar','despedirse',
  'comprar','vender','pagar','cobrar','gastar','ahorrar','invertir','donar',
  'abrir','cerrar','entrar','salir','subir','bajar','girar','empujar','jalar',
  // Sentimientos y emociones
  'calor','miedo','rabia','sudor','honor','prisa','rumbo','penas','celos','temor',
  'dolor','calma','susto','deseo','culpa','enojo','odio','furia','amor','gozo',
  'pena','pavor','asco','grima','pudor','apego','rabia',
  'alegría','tristeza','nostalgia','euforia','paz','ansiedad','angustia',
  'vergüenza','orgullo','envidia','cariño','ternura','melancolía','felicidad',
  'esperanza','fe','duda','confianza','gratitud','compasión','empatía',
  // Familia y personas
  'madre','padre','niños','mujer','chica','chico','primo','nieta','novia','novio',
  'socio','amiga','amigo','ángel','reina','reyes','conde','damas','bebés','yerno',
  'nuera','baron','duque','noble','abuela','abuelo','tíos','padrino','madrina',
  'sobrino','cuñado','gemelo','adulto','joven','viudo','viuda','soltero','casado',
  'huérfano','adoptado','tutora','guardián','vecina','vecino','compañero','colega',
  'rival','enemigo','aliado','cómplice','testigo','víctima','héroe','villano',
  // Trabajo y oficios
  'médico','piloto','chofer','actor','poeta','cantante','músico','cocinero',
  'mesero','enfermero','guardia','policía','bombero','maestro','doctor','guía',
  'jefe','líder','capitán','abogado','juez','fiscal','notario','árbitro',
  'técnico','mecánico','electricista','plomero','carpintero','albañil','jardinero',
  'costurero','sastre','zapatero','peluquero','veterinario','biólogo','químico',
  'físico','matemático','historiador','filósofo','psicólogo','sociólogo',
  'economista','contador','administrador','gerente','director','presidente',
  'senador','diputado','gobernador','alcalde','secretario','ministro','embajador',
  // Tiempo y clima
  'horas','meses','siglo','fecha','noche','tarde','época','clima','viento','granizo',
  'bruma','rocío','calor','ardor','temporal','turno','etapa','plazo',
  'martes','jueves','viernes','sábado','lunes','agosto','junio','enero','mayo',
  'lluvioso','soleado','nublado','tormentoso','ventoso','helado','cálido','húmedo',
  'amanecer','atardecer','mediodía','medianoche','madrugada',
  // Deportes y juegos
  'tenis','boxeo','lucha','rugby','arco','cancha','equipo','torneo','ligas','copa',
  'gol','punto','tanto','pieza','ficha','dado','carta','torre','peón','jaque',
  'tablero','turno','ronda','empate','árbitro','campeón','medalla','récord',
  'fútbol','básquet','béisbol','volibol','natación','ciclismo','esgrima','atletismo',
  'ajedrez','damas','dominó','lotería','póker','cribbage',
  // Tecnología y ciencia
  'datos','clave','tecla','ratón','bases','sitio','virus','panel','robot','fibra',
  'señal','nube','carga','cable','disco','código','botón','menú','icono','imagen',
  'video','audio','texto','juego','red','chip','láser','imán','onda','átomo',
  'electrón','protón','neutrón','fotón','fotón','plasma','gas','sólido','líquido',
  'fuerza','masa','velocidad','energía','calor','luz','sonido','vibración',
  'célula','núcleo','membrana','citoplasma','cromosoma','gen','proteína','enzima',
  'bacteria','virus','hongo','alga','musgo','helecho','briofita',
  // Música y arte
  'piano','notas','ritmo','canto','tonos','rumba','salsa','tango','samba','banda',
  'coro','letra','verso','compás','tempo','acorde','cello','laúd','saxo',
  'guitarra','violín','flauta','tambor','arpa','trompeta','batería','órgano',
  'oboe','tuba','clarinete','acordeón','mandolina','banjo','sitar','balalaika',
  'pintura','escultura','fotografía','dibujo','grabado','cerámica','textil',
  'ballet','ópera','teatro','circo','mimo','danza','zarzuela','flamenco',
  // Abstractos y comunes
  'razón','acero','justo','molde','salud','listo','perla','roble','moral','final',
  'total','vital','genio','noble','línea','álbum','ámbar','envío','etapa','gesto',
  'karma','lleno','obvio','pausa','quizá','siglo','tropa','vicio','almas','espía',
  'farol','grano','hecho','igual','jamón','lunar','norma','otoño','rango','siete',
  'yogur','logro','éxito','misma','causa','valor','ideas','mente','forma','regla',
  'leyes','clase','suerte','riesgo','crisis','gasto','turno','oferta','peso','costo',
  'centro','marca','nombre','firma','brote','nota','cifra','dato','ficha','texto',
  'curso','mapa','ruta','modo','tipo','tasa','tema','sueldo','renta','sala',
  'fondo','talón','orden','truco','pista','ruido','caos',
  // Cotidianas adicionales
  'abeja','acera','aguas','alzar','apodo','armar','atajo','aviso','baile','balde',
  'bañar','barba','beber','bomba','buceo','buque','burla','buzón','cabal','caída',
  'calvo','cañas','ceder','celda','cenar','cerco','clavo','cobre','coral','crudo',
  'cubos','dardo','dedal','deseo','dieta','digno','dique','droga','ducha','duelo',
  'erizo','error','falda','faros','favor','feria','finca','golpe','grado','grifo',
  'grúas','habas','huida','impar','jabón','legua','macho','matiz','moler','momia',
  'muela','nacar','nudos','ollas','pegar','picar','pozos','puños','queja','ramos',
  'ratos','regar','ronda','rugir','sabor','secar','senda','solar','sonar','tapar',
  'timón','trapo','tubos','turco','untar','vagón','vigas','manta','audio','canoa',
  'yate','barca','pesca','tinta','papel','cuento','poema','carta','soplo','grito',
  'brida','cauce','cetro','colmo','cuota','dogma','fango','fleco','freno','garra',
  'greda','grumo','hebra','leña','linfa','llaga','nardo','nicho','palio','pasmo',
  'renta','resto','rigor','rumor','sagaz','savia','sesgo','solaz','sopor','tañer',
  'telón','toldo','traza','zanja','adobe','bulto','burda','cisma','decor','feraz',
  'garbo','hiato','hosco','jaspe','libar','rapaz','sorbo','tapiz','trozo','zurra',
  'añejo','dueño','sueño','paños','bañar','guiño','moños','piñón','cariño',
  'hazañ','pañal','empeñ','enseñ','cuñas','engañ','gruñe','puñal','señor','tañer',
  'teñir','marañ','ñoqui','moños','peñón','seños',
];

// ════════════════════════════════════════════════════════════
// HARDCORE WORDS — Vocabulario avanzado/culto/técnico ~2200 palabras
// ════════════════════════════════════════════════════════════
const HARDCORE_RAW = [
  // Palabras con tilde difíciles
  'ácido','álamo','ámbar','ánima','ápice','áspid','átomo','ávido','ázimo','ébano',
  'élite','éxodo','ético','ídolo','índex','ínter','íbero','óbice','óntic','ónice',
  'ópalo','ópera','óvalo','óxido','único','útero','cáliz','cénit','códex','cúbit',
  'céfir','dátil','débil','dócil','fémur','flúor','tórax','áorta','bícep','bóvid',
  'cómic','dúplo','fétid','gélid','bálsamo','cénit','cínico','dígito','éxtasis',
  'fósil','géiser','héroe','ícono','júbilo','kéfir','láser','mérito','néctar',
  'órbita','pájaro','quórum','récord','sótano','última','vórtex',
  // Anatomía y medicina
  'tórax','fíbra','tibia','sutur','lupus','renal','hepát','nódal','sépsi','edema',
  'lesión','tóxico','letal','sérum','vacuna','biops','tumor','quist','úlcer','coágu',
  'tromb','infar','herni','cróni','agudo','septi','pedia','ginec','derma','trauma',
  'cólico','émbol','flebitis','anemia','diabética','artritis','migraña',
  'esclerosis','epilepsia','parkinson','alzheimer','esquizofrenia',
  'hematoma','contusión','fractura','esguince','luxación','herida','absceso',
  'seroma','edema','ascitis','íctero','cirrosis','hepatitis','gastritis','colitis',
  'anestesia','cirugía','biopsia','radioterapia','quimioterapia','diálisis',
  'trasplante','prótesis','ortesis','catéter','endoscopia','laparoscopia',
  // Botánica
  'sépalo','pétalo','xilema','floema','tallo','raíz','fronde','estolón','rizoma',
  'bulbo','tubérculo','cálice','savia','resina','corteza','leñosa','musgo','helecho',
  'liquen','hongo','alga','espesura','sotobosque','dosel','epífita','parásita',
  'briófita','pteridofita','gimnosperma','angiosperma','monocotiledónea',
  'dicotiledónea','leguminosa','gramínea','crucífera','rosácea','solanácea',
  'cucurbitácea','compuesta','umbelífera','labiada','escrofulariácea','liliácea',
  // Mineralogía y geología
  'ágata','berilo','jaspe','ópalo','topaz','cuarzo','pirita','feldespato','basalto',
  'granito','obsidiana','pómez','arcilla','sílice','yeso','mármol','pizarra','esquisto',
  'caliza','grafito','diamante','rubí','esmeralda','zafiro','amatista','peridoto',
  'turquesa','malaquita','hematita','magnetita','galena','casiterita','cinabrio',
  'corundum','espinela','granate','circón','olivino','piroxeno','anfíbol','mica',
  'feldespato','cuarzo','calcita','dolomita','aragonito','apatita','fluorita',
  // Química y física
  'ácido','álcali','éster','éter','cetona','aldehído','amina','amida','nitrilo',
  'alcohol','fenol','haluro','sulfuro','carburo','silicato','fosfato','nitrato',
  'sulfato','cloruro','bromuro','yoduro','acetato','benzoato','citrato','oxalato',
  'catálisis','electrólisis','oxidación','reducción','precipitación','destilación',
  'sublimación','fusión','ebullición','ionización','condensación','absorción',
  'adsorción','difusión','osmosis','diálisis','cristalización','polimerización',
  'hidrólisis','saponificación','esterificación','halogenación','nitración',
  'fotón','cuanto','bosón','fermión','leptón','hadron','quark','gluón','gravitón',
  'antimateria','neutrino','positrón','muón','pión','kaón','hiperon',
  'inducción','capacitancia','impedancia','reactancia','resonancia','interferencia',
  'difracción','reflexión','refracción','dispersión','polarización','coherencia',
  // Filosofía y humanidades
  'prosa','tesis','épica','sátira','elegía','augur','oráculo','lírica','mímesis',
  'dogma','nihil','éthos','logos','tropo','síntesis','antítesis','ironía','fábula',
  'prólogo','cánon','edición','verso','ética','lógica','filósofo','racionalismo',
  'empirismo','escepticismo','relativismo','nihilismo','existencialismo','pragmatismo',
  'utilitarismo','deontología','teleología','axiolojía','epistemología','ontología',
  'metafísica','fenomenología','hermenéutica','dialéctica','deducción','inducción',
  'abducción','analogía','silogismo','paradoja','dilema','aporía','sofisma',
  'argumento','premisa','conclusión','validez','veracidad','objetividad','subjetividad',
  // Derecho
  'juicio','causa','leyes','fuero','dicter','acuerdo','decreto','norma','sanción',
  'multa','penas','delito','fraude','robo','estafa','falta','hurto','lesión','culpa',
  'abogado','fiscal','juez','reo','testigo','demanda','firma','acta','jurar',
  'sentencia','recurso','apelación','casación','amparo','reforma','iniciativa',
  'promulgar','publicar','derogar','abrogar','modificar','interpretar','aplicar',
  // Historia y arqueología
  'ariete','catapulta','trebuchet','ballesta','arco','lanza','sable','escudo',
  'armadura','colgante','amuleto','ofrenda','libación','sacrificio','ritual','culto',
  'jeroglífico','cuneiforme','pictograma','ideograma','alfabeto','silabario',
  'papiro','pergamino','tablilla','códice','incunable','manuscrito','palimpsesto',
  'neolítico','paleolítico','mesolítico','calcolítico','bronce','hierro',
  'megalítico','dolmen','menhir','crómlech','túmulo','necrópolis','hipogeo',
  'ágora','foro','acrópolis','acueducto','anfiteatro','coliseo','circo','termas',
  'catacumba','basílica','baptisterio','capitel','archivolto','mosaico','fresco',
  // Arquitectura
  'ábside','friso','zócalo','arco','dósel','fuste','pórtico','gótico','bóveda',
  'cúpula','fachada','dintel','pilar','base','columna','arco','altar','nave','cripta',
  'torre','muro','almena','garita','flecha','chapitel','moldura','cornisa','loseta',
  'estucado','revoque','enlucido','empedrado','solado','chapado','enchape','revestimiento',
  'celosía','persiana','alféizar','jamba','dovela','clave','plementería','contrafuerte',
  'arbotante','gárgola','pináculo','chapitel','linterna','lucernario','hastial',
  // Marinería y navegación
  'estay','bauprés','bita','botavara','cabo','driza','eslora','gabia','orzar','rizar',
  'timón','vigía','calatrave','carel','draga','fonda','galón','lancha','mástil',
  'proel','quilla','rumbo','sirga','tajar','varada','virar','zabra',
  'latitud','longitud','acimut','declinación','altitud','azimut','náutica','derrotero',
  'bitácora','sextante','cronómetro','brújula','compás','carta','pilotaje',
  'fondeadero','varadero','dársena','escollera','rompeolas','malecón','embarcadero',
  'amarre','ancla','cadena','anda','boya','baliza','faro','señal','balizaje',
  // Literatura y retórica
  'aliteración','anáfora','antítesis','apóstrofe','asíndeton','asíndeton','asíndeton',
  'hipérbole','hipérbaton','ironía','metonimia','metáfora','oxímoron','paradoja',
  'paronomasia','perífrasis','pleonasmo','polisíndeton','prosopopeya','sinécdoque',
  'sinonimia','antónimo','polisemia','ambigüedad','homonimia','paronimia','homofonía',
  'alomorfo','morfema','lexema','grafema','fonema','sílaba','diptongo','triptongo',
  'hiato','acento','tilde','tónico','átono','aguda','grave','esdrújula','sobresdrújula',
  // Arcaísmos y cultos RAE
  'acervo','adust','agraz','ahíto','albur','aleve','alfé','almez','anodó','aovad',
  'apiñar','arcón','arete','arras','atril','audaz','avezar','axioma','azaga','bahar',
  'balaj','bajel','bodón','broca','bucar','calva','cañiz','catar','celad','cendal',
  'cesto','choza','cimbl','cisma','cobij','cofré','colmo','coral','cruza','cuñar',
  'decor','deudo','diván','dogma','dosel','ejido','enojo','erial','exord','faena',
  'farsa','fasci','feraz','fiord','fluir','furor','gacel','garbo','garfi','genol',
  'gleba','golfán','guald','halco','helar','hiato','hosco','impar','irisa',
  'jaspe','joyel','jurel','lacón','lacra','lacre','lerdo','lezna','libar','llaga',
  'macil','magma','mefít','mezón','mirra','mojar','morbo','mugir','naíta','nimbo',
  'nódal','obrar','obvió','oleaj','opaco','orlar','osado','pábil','palúd','pasmo',
  'pecio','petró','pilar','pívot','plebe','plomó','podio','praxi','pugnar','punzó',
  'quimo','ragúz','redil','rezar','ribaz','ronco','rumor','sarco','sazón','sesgo',
  'sinuó','sobré','solaz','sopor','sudor','sumir','tabúr','tañer','templar','tizón',
  'topar','trama','truán','ungir','uñero','vahíd','veler','verbo','vetea','viñed',
  'viraz','volco','volver','yedra','yermo','yesca','zafar','zagal','zancó','zarco',
  // Palabras técnicas de ciencias
  'xenón','xilol','xifón','quórum','quena','quino','quina','quima','quilo','quimo',
  'fibra','tibia','riñón','basal','génic','ácida','plasm','célula','mitosis',
  'meiosis','profase','metafase','anafase','telofase','interfase','cromosoma',
  'alelo','locus','fenotipo','genotipo','haploide','diploide','poliploide',
  'organismo','eucariota','procariota','arqueobacteria','eubacteria','protisto',
  'fungi','animalia','plantae','virus','prión','virión','cápside','envoltura',
  'antígeno','anticuerpo','inmunidad','vacuna','suero','plasma','linfocito',
  'eritrocito','leucocito','plaqueta','hemoglobina','hemograma','bioquímica',
  // Gastronomía técnica
  'fumét','glasé','liaré','napado','ragú','brear','caldos','claro','cocer',
  'cuajo','emuls','fermentación','fondo','genoese','gratin','hervir','infus',
  'macerar','pelar','reducción','sazonar','sofrít','templar','tornear','vapor',
  'saltear','blanquear','escaldar','glasear','napar','ligar','reducir','tamizar',
  'batir','amasar','fermentar','leudar','gratiñar','brasear','estofar','pochar',
  'confitar','marinar','curar','ahumar','macerar','acidular','emulsionar',
  // Textiles y materiales
  'lienzo','seda','raso','terliz','dril','gasar','muaré','rasón','tafetán',
  'felpa','franela','bayeta','paños','satén','brocado','damasco','otomán','crepé',
  'tricot','hilado','tejido','trenzado','urdimbre','cardado','bobina','huso','ovillo',
  'algodón','lino','cáñamo','yute','sisal','henequén','alpaca','lana','seda','nailón',
  'poliéster','acrílico','viscosa','modal','lycea','elastano','microfibrra','gore-tex',
  // Xenónimos y términos internacionales
  'ballet','kabuki','manga','anime','bonsai','sushi','ramen','tofu','sake','miso',
  'haiku','karma','yoga','zen','chai','curry','chutney','chow','wok','soja',
  'taekwondo','karate','judo','aikido','kendo','sumo','capoeira','sambo','krav-maga',
  // Palabras difíciles con ñ
  'añejo','cañón','dueño','muñón','paños','reñir','sueño','uñero','daños','piñón',
  'riñón','peñas','coñac','cañas','bañar','guiño','moños','niños','ñoños',
  'hazaña','pañal','empeñar','enseñar','ordeñar','rapiña','riñas','vilancico',
  'cuñas','engañar','gruñir','puñal','señor','tañer','teñir','marañón','ñoqui',
  // Palabras poco comunes RAE
  'ábaco','abrogado','acéfalo','acérrimo','aciago','acierto','acmé','acontecer',
  'acopiar','acreditar','acuciar','aculturación','adagio','adagio','adalid',
  'adánico','adarga','adehala','adentrar','diestro','adusto','afable','afanoso',
  'aférrimo','agio','agónico','agreste','agrimensor','agrupación','ahijado',
  'airado','aireado','aisfibias','ajeno','ajonjolí','ajourné','albedrio','albor',
  'alborozo','álbum','alcahuete','alhaja','alheli','alheña','alimaña','alinde',
  'alinear','alisio','alquimia','altruismo','altivez','amancebarse','amargo',
  'amenaza','amotinar','amplitud','anacrónico','analfabeto','analógico','anchura',
  'andamio','angustiar','añadir','aparejo','apelativo','apemia','apercibir',
  'ápodo','apotegma','apóstata','arbitrar','arcano','ardid','argolla','argüir',
  'aridez','arisco','arrebatar','arrogante','artículo','asaciar','asaltar',
  'asaz','asiduo','asombro','áspero','atávico','atáxia','atavío','atemperar',
  'átonito','atrición','atroz','auge','augurar','avasallar','ávaro','axila',
  'azeite','azogue','baldear','barbárico','bastidor','batallón','benigno','berrinche',
  'bestial','bíblico','bigardo','bigote','bivio','blasfemo','bochornoso','boicot',
  'bravío','brisote','brusco','burlesco','cabal','cabalístico','cacique','cadalso',
  'cádaver','calambre','calmoso','camaleón','cánico','capricho','cárdeno','carísimo',
  'carnaval','castigar','catecismo','cautivo','cazurro','celo','celosía','cénizo',
  'cercano','chabacano','chiflado','chillido','chisme','chivo','chistoso','cínico',
  'circunciso','cisma','claustro','codiciar','cohibir','comadre','cómico','compadre',
  'compás','cónclave','condenar','cónico','consabido','consuelo','contrito','convulso',
  'copioso','coránico','cosquillas','crítico','crujido','cuanto','cucaracha','cuento',
  'culebrón','cuspidal','dantesco','décima','despecho','dictamen','difunto','digresión',
  'dilación','diligente','dipsómano','diserto','disfraz','disgusto','ditirámbo',
  'divino','dócil','dogmático','dominante','dubitativo','dulcísimo',
  // Palabras de letras y artes
  'acróstico','anagrama','calambur','caligrama','centón','clerihew','colofón',
  'décima','endecha','ensalada','epigrama','eslogan','estancia','estribillo',
  'fábula','haikú','idilio','lamento','lítote','madrigal','ode','ovilejo',
  'palíndromo','parodia','pastoral','pentámetro','poema','quintilla','redondilla',
  'romancillo','rondel','serranilla','sextina','soneto','terceto','triolet','trova',
  'villancico','virelai','zaijal','zéjel','acróstico','caligrama',
];

function normLen(w) {
  return w.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[ñÑ]/g,'n').replace(/[üÜ]/g,'u').toLowerCase();
}
function isValid(w) {
  if (typeof w !== 'string') return false;
  const n = normLen(w);
  return n.length === 5 && /^[a-z]{5}$/.test(n);
}

const easyFiltered = [...new Set(EASY_RAW)].filter(isValid);
const hardcoreFiltered = [...new Set(HARDCORE_RAW)].filter(isValid);

console.log(`✅ Easy words válidas: ${easyFiltered.length}`);
console.log(`✅ Hardcore words válidas: ${hardcoreFiltered.length}`);

function toBlock(name, arr) {
  let lines = [];
  for (let i = 0; i < arr.length; i += 10) {
    lines.push('    ' + arr.slice(i, i+10).map(w=>`'${w}'`).join(','));
  }
  return `const ${name} = [\n${lines.join(',\n')}\n  ]`;
}

const fs = require('fs');
let content = fs.readFileSync('./games/wordle/wordle.js', 'utf8');

// Replace EASY_WORDS
let s = content.indexOf('const EASY_WORDS = [');
let e = content.indexOf('];', s) + 2;
content = content.substring(0, s) + toBlock('EASY_WORDS', easyFiltered) + content.substring(e);

// Replace HARDCORE_WORDS
s = content.indexOf('const HARDCORE_WORDS = [');
e = content.indexOf('];', s) + 2;
content = content.substring(0, s) + toBlock('HARDCORE_WORDS', hardcoreFiltered) + content.substring(e);

fs.writeFileSync('./games/wordle/wordle.js', content, 'utf8');
console.log('✅ wordle.js actualizado. Recarga el juego con F5.');
