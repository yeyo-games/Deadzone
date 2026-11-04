# Dead Zone — Supervivencia Zombi 2D

Juego de supervivencia zombi en vista cenital (top-down) que se juega directamente en el navegador:
**Chrome y Safari, en computadora y en celular**. Sin instalaciones, sin compilación.

## Cómo se juega

Sobrevive a rondas de caminantes cada vez más grandes. Una ronda termina al eliminar al último zombi; la
siguiente no empieza hasta que pulses **Iniciar siguiente ronda**, así que puedes prepararte sin prisa. Cada zombi eliminado da experiencia; al subir de
nivel el juego se pausa y eliges una de tres mejoras aleatorias. Correr gasta estamina: úsala para salir
de un cerco, no para pasear.

| Zombi   | Vida | Velocidad     | Notas                                                         |
|---------|------|---------------|---------------------------------------------------------------|
| Normal  | 42   | media (el doble que antes) | Llega en hordas enormes (cientos por oleada). Si le das y no muere, se frena, se desangra y avanza arrastrándose dejando un rastro de sangre |
| Policía SWAT | 336 | lenta     | El 20% de los normales. Escudo al brazo; aguanta 8× más       |
| Super blindado | 2100 | muy lenta | Desde la oleada 11, el 7% de la horda. Gordo con armadura militar; aguanta 50× más. Las balas no lo frenan y casi la mitad rebotan en la armadura. Da **super golpes**: te quita 30, te avienta y destroza barricadas |
| Velocista | 26 | rápida        | Desde la primera oleada. Te alcanza si no corres              |
| Gordo   | 130  | más lenta     | Más grande, aguanta unas 3× más disparos. **Al morir revienta en ácido verde**: si te salpica te quema 5 s (2 de vida por segundo) y la vista se pone verde y borrosa |
| Toro    | 294  | rápida al embestir | Desde la oleada 3. Musculoso, bronceado y con cuernos de hueso. Al verte escarba y **embiste**: si te da te lanza y te quita 40. Si choca con una barricada la embiste una y otra vez (250 la embestida larga, 40 las cortas) hasta romperla |
| Rocoso  | 4200 | lenta (la más lenta) | Desde la oleada 5: uno al principio y unos más cada oleada. Zombi recubierto de roca, mucho más grande que un gordo; aparta a la horda al caminar y las balas no lo frenan. **Va recto hacia ti** y destroza lo que le estorba: árboles y coches (desaparecen del mapa), aplasta la madera; contra el metal, las vallas y los sacos se recarga y los golpea (150 cada 0,6 s) sin moverlos, y sólo si sigue pegado al mismo muro más de 5 s abolla y avienta el metal o empuja la valla o los sacos hasta quebrarlos; embiste el concreto (350 por golpe) y a la HESCO y al concreto reforzado se aleja y los embiste (700). Si te alcanza **te agarra y te lanza** hacia donde hay más zombis: te quita 50 y los que tocas al volar mueren (los grandes sólo se apartan) |
| Dorado  | 126  | rápida        | Raro (uno cada 35–65 s de ronda). No ataca: huye y desaparece a los 26 s. Si lo matas, da **$100–$250** |

Cuando un zombi te golpea **pierdes dinero** ($16–$40 al azar, nunca te deja en negativo) y lo ves en un
indicador rojo junto a tu dinero; en las oleadas 1 a 3 los golpes todavía no cuestan dinero. El zombi dorado parpadea cuando está por escaparse; si se va, no da nada.

**Racha:** cada baja hecha antes de 2,5 s de la anterior alarga tu racha (un dorado suma 10). Con 10 bajas
seguidas cada zombi da **×1,5** de dinero y experiencia, con 25 **×2**, con 50 **×3** y con 100 **×4**. Un
golpe de zombi (fuera del robot) o caer la corta. La mejor racha de la partida sale en el resumen final.
La experiencia para subir de nivel crece más suave en los primeros 10 niveles.

**Arranque suave:** la oleada 1 trae menos de la mitad de zombis y ningún policía SWAT (llegan en la 2),
la 2 trae dos tercios y la 3 un 85 %; desde la 4, la horda entera. Los niveles 1 y 2 piden menos
experiencia (unas 12 y 30 bajas). Cada baja hace saltar en el sitio lo que te dio (**+$** y **+XP**; si caen
varias juntas, se suman en un solo número) y, en solitario, una baja grande o cuatro casi a la vez detienen
el mundo una fracción de segundo para que el golpe se sienta.

**Rondas especiales:** desde la oleada 2, cada oleada tiene un 65 % de probabilidad de ser especial (nunca
dos seguidas). Se anuncian en el cartel y su nombre sale en el contador de oleada, y todas sus bajas pagan
×1,5 (la luna de sangre, ×2):

| Ronda | Qué pasa |
|-------|----------|
| Niebla | Solo ves un claro alrededor tuyo; la horda llega de entre la niebla |
| Apagón | Las farolas se apagan: solo alumbran tu linterna, los disparos y el fuego |
| Estampida | Una horda más chica (60 %) solo de velocistas y toros |
| Lluvia dorada | Un zombi dorado tras otro, cada 7 a 11 s |
| Asedio blindado | La mitad de los normales llegan como policías SWAT |
| Luna de sangre | Noche roja: los zombis van un 20 % más rápido y pagan el doble |

**Jefes:** cada 5 oleadas llega un jefe, con su barra de vida arriba de la pantalla (y el nombre del
ataque que prepara), una flecha roja en la orilla cuando no lo ves y música propia. Esa oleada trae la
mitad de horda y nunca es especial. **Todos sus ataques avisan antes en el suelo**: un anillo o una franja
roja que se llena (sal antes de que se complete), un anillo naranja donde caerá lo que lanza o un círculo
morado cuando llama a la horda o prepara algo. Las zonas que dejan (veneno verde, fuego, electricidad
azul, torbellino) parpadean un momento antes de hacer daño. Cuando le queda el 60 % de vida se
**enfurece** y ataca más seguido; al final entra en **furia**. Al derrotarlo, cada jugador gana su premio
y suelta cajas de armas, botiquines y munición. Las peleas son cortas pero peligrosas: los jefes tienen
poca vida (la de la tabla) y **pegan el doble** (golpes, ataques y zonas). En línea su vida crece un 60 %
por cada jugador extra.
Después del Rey (oleada 75) la lista vuelve a empezar, con 1,5 veces la vida en cada vuelta.

**Operaciones de alto riesgo:** al superar la oleada 20 (y luego la 25, la 30…), durante el descanso llega
un mensaje por radio con **dos operaciones** de las tres y la opción **Seguir con las oleadas**. Cada tarjeta
dice el objetivo, la amenaza, el dinero exacto y el plano que da la primera vez. Son opcionales y van
**entre oleadas**: si aceptas una tras la 20, al terminar sigue pendiente la 21 (y el jefe sigue en la 25).
Al aceptarla la zona se marca en el mapa (rombo, flecha en la orilla y distancia) y puedes comprar y
prepararte; nada corre hasta que usas el objetivo por primera vez. Los puntos se usan **manteniendo H**
(en el celular, el botón **H**). Arriba se ve el objetivo actual, su progreso y el estado del objeto.

