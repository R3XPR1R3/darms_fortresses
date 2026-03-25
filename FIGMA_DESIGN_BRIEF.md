# Darms: Fortresses — Design Brief for FigmaMake

## Project Overview

**Darms: Fortresses** — dark-fantasy card strategy game (mobile-first web app, 4 players).
Players draft heroes each round ("day"), build districts, use abilities, and race to build 8 districts first.

**Genre reference**: Citadels (board game) reimagined as a dark-fantasy digital card game.

---

## Color Palette & Visual Identity

### Primary Colors
- **Background**: `#1a1a2e` (deep navy/charcoal)
- **Primary Accent**: `#e94560` (crimson red — actions, urgency, highlights)
- **Secondary Dark**: `#0f3460` (dark blue — panels, cards, secondary UI)
- **Panel Background**: `#16213e` (slightly lighter dark blue)
- **Surface Dark**: `#12182a` (opponent boards, recessed areas)
- **Text Primary**: `#eeeeee` (off-white)
- **Text Secondary**: `#888888`, `#aaaaaa`

### District/Faction Colors
- **Yellow** (Royal): `#f0c040`
- **Blue** (Holy): `#4090f0`
- **Green** (Trade): `#40c060`
- **Red** (Military): `#e04050`
- **Purple** (Special): `#9060e0`

### Hero-Specific Colors
| Hero | Color | Hex |
|------|-------|-----|
| Assassin (Fahira Mirai) | Crimson | `#e94560` |
| Thief (Mitchell Silas) | Gold | `#c0a040` |
| Sorcerer (Master Zedrud) | Purple | `#7c3aed` |
| King (Irisiy Faoris) | Bright Gold | `#f0c040` |
| Cleric (Ashley Firia) | Blue | `#4090f0` |
| Merchant (Marhat Fahari) | Green | `#40c060` |
| Architect (Sebastian Maevis) | Rose | `#f090a0` |
| General (Gresh Mavrov) | Dark Red | `#e04050` |

### Visual Style
- **Dark fantasy** aesthetic — gritty medieval with magical undertones
- **Glowing accents** on dark backgrounds (neon-on-dark feel)
- **Minimal borders**, use color and shadow to separate sections
- **Card textures** with low-opacity building illustrations as backgrounds
- **Hero portraits** are painted/illustrated character art (anime-influenced dark fantasy)

---

## Screen Flow (6 Screens)

### Screen 1: Main Menu
**Layout**: Centered vertical stack, max-width 400px

**Elements**:
- Game logo/title: "⚔ Darms: Fortresses" (large, crimson, letter-spacing)
- Subtitle: "Card strategy" (small, muted)
- Language toggle button (top-right corner, small pill: "RU" / "EN")
- Player name input field (dark bg, blue border, placeholder "Your name")
- Primary button: "Local game (with bots)" — full width, crimson
- Divider: "— online —" (muted text with lines)
- Two secondary buttons: "Create room" / "Join by code"

**Feel**: Clean, inviting, mysterious. Dark background with subtle texture.

---

### Screen 2: Online Lobby
**Layout**: Centered vertical stack

**Elements**:
- Room code display: large monospace text in a dashed crimson border box
- Hint: "Share code with friends" (small, muted)
- Player list (up to 4 slots):
  - Each player: avatar placeholder + name + badges (host, bot, "you")
  - Empty slots shown as dashed outlines
- Player count: "2/4 players"
- Action buttons (host only): "Add bot", "Start game" (disabled if <4)
- Back button (secondary)

---

### Screen 3: Hero Draft Phase
**Layout**: Vertical stack, mobile-optimized (max-width 600px)

**Top section — Turn Banner**:
- Full-width bar with gradient (`#0f3460` → `#16213e`)
- Text: "Day 1 — Your hero pick!" or "Day 1 — Hero pick..."
- When it's your turn: crimson gradient background with **pulse animation**
- Draft timer badge: "45s" (gold text, dark bg, goes red when ≤10s)

