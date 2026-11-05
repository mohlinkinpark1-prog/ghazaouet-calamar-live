# Lueur de Veille — Philosophie du design

> Ghazaouet Calamar Live · mouvement visuel fondé le 5 novembre 2026.

## 1. Le sujet dicte la lumière

Il est 3 heures du matin au port de Ghazaouet. La baie est noire — pas noire comme un écran, noire comme une **encre** qui absorbe tout ce qu'elle reçoit. Ce qui reste visible se réduit à trois sources : les **lampes sodium** du pont qui teintent l'eau d'un jaune chaud alcalin, le **phosphore** des méduses et du plancton qui répond en vert-mer quand les encornets remontent, et la **lune** qui pose une feuille d'or mat sur les crêtes. Tout le design dérive de ces trois lumières sur une mer d'encre : Fosse d'encre `#050E13`, Lanterne `#FFB629`, Phosphore `#48E3C6`, et pour les avertissements, le rouge brique d'un feu de signalisation réglé sur « chantier » `#FF5E5B`. Il n'existe pas de blanc pur dans ce système — à sa place, la **Chair** `#F2EDE2`, la couleur du carton d'un filin rouillé que la brume éclaire.

## 2. La nuit n'est pas un fond bleu sombre

Les interfaces « dark mode » génériques dégradent du noir vers du bleu-gris ; la nuit d'un port de pêche ne dégrade jamais, elle **concentre**. Les panneaux sont des quantités de brume (`rgba(9,26,40,.68)`) posées sur l'encre, avec une seule frontière nette par bloc — la wayne des taudis, pas la grille d'un tableau de bord corporate. La hiérarchie se fait par **émission** : ce qui émet (les valeurs, la jauge, la fenêtre optimale) reprend la lumière sodium ou phosphore ; ce qui est passif (libellés, notes) demeure en brume `#9DB3BE`. Un regard posé sur la page doit immédiatement trouver le point chaud de la nuit — l'indice du jour — comme un pêcheur trouve la lampe de son pont deux quais plus loin.

## 3. La typographie a de la main

Le cadre porte la voix : **Bricolage Grotesque** pour ce qui nomme — titres, valeurs, dates — une grotesque à l'ossature visible, aux jonctions où l'on voit l'outil. Le texte courant respire en **Instrument Sans**, sobre sans être anonyme. Les données monospace restent en **JetBrains Mono**, parce qu'un chiffre de profondeur ou de houle se compare en tabular, comme au relevé du sémaphore. Ce trio (main qui nomme / main qui explique / main qui compte) est fixé par tokens — `--font-display`, `--font-ui`, `--font-mono` — et jamais contredje jamais dérogé cas par cas.

## 4. La signature : la fenêtre de tir

Le geste le plus reconnaissable du mouvement est la **fenêtre de tir** : encadré de la fenêtre optimale de la nuit, où un **faisceau de lampe balaie lentement** de gauche à droite, toutes les ~7 secondes, comme la lumière d'un pont qui fouille l'eau avant de revenir. C'est délibérément lent et discret — un liseré qui glisse, pas un cambouis de gradient. `prefers-reduced-motion` éteint l'animation et fige le faisceau à 25 % : les yeux fatigués et les mains ancrées restent servis. Ce balayage est la seule animation décorative du système ; partout ailleurs, le mouvement appartient au donné (données fraîches, jauge, lune).

## 5. Le calmar décide, l'interface obéit

Chaque variable du système a un devoir : `--band-*` hérite des cinq paliers de l'Indice Calamar™ et répond à la notation du moteur (engine.js), donc le calendrier, la jauge et les cartes **ne peuvent jamais se contredire** — la même nuit est colorée pareil partout, dans les six thèmes, jusqu'à la version claire « Jour Mer » où les paliers se resserrent en encres foncées pour rester lisibles en plein soleil du pont. La géométrie (jauge 300×212, arc, pivot) est une question d'exactitude avant d'être une question de goût : la valeur doit demeurer au-dessus de l'aiguille, jamais recoupée.

## 6. Ce que le mouvement interdit

Pas de blanc pur. Pas de dashboards bleu-violet. Pas d'ombres portées ostentatoires — l'ombre est la nuit elle-même (`0 24px 60px rgba(0,0,0,.45)`, une seule). Pas d'emoji comme icônes : le sprite interne SVG tient la main. Pas de bleu par défaut : tout le bleu de l'app vient de la Méditerranée réelle et passe par `--sea`/`--sea-rgb`. Et pas de décoration qui ne raconte pas une nuit de pêche : si un élément n'éclaire ni ne mesure, il n'appartient pas à Lueur de Veille.