- **Convoy militar perdido** (defender): elimina a los guardias, conecta el motor y la batería del camión
  (2 s cada uno) y protege 60 s el desbloqueo de su caja. Sólo avanza si alguien está cerca (si os alejáis
  se pausa y no se pierde lo que llevaba). Llegan primero por una calle, a los 20 s por otra y en los
  últimos 20 s más fuerte y con un grupo blindado; la radio y flechas rojas avisan por dónde. Algunos zombis
  van por el camión: si cae, la operación falla. Puedes construir alrededor (no encima ni tapando sus
  componentes). Al abrirse, saca el contenido con H.
- **Destruir el nido** (entrar y escapar): coloca una carga en cada uno de sus tres puntos (3 s; un golpe o
  alejarte la corta) y el nido se agita más con cada una. Con la tercera empiezan **12 s**: el área de la
  explosión se marca en rojo y una flecha verde lleva a la salida más cercana (siempre se llega a pie con
  margen; dentro del área no se puede construir). Quien siga dentro recibe un daño fuerte.
- **Recuperar suministros** (transportar): tres cargamentos (uno cerca, otro lejos y otro en un sitio
  estrecho con guardias resistentes) y un punto de entrega. Recoges uno con H (1 s); llevarlo te frena un
  15% (en el robot no) pero puedes disparar. Mantén H medio segundo para soltarlo. Cada entrega trae una
  respuesta anunciada junto al punto de entrega.

Recompensa: $2 000 + $150 por cada oleada pasada la 20 (convoy ×1, nido ×1,25, suministros ×1,15) y, la
primera vez en la partida, un **plano**: el **señuelo sonoro** (convoy; pieza de $500 que se activa con H y
atrae 8 s a los zombis normales cercanos), la **munición incendiaria** de la torreta pesada (nido; $3 000 en
su taller, 20% menos de daño pero quema, y eliges balas normales o incendiarias) y el **reparador de campo**
(suministros; pieza de $1 000 con 3 cargas: con H repara un 25% a una estructura o robot cercano que lleve
5 s sin daño, cada 20 s). Fallar o retirarte (mantén **Retirada**) no termina la partida, pero no da
recompensa y gasta la oportunidad; morir sigue las reglas de siempre. Al terminar, una transición breve os
devuelve a donde aceptasteis la operación, sin sus zombis. En línea se vota (20 s, gana la mayoría y el
líder desempata), cada participante conectado cobra, la retirada pide la mayoría y quien cayó revive al
terminar la operación.

| # | Jefe | Oleada | Vida | Ataques | Punto débil | Premio |
|---|------|--------|------|---------|-------------|--------|
| 1 | El Rocoso Supremo | 5 | 4 500 | Embestida rocosa · Pisotón · Lanzamiento de roca · Piel endurecida (8 s, la mitad del daño) · Furia de piedra (30 %) | La espalda de lava: +40 % | $1500 |
| 2 | El Aplastador | 10 | 7 500 | Martillazo (rompe construcciones) · Carga brutal · Agarre demoledor (90 y te lanza) · Golpes consecutivos (3) · Rompefilas (acelera a la horda) | Si su carga choca con un edificio, 3 s aturdido | $2200 |
| 3 | El Campanero | 15 | 11 400 | Llamada de la horda (20 zombis) · Onda sonora (te frena 4 s) · Campanada de guerra (+35 % de velocidad a la horda) · Golpe de cadena · Última llamada (20 %: corredores) | Rompe la **campana** de su espalda y se acaban la llamada, la onda y la campanada | $3000 |
| 4 | El Contaminado | 20 | 16 500 | Nube tóxica (8 s) · Proyectil corrosivo (rompe barricadas) · Rastro venenoso · Explosión química · Lluvia corrosiva | Sus depósitos de la espalda: el doble | $3800 |
| 5 | El Carcelero | 25 | 23 400 | Escudo de frente (sólo le entra el 20 %) · Golpe de prisión · Cadena de captura (te jala y te deja quieto) · Encierro (muros de metal temporales) · Carga blindada | Costados y espalda | $4600 |
| 6 | La Cazadora | 30 | 31 500 | Salto depredador · Ataque relámpago (3 embestidas) · Acecho (casi invisible) · Grito de persecución (corredores) · Furia final (25 %) | Tras cada salto queda quieta y expuesta; las explosiones la aturden | $5500 |
| 7 | El Excavador | 35 | 43 500 | Ataque subterráneo (sale debajo de ti) · Derrumbe · Lanzamiento de escombros · Túnel de invasión (zombis junto a ti) · Demolición | Al salir de la tierra, 4 s expuesto | $6500 |
| 8 | El Generador | 40 | 57 000 | Descarga eléctrica · Pulso electromagnético (apaga tus torretas 6 s) · Suelo electrificado · Sobrecarga (10 s) · Cadena eléctrica | Tras la sobrecarga, 5 s quieto y expuesto | $7600 |
| 9 | La Reina de la Colmena | 45 | 75 000 | Nacimiento masivo (25 corredores) · Guardia real (4 super blindados) · Orden de ataque · Caparazón protector (6 s, casi inmune) · Enjambre (desde el 40 %, cada 15 s) | Mientras pare no se mueve y recibe más daño | $9000 |
| 10 | El Devorador | 50 | 99 000 | Absorción (se cura con cada zombi que muere cerca) · Mordida titánica · Succión · Golpe sísmico · Hambre (cada 20 % perdido pega un 10 % más) | Limpia su alrededor y no se cura | $11 000 |
| 11 | El Incendiario | 55 | 129 000 | Llamarada frontal · Bombardeo incendiario · Camino ardiente · Sobrecalentamiento (12 s) · Tormenta de llamas | Sobrecalentado recibe un 60 % más | $13 000 |
| 12 | El Arquitecto de Ruinas | 60 | 168 000 | Destructor de muros (va por tu defensa más dura) · Barrera de escombros · Demolición en cadena · Proyectil estructural · Asedio inteligente | Mientras demuele, +50 % | $15 000 |
| 13 | La Tormenta Viviente | 65 | 216 000 | Ráfaga monstruosa (te avienta) · Torbellino de escombros · Lluvia de proyectiles · Tormenta de polvo (no se ve) · Huracán final (20 %) | Rompe los **hombros** (por la espalda) y se acaba el viento | $17 000 |
| 14 | El Titán del Apocalipsis | 70 | 270 000 | Pisotón devastador · Lanzamiento de vehículos · Carga colosal · Golpe de destrucción · Despertar del titán (30 %: pierde armadura y combina ataques) | Rompe las **rodillas** (de frente) y camina más lento | $20 000 |
| 15 | El Rey de los Muertos | 75 | 360 000 | Llamado del ejército · Dominio absoluto (15 s: horda más rápida y dura) · Aniquilación · Resurrección del ejército (30) · Furia del rey (20 %: refuerzos) | Su **corona** tiene tres núcleos: cada uno roto lo debilita y calma a la horda | $30 000 |