**Middle section — Opponent Mini-Tabs**:
- Horizontal row of 3 opponent tabs (each ~33% width)
- Each tab shows:
  - Hero portrait thumbnail (if already picked and revealed) OR sleep icon (💤)
  - Player name (10px)
  - Mini stats: 💰2 🏠0/8
- Active tab has colored bottom border (hero color)

**Center section — Draft Cards**:
- Ban display: "Banned: [hero portraits] + 1 hidden"
- **Hero selection cards** — THIS IS THE KEY UI:
  - 6 cards (or fewer as picks happen), horizontally scrollable on mobile
  - Each card is a vertical card (~120×200px) containing:
    - **Hero portrait** (top half, cropped character art, 72px height)
    - **Class label** (uppercase, tiny, hero color): "ASSASSIN", "THIEF", etc.
    - **Color faction dot** (8px circle if hero has a faction color)
    - **Hero name** (bold, 11px): "Fahira Mirai"
    - **Speed badge** (⚡ number, muted)
    - **Ability name** (hero color, 10px): "Assassination"
    - **Ability description** (muted, 9px, 2-3 lines)
  - Card border: 2px `#0f3460`, on hover → hero color + glow + lift (-4px translateY)
  - Cards should feel like collectible character cards

**Bottom section — My Board (simplified)**:
- Stats bar: 💰2 🃏5 🏠0/8
- District grid (empty at start)

---

### Screen 4: Companion Draft Phase
**Layout**: Same frame as hero draft, center section changes

**Center section — Companion Selection**:
- Title: "Choose Companion" (h2)
- Hint: "Pick a companion for this day:"
- **Companion cards** (currently 1, designed for 3):
  - Each card is a horizontal button/card (~300×60px):
    - Companion icon (emoji or illustration placeholder): 🧑‍🌾
    - Companion name: "Useless Farmer"
    - Ability description: "Take +1 extra gold"
  - On hover: subtle glow, lift
  - Design should support 3 distinct companion cards in the future

**Note**: This is simultaneous — all players pick at once. Show "Other players are choosing..." after picking.

---

### Screen 5: Turns Phase (Main Gameplay)
**Layout**: Vertical stack, this is the main game screen

#### 5A. Turn Banner (top, fixed)
- Shows whose turn it is
- If **my turn**: crimson pulse background
  - "[Hero Portrait 24px] Your turn — Fahira Mirai [48s]"
- If **other's turn**:
  - "Turn: [Hero Portrait] Hero Name (Player Name)" (if hero is revealed)
  - "Turn: Player Name" (if hero unrevealed)
- Timer badge: gold text, turns red ≤10s

#### 5B. Opponent Tabs (below banner)
- 3 horizontal tabs for opponents
- Active tab: hero-color bottom border + arrow indicator (▼)
- Each tab:
  - Hero portrait (20px) or 💤
  - Player name (truncated)
  - 💰gold 🏠districts
  - ⭐ if finished first

#### 5C. Opponent Board (scrollable area)
- **Hero display** (if revealed):
  - Large hero portrait (64px)
  - Hero name (14px, hero color)
  - Speed (11px, muted)
- **If unrevealed**: 💤 sleep emoji (32px) + "Role hidden" + player name
- Stats bar: 💰gold 🃏hand 🏠districts/8 ⭐
- **Districts grid** (4 columns):
  - Each district is a small card (aspect 5:6)
  - Card shows: cost badge (circle), name, HP, faction color border
  - Card has low-opacity building texture background
- If assassinated: "💀 Killed today" badge (crimson)

#### 5D. My Board (bottom, fixed/scrollable)
- **Hero row**:
  - Portrait (48px)
  - Hero name (14px, bold, hero color)
  - Speed (11px)
  - Ability tag (small pill: "Assassination", hero color text on dark bg)
