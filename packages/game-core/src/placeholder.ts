import type { GameState, DistrictCard, PlayerState } from "@darms/shared-types";
import type { Rng } from "./rng.js";
import { generateRandomCard } from "./deck.js";
import { createPurplePlaceholder } from "./setup.js";

/** Max number of choices shown when playing a placeholder (3-of-N). */
const OFFER_SIZE = 3;

function addLog(state: GameState, message: string): GameState {
  return { ...state, log: [...state.log, { day: state.day, message }] };
}

/**
 * Play a purple placeholder stub from hand.
 *
 * Cases:
 *   - purplePool.length >= 2 → open an offer of min(3, pool.length) distinct cards; await pick.
 *   - purplePool.length === 1 → instantly grant the last card to the hand.
 *   - purplePool.length === 0 → shuffle the placeholder back into the deck and grant
 *     a random coloured card to the hand (design spec: "замешивает обратно и создаёт
 *     случайную цветную").
 *
 * Playing the placeholder does not consume a build action — it's free, like a spell.
 */
export function playPurplePlaceholder(
  state: GameState,
  playerId: string,
  cardId: string,
  rng: Rng,
): GameState | null {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;

  const player = state.players[playerIdx];
  if (player.assassinated) return null;
  if (player.pendingPurpleOffer) return null;

  const cardIdx = player.hand.findIndex((c) => c.id === cardId && c.placeholder === "purple");
  if (cardIdx === -1) return null;

  const newHand = [...player.hand];
  newHand.splice(cardIdx, 1);

  const pool = [...player.purplePool];

  // Case: pool exhausted — recycle placeholder + grant a random colored card.
  if (pool.length === 0) {
    const recycled = createPurplePlaceholder();
    const newDeck = [...state.deck, recycled];
    rng.shuffle(newDeck);
    const coloredCost = rng.int(1, 4);
    const colored = generateRandomCard(coloredCost, rng);
    const newPlayers = [...state.players];
    newPlayers[playerIdx] = { ...player, hand: [...newHand, colored] };
    return addLog(
      { ...state, players: newPlayers, deck: newDeck, rng: rng.getSeed() },
      `🟣 ${player.name} разыграл заглушку — пул пуст, возврат в колоду, получена ${colored.name}`,
    );
  }

  // Case: only one left — grant it immediately.
  if (pool.length === 1) {
    const granted = pool[0];
    const newPlayers = [...state.players];
    newPlayers[playerIdx] = {
      ...player,
      hand: [...newHand, granted],
      purplePool: [],
    };
    return addLog(
      { ...state, players: newPlayers, rng: rng.getSeed() },
      `🟣 ${player.name} разыграл заглушку — последняя фиолетовая карта: ${granted.name}`,
    );
  }

  // Case: open an offer of up to OFFER_SIZE distinct cards from the pool.
  const offerCount = Math.min(OFFER_SIZE, pool.length);
  const indices: number[] = [];
  const available = pool.map((_, i) => i);
  rng.shuffle(available);
  for (let i = 0; i < offerCount; i++) {
    indices.push(available[i]);
  }
  indices.sort((a, b) => a - b);
  const offer = indices.map((i) => pool[i]);

  const newPlayers = [...state.players];
  newPlayers[playerIdx] = {
    ...player,
    hand: newHand,
    pendingPurpleOffer: offer,
  };
  return addLog(
    { ...state, players: newPlayers, rng: rng.getSeed() },
    `🟣 ${player.name} разыграл заглушку — выбор ${offerCount} из ${pool.length}`,
  );
}

/**
 * Player picks one of the cards in their pending purple offer.
 * Chosen card is added to hand; it (and only it) is removed from the pool.
 * Non-picked offered cards stay in the pool for future placeholders.
 */
export function pickFromPurpleOffer(
  state: GameState,
  playerId: string,
  offerIndex: number,
): GameState | null {
  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return null;

  const player = state.players[playerIdx];
  const offer = player.pendingPurpleOffer;
  if (!offer || offerIndex < 0 || offerIndex >= offer.length) return null;

  const picked = offer[offerIndex];
  const poolIdx = player.purplePool.findIndex((c) => c.id === picked.id);
  if (poolIdx === -1) return null;

  const newPool = [...player.purplePool];
  newPool.splice(poolIdx, 1);

  const newPlayers = [...state.players];
  newPlayers[playerIdx] = {
    ...player,
    hand: [...player.hand, picked],
    purplePool: newPool,
    pendingPurpleOffer: null,
  };

  return addLog(
    { ...state, players: newPlayers },
    `🟣 ${player.name} выбрал ${picked.name}`,
  );
}