### Cuentas y clasificación

Al entrar escribes un **nombre y un PIN de 4 números**: si la cuenta no existe se crea, y si existe entras
con su progreso. Cada cuenta tiene su propia partida guardada y su mejor marca (oleada más alta y bajas).
El **Salón de la fama** del menú principal (podio con los 3 mejores) y la insignia **Top #N** junto a tu nombre muestran los récords de las cuentas de ese dispositivo. Abierto como Artifact
de Claude, el progreso se copia también a la nube de tu cuenta de Claude y hay una clasificación global.
Para la **clasificación mundial** (todos los celulares en la misma lista) crea un proyecto gratuito en
Supabase y pega su URL y su clave publicable en `ONLINE` de `js/core/config.ts` (ver «Clasificación
mundial y estadísticas» abajo).

### Progreso guardado

El juego se guarda solo en el navegador cada pocos segundos, **también a mitad de ronda** (con los
zombis que siguen vivos), y al cerrar o minimizar la página. Al volver a abrir el sitio aparece
**Continuar** y sigues donde estabas. **Si mueres, pierdes la partida** y la siguiente empieza desde la
oleada 1 (tu récord en la clasificación se conserva). *Nueva partida* también borra el progreso.
El guardado vive en el navegador de cada dispositivo (y en cada sitio web por separado).

### Dinero y tienda

Cada zombi eliminado da dinero: **normal $0,5 · velocista $1,5 · gordo $2,5 · SWAT $5 · toro $7,5 · super blindado $12,5**
(los centavos se juntan hasta completar un dólar). Superar una oleada paga un premio de **$15 + $10 por
oleada** ($25 la primera, $65 la quinta). Al terminar cada oleada (después
de elegir tu mejora de nivel) se abre la tienda:

| Estructura | Precio | Efecto |
|--------|--------|--------|
| Bloque de madera | $10 | Barricada básica (160) |
| Sacos terreros | $25 | Muro ancho y barato (450) |
| Bloque de metal | $30 | 3× más que la madera (520) |
| Valla de metal reforzado | $70 | Muro ancho muy resistente (1400) |
| Muro de concreto | $150 | La defensa más dura (3200) |
| Barrera HESCO | $800 | Gaviones de malla con arena, casi indestructibles (10000) |
| Barrera de concreto reforzado | $1300 | Concreto con placas de acero y vigas; recibe 10 % menos daño (18000) |
| Torreta automática | $500 | Dispara sola al zombi más cercano |
| Torreta pesada | $15 000 | Cañón doble que manejas tú (ver abajo) |
| Torreta militar | $50 000 | Torre de tanque que lanza sola misiles antitanque (ver abajo) |
| Alambre de púas | $20 | No bloquea: frena y hiere |
| Trampa de pinchos | $60 | Frena y hiere mucho más |
| Barrera de pinchos oxidada | $100 | Tres bloques de lámina oxidada con pinchos: no tapa el paso, pero los zombis que la cruzan casi se detienen y se hieren. No se gasta al pisarla: dura 3 oleadas |
| Mina terrestre | $45 | Explota al pisarla |
| Granada | $90 | Explosión en área que lanzas tú |
| Molotov | $60 | Charco de fuego: los zombis que lo pisan arden, se retuercen y el fuego se contagia |
| Misil improvisado | $120 | Tubo con pólvora y cinta: sale recto hacia donde apuntas (cabeceando) y estalla al primer zombi o pared, algo más fuerte que una granada. De un solo uso |
| Bomba lapa | $250 | Carga adhesiva: vuela en arco hacia el zombi más cercano a donde apuntas (jefes incluidos), se le pega y estalla a los 2 s con una explosión enorme (radio 210). Al que la lleva le quita 1000 de vida y a los de alrededor 500; revienta a los gordos de una y al rocoso le arranca la mitad de su vida (un cuarto si sólo lo alcanza). Si no hay zombi, cae al suelo y se pega al primero que la toque |

Para construir pulsa `F` (o el botón de construir en el celular, o toca una pieza del inventario): abajo
aparece la barra con las piezas que tienes y la elegida se ve donde caería, en verde si cabe y en rojo si
no, dentro de un círculo que marca hasta dónde llegas. En computadora sigue al ratón y se pone con clic
(rueda o `1`–`9` para cambiar de pieza, clic derecho, `F` o `Esc` para salir). En el celular la pieza
aparece delante de ti (hacia donde caminas) y la barra de piezas va abajo, entre el joystick y los
botones. Lo más fácil es arrastrar una pieza de la barra al mapa y soltarla: se ve un poco arriba del
dedo, en verde si cabe o en rojo si no, y mientras la llevas la barra se aparta para poder soltarla
también detrás. También puedes tocar el mapa (o un toque corto sobre el joystick) para moverla y
ponerla con ✓. Después la siguiente se propone justo al lado, siguiendo la fila, así que con ✓ ✓ ✓
levantas un muro. Las piezas alargadas se ponen atravesadas, de cara a ti; `R` o el botón **Girar**
de la barra las giran. Junto a otra pieza, la nueva se pega a ella: tocándola, alineada (al
centro o a ras de una orilla) y, si sigue la fila de un muro alargado, girada igual que él, así las
filas quedan rectas y sin huecos. Si apuntas encima de una pieza, la nueva se apila justo sobre ella;
las torretas no se apilan, se arriman. Mientras construyes no disparas.

Las balas pasan por encima de las barricadas (también por encima de los coches).
Tú puedes atravesar tus propias estructuras; los zombis no. Puedes **encimar estructuras** en el mismo lugar
(madera sobre madera, muro sobre valla…): cada pieza aguanta lo suyo y los zombis rompen primero la de
arriba. La torreta necesita su propio sitio. Los zombis las golpean hasta
romperlas o buscan otro camino para rodearlas.

Los zombis aparecen en grupitos por todas las orillas de la pantalla. Unos van directo por ti, otros te
flanquean por los lados y otros dan la vuelta para llegarte por la espalda, así que cuando son muchos te
van cerrando poco a poco. Todos siguen rutas que rodean edificios, coches y barricadas; si alguno se
atasca, se escurre de lado y recalcula su camino.
Caminan de forma algo irregular (se desvían y tropiezan), algunos se quedan rezagados, se esquivan
entre ellos para no amontonarse y los más rápidos adelantan a los más lentos.

### Jugar con amigos (en línea, de 2 a 4)

El juego tiene dos modos: **Un jugador** y **En línea · 2 a 4**. Para jugar con un amigo, uno toca
*En línea* → *Crear sala* y le pasa el **código** de 6 caracteres o el **enlace de invitación**
(`?sala=CÓDIGO`) que muestra la sala; el otro abre el enlace (o escribe el código) y entra. La partida
empieza cuando hay **de 2 a 4 jugadores conectados y listos**; con una sola persona el botón
*Iniciar partida* avisa de que hace falta otra. Ver «Multijugador en línea» más abajo.