- **Stats bar**: 💰3 🃏4 🏠2/8 ⭐
- **My districts** (4 columns, same card style as opponents)
- **Hand section**:
  - Label: "Hand" (small, crimson)
  - **Hand cards** (horizontally scrollable, ~72×96px each):
    - Faction-colored background gradient
    - Cost badge (20px circle, top-left)
    - District name (centered, word-wrapped)
    - Low-opacity building texture
    - If buildable: "Build" button overlay (tiny, primary)
    - If too expensive: dimmed/grayed

#### 5E. Action Buttons (bottom of my board)
- **Row of action buttons** (flex-wrap):
  - **Ability button** (secondary, dark blue): "[Hero Portrait 20px] Ability"
    - OR "✓ Passive" for passive heroes (King, Cleric, Merchant, Architect)
  - **Companion button** (secondary): "🧑‍🌾 Useless Farmer"
  - **Gold button** (gold bg, black text): "💰 +1 Gold"
  - **Draw button** (blue): "🃏 Draw card"
  - **End turn button** (primary, crimson): "End turn ➡"
- If assassinated: "💀 You are killed today. Your turn is skipped." (hint text)
- If not my turn: "Waiting for other players..." (hint text)

#### 5F. Bottom Bar
- Ban list: "Banned: [hero portraits] + 1 hidden"
- Journal toggle: "📜 Journal" (collapsible)
- **Game log** (when expanded, 150px max-height, scrollable):
  - Entries: "[Day 1] Player used ability on Target"
  - Day tags in crimson

---

### Screen 6: Ability Modals
**Design**: Fixed overlay, centered card (350px wide), dark panel bg, crimson border

#### 6A. Assassin Modal — "Kill a character"
- Hint: "Choose a character — if someone has it, they skip their turn."
- List of hero buttons (exclude Assassin + face-up banned):
  - Each: [Hero Portrait 24px] Hero Name [⚡Speed]
  - Clickable, hover highlight

#### 6B. Thief Modal — "Rob a character"
- Same layout, exclude Thief + Assassin + face-up banned

#### 6C. Sorcerer Modal — "Sorcerer Ability"
- Hint: "Discard 2 random cards and draw 3, or swap hands with any player."
- Option 1: "[Sorcerer Portrait] Discard 2, draw 3"
- Option 2-4 (per opponent):
  - "[Hero Portrait or ❓] Player Name — X cards"
  - Shows revealed hero portrait if hero is known, otherwise ❓

#### 6D. General Modal — "Destroy a district"
- Hint: "Spend gold to destroy an opponent's district. Cleric is protected."
- List of destroyable districts (per opponent, excluding Cleric):
  - "💥 District Name (Cost💰) from Player Name [Hero Portrait if revealed]"
- If no targets: "No available targets"
- If not enough gold: "Not enough gold"

---

### Screen 7: Winner Overlay
- Fixed fullscreen overlay (`rgba(0,0,0,0.8)`)
- Centered winner card:
  - "🏆 [Winner Name] won!" (large text)
  - Score/stats summary (optional future feature)
  - "← To menu" button (primary, crimson)
- Pop-in animation: scale from 0.5 → 1.0

---

## Component Library

### Buttons
| Variant | Background | Text | Use Case |
|---------|-----------|------|----------|
| Primary | `#e94560` | white | Main actions (End turn, Start game) |
| Secondary | `#0f3460` | white | Abilities, companion, navigation |
| Gold | `#f0c040` | black | Gold income |
| Card Blue | `#4090f0` | white | Draw card |
| Disabled | any (opacity 0.4) | — | Unavailable actions |

### Cards
- **Hero Draft Card**: 120×200px, portrait + info, bordered, hover glow
- **District Card** (built): 5:6 aspect, cost badge, name, HP, texture bg
- **Hand Card**: 72×96px, faction color, cost badge, name, build button
- **Companion Card**: 300×60px horizontal, icon + name + description

