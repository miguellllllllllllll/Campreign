import type { TutorialStep } from '../types/tutorial.ts'

/**
 * "The Goblin in the Cellar" — the whole tutorial as data. Adding a beat means
 * adding an entry here, never editing a component. The `guidance` field is what
 * the banner shows word for word, so a step can never leave the player stuck
 * without an instruction.
 */
export const GOBLIN_CELLAR: readonly TutorialStep[] = [
  {
    id: 'arrive',
    phase: 'exploration',
    title: 'The cellar door',
    narration:
      'The innkeeper points a shaking finger at the cellar hatch. "Something got in through the drain," she says. "It has been knocking bottles over all morning." The hatch is propped open. Below, the dark smells of spilled ale and wet stone.',
    guidance:
      'Read the scene, then press Continue. Nothing can go wrong yet — this is just the story setting itself up.',
    completion: { when: 'acknowledged' },
    next: 'listen',
  },
  {
    id: 'listen',
    phase: 'exploration',
    title: 'Listen at the hatch',
    narration:
      'You crouch at the top of the steps. There is a scrape of claws on stone, then nothing. Whatever is down there may already know you are here.',
    guidance:
      'Press Roll Perception. You will roll a twenty-sided die and add your bonuses; reach 12 and you work out where the noise is coming from before you go down.',
    completion: { when: 'skillCheck', skill: 'perception' },
    check: {
      skill: 'perception',
      dc: 12,
      reason: 'Perception is noticing things. Wisdom governs it.',
      onSuccess:
        'You pin the sound down: something small, breathing fast, tucked behind the ale barrels in the far corner. You will see it before it sees you.',
      onFailure:
        'The cellar swallows the noise. You will be going down blind — not a disaster, just less warning than you would like.',
    },
    next: 'descend',
  },
  {
    id: 'descend',
    phase: 'exploration',
    title: 'Down the steps',
    narration:
      'The steps are slick. At the bottom, a goblin stands with its back to a stack of barrels, scimitar out, eyes enormous. It is cornered, and it knows it.',
    guidance:
      'Press Continue. You have finished the exploration phase — you looked around and found something. Now you get to decide how to handle it.',
    completion: { when: 'acknowledged' },
    next: 'parley',
  },
  {
    id: 'parley',
    phase: 'social',
    title: 'It has not attacked yet',
    narration:
      'The goblin bares its teeth, but the blade is shaking. It is between you and nothing at all — no exit, no friends. It says something in a language you do not know, then, thickly: "You go. I go. Yes?"',
    guidance:
      'Pick how you want to handle this. Talking and threatening are both rolls against a difficulty of 12. Drawing steel needs no roll at all — but it starts the fight immediately.',
    completion: { when: 'choicePicked' },
    choices: [
      {
        id: 'persuade',
        label: 'Offer it a way out',
        check: { skill: 'persuasion', dc: 12 },
        onSuccess:
          'You step aside and point at the drain. The goblin edges past you, then bolts — and stops halfway, because a shape fills the drain behind it. It turns back, cornered again, and now it is genuinely frightened.',
        onFailure:
          'You reach out an open hand. The goblin reads it as a grab and lunges, shrieking.',
      },
      {
        id: 'intimidate',
        label: 'Tell it exactly what happens if it stays',
        check: { skill: 'intimidation', dc: 12 },
        onSuccess:
          'You describe, calmly, what a longsword does to something its size. The goblin believes you. Its guard drops — and it swings anyway, badly, out of pure panic.',
        onFailure:
          'You growl. The goblin growls back, louder, and decides that you are the smaller problem.',
      },
      {
        id: 'attack',
        label: 'Draw steel and end it',
        onSuccess:
          'You do not give it the chance to decide. Your weapon comes up and the cellar turns into a fight.',
        onFailure:
          'You do not give it the chance to decide. Your weapon comes up and the cellar turns into a fight.',
      },
    ],
    next: 'initiative',
  },
  {
    id: 'initiative',
    phase: 'combat',
    title: 'Roll for initiative',
    narration:
      'Everything speeds up. From here you take it in turns: everyone rolled a twenty-sided die and added their Dexterity, and whoever rolled highest acts first.',
    guidance:
      'Look at the turn order on the right, then press Continue. A round is one pass through that list, and it repeats until the fight is over.',
    completion: { when: 'acknowledged' },
    onEnter: [{ kind: 'startCombat' }],
    next: 'move',
  },
  {
    id: 'move',
    phase: 'combat',
    title: 'Movement first',
    narration:
      'Your longsword only reaches the square next to you. The goblin is across the cellar floor.',
    guidance:
      'Click one of the highlighted squares to walk there. Aim to finish next to the goblin. Moving does not use up your action, so you can still attack afterwards.',
    completion: { when: 'moved' },
    victory: 'aftermath',
    next: 'attack',
  },
  {
    id: 'attack',
    phase: 'combat',
    title: 'Then your action',
    narration:
      'You get one significant thing per turn. Attacking is the obvious one: roll a twenty-sided die, add your bonuses, and compare the total to the goblin’s Armour Class of 12.',
    guidance:
      'Press your weapon button to attack the goblin. If you are still too far away, move closer first — the button will tell you.',
    completion: { when: 'attackResolved' },
    victory: 'aftermath',
    next: 'endTurn',
  },
  {
    id: 'endTurn',
    phase: 'combat',
    title: 'End your turn',
    narration:
      'You have moved and you have acted. That is a turn. Handing over lets the goblin take its own — it will close the distance and swing back.',
    guidance:
      'Press End Turn. The goblin will act straight away, and then it comes back round to you.',
    completion: { when: 'turnEnded' },
    victory: 'aftermath',
    next: 'rout',
  },
  {
    id: 'rout',
    phase: 'combat',
    title: 'Finish the fight',
    narration:
      'Now you know the whole loop: move, act, end turn. Repeat it until one side is out of hit points.',
    guidance:
      'Keep moving, attacking and ending your turn until the goblin is down. Every roll is explained in the log underneath the map.',
    completion: { when: 'enemyDefeated' },
    victory: 'aftermath',
    next: 'aftermath',
  },
  {
    id: 'aftermath',
    phase: 'combat',
    title: 'You levelled up',
    narration:
      'The goblin stops moving. You catch your breath, bind what needs binding, and something settles — you are better at this than you were an hour ago.',
    guidance:
      'Read what changed, then press Continue. Levelling up in D&D is exactly this: your numbers go up, and you get something new to do with them.',
    completion: { when: 'acknowledged' },
    onEnter: [{ kind: 'levelUp' }, { kind: 'shortRest' }],
    next: 'deeper',
  },
  {
    id: 'deeper',
    phase: 'combat',
    title: 'Something else is down here',
    narration:
      'The drain the innkeeper mentioned is a hole in the far wall, and it is bigger than a drain. Something comes through it fast and low, and something else follows on foot, unhurried, rattling.',
    guidance:
      'Two of them this time. Press Continue to roll initiative — then look at the turn order before you decide who to hit.',
    completion: { when: 'acknowledged' },
    onEnter: [{ kind: 'startCombat', encounterId: 'deeper' }],
    next: 'swarm',
  },
  {
    id: 'swarm',
    phase: 'combat',
    title: 'Two at once',
    narration:
      'Two enemies is not twice one enemy. The bat is fast and fragile; the skeleton is slow and keeps coming. Dropping one of them halves what is being thrown at you, so most of the time the answer is to finish one rather than wound both.',
    guidance:
      'Fight them the same way — move, act, end turn — but choose a target each round. Your spells and your new hit points are both worth spending here.',
    completion: { when: 'enemyDefeated' },
    victory: 'finish',
    next: 'finish',
  },
  {
    id: 'finish',
    phase: 'combat',
    title: 'The cellar is clear',
    narration:
      'That is the whole game: explore, talk, fight, and get better at it. Everything above this is the same three things with bigger numbers.',
    guidance:
      'Nothing left down here. Play it again with a different class to see how much of this changes, or build another hero and start over.',
    completion: { when: 'acknowledged' },
    next: null,
  },
]

export const FIRST_STEP_ID = 'arrive'
export const FINAL_STEP_ID = 'finish'

export function stepById(id: string): TutorialStep | undefined {
  return GOBLIN_CELLAR.find((step) => step.id === id)
}