### Robot de combate

En la tienda puedes comprar un **robot de combate** ($3000) del doble de tamaño de un gordo, con
10 000 de vida. Acércate y pulsa `E` (botón **ROBOT** en el celular) para subirte o bajarte: caminas
entre la horda apartando zombis, recibe él los golpes en vez de ti y usa tus armas montadas en su brazo
derecho (puedes cambiarlas igual que siempre). No se cura solo: repáralo en la tienda después de cada
oleada. Si su vida llega a 0 explota, sales despedido y hay que repararlo para volver a usarlo.

### Torreta pesada y su taller

La **torreta pesada** ($15 000) es un cañón doble que manejas tú (`E` junto a ella) con balas explosivas
que se compran en la tienda. Junto a ella (o montado) pulsa `M` (botón de la **llave** en el celular)
para abrir su **taller**: cada torreta tiene sus propias mejoras, se compran en cualquier momento y se
ven en la torreta.

Calibre, cadencia, carga explosiva y blindaje tienen **10 niveles** cada uno (cada nivel cuesta más):

| Mejora | Niveles (precio) | Efecto (de fábrica → nivel 10) |
|--------|------------------|--------------------------------|
| Calibre | $1000 · $2500 · $5000 · $8000 · $12 000 · $17 000 · $23 000 · $30 000 · $40 000 · $50 000 | Daño ×1,2 · ×1,4 · ×1,6 · ×1,8 · ×2 · ×2,25 · ×2,5 · ×2,75 · ×3 · ×3,3 (al pegar y al estallar) |
| Cadencia | los mismos que el calibre | 11 · 13 · 15 · 16 · 17 · 18 · 19 · 20 · 21 · 22 disparos por segundo (de 9) |
| Carga explosiva | $1200 · $3000 · $6000 · $9000 · $13 000 · $18 000 · $24 000 · $31 000 · $40 000 · $50 000 | Radio de la explosión 75 · 90 · 105 · 115 · 125 · 135 · 145 · 155 · 165 · 175 px (de 60) |
| Blindaje | $800 · $2000 · $4000 · $6500 · $9500 · $13 000 · $17 000 · $22 000 · $28 000 · $35 000 | Vida 6000 · 8000 · 10 000 · 12 500 · 15 000 · 17 500 · 20 000 · 23 000 · 26 000 · 30 000 (de 4000) y repara del 15 al 70 % al acabar cada oleada |
| Piloto automático | $6000 | Sin nadie a los mandos dispara sola a media cadencia (hasta 520 px) con las balas de quien la puso |

### Torreta militar

La **torreta militar** ($50 000) es la parte de arriba de un tanque: ocupa 3×3 casillas, aguanta 9000 y
dispara sola, sin munición. Gira despacio hacia el zombi a su alcance (hasta 720 px, y no a los que tiene
encima), **primero a los grandes** (rocosos, super blindados, gigantes, toros y gordos), y cada 2,4 s
lanza un **misil antitanque** que sale con una nube de humo negro, deja un trazo encendido que alumbra la
noche y se apaga poco a poco, y estalla
en el primer zombi o pared que toca (o donde estaba su blanco) con el radio y el daño del misil del Bomber.

También **te puedes subir** (`E` junto a ella, o el botón **Torreta** en el celular): vas encima de la
torre, que gira más rápido hacia tu mira, y lanzas tú un misil cada 1,6 s hasta donde apuntas (en el
celular, al zombi más cercano). Encima recibes la mitad del daño, como en la torreta pesada, y nadie te
puede agarrar. Te bajas con `E` por detrás de la torre.

Tiene su propio **taller**, como la pesada (`M` junto a ella o montado, botón de la **llave** en el
celular). Sus mejoras son de esa torreta y se ven en ella (tubos a los lados, placas y antena de radar):

| Mejora | Niveles (precio) | Efecto (de fábrica → máximo) |
|--------|------------------|------------------------------|
| Ojiva | $3000 · $6000 · $10 000 · $15 000 · $21 000 · $28 000 · $36 000 · $45 000 | Daño del estallido ×1,2 · ×1,4 · ×1,6 · ×1,85 · ×2,1 · ×2,4 · ×2,7 · ×3 y radio ×1,05 … ×1,4 |
| Cargador automático | los mismos que la ojiva | Un misil cada 2,1 · 1,85 · 1,65 · 1,5 · 1,35 · 1,2 · 1,1 · 1 s (de 2,4); subido también disparas más seguido |
| Radar | $2500 · $5000 · $9000 · $14 000 · $20 000 | Alcance 800 · 880 · 960 · 1040 · 1120 px (de 720) y la torre gira más rápido |
| Blindaje | $2000 · $4500 · $8000 · $12 000 · $17 000 · $23 000 · $30 000 · $38 000 | Vida 12 000 · 15 000 · 18 000 · 22 000 · 26 000 · 30 000 · 35 000 · 40 000 (de 9000) y repara del 15 al 60 % al acabar cada oleada |
| Salva | $25 000 · $60 000 | 2 y luego 3 misiles por disparo, en abanico (por el cañón y los tubos de los lados) |

### Torretas en multijugador

En línea, a tu torreta pesada o militar **sólo te subes tú**. Para prestarla, junto a ella (o montado)
pulsa `L` o el botón del **candado** (también está en su taller): el candado se
abre y los demás ya pueden subirse. Si vuelves a cerrarlo, quien la esté manejando se baja.

### Armas y munición

El subfusil, con el que empiezas, tiene balas infinitas. Las demás se compran en la tienda (la escopeta y
el lanzallamas también salen en las cajas de armas) y cuestan más mientras más poder tienen: daño por segundo
contando recargas, a cuántos zombis atraviesan y el área. Puedes **vender** cualquier arma que tengas por
la mitad de su precio:

| Arma | Precio | Daño | Cargador | Daño por segundo |
|------|--------|------|----------|------------------|
| Subfusil | inicial | 14 | 32 | 100 |
| Escopeta | $500 | 8 × 30 | 6 | 280 de cerca |
| Fusil de asalto | $800 | 30 | 30 (atraviesa 1) | 180 (365 en fila) |
| Lanzallamas | $1200 | 9 por llamarada + quemadura | 100 de combustible (atraviesa a todos) | 160 a cada uno de cerca, más 24 por segundo mientras arden |
| Escopeta automática | $2000 | 9 × 22 | 12 | 400 de cerca |
| Ametralladora | $3000 | 30 | 100 (atraviesa 2) | 260 (780 en fila) |
| Francotirador | $4500 | 300 | 5 (atraviesa 6) | 190 (1320 en fila) |
| Bazuca antitanque | $6000 | cohete en área | 1 (recarga 4 s) | revienta grupos y blindados |

