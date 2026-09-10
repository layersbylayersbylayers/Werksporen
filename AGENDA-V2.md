# Werksporen V2 — lokale agenda

Deze agenda hoort bij de offline V2-versie op de SSD. V1 blijft onaangeraakt. Er wordt pas gemerged of gedeployed wanneer een versie echt af en getest is.

## Hoofddoel

De homepage wordt een bezoekwaardige interactieve werkruimte: een vaste grid waarin games, beeld, beweging en later eigen sound-ontwerpen samenkomen. De overige tabs blijven de verdiepende portfolio-/informatiepagina's.

## Werkvolgorde

1. **Games afronden**
   - Memory — afgerond; niet meer aanpassen.
   - Minesweeper — eerste V2-versie staat; verder stabiliseren en testen zonder Memory te wijzigen.
   - Snake — volgende kandidaat: eenvoudige besturing, touch/muis en een rustige grid-morph.
   - Tetris — daarna; technisch complexer door vallende stukken, rotatie, collision en timing.
2. **Games eigen maken**
   - Per game een unieke Werksporen-presentatie en animatietaal.
   - Pas daarna sounds toevoegen: eerst observeren, analyseren en zelf ontwerpen.
   - Win-, verlies-, start- en overgangsschermen per game als tijdelijke, verwijderbare Admin-opties ontwerpen.
3. **APPS-tab bouwen**
   - Nieuwe tab met dezelfde Home/Minesweeper-gridgedachte.
   - Gevulde vakjes zijn app-kadertjes/app-iconen, geen losse grote afbeelding vóór de grid.
   - Elk app-vakje is aanklikbaar en opent de betreffende mini-app.
   - Met twee apps bestaan er dus twee gevulde vakjes; lege vakjes blijven onderdeel van het raster.
   - De halve MYKIRI-app is de eerste kandidaat; later kunnen meer zelfgemaakte apps volgen.

## Ontwerpprincipes

- Gebruik de bestaande Home → side-grid morph als basis voor alle grid-games.
- Eén duidelijke gridmodus per game; geen dubbele rasters, overlays of verspringende paginahoogte.
- Touch, trackpad en muis ondersteunen waar dat logisch is.
- Footer, disclaimer, day/night/language en navigatie blijven stabiel tijdens interactie.
- Tijdelijke testbediening komt gegroepeerd in Admin en is later in één blok te verwijderen.

## Technische werkwijze

- Werk uitsluitend in `portfolio-v2` op de SSD.
- Maak vóór grotere wijzigingen een backup/branch.
- Test lokaal/offline; push en deploy alleen na expliciete beslissing.
- Controleer na elke game: syntax, `git diff --check`, browser-interactie, mobiele bediening en regressie van Memory.

## Open ontwerpvragen

- Welke eigen soundtaal hoort bij iedere game?
- Welke unieke eindstaat past bij Snake, Tetris en Minesweeper?
- Welke app-iconen en mini-apps komen na MYKIRI in de APPS-tab?
