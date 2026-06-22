/**
 * StreamSync Wordle — Live Interactive Game v4
 * 
 * TWO GAME MODES:
 *   🎮 STREAMER — Streamer plays via keyboard. Easy / Hardcore difficulty.
 *   👥 VIEWERS  — Chat viewers play. Filterable by role (all, admins, subs, quiéreme).
 *
 * 10,000+ Spanish 5-letter words (powered by an-array-of-spanish-words)
 * EASY: ~800 common curated words
 * HARDCORE: ALL 10,836 words from the full Spanish dictionary
 */
(function () {
  'use strict';

  const WORD_LENGTH = 5;
  const MAX_ATTEMPTS = 6;
  const BACKEND_URL = 'http://localhost:3000';

  // ════════════════════════════════════════════
  //  EASY WORDS (~800 common Spanish words)
  // ════════════════════════════════════════════
  const EASY_WORDS = [
    'perro','gatos','tigre','ratón','cisne','zorro','pulpo','cabra','cerdo','burro',
    'patos','llama','cebra','hiena','lince','potro','corzo','garza','morsa','cobra',
    'ranas','sapos','lobos','vacas','toros','yegua','mulas','buhos','oveja','ganso',
    'mosca','abeja','bicho','koala','panda','coyot','grajo','nariz','lecón','mirlo',
    'tucán','guila','oruga','gamba','pulga','plato','leche','huevo','arroz','queso',
    'limón','melón','torta','salsa','dulce','fruta','crema','pollo','tapas','pasta',
    'pizza','jugos','sopas','tacos','carne','panes','vinos','copas','tazas','menta',
    'fresa','mango','papas','cocos','higos','pasas','trigo','avena','moras','peras',
    'setas','oliva','natas','jalea','masas','caldo','piñas','chile','nacha','mochi',
    'sushi','cacao','atole','pozol','porra','birra','cocoa','dátil','sopón','torte',
    'tosta','cruda','cocid','asada','vapor','cielo','playa','campo','monte','nieve',
    'arena','selva','valle','bahía','costa','rocas','cueva','prado','cerro','brisa',
    'marea','cañón','oasis','delta','golfo','dunas','llano','lomas','flora','fauna',
    'tallo','hojas','nubes','solar','senda','barro','polvo','silla','tabla','reloj',
    'pluma','velas','cinta','techo','pared','suelo','marco','bolsa','llave','disco',
    'radio','cofre','libro','plano','cajón','botón','cajas','jarra','camas','vasos',
    'horno','fogón','patio','muros','pisos','funda','clavo','pinza','aguja','manta',
    'jabón','peine','rueda','motor','cable','cojín','falda','blusa','gorra','botas',
    'traje','manga','bolso','verde','negro','rubio','claro','sabio','bravo','feliz',
    'fuego','nuevo','primo','largo','corto','ancho','gordo','flaco','suave','tibio',
    'vacío','pleno','veloz','mejor','mayor','menor','ciego','calvo','justo','bueno',
    'malos','bello','noble','digno','crudo','sucio','listo','bruto','viejo','joven',
    'lento','recto','curvo','tosco','lerdo','sabor','agrio','ácido','jugar','comer',
    'vivir','andar','abrir','subir','mirar','salir','traer','poner','saber','poder',
    'decir','venir','tener','hacer','pedir','tocar','tirar','meter','sacar','ganar',
    'crear','coser','tejer','lavar','girar','tomar','beber','rezar','temer','soñar',
    'nadar','volar','calor','miedo','rabia','sudor','honor','prisa','rumbo','penas',
    'celos','temor','dolor','calma','susto','deseo','culpa','enojo','furia','pavor',
    'grima','pudor','apego','madre','padre','niños','mujer','chica','chico','nieta',
    'novia','novio','socio','amiga','amigo','ángel','reina','reyes','conde','damas',
    'bebés','yerno','nuera','baron','duque','plaza','hotel','museo','banco','casas',
    'punto','ritmo','gusto','lucha','drama','humor','labor','danza','canto','pacto',
    'señal','cargo','calle','broma','mundo','globo','barco','piano','cines','salas',
    'aulas','feria','aldea','villa','paseo','atajo','túnel','torre','palco','horas',
    'meses','siglo','fecha','noche','tarde','época','clima','bruma','rocío','ardor',
    'turno','etapa','plazo','brazo','manos','dedos','pecho','hueso','labio','cuero',
    'cejas','talón','tenis','boxeo','rugby','ligas','tanto','pieza','ficha','carta',
    'jaque','ronda','datos','clave','tecla','bases','sitio','virus','panel','robot',
    'fibra','carga','icono','video','audio','texto','juego','notas','tonos','rumba',
    'tango','samba','banda','letra','verso','tempo','cello','razón','acero','molde',
    'salud','perla','roble','moral','final','total','vital','genio','línea','álbum',
    'ámbar','envío','gesto','karma','lleno','obvio','pausa','quizá','tropa','vicio',
    'almas','espía','farol','grano','hecho','igual','jamón','lunar','norma','otoño',
    'rango','siete','yogur','logro','éxito','misma','causa','valor','ideas','mente',
    'forma','regla','leyes','clase','gasto','costo','marca','firma','brote','cifra',
    'curso','renta','fondo','acera','aguas','alzar','apodo','armar','aviso','baile',
    'balde','bañar','barba','bomba','buceo','buque','burla','buzón','cabal','caída',
    'cañas','ceder','celda','cenar','cerco','cobre','coral','cubos','dardo','dedal',
    'dieta','dique','droga','ducha','duelo','erizo','error','faros','favor','finca',
    'golpe','grado','grifo','grúas','habas','huida','impar','legua','macho','matiz',
    'moler','momia','muela','nacar','nudos','ollas','pegar','picar','pozos','puños',
    'queja','ramos','ratos','regar','rugir','secar','sonar','tapar','timón','trapo',
    'tubos','turco','untar','vagón','vigas','canoa','barca','pesca','tinta','papel',
    'poema','soplo','grito','orden','truco','pista','ruido','brida','cauce','cetro',
    'colmo','cuota','dogma','fango','fleco','freno','garra','greda','grumo','hebra',
    'linfa','llaga','nardo','nicho','palio','pasmo','resto','rigor','rumor','sagaz',
    'savia','sesgo','solaz','sopor','tañer','telón','toldo','traza','vesta','zanja',
    'adobe','bulto','burda','cisma','decor','feraz','garbo','hiato','hosco','jaspe',
    'libar','rapaz','sorbo','tapiz','trozo','zurra','añejo','dueño','sueño','paños',
    'guiño','moños','piñón',
    // ── Palabras comunes adicionales ──
    'araña','reñir','señor','tribu','palma','bruja','plata','hielo','hogar','libre',
    'lindo','cruel','trono','fallo','flojo','junta','vasto','astro','casco','denso',
    'firme','flujo','fumar','gripe','guapo','herir','indio','jaula','lapso','latir',
    'limbo','mafia','malla','manso','media','morir','nacer','optar','pagar','pasar',
    'pasto','penal','pesar','plaga','polar','pugna','racha','rasgo','regir','remar',
    'risco','rival','ruina','sacro','sanar','sauce','talla','tenor','terco','trago',
    'trama','trece','usted','valer','valla','varón','vigor','viral','voces','yerba',
    'zurdo','abuso','agudo','ajeno','altar','ameno','apuro','avaro','bajar','boina',
    'borde','breve','bucle','caber','calco','caspa','ciega','cisco','citar','cobro',
    'cruce','deber','demás','doble','durar','enano','errar','falso','fijar','furia',
    'gozar','grave','guiar','guiso','hueco','labra','lecho','legal','lejos','licor',
    'lirio','magia','matar','mixto','mover','multa','nadie','ojear','pacta','parir',
    'pelar','pilar','plomo','prosa','pulir','quema','signo','sirve','sobre','soler',
    'sordo','sumar','surco','tarea','torpe','turba','único','unión','viuda','zarpa',
    'alado','asado','ateos','banca','bicho','bocas','bolas','borde','brote','cacao',
    'capaz','ceder','cesta','choza','colar','comer','cómic','común','costa','cuñas',
    'daños','diosa','disco','duque','elite','emma','fallo','fasto','feria','fiero',
    'frase','freno','globo','gorra','hábil','hilos','hongo','huevo','jefes','judío',
    'karma','lanza','latín','leona','ligas','lotes','lucir','llama','macho','marea',
    'menta','metro','minas','mocho','mugir','negar','nubla','obeso','oliva','opera',
    'osado','patio','persa','picar','pinta','prado','queso','rally','rango','regar',
    'riñón','rugir','saldo','selva','siglo','silbo','sopla','sucia','tenis','tigre',
    'tocar','tumba','urbe','usura','vacas','vapor','verde','vigía','vivaz','yegua',
    'señas','teñir','gruñe','puñal','peñas','caños','seños','leñas','riñas','cuñar',
    'pañal','ñoqui','niñez','piñas','muñón','uñero',
    // ── Animales extra ──
    'ratón','cisne','zorro','erizo','gallo','topo','perra','burra','jirafa',
    'paloma','grulla','lobo','vaca','toro','rana','sapo','mosca','abeja',
    // ── Comida extra ──
    'zumos','tortas','tamales','atun','yogur','cereal','tacos','tamal',
    'salsa','pollo','queso','leche','arroz','pasta','sopa','pizza',
    // ── Personas / familia extra ──
    'amado','nieto','yerno','suegra','primo','prima','bebés','baron',
    // ── Lugares extra ──
    'jardin','bosque','muelle','mercado','pueblo',
    // ── Verbos extra ──
    'amar','reir','cantar','bailar','correr','saltar','gritar','luchar',
    'vencer','perder','ayudar','crecer','hablar','escuchar','pensar',
    'sentir','buscar','llevar','llamar',
    // ── Adjetivos extra ──
    'triste','alegre','amargo','fuerte','rapido','lindo','linda','bonito',
    'limpio','oscuro','palido','tierno','fresco','aspero','guapo','guapa',
    // ── Cotidianas ──
    'abajo','ahora','antes','buena','cinco','color','donde','entre',
    'estar','ganas','gente','grupo','gusto','ideal','junto','largo',
    'lista','logro','mejor','mismo','mucho','mundo','nivel','norte',
    'nueva','nuevo','ojala','otros','parte','punto','quien','redes',
    'reino','resto','saber','salud','segun','siete','sobre','tarde',
    'tener','tiene','tirar','tocar','todos','truco','unico','union',
    'usted','valer','veces','venga','vivir','viaje','video','volar',
    // ── Extra comunes ──
    'actor','cargo','carta','causa','cifra','clase','clima','cobro',
    'cortar','corte','creer','curso','datos','deuda','dicho','dolor',
    'duelo','echar','error','favor','falta','final','firma','flujo',
    'forma','fuego','ganar','golpe','grado','grupo','hacer','hasta',
    'hecho','hielo','hogar','honor','image','juega','juego','jugar',
    'labra','largo','lejos','libre','ligas','lucir','llama','magia',
    'mamá','manda','mejor','miles','mundo','nacer','nadie','noche',
    'nueva','nuevo','ojala','pausa','poder','prisa','puede','queda',
    'queja','razón','recib','regla','reina','respeto','salir','salta',
    'sauce','según','signo','sobre','tener','tirar','valor',
  ]

  // ════════════════════════════════════════════
  //  HARDCORE WORDS — Full 10,836 word dictionary
  //  Loaded from spanish_words.js (SPANISH_WORDS_5)
  // ════════════════════════════════════════════
  // Use the full 10,836-word dictionary from spanish_words.js
  // HARDCORE = ALL words from the dictionary (filters out words not in SPANISH_WORDS_5)
  const HARDCORE_WORDS = (typeof SPANISH_WORDS_5 !== 'undefined' ? SPANISH_WORDS_5 : []);

  // Pre-build a normalized Set of ALL valid words for O(1) lookups
  const ALL_WORDS_SET = new Set();
  [...EASY_WORDS, ...HARDCORE_WORDS].forEach(w => {
    ALL_WORDS_SET.add(w.toLowerCase()
      .replace(/ñ/g, '\uFFFF').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\uFFFF/g, 'ñ'));
  });
  console.log(`📚 Diccionario cargado: ${ALL_WORDS_SET.size} palabras únicas (Easy: ${EASY_WORDS.length}, Full: ${HARDCORE_WORDS.length})`);

  // ── STATE ──
  let gameMode = localStorage.getItem('wordle-gameMode') || 'streamer'; // 'streamer' | 'viewers'
  let mode = localStorage.getItem('wordle-mode') || 'easy'; // 'easy' | 'hardcore'
  let viewerFilter = localStorage.getItem('wordle-viewerFilter') || 'all'; // 'all' | 'admins' | 'subscribers' | 'quiereme' | 'rosa_o_quiereme'
  let secretWord = '';
  let secretWordDisplay = '';
  let currentRow = 0;
  let currentCol = 0;
  let gameOver = false;
  let chatPool = [];
  let allGuesses = [];
  let players = new Set();
  let lastGuesser = '';
  let totalAttempts = 0;
  const keyStates = {};

  // Rose gift tracking – users who sent a rose during this stream session
  const roseViewers = new Set();

  // Streaks
  let streaks = JSON.parse(localStorage.getItem('wordle-streaks') || '{}');
  if (!streaks.easy) streaks.easy = { current: 0, best: 0, wins: 0, losses: 0 };
  if (!streaks.hardcore) streaks.hardcore = { current: 0, best: 0, wins: 0, losses: 0 };

  // ── SOCKET ──
  const socket = io(BACKEND_URL);

  // ── DEBUG: Log ALL socket events ──
  socket.onAny((eventName, ...args) => {
    console.log(`🔌 [SOCKET EVENT] ${eventName}`, args);
  });

  socket.on('connect', () => {
    console.log('✅ [WORDLE] Socket conectado al backend:', BACKEND_URL);
    document.getElementById('connection-dot').style.background = 'var(--green)';
  });

  socket.on('connect_error', (err) => {
    console.error('❌ [WORDLE] Error de conexión socket:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.warn('🔌 [WORDLE] Socket desconectado:', reason);
    document.getElementById('connection-dot').style.background = '#ff4444';
  });

  // ── GIFT EVENT: track rose senders ──
  socket.on('gift', (data) => {
    const giftName = (data.giftName || '').toLowerCase();
    const userId = data.uniqueId || 'anon';
    // Detect rose gift by name (TikTok gift names vary: 'Rose', 'Rosa', etc.)
    if (giftName.includes('rose') || giftName.includes('rosa')) {
      if (!roseViewers.has(userId)) {
        roseViewers.add(userId);
        console.log(`🌹 [ROSA] @${userId} desbloqueó permiso de juego con una rosa`);
        showRoseToast(userId, data.profilePic);
      }
    }
  });

  function showRoseToast(userId, profilePic) {
    const t = document.getElementById('toast');
    t.textContent = `🌹 @${userId} envió una rosa y puede jugar!`;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3500);
  }

  socket.on('chat', (data) => {
    console.log(`💬 [WORDLE CHAT] Recibido de @${data.uniqueId}: "${data.comment}" | gameMode=${gameMode}`);

    // In streamer mode, ignore chat for gameplay
    if (gameMode === 'streamer') {
      console.log('   ↳ Ignorado: modo streamer activo');
      return;
    }

    const comment = (data.comment || '').trim().toLowerCase();
    const userId = data.uniqueId || 'anon';

    if (!isValidWord(comment)) {
      console.log(`   ↳ Rechazado: "${comment}" no es palabra válida (5 letras a-záéíóúüñ)`);
      return;
    }

    // Check viewer filter
    if (!canViewerPlay(data)) {
      console.log(`   ↳ Rechazado: filtro de viewers no permite a ${userId} (filtro: ${viewerFilter})`);
      return;
    }

    players.add(userId);
    const normalized = normalizeWord(comment);
    console.log(`   ↳ Palabra válida: "${comment}" → normalizada: "${normalized}"`);

    if (!chatPool.includes(comment)) {
      chatPool.push(comment);
      updatePoolCount();
    }

    if (!gameOver && secretWord) {
      if (!isWordInDictionary(comment)) {
        console.log(`   ↳ Rechazado: "${comment}" NO está en el diccionario (${getPoolForMode().length} palabras)`);
        return;
      }
      console.log(`   ✅ ACEPTADA: "${comment}" por @${userId} | fila=${currentRow}`);
      lastGuesser = userId;
      updateViewerCard(data);
      submitWord(normalized, comment, userId);
    } else {
      console.log(`   ↳ Ignorado: gameOver=${gameOver}, secretWord="${secretWord}"`);
    }
  });

  // ── VIEWER CARD ──
  let viewerCardTimeout;
  function updateViewerCard(data) {
    if (gameMode !== 'viewers') return;
    
    const card = document.getElementById('viewer-card');
    const avatar = document.getElementById('viewer-avatar');
    const placeholder = document.getElementById('viewer-avatar-placeholder');
    const name = document.getElementById('viewer-name');
    const status = document.getElementById('viewer-status');
    
    if (!card) return;

    card.classList.remove('hidden');
    card.classList.remove('winner');
    
    name.textContent = '@' + (data.uniqueId || 'anon');
    status.textContent = `Intentó: ${data.comment.toUpperCase()}`;

    console.log(`🖼️ [AVATAR] @${data.uniqueId} profilePic=${data.profilePic || 'NULL'}`);
    
    if (data.profilePic) {
      avatar.onerror = () => {
        console.warn(`🖼️ [AVATAR] Error loading pic for @${data.uniqueId}, using placeholder`);
        avatar.classList.add('hidden');
        placeholder.classList.remove('hidden');
        placeholder.textContent = (data.uniqueId || '?').charAt(0).toUpperCase();
      };
      avatar.src = data.profilePic;
      avatar.classList.remove('hidden');
      placeholder.classList.add('hidden');
    } else {
      avatar.classList.add('hidden');
      placeholder.classList.remove('hidden');
      placeholder.textContent = (data.uniqueId || '?').charAt(0).toUpperCase();
    }
    
    clearTimeout(viewerCardTimeout);
    if (!gameOver) {
      viewerCardTimeout = setTimeout(() => {
        card.classList.add('hidden');
      }, 5000);
    }
  }

  function setViewerCardWinner() {
    clearTimeout(viewerCardTimeout);
    const card = document.getElementById('viewer-card');
    const status = document.getElementById('viewer-status');
    if (!card) return;
    card.classList.add('winner');
    status.textContent = '¡Adivinó la palabra! 🎉';
  }

  // ── HELPERS ──
  function isValidWord(word) {
    if (!word || word.length !== WORD_LENGTH) return false;
    return /^[a-záéíóúüñ]{5}$/i.test(word);
  }

  function isWordInDictionary(word) {
    const normalized = normalizeWord(word);
    return ALL_WORDS_SET.has(normalized);
  }

  function normalizeWord(word) {
    // Preserve ñ as a distinct letter (it's NOT the same as n in Spanish)
    return word.toLowerCase()
      .replace(/ñ/g, '\uFFFF')          // protect ñ before NFD decomposition
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // remove accent marks (á→a, é→e...)
      .replace(/\uFFFF/g, 'ñ');          // restore ñ
  }

  function getPoolForMode() {
    // Easy = curated common words (~800), Hardcore = ALL 10,836 words from dictionary
    return mode === 'hardcore' ? HARDCORE_WORDS : EASY_WORDS;
  }

  /**
   * Checks if a user has "quiéreme" status.
   * Based on actual TikTok badge data observed:
   *   - badgeScene 10 = "gods" / top fan category (quiéreme indicator)
   *   - badgeScene 6 with ranking (e.g. "no. 3") = top supporter ranking
   *   - topFanLevel > 0
   *   - followRole >= 2
   *   - teamMemberLevel > 0
   *   - fansClub with level > 0
   */
  function hasQuieremeStatus(data, badgeKeys) {
    // Check topFanLevel
    if ((data.topFanLevel || 0) > 0) return true;
    // Check followRole (2+ = friend/quiéreme)
    if ((data.followRole || 0) >= 2) return true;
    // Check teamMemberLevel
    if ((data.teamMemberLevel || 0) > 0) return true;
    // Check fansClub
    if (data.fansClub && (data.fansClub.level > 0 || data.fansClub.data)) return true;

    // Check badge scenes: scene_10 (gods/top category) = quiéreme
    // scene_6 with rank = top supporter = quiéreme
    if (badgeKeys.some(k =>
      k.includes('scene_10') ||  // gods / top fan badge
      k.includes('scene_6')     // top supporter ranking
    )) return true;

    // Check badge text keys for fan/quiereme mentions
    if (badgeKeys.some(k =>
      k.includes('quiereme') || k.includes('quiéreme') ||
      k.includes('gods') || k.includes('top_fan') || k.includes('fan_level')
    )) return true;

    return false;
  }

  function canViewerPlay(data) {
    const badges = data.badges || [];

    // Extract ALL text identifiers from each badge
    const badgeKeys = badges.map(b => {
      const parts = [];
      if (b.type) parts.push(b.type);
      if (b.name) parts.push(b.name);
      if (b.displayType) parts.push(b.displayType);
      // Nested combine.text.key — role name
      if (b.combine?.text?.key) parts.push(b.combine.text.key);
      if (b.combine?.text?.defaultPattern) parts.push(b.combine.text.defaultPattern);
      if (b.combine?.str) parts.push(b.combine.str);
      // badgeScene number
      if (b.badgeScene != null) parts.push(`scene_${b.badgeScene}`);
      return parts.join('|').toLowerCase();
    });

    // Debug: dump badge keys as JSON string so values are visible
    if (viewerFilter !== 'all') {
      console.log(`🔍 [FILTER] @${data.uniqueId} | filter=${viewerFilter} | topFan=${data.topFanLevel} | followRole=${data.followRole} | teamMember=${data.teamMemberLevel} | fansClub=${JSON.stringify(data.fansClub)} | roseUnlocked=${roseViewers.has(data.uniqueId)}`);
      console.log(`🔍 [BADGE-KEYS] @${data.uniqueId}:`, JSON.stringify(badgeKeys));
    }

    switch (viewerFilter) {
      case 'all':
        return true;

      case 'admins':
        if (data.isModerator) return true;
        return badgeKeys.some(k =>
          k.includes('host') || k.includes('moderator') || k.includes('mod') || k.includes('admin')
        );

      case 'subscribers':
        if (data.isSubscriber) return true;
        return badgeKeys.some(k =>
          k.includes('subscriber') || k.includes('sub') || k.includes('subscription')
        );

      case 'quiereme':
        return hasQuieremeStatus(data, badgeKeys);

      case 'rosa_o_quiereme': {
        if (roseViewers.has(data.uniqueId)) return true;
        return hasQuieremeStatus(data, badgeKeys);
      }

      default:
        return true;
    }
  }

  // ── GAME ──
  function startNewGame() {
    const pool = getPoolForMode();
    const idx = Math.floor(Math.random() * pool.length);
    secretWordDisplay = pool[idx];
    secretWord = normalizeWord(secretWordDisplay);
    currentRow = 0;
    currentCol = 0;
    gameOver = false;
    allGuesses = [];
    totalAttempts = 0;
    lastGuesser = '';
    Object.keys(keyStates).forEach(k => delete keyStates[k]);

    // Clear rose permissions each round — viewers must send a new rose per game
    roseViewers.clear();
    console.log('🌹 [ROSA] Lista de rosas limpiada para nueva ronda');

    buildBoard();
    buildKeyboard();
    updatePoolCount();
    updateStreakUI();
    updateUI();
    hideModal();

    const card = document.getElementById('viewer-card');
    if (card) {
      card.classList.add('hidden');
      card.classList.remove('winner');
    }

    const diffLabel = mode === 'hardcore' ? '💀 HARDCORE' : '😊 FÁCIL';
    const modeLabel = gameMode === 'streamer' ? '🎮 Streamer' : '👥 Viewers';
    showToast(`${modeLabel} · ${diffLabel} — ¡Nueva partida!`);
  }

  function submitWord(normalized, display, userId) {
    if (gameOver) return;
    // In streamer mode, enforce the classic 6-attempt limit
    if (gameMode === 'streamer' && currentRow >= MAX_ATTEMPTS) return;

    // ⚠️ Siempre mostramos las letras NORMALIZADAS (sin tilde) en las celdas.
    // Esto evita la confusión de ver "í" amarillo y pensar que coincide con "ó":
    // si el viewer escribe "í", la celda muestra "i", dejando claro que es la "i"
    // de la palabra (p.ej. la "i" de "óxido") lo que activó el amarillo — no la "ó".
    const chars = normalized.split('');
    for (let i = 0; i < WORD_LENGTH; i++) {
      const cell = getCell(currentRow, i);
      cell.textContent = chars[i];
      cell.classList.add('filled');
    }

    evaluateRow(normalized);
    allGuesses.push(normalized);
    totalAttempts++;

    if (normalized === secretWord) {
      gameOver = true;
      recordStreak(true);
      if (gameMode === 'viewers') setViewerCardWinner();
      showModal(true, userId);
      return;
    }

    currentRow++;

    if (currentRow >= MAX_ATTEMPTS) {
      if (gameMode === 'viewers') {
        // Infinite mode: scroll the board up
        scrollBoard();
      } else {
        // Streamer mode: classic game over
        gameOver = true;
        recordStreak(false);
        showModal(false, null);
      }
    }
  }

  /**
   * Scrolls the board up: removes the top row with animation,
   * shifts remaining rows, and adds a fresh empty row at the bottom.
   * Keeps the visual board at exactly 6 rows.
   */
  function scrollBoard() {
    const board = document.getElementById('board');
    const rows = board.querySelectorAll('.row');

    // Animate the top row out
    const topRow = rows[0];
    topRow.classList.add('row-exit');

    setTimeout(() => {
      // Remove the top row from DOM
      topRow.remove();

      // Re-number all remaining cells so getCell() still works
      const remainingRows = board.querySelectorAll('.row');
      remainingRows.forEach((row, r) => {
        const cells = row.querySelectorAll('.cell');
        cells.forEach((cell, c) => {
          cell.id = `cell-${r}-${c}`;
        });
      });

      // Add a new empty row at the bottom
      const newRow = document.createElement('div');
      newRow.className = 'row row-enter';
      for (let c = 0; c < WORD_LENGTH; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.id = `cell-${MAX_ATTEMPTS - 1}-${c}`;
        newRow.appendChild(cell);
      }
      board.appendChild(newRow);

      // Remove animation class after it plays
      setTimeout(() => newRow.classList.remove('row-enter'), 350);

      // currentRow stays at the last row position
      currentRow = MAX_ATTEMPTS - 1;
    }, 300);
  }

  function evaluateRow(guess) {
    const secret = secretWord.split('');
    const guessArr = guess.split('');
    const result = Array(WORD_LENGTH).fill('absent');

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guessArr[i] === secret[i]) { result[i] = 'correct'; secret[i] = null; }
    }
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i] === 'correct') continue;
      const idx = secret.indexOf(guessArr[i]);
      if (idx !== -1) { result[i] = 'present'; secret[idx] = null; }
    }

    for (let i = 0; i < WORD_LENGTH; i++) {
      const cell = getCell(currentRow, i);
      setTimeout(() => cell.classList.add(result[i]), i * 180);

      const letter = guessArr[i];
      const cur = keyStates[letter];
      if (result[i] === 'correct') keyStates[letter] = 'correct';
      else if (result[i] === 'present' && cur !== 'correct') keyStates[letter] = 'present';
      else if (!cur) keyStates[letter] = 'absent';
    }
    setTimeout(updateKeyboard, WORD_LENGTH * 180 + 100);
  }

  // ── STREAKS ──
  function recordStreak(win) {
    const s = streaks[mode];
    if (win) { s.current++; s.wins++; if (s.current > s.best) s.best = s.current; }
    else { s.current = 0; s.losses++; }
    localStorage.setItem('wordle-streaks', JSON.stringify(streaks));
    updateStreakUI();
  }

  function updateStreakUI() {
    const s = streaks[mode];
    document.getElementById('streak-current').textContent = s.current;
    document.getElementById('streak-best').textContent = s.best;
    document.getElementById('streak-wins').textContent = s.wins;
    document.getElementById('streak-losses').textContent = s.losses;
  }

  // ── UI ──
  function buildBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    for (let r = 0; r < MAX_ATTEMPTS; r++) {
      const row = document.createElement('div');
      row.className = 'row';
      for (let c = 0; c < WORD_LENGTH; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.id = `cell-${r}-${c}`;
        row.appendChild(cell);
      }
      board.appendChild(row);
    }
  }

  // Keyboard with accented letters row
  const KB = [
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l','ñ'],
    ['á','é','í','ó','ú'],
    ['ENTER','z','x','c','v','b','n','m','⌫'],
  ];

  function buildKeyboard() {
    const kb = document.getElementById('keyboard');
    kb.innerHTML = '';
    KB.forEach((row, rowIdx) => {
      const r = document.createElement('div');
      r.className = 'keyboard-row';
      row.forEach(key => {
        const b = document.createElement('button');
        let cls = 'key';
        if (key.length > 1) cls += ' wide';
        if (rowIdx === 2) cls += ' accent-key'; // accent row
        b.className = cls;
        b.textContent = key;
        b.id = `key-${key.toLowerCase()}`;
        b.addEventListener('click', () => handleKey(key));
        r.appendChild(b);
      });
      kb.appendChild(r);
    });

    // Show/hide keyboard based on game mode
    if (gameMode === 'viewers') {
      kb.classList.add('kb-hidden');
    } else {
      kb.classList.remove('kb-hidden');
    }
  }

  function updateKeyboard() {
    Object.entries(keyStates).forEach(([l, s]) => {
      // Each keyState key is already a normalized (accent-free) letter.
      // Color the primary key AND any accented variant key that maps to the same base.
      const targets = [l];
      const accentMap = { 'a': 'á', 'e': 'é', 'i': 'í', 'o': 'ó', 'u': 'ú' };
      if (accentMap[l]) targets.push(accentMap[l]);

      targets.forEach(letter => {
        const k = document.getElementById(`key-${letter}`);
        if (k) {
          const isAccent = ['á','é','í','ó','ú'].includes(letter);
          k.className = `key ${s}${isAccent ? ' accent-key' : ''}`;
        }
      });
    });
  }

  // Keyboard input (only works in streamer mode)
  document.addEventListener('keydown', (e) => {
    if (gameMode !== 'streamer') return;
    if (gameOver || !secretWord) return;
    if (e.key === 'Enter') handleKey('ENTER');
    else if (e.key === 'Backspace') handleKey('⌫');
    else if (/^[a-záéíóúüñ]$/i.test(e.key)) handleKey(e.key.toLowerCase());
  });

  function handleKey(key) {
    if (gameMode !== 'streamer') return;
    if (gameOver || !secretWord) return;
    if (key === '⌫') {
      if (currentCol > 0) {
        currentCol--;
        const cell = getCell(currentRow, currentCol);
        cell.textContent = '';
        cell.classList.remove('filled');
      }
    } else if (key === 'ENTER') {
      if (currentCol === WORD_LENGTH) {
        const display = getRowWord(currentRow);
        const normalized = normalizeWord(display);
        if (!isWordInDictionary(display)) {
          shakeRow(currentRow);
          showToast('❌ Palabra no válida');
          // Limpiar las celdas para que el jugador pueda corregirla
          for (let i = 0; i < WORD_LENGTH; i++) {
            const cell = getCell(currentRow, i);
            cell.textContent = '';
            cell.classList.remove('filled');
          }
          currentCol = 0;
          return;
        }
        lastGuesser = '🎮 Streamer';
        submitWord(normalized, display, '🎮 Streamer');
        currentCol = 0;
      } else {
        shakeRow(currentRow);
        showToast('⚠️ Necesitas 5 letras');
      }
    } else if (currentCol < WORD_LENGTH) {
      const cell = getCell(currentRow, currentCol);
      // Mostrar la letra normalizada (sin tilde) en la celda.
      // Así el streamer ve exactamente lo que se evalúa, sin ambigüedad.
      cell.textContent = normalizeWord(key);
      cell.classList.add('filled');
      currentCol++;
    }
  }

  function getCell(r, c) { return document.getElementById(`cell-${r}-${c}`); }
  function getRowWord(row) { let w = ''; for (let i = 0; i < WORD_LENGTH; i++) w += getCell(row, i).textContent; return w; }
  function shakeRow(row) {
    for (let i = 0; i < WORD_LENGTH; i++) {
      const c = getCell(row, i);
      c.classList.add('shake');
      setTimeout(() => c.classList.remove('shake'), 400);
    }
  }

  function updatePoolCount() {
    const base = getPoolForMode().length;
    document.getElementById('pool-count').textContent = base + chatPool.length;
  }

  // ── GAME MODE SWITCHING ──
  document.getElementById('gmode-streamer').addEventListener('click', () => switchGameMode('streamer'));
  document.getElementById('gmode-viewers').addEventListener('click', () => switchGameMode('viewers'));

  function switchGameMode(gm) {
    gameMode = gm;
    localStorage.setItem('wordle-gameMode', gameMode);

    // Update main mode buttons
    document.getElementById('gmode-streamer').classList.toggle('active', gameMode === 'streamer');
    document.getElementById('gmode-viewers').classList.toggle('active', gameMode === 'viewers');

    // Show/hide sub-mode bars
    document.getElementById('sub-mode-streamer').classList.toggle('hidden', gameMode !== 'streamer');
    document.getElementById('sub-mode-viewers').classList.toggle('hidden', gameMode !== 'viewers');

    updateUI();
    startNewGame();
  }

  // ── DIFFICULTY SWITCHING (Streamer sub-mode) ──
  document.getElementById('mode-easy').addEventListener('click', () => switchMode('easy'));
  document.getElementById('mode-hardcore').addEventListener('click', () => switchMode('hardcore'));

  function switchMode(m) {
    mode = m;
    localStorage.setItem('wordle-mode', mode);
    document.getElementById('mode-easy').classList.toggle('active', mode === 'easy');
    document.getElementById('mode-hardcore').classList.toggle('active', mode === 'hardcore');
    document.getElementById('mode-label').textContent = mode === 'hardcore' ? '💀 HARDCORE' : '😊 FÁCIL';
    startNewGame();
  }

  // ── VIEWER FILTER SWITCHING ──
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      viewerFilter = btn.dataset.filter;
      localStorage.setItem('wordle-viewerFilter', viewerFilter);
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === viewerFilter));
      const filterLabels = {
        all: '🌐 Todos',
        admins: '👑 Admins',
        subscribers: '💎 Subs',
        quiereme: '💖 Quiéreme',
        rosa_o_quiereme: '🌹 Rosa o Quiéreme'
      };
      showToast(`Filtro: ${filterLabels[viewerFilter] || viewerFilter}`);
      updateUI(); // ← Refresh the banner text when filter changes
    });
  });

  // ── VIEWER DIFFICULTY MINI TOGGLE ──
  document.querySelectorAll('.diff-mini-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.diff;
      localStorage.setItem('wordle-mode', mode);
      document.querySelectorAll('.diff-mini-btn').forEach(b => b.classList.toggle('active', b.dataset.diff === mode));
      // Also sync the streamer difficulty buttons
      document.getElementById('mode-easy').classList.toggle('active', mode === 'easy');
      document.getElementById('mode-hardcore').classList.toggle('active', mode === 'hardcore');
      document.getElementById('mode-label').textContent = mode === 'hardcore' ? '💀 HARDCORE' : '😊 FÁCIL';
      startNewGame();
    });
  });

  // ── UPDATE UI ──
  function updateUI() {
    const banner = document.getElementById('instructions-banner');
    const kb = document.getElementById('keyboard');

    if (gameMode === 'streamer') {
      banner.innerHTML = '<p>⌨️ Usa el <strong>teclado</strong> para jugar · Tildes y Ñ permitidas</p>';
      banner.className = 'instructions-banner streamer-instructions';
      kb.classList.remove('kb-hidden');
      const card = document.getElementById('viewer-card');
      if (card) card.classList.add('hidden');
    } else {
      const filterLabels = {
        all: '🌐 Todos',
        admins: '👑 Solo Admins',
        subscribers: '💎 Solo Subs',
        quiereme: '💖 Solo Quiéreme',
        rosa_o_quiereme: '🌹 Envía una Rosa o ten Quiéreme activo'
      };
      banner.innerHTML = `<p>💬 Escribe <strong>5 letras</strong> en el chat para jugar · ${filterLabels[viewerFilter] || viewerFilter}</p>`;
      banner.className = 'instructions-banner viewers-instructions';
      kb.classList.add('kb-hidden');
    }
  }

  // ── MODAL ──
  function showModal(win, guesser) {
    const modal = document.getElementById('modal');
    const s = streaks[mode];
    document.getElementById('modal-icon').textContent = win ? '🎉' : '💀';
    document.getElementById('modal-title').textContent = win ? '¡Palabra Adivinada!' : '¡Fin del juego!';
    document.getElementById('modal-word').textContent = secretWordDisplay;
    document.getElementById('modal-guesser').textContent = win && guesser ? `Adivinada por @${guesser}` : '';
    document.getElementById('stat-attempts').textContent = totalAttempts;
    document.getElementById('stat-streak').textContent = s.current;
    document.getElementById('stat-best').textContent = s.best;
    document.getElementById('stat-players').textContent = players.size;
    modal.classList.remove('hidden');
    setTimeout(() => { if (!modal.classList.contains('hidden')) startNewGame(); }, 12000);
  }

  function hideModal() { document.getElementById('modal').classList.add('hidden'); }
  document.getElementById('modal-btn').addEventListener('click', startNewGame);

  // Give up button (Viewer Mode)
  document.getElementById('btn-give-up-viewers').addEventListener('click', () => {
    if (gameOver || !secretWord) return;
    gameOver = true;
    recordStreak(false);
    showModal(false, null);
  });

  // ── TOAST ──
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 2500);
  }

  // ── INIT ──
  // Restore game mode UI
  document.getElementById('gmode-streamer').classList.toggle('active', gameMode === 'streamer');
  document.getElementById('gmode-viewers').classList.toggle('active', gameMode === 'viewers');
  document.getElementById('sub-mode-streamer').classList.toggle('hidden', gameMode !== 'streamer');
  document.getElementById('sub-mode-viewers').classList.toggle('hidden', gameMode !== 'viewers');

  // Restore difficulty UI
  document.getElementById('mode-easy').classList.toggle('active', mode === 'easy');
  document.getElementById('mode-hardcore').classList.toggle('active', mode === 'hardcore');
  document.getElementById('mode-label').textContent = mode === 'hardcore' ? '💀 HARDCORE' : '😊 FÁCIL';

  // Restore viewer filter UI
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === viewerFilter));
  document.querySelectorAll('.diff-mini-btn').forEach(b => b.classList.toggle('active', b.dataset.diff === mode));

  startNewGame();
})();