El **lanzallamas** escupe 18 llamaradas por segundo que llegan a unos 250 px: queman a todos los zombis
que tocan (sólo el gigante las ataja), no los empujan y los dejan ardiendo 3 s; el fuego se contagia entre
los que van pegados. Las paredes paran las llamas. Las partidas guardadas que tenían el rifle reciben el
lanzallamas con el depósito lleno.

En la sección **Munición** de la tienda compras cargadores de cualquier arma que tengas, de 1 en 1 o de
10 en 10. La reserva de balas no tiene límite.

La **bazuca** dispara cohetes que estallan con el doble de área que una granada y lanzan los cuerpos por
los aires. Si le das a un gordo, el cohete se le queda clavado en la panza, el gordo se hincha y brilla en
amarillo y revienta brutalmente; si le das a un super blindado, se incrusta en su placa y lo revienta de un solo tiro. Los zombis sueltan munición y botiquines más a menudo
(sobre todo los grandes), y la munición se recoge al instante al pasar cerca.

### Sonido y música

Cada arma tiene su propio disparo y su recarga (cargador, cerrojo, cartuchos) sincronizada con la
animación. Hay gruñidos, pasos de la horda, impactos y caídas. La música cambia sola entre **calma**,
**amenaza** y **horda** según cuántos zombis tengas cerca, con transiciones suaves.

### Personaje y latas

En **Personaje** eliges colores (piel, pelo, pañuelo, chaqueta, pantalón y mochila o capa) y, por pestañas,
sombrero, traje, cara, espalda y efecto. Al superar cada oleada ganas **latas** (1 en las primeras, 2 desde
la 5, 3 desde la 10...), que se guardan en tu cuenta. Con ellas compras accesorios: corona, kabuto
samurái, vikingo, armadura dorada, ninja, visor nocturno o cibernético, capa, katana, jetpack, alas, estela
de neón, chispas, pies en llamas o aura tóxica. Antes de comprar los puedes probar en la vista previa. En
línea los demás ven lo que llevas.

### Controles

En el celular sólo hay a mano disparar, cambiar de arma, recargar y la habilidad. Los botones pequeños
de granada, molotov, misil improvisado, bomba lapa, construir, robot y taller aparecen en una fila encima sólo
cuando los puedes usar (si los compraste o estás junto a la torreta), y el inventario sólo enseña lo que
tienes.

| Computadora | Celular |
|-------------|---------|
| `WASD` / flechas: moverse | Joystick virtual (lado izquierdo) |
| `Shift`: correr · `Espacio`: disparar | Lleva el joystick hasta el borde para correr |
| Ratón: apuntar · clic: disparar | Botón de disparo con **apuntado automático** |
| `R`: recargar | Botón de recarga |
| `1`–`9`, `Q` o `Tab`: cambiar arma | Botón de cambio de arma |
| `F`: modo construir (clic coloca, `R` gira, rueda o `1`–`9` cambia de pieza) | Botón **Construir**: arrastra una pieza de la barra al mapa y suéltala (o toca el mapa y ✓), **Girar** la gira |
| `G`: lanzar granada · `T`: molotov · `Z`: misil improvisado · `C`: bomba lapa · `E`: robot o torreta pesada | Botones pequeños de **granada**, **molotov**, **misil** y **bomba lapa** (apuntan solos) |
| `M`: taller de la torreta pesada o militar (junto a ella) | Botón de la **llave** |
| `H` mantenida: usar el objetivo de una operación, soltar un cargamento, activar un señuelo o el reparador | Botón **H** (aparece cuando hay algo que usar) |
| `L`: en línea, dejar o no que otros se suban a tu torreta | Botón del **candado** |
| `Enter`: iniciar siguiente ronda (en línea: estoy listo) | Botón del panel **Ronda completada** |
| `Esc` / `P`: pausa | Botón de pausa |

### Modo desarrollador