### Badges/Pills
- Timer: gold text on dark bg, red when urgent
- Speed: "⚡N" muted text
- Ability tag: hero-color text on dark pill
- Cost badge: 20px circle, dark semi-transparent bg
- HP badge: tiny, bottom-right of district cards
- Crown: ⭐ / 👑 near player name

### Modals
- Dark panel (`#16213e`), 1px crimson border, rounded
- Title in crimson (h3)
- Option buttons: full-width, flex with icon + text, gap 6px

---

## Responsive Behavior

### Mobile Portrait (< 600px width)
- Show landscape rotation hint overlay
- "Rotate your device for the best experience"
- Dismiss button available

### Mobile Landscape (≤ 500px height)
- Switch to **row-based layout**:
  - Turn banner: full width strip (top)
  - Opponent tabs: vertical column (left, 130px)
  - Opponent board: center (flex: 1)
  - My board: bottom strip (full width, scrollable)
- Smaller typography (12px body)
- Smaller cards (64×84px hand cards)
- Smaller badges (18px)

### Tablet/Desktop (> 600px)
- Centered column layout (max-width 600px)
- All sections visible without horizontal scroll
- Hero draft cards in a single row (no scroll needed)

---

## Animations & Transitions

- **District built**: scale 0.3→1, opacity 0→1, slight rotation (450ms)
- **Gold/hand change**: stats bar pulse scale 1→1.12→1 (300ms)
- **Turn switch**: banner fade-in from top (300ms)
- **Opponent tab switch**: board slide-in from right (250ms)
- **Draft cards appear**: staggered slide-up + fade (350ms each, 60ms delay)
- **Winner overlay**: scale 0.5→1 pop-in (500ms, ease-out-back)
- **My turn banner**: continuous pulse animation (1.5s, opacity 0.85↔1)
- **Timer urgent**: faster pulse (0.8s) when ≤10s

---

## Key UX Notes

1. **Information hierarchy**: Current turn/timer always visible at top. Your own board always at bottom. Opponents in the middle — switchable via tabs.

2. **Draft experience**: Hero cards should feel like "choosing your destiny" — large portraits, hover effects, clear ability descriptions. This is the most exciting moment each round.

3. **Companion draft**: Simpler, faster choice. Cards are smaller, more functional. Think of it as a quick side-pick between the main draft and gameplay.

4. **Action clarity**: During your turn, available actions should be immediately obvious. Unavailable actions should be hidden or clearly disabled. The flow is: Ability → Companion → Income → Build → End Turn.

5. **Secret information**: Other players' heroes are hidden until their turn. Use 💤/❓ placeholders. When revealed, show hero portrait and name prominently.

6. **Timer pressure**: Timer is a constant presence during your turn. When ≤10s, it should feel urgent (red, pulsing). Auto-action on expiry prevents stalling.

7. **Dark theme**: The entire UI is dark. Light elements (text, icons, accents) should pop. Avoid large bright areas. Use glows and subtle gradients instead of flat colors.

---

## Design Deliverables Requested

1. **Complete component library** (buttons, cards, badges, modals, inputs)
2. **All 7 screens** at mobile landscape resolution (primary) and desktop (secondary)
3. **Hero draft card** component in detail (this is the signature UI element)
4. **Ability modal** designs for all 4 active heroes
5. **District card** variants for all 5 faction colors + purple
6. **Animation specs** (timing, easing, transforms) for key transitions
7. **Responsive variants** for portrait hint, landscape mobile, tablet

---

## Assets Available

- 8 hero character portraits (painted illustration style, PNG/GIF)
- 25+ building texture illustrations (per district, PNG)
- Hero icon SVGs (32×32, inline, simple geometric shapes)

Path pattern: `/heroes/{heroId}/skins/default/portrait.png`
Building textures: generated per district name