Para probar el juego sin jugar cada ronda hay un panel de desarrollo (`js/ui/dev.js`). Se activa abriendo el
juego con `?dev=1` en la dirección (por ejemplo `http://localhost:8080/?dev=1`); queda guardado en ese
navegador hasta que lo abras con `?dev=0`. En el celular, sin teclado, se activa y desactiva tocando
**cinco veces seguidas el número de versión** del menú principal. Con el modo activado, la tecla **º**
(la que está a la izquierda del `1`; `` ` `` en teclado inglés) enseña u oculta el panel.

El panel muestra, cuatro veces por segundo: la oleada y su estado, los zombis **vivos**, **en pantalla** y
**cerca** (y cuántos de cada tipo), el tamaño de la ronda con lo que queda **en cola**, lo que traen las
**dos rondas siguientes** (sin contar rondas especiales), el reloj del zombi dorado, la posición, vida,
nivel y dinero del jugador, y balas, partículas, estructuras y FPS. Y tiene botones para: dar **dinero**
(+$1 000 y +$10 000), **subir de nivel**, **matar a todos** (con botín), **terminar la ronda** (abre la
tienda como siempre), **saltar a cualquier ronda** (la que esté en curso se descarta), **generar N zombis**
de un tipo junto a la pantalla, sacar un **zombi dorado**, abrir ya la **oferta de operaciones** (deja la
partida en el descanso tras la oleada 20 o la siguiente que toque), cambiar la **velocidad del juego** (×0,25 a
×3), ser **invencible**, tener **munición infinita**, desbloquear **todas las armas** y desplegar el
**robot**.

Una partida en la que se usó cualquiera de esas trampas queda marcada (también en el guardado) y **no
cuenta para los récords** de la cuenta ni para la clasificación. En línea el servidor manda, así que el
panel sólo muestra cifras.

## Ejecutar en local

Los módulos de JavaScript necesitan un servidor (no funciona abriendo el archivo con doble clic):

```bash
npm ci               # una vez: dependencias
npm run dev          # http://localhost:8080
```

Para probar en tu celular, conéctalo a la misma red Wi-Fi y abre `http://IP-DE-TU-PC:8080`.

## Publicar en Vercel

Flujo actual:

1. **Push a `main`** (la rama principal) → el proyecto `deadzone` de Vercel publica en producción
   (`deadzone-five-red.vercel.app`). Las demás ramas del repositorio generan una vista previa.
2. Vercel no publica la carpeta tal cual: ejecuta `npm run build` (Vite, lo pide `vercel.json`) y publica `dist/`. El servidor, la documentación y los scripts no quedan públicos.
3. GitHub Actions (`.github/workflows/ci.yml`) comprueba en cada push y pull request Biome, los tipos (`checkJs` y TypeScript estricto en el núcleo), las pruebas del núcleo, los tipos y pruebas del servidor, y Playwright (Chromium y WebKit).
4. Si cambió código que usa el servidor (`server/`, `js/`, `deploy/`),
   `.github/workflows/servidor.yml` actualiza la máquina de Vultr en cuanto no hay salas
   abiertas (ver «Publicación automática» en [`deploy/README.md`](deploy/README.md)).

Para crear el proyecto desde cero: [vercel.com](https://vercel.com) → **Add New… → Project** →
importa este repositorio. `vercel.json` ya define el build (*Framework Preset* da igual).

**yeyo.games/deadzone.** El hub `yeyo.games` es otro proyecto de Vercel (`yeyo-games`, Astro,
publicado con la CLI de Vercel). No guarda una copia del juego: su `vercel.json` pasa `/deadzone/`
al proyecto `deadzone`, así que muestra siempre la última versión publicada:

```json
"redirects": [{ "source": "/deadzone", "destination": "/deadzone/", "permanent": false }],
"rewrites": [
  { "source": "/deadzone/", "destination": "https://deadzone-five-red.vercel.app/index.html" },
  { "source": "/deadzone/:path+", "destination": "https://deadzone-five-red.vercel.app/deadzone/:path+" }
]
```

En el iPhone, abre la URL en Safari → Compartir → **Añadir a pantalla de inicio** para jugar a pantalla completa.

## Clasificación mundial y estadísticas (Supabase)

Un solo proyecto de Supabase guarda la clasificación mundial (`scores`) y las estadísticas de uso. No hace
falta para jugar con amigos: las partidas de 2 a 4 pasan por el servidor en línea, que no toca la base.

1. En https://supabase.com crea un proyecto (el plan gratuito basta; región `us-east-1`).
2. En *SQL Editor* pega entero [`supabase/esquema.sql`](supabase/esquema.sql) y ejecútalo (se puede repetir:
   crea tablas, políticas, vistas y funciones sólo si faltan).
3. Elige la clave de la página de estadísticas y fíjala en el mismo editor (nunca va en el código):

```sql
select fijar_clave('tu clave');
```

4. En *Project Settings → API* copia la **URL del proyecto** y la **clave publicable** (`sb_publishable_…`)
   en `ONLINE` de `js/core/config.ts`. El juego usa la API REST, sin librería; la clave es pública por
   diseño: las tablas sólo se escriben a través de las funciones `dz_*` y sólo `scores` se lee.

Cualquiera que tenga el juego puede subir su récord; es una clasificación para jugar entre amigos, no a
prueba de trampas. Las pruebas de navegador (Playwright) no escriben en ella.

### Qué se mide y dónde se ve

Todo es **anónimo**: un identificador aleatorio por navegador (sin nombre de cuenta, sin PIN, sin IP
guardada por el juego), por eso no hay aviso de cookies. Se guarda una **sesión** por cada apertura del
juego (inicio, último latido cada minuto, versión, táctil o no, por dónde entró) y una **partida** por cada
run (modo, clase, oleada, duración, nivel, bajas por tipo, cómo acabó, causa de la muerte con la oleada y
el arma en mano), más cada **mejora** elegida con las que se ofrecieron y cada **compra** con su oleada.
No se manda nada desde `npm run dev`, desde Playwright ni si abres el juego una vez con `?sinstats`
(queda recordado en ese navegador: sirve para excluir tus propios dispositivos).

La página **`/stats`** (en producción, `yeyo.games/deadzone/stats`, sin barra final porque el hub no la pasa; no está enlazada desde el juego) pide
la clave y muestra visitas por día, dispositivos que regresan, ronda promedio y distribución por clase,
duración de sesiones y partidas, tasa de elección de cada mejora, compras y causas de muerte, por 7 días,
30 días o todo. Las vistas `v_*` del esquema dan lo mismo en el panel de Supabase.

## Multijugador en línea (servidor, de 2 a 4 por sala y 8 salas)

El botón **En línea · 2 a 4** usa un servidor propio (carpeta `server/`). Capacidad: **de 2 a 4
jugadores por sala** (`MIN_PLAYERS`, `MAX_PLAYERS`) **y 8 salas a la vez** (`MAX_ROOMS`); con todas las
salas ocupadas el juego avisa de que el servidor está lleno. **Cómo
publicarlo en una máquina virtual y qué comprar: [`deploy/README.md`](deploy/README.md).** Todos se conectan a él por WebSocket, así que funciona en cualquier red
(sin conexión directa entre celulares ni base de datos de por medio).

**Cómo funciona.** El servidor (Node + TypeScript + [Colyseus](https://colyseus.io) 0.18) simula la
partida completa a 60 pasos por segundo con los mismos módulos del juego (`js/sim/world.ts`,
`js/sim/zombies.ts`, `js/sim/player.ts`, `js/sim/bullets.ts`, `js/sim/director.ts`): decide movimiento, choques,
disparos, impactos, vida, muertes, oleadas y bajas. El navegador sólo manda lo que quiere hacer
(dirección, correr, disparar, ángulo de la mira, recargar, arma) con un número de secuencia, y
recibe 20 fotos por segundo de lo que tiene cerca.

- **Tu personaje** responde al instante: el movimiento se predice en el navegador con las mismas
  reglas (`Player.move`) y, al llegar el estado confirmado, se restaura y se vuelven a aplicar las
  entradas pendientes (`js/net/netcode.ts`). Las correcciones pequeñas se borran suavemente; las grandes
  (más de 150 px) se aplican de golpe.
- **Los demás y los zombis** se dibujan 110 ms en diferido, interpolando entre fotos con el reloj
  del servidor; como mucho se adelantan 100 ms si falta una foto, y una foto vieja nunca los hace
  retroceder.
- **Disparos:** tu fogonazo y tus balas se ven al instante pero son de adorno; el daño lo calcula
  el servidor con sus propias balas.

**Salas.** Crear sala da un código de 6 caracteres (generado con `crypto`) y un enlace de
invitación (`?sala=CÓDIGO`). Hay lista de jugadores con su estado (listo, jugando, caído,
reconectando), botón *Estoy listo* y *Iniciar partida* sólo para el propietario (cuando hay al menos
`MIN_PLAYERS` = 2 conectados y los demás están listos). Fases: esperando → cargando → jugando → finalizada (con resultados). Si el
propietario se va, la sala pasa al más antiguo. Una sala vacía se borra a los 30 s, y una sala
sin partida (esperando o en resultados) se cierra a los 20 minutos para liberar su cupo.

**Reglas del modo en línea (fase 1).** Cada uno tiene su dinero, armas y
mejoras, y la experiencia es del equipo: el dinero se gana como en solitario (recompensas por zombi y
el dorado, para quien lo mata; cada golpe de zombi cuesta dinero, salvo dentro del robot). Al subir de
nivel a mitad de oleada aparece el botón **¡Mejora!** (tecla <kbd>U</kbd>): la partida no se detiene,
así que cada uno la abre cuando le conviene; entre oleadas se abre sola y luego la tienda. La tienda
tiene lo mismo que en solitario: armas, munición, defensas y trampas, granadas, molotovs y el robot de
combate (uno por jugador). Lo que compras lo usas cuando quieras, también en plena oleada: construir
(<kbd>F</kbd>), lanzar (<kbd>G</kbd>/<kbd>T</kbd>) y subir al robot (<kbd>E</kbd>) los hace el
servidor, que también simula las torretas, minas, fuego, cohetes y el ácido del gordo. Se conservan
armas de cajas, munición y botiquines.
Zombis por oleada: 0,5 del solitario + 0,15 por cada jugador extra (y 1,4 veces su vida). Si caes, revives al terminar la oleada junto a un compañero; la partida termina cuando
caen todos. Entre oleadas cada uno pulsa **Estoy listo** (se puede cancelar) y la siguiente empieza cuando lo están
todos los que siguen conectados; el botón dice cuántos faltan. El zombi dorado
da dinero a quien lo mata. Quien entra a una sala con la partida empezada espera en la sala y juega la
siguiente. Si alguien pierde la conexión, su personaje se queda quieto, los zombis lo ignoran y no
recibe daño durante 20 s; si vuelve (con el token de reconexión, también tras recargar la página)
recupera el mismo personaje; si no, sale de la sala.

#### Modo desarrollador

Para probar el juego sin jugar cada ronda hay un panel de desarrollo (`js/ui/dev.js`). Se activa abriendo el
juego con `?dev=1` en la dirección (por ejemplo `http://localhost:8080/?dev=1`); queda guardado en ese
navegador hasta que lo abras con `?dev=0`. En el celular, sin teclado, se activa y desactiva tocando
**cinco veces seguidas el número de versión** del menú principal. Con el modo activado, la tecla **º**
(la que está a la izquierda del `1`; `` ` `` en teclado inglés) enseña u oculta el panel.

El panel muestra, cuatro veces por segundo: la oleada y su estado, los zombis **vivos**, **en pantalla** y
**cerca** (y cuántos de cada tipo), el tamaño de la ronda con lo que queda **en cola**, lo que traen las
**dos rondas siguientes** (sin contar rondas especiales), el reloj del zombi dorado, la posición, vida,
nivel y dinero del jugador, y balas, partículas, estructuras y FPS. Y tiene botones para: dar **dinero**
(+$1 000 y +$10 000), **subir de nivel**, **matar a todos** (con botín), **terminar la ronda** (abre la
tienda como siempre), **saltar a cualquier ronda** (la que esté en curso se descarta), **generar N zombis**
de un tipo junto a la pantalla, sacar un **zombi dorado**, abrir ya la **oferta de operaciones** (deja la
partida en el descanso tras la oleada 20 o la siguiente que toque), cambiar la **velocidad del juego** (×0,25 a
×3), ser **invencible**, tener **munición infinita**, desbloquear **todas las armas** y desplegar el
**robot**.

Una partida en la que se usó cualquiera de esas trampas queda marcada (también en el guardado) y **no
cuenta para los récords** de la cuenta ni para la clasificación. En línea el servidor manda, así que el
panel sólo muestra cifras.

## Ejecutar en local

```bash
npm run server:install   # una vez: dependencias del servidor
npm run server           # servidor en ws://localhost:2567 (salud: http://localhost:2567/health)
npm run dev              # en otra terminal: el juego en http://localhost:8080
```

En `localhost` (o abriendo el juego por `http://IP-DE-TU-PC:8080`) el juego busca solo el servidor
en el puerto 2567 de ese mismo equipo.

### Probar con dos navegadores

1. Abre `http://localhost:8080` en Chrome y en otro navegador (o una ventana de incógnito).
2. En el primero: **En línea · hasta 4 → Crear sala → Copiar invitación**.
3. Pega la invitación en el segundo (o escribe el código) → **Unirse → Estoy listo**.
4. En el primero: **Iniciar partida**.
5. Toca el indicador de conexión (arriba a la izquierda) o pulsa **F3** para ver el diagnóstico:
   RTT de aplicación y su variación, pasos por segundo del servidor y su duración, CPU del servidor,
   salas y jugadores, KB/s del WebSocket y correcciones de posición.

Para probar cortes: recarga la página en plena partida (vuelves a tu personaje), o en las
herramientas de desarrollo de Chrome pon la red en *Offline* unos segundos (se reconecta solo).
Para probar latencia: arranca el servidor con `COLYSEUS_LATENCY=150 npm run server` (simula 150 ms
de ida y vuelta en el servidor) o usa la limitación de red de Chrome (simula una red lenta en el
navegador).

### Pruebas y carga

```bash
npm run server:test      # salas, cupos, permisos, entradas inválidas, reconexión, limpieza, predicción
npm run server           # en otra terminal, para la prueba de carga
npm run server:load      # 20 clientes: 5 salas de 4 (60 s); para la capacidad actual: -- --rooms 8x4
node server/tools/load.ts --url wss://servidor.tu-dominio.com --origin https://tu-juego.com --secs 60
```

Resultados medidos **en localhost** (servidor y clientes en el mismo PC con Windows; no son
medidas de red real). Las filas de salas de 10 son de cuando el cupo era 10 (`MAX_PLAYERS=10`):

| Prueba | Fotos/s por cliente | KB/s por cliente | Pasos/s del servidor | Paso medio · peor | CPU del servidor |
| --- | --- | --- | --- | --- | --- |
| 1 sala de 10, 20 fotos/s | 20,0 | ~28 | 60,0 (0 descartados) | 1,5 ms · 16 ms | 26 % de un núcleo |
| 1 sala de 10, 10 fotos/s (`SNAP_HZ=10`) | 10,0 | ~15 | 60,0 (0 descartados) | 0,8 ms · 10 ms | 15 % de un núcleo |
| 5 salas de 2 | 15,5 (las salas terminan al morir los bots) | ~17 | 60 por sala (3 descartados) | 0,9 ms · 22 ms | 34 % de un núcleo |
| 1 sala de 10 con `COLYSEUS_LATENCY=100` | 20,0 | ~25 | 60,0 | 0,8 ms · 6 ms | 16 % de un núcleo |
| 5 salas de 4, 20 fotos/s (capacidad anterior) | 17,0 (las salas terminan al morir los bots) | ~22 | 60,6 por sala (0 descartados) | 0,44 ms · 4,8 ms | 18 % de un núcleo (pico 51 %), 150 MB |
| **8 salas de 4, 20 fotos/s (capacidad actual, 45 s)** | 16,4 (mín. 8,1; los bots comparten el PC) | ~28 | 60,2 por sala (0 descartados) | 0,26 ms · 3,2 ms | 21,5 % de un núcleo (pico 60 %), 170 MB |

Con 100 ms de latencia simulada el RTT medido fue de 124 ms de mediana, y en el navegador el
personaje propio empezó a moverse en el primer fotograma (unas 10 entradas sin confirmar, 0
correcciones al caminar). El objetivo de un RTT por debajo de 50 ms depende de lo cerca que esté el
servidor de los jugadores: **no está medido en un servidor remoto** y no se garantiza. El RTT que se
muestra es de aplicación (ida y vuelta de un mensaje), no el ping de red ni el tiempo total de
respuesta (que suma el retraso de dibujo y los fotogramas). Las pérdidas de paquetes no se miden:
WebSocket va sobre TCP, que las oculta reenviando.

### Render (histórico)

El servidor empezó en el plan gratis de Render; `render.yaml` sigue en el repo como respaldo
(**New → Blueprint** en [render.com](https://render.com) y apuntar `NET.server` a su URL). No sirve
para la capacidad actual: 0,1 CPU, se duerme a los 15 minutos sin tráfico, tarda cerca de un minuto
en despertar y al dormirse se pierden las partidas. Producción es la máquina virtual de
[`deploy/README.md`](deploy/README.md).

### Alternativa: una máquina virtual Linux (también ARM)

La forma preparada (Docker + Caddy, con script de instalación) está en
[`deploy/README.md`](deploy/README.md). A mano, sin Docker:

Las dependencias son JavaScript puro (Node 22.18 o más nuevo), así que funciona igual en x86 y en
ARM (por ejemplo una VM Ampere). Ejemplo con Ubuntu:

```bash
sudo apt install -y nodejs npm git        # o Node 24 desde nodesource / nvm
git clone https://github.com/TU-USUARIO/Juego--safari.git && cd Juego--safari
npm ci --prefix server
ALLOWED_ORIGINS=https://tu-juego.vercel.app npm start --prefix server
```

Para dejarlo siempre encendido usa un servicio de systemd, y para `wss://` pon delante un proxy
con HTTPS (por ejemplo Caddy: `tu-dominio.com { reverse_proxy localhost:2567 }`, que consigue el
certificado solo). Detén el servicio con `SIGTERM` (`systemctl stop`): el servidor avisa a los
jugadores antes de cerrar.

### Variables de entorno

Están todas, con su explicación, en [`server/.env.example`](server/.env.example) (no hay secretos:
el servidor no usa claves). La frecuencia de simulación no es una variable: es `NET.tickHz` en
`js/core/config.ts`, porque el navegador la necesita igual para predecir.

### Seguridad básica

El servidor valida tipo, rango y tamaño de cada mensaje (más de 16 KB corta la conexión), limita
cuántas entradas y acciones manda cada jugador por segundo, rechaza secuencias repetidas o muy
adelantadas, recorta la dirección a longitud 1 y aplica él mismo la velocidad, la cadencia y la
munición. La identidad sale de la sesión de Colyseus (nunca de un id que mande el cliente): conocer
el código de la sala sólo permite pedir entrar. `ALLOWED_ORIGINS` limita qué páginas pueden
conectarse. Los tokens no se registran.

### Limitaciones y trabajo pendiente

- Sin compensación de latencia para los disparos: las balas son proyectiles que simula el servidor
  en su presente. Con mucho RTT, al apuntar a un zombi que se mueve de lado puedes fallar por poco.
- Tu personaje no predice el empujón de los zombis (lo corrige el servidor; se nota como un leve
  deslizamiento al chocar con la horda).
- Una sola instancia y todo en memoria: reiniciar el proceso termina las partidas.
- Las fotos van en JSON/msgpack con posiciones cercanas (unos 25–30 KB/s por jugador a 20 fotos/s);
  se podrían comprimir más con un formato binario o con diferencias entre fotos.
- Medido sólo en localhost; falta medir en un servidor real y con celulares.

## Versiones y caché

Vite genera archivos con hash en `dist/assets/` (se guardan en caché para siempre) y `index.html` va con `no-cache` (ver `vercel.json`), así que ya no hay que sellar nada. `js/core/version.ts` lleva la versión del build; si una pestaña vieja sigue abierta cuando se publica otra, el juego avisa con un mensaje (compara con `version.json`). La versión aparece en el menú.

## Estructura

```
index.html            Interfaz: HUD, controles táctiles y pantallas
css/style.css         Estilos y diseño adaptable
js/main.js            Game: construye los módulos, guarda la partida y corre el bucle (sólo coordina)
js/states.js          Máquina de estados como tabla (menú, partida, pausa, tienda, nivel, fin…)
js/events.js          Eventos de combate del jugador local
js/actions.js         Acciones de tecla y botón (habilidad, robot, construir, lanzar)
js/save.js            Guardado y carga del progreso
js/core/config.ts     Equilibrio: armas, zombis, tienda, experiencia, red
js/core/util.ts       Utilidades (azar, geometría, almacenamiento)
js/core/version.ts    Versión del código (la inyecta Vite al compilar)
js/core/types.d.ts    Tipos compartidos (GameHost, Cmd…)
js/sim/               Lógica del juego; también la ejecuta el servidor (sin document)
  world.js            Ciudad procedural (sólo datos), colisiones y campo de flujo
  player.js           Movimiento, estamina, armas, recarga y retroceso
  zombies.js          Horda, tácticas (directo, flanco, espalda), rejilla espacial y ataques
  bullets.js          Balas con colisión segmento-círculo y perforación
  director.js         Oleadas y aparición de zombis
  rules.js            Reglas de combate compartidas con el servidor (bajas, botín, dorado, ácido)
  combat.js           Reglas de impacto de bala (compartidas con el servidor)
  combo.js            Racha de bajas
  upgrades.js         Mejoras al subir de nivel
  abilities.js        Clases y habilidades
  build.js            Barricadas, alambre de púas, torretas, granadas y molotov
  heavy.js            Mejoras y disparo de la torreta pesada (también el piloto automático)
  pickups.js          Munición, botiquines y cajas de armas
  robot.js            Robot de combate pilotable
js/render/            Todo el dibujo (una pieza por módulo de sim/ que se ve)
  scene.js            El fotograma completo, el tamaño del lienzo y la calidad adaptable
  camera.js           Cámara con sacudida y retroceso
  sprites.js          Todo el arte, generado por código
  world.js            Suelo por trozos, árboles, fuegos y postes
  zombies.js · bullets.js · pickups.js · build.js · robot.js · remote.js
  lighting.js         Oscuridad, linterna, farolas y fuegos
  particles.js        Partículas y restos en el suelo
  floaters.js         Números +$ y +XP que saltan sobre las bajas
js/net/
  mode.js             game.mode: Solo (con `detached`), OnlineClient, ServerMode
  protocol.js         Tablas y bits del protocolo (cliente y servidor)
  netcode.js          Predicción/reconciliación e interpolación (compartido con el servidor)
  snapshot.js         Codificador de la foto del mundo (servidor)
  remote.js           Lo que llega por la red: jugadores, zombis y balas de adorno
  online.js           Modo en línea: sala, predicción, interpolación y diagnóstico
js/ui/                Entrada (input.js), sonido (audio.js), música (music.js), cuentas (accounts.js)
                      y una pieza por pantalla: hud, shop, class, look, levelup, over, menu, account, board, lobby
public/               Manifiesto e íconos de la PWA
test/                 Pruebas del núcleo (node:test) · e2e/: pruebas de navegador (Playwright)
server/               Servidor autoritativo en línea (Node, TypeScript, Colyseus); pruebas y carga
deploy/               Servidor en una máquina virtual: Docker, Caddy (HTTPS), instalación y guía
docs/                 Documentación técnica y plan de refactorización
render.yaml           Despliegue del servidor en Render (histórico, respaldo)
```

Todo el arte y el sonido se generan por código: el proyecto no usa recursos de terceros.
