import { attackBonus, damageNotation } from '../../lib/dnd/characterBuilder.ts'
import { BACKGROUND_PRESETS, CLASS_PRESETS, RACE_PRESETS } from '../../lib/dnd/presets.ts'
import { featById } from '../../content/feats.ts'
import { spellsByIds } from '../../content/spells.ts'
import { subclassById } from '../../content/subclasses.ts'
import {
  ABILITY_LABELS,
  ABILITY_NAMES,
  SKILL_ABILITY,
  SKILL_LABELS,
  SKILL_NAMES,
  abilityModifier,
  formatModifier,
  passiveScore,
  proficiencyBonus,
  skillBonus,
} from '../../lib/dnd/stats.ts'
import type { Character } from '../../types/character.ts'

/*
 * Ink-friendly by design. This sheet is the one part of Hero Step that must not
 * inherit the obsidian theme: it is printed on white paper, so the colours are
 * literal values rather than theme tokens, and they are inline so no dark-mode
 * utility can win against them.
 *
 * Body copy uses Georgia rather than the app's Cinzel. Cinzel is a display face
 * and unreadable in a paragraph at 9pt; headings keep it.
 */
const PARCHMENT = '#FAF7F2'
const INK = '#1B1710'
const RULE = '#8B6B23'
const RULE_SOFT = '#C6AE73'
const BODY_FONT = 'Georgia, "Times New Roman", serif'

const boxed = {
  border: `1.5px solid ${RULE}`,
  borderRadius: '3px',
} as const

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: RULE,
        borderBottom: `1.5px solid ${RULE_SOFT}`,
        letterSpacing: '0.08em',
      }}
      className="mb-1.5 pb-0.5 text-[8pt] font-bold uppercase"
    >
      {children}
    </p>
  )
}

/** A labelled value in its own ruled box — the visual unit of a paper sheet. */
function Field({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div style={boxed} className="flex flex-col items-center px-1 py-1 text-center">
      <span className="text-[13pt] leading-none font-bold">{value}</span>
      <span style={{ color: RULE }} className="mt-0.5 text-[6.5pt] font-bold uppercase">
        {label}
      </span>
      {hint !== undefined && <span className="text-[6pt] leading-tight opacity-70">{hint}</span>}
    </div>
  )
}

export function PrintableCharacterSheet({ character }: { character: Character }) {
  const klass = CLASS_PRESETS[character.classId]
  const race = RACE_PRESETS[character.raceId]
  const background = BACKGROUND_PRESETS[character.backgroundId]

  const subclass = subclassById(character.subclassId)
  const feat = featById(character.featId)
  const prof = proficiencyBonus(character.level)
  const perception = passiveScore(
    skillBonus(character.scores, 'perception', character.level, character.skillProficiencies),
  )

  return (
    <div
      className="printable-sheet"
      style={{
        width: '210mm',
        minHeight: '297mm',
        background: PARCHMENT,
        color: INK,
        fontFamily: BODY_FONT,
        padding: '12mm',
        boxSizing: 'border-box',
      }}
    >
      {/* --- Header banner ------------------------------------------------ */}
      <div style={{ ...boxed, padding: '3mm' }} className="mb-2">
        <p className="font-serif text-[20pt] leading-none font-black">{character.name}</p>
        <div className="mt-2 grid grid-cols-5 gap-1.5 text-[7.5pt]">
          {[
            { label: 'Class & Level', value: `${klass.label} ${character.level}` },
            { label: 'Ancestry', value: race.label },
            { label: 'Background', value: background.label },
            { label: 'Proficiency', value: formatModifier(prof) },
            { label: 'Passive Perception', value: String(perception) },
          ].map((cell) => (
            <div key={cell.label}>
              <p style={{ color: RULE }} className="text-[6.5pt] font-bold uppercase">
                {cell.label}
              </p>
              <p className="font-bold">{cell.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {/* --- Left column: the numbers you look up constantly ------------- */}
        <div style={{ width: '32%' }} className="flex flex-col gap-2">
          <div>
            <SectionTitle>Ability Scores</SectionTitle>
            <div className="grid grid-cols-3 gap-1.5">
              {ABILITY_NAMES.map((ability) => (
                <Field
                  key={ability}
                  label={ABILITY_LABELS[ability]}
                  value={String(character.scores[ability])}
                  hint={formatModifier(abilityModifier(character.scores[ability]))}
                />
              ))}
            </div>
          </div>

          <div>
            <SectionTitle>Combat</SectionTitle>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Armour Class" value={String(character.ac)} hint={character.armorName} />
              <Field label="Speed" value={`${character.speedFeet} ft`} hint="30 ft = 6 squares" />
              <Field label="Hit Points" value={String(character.maxHp)} hint="Current: ____" />
              <Field label="Hit Dice" value={`1d${klass.hitDie}`} hint="Per long rest" />
            </div>
          </div>

          <div>
            <SectionTitle>Saving Throws</SectionTitle>
            <div style={boxed} className="px-1.5 py-1">
              {ABILITY_NAMES.map((ability) => {
                const proficient = character.savingThrows.includes(ability)
                const bonus = abilityModifier(character.scores[ability]) + (proficient ? prof : 0)
                return (
                  <div key={ability} className="flex items-center gap-1.5 text-[8pt] leading-snug">
                    <span aria-hidden style={{ color: proficient ? INK : RULE_SOFT }}>
                      {proficient ? '●' : '○'}
                    </span>
                    <span className="w-8 font-mono font-bold">{formatModifier(bonus)}</span>
                    <span>{ABILITY_LABELS[ability]}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {character.spellcasting !== undefined && (
            <div>
              <SectionTitle>Spellcasting</SectionTitle>
              <div className="grid grid-cols-2 gap-1.5">
                <Field label="Spell Save DC" value={String(character.spellcasting.saveDc)} />
                <Field
                  label="Spell Attack"
                  value={formatModifier(character.spellcasting.attackBonus)}
                />
              </div>
              {character.spellcasting.note !== undefined && (
                <p className="mt-1 text-[6.5pt] leading-tight italic">
                  {character.spellcasting.note}
                </p>
              )}
            </div>
          )}
        </div>

        {/* --- Right column: what you actually do on your turn ------------- */}
        <div style={{ width: '68%' }} className="flex flex-col gap-2">
          <div>
            <SectionTitle>Attacks &amp; Actions</SectionTitle>
            <table className="w-full border-collapse text-[8pt]">
              <thead>
                <tr style={{ color: RULE }} className="text-left text-[6.5pt] uppercase">
                  <th className="pb-0.5">Attack</th>
                  <th className="pb-0.5">To Hit</th>
                  <th className="pb-0.5">Damage</th>
                  <th className="pb-0.5">Range</th>
                </tr>
              </thead>
              <tbody>
                {character.attacks.map((attack) => (
                  <tr key={attack.id} style={{ borderTop: `1px solid ${RULE_SOFT}` }}>
                    <td className="py-0.5 font-bold">{attack.name}</td>
                    <td className="py-0.5 font-mono">
                      {formatModifier(
                        attackBonus(attack, character.scores, character.level),
                      )}
                    </td>
                    <td className="py-0.5 font-mono">
                      {damageNotation(attack, character.scores)} {attack.damageType}
                    </td>
                    <td className="py-0.5">
                      {attack.ranged
                        ? `${attack.rangeSquares * 5} ft (${attack.rangeSquares} sq)`
                        : 'Melee, 5 ft'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(character.cantrips !== undefined || character.preparedSpells !== undefined) && (
            <div>
              <SectionTitle>
                Spells
                {character.spellSlots !== undefined &&
                  ` — ${character.spellSlots} first-level slot${character.spellSlots === 1 ? '' : 's'} per long rest`}
              </SectionTitle>
              <table className="w-full border-collapse text-[8pt]">
                <thead>
                  <tr style={{ color: RULE }} className="text-left text-[6.5pt] uppercase">
                    <th className="pb-0.5">Spell</th>
                    <th className="pb-0.5">Level</th>
                    <th className="pb-0.5">Effect</th>
                    <th className="pb-0.5">Range</th>
                  </tr>
                </thead>
                <tbody>
                  {spellsByIds([
                    ...(character.cantrips ?? []),
                    ...(character.preparedSpells ?? []),
                  ]).map((spell) => (
                    <tr key={spell.id} style={{ borderTop: `1px solid ${RULE_SOFT}` }}>
                      <td className="py-0.5 font-bold">
                        {spell.name}
                        {spell.isConcentration && (
                          <span style={{ color: RULE }} className="text-[6pt] uppercase"> · conc</span>
                        )}
                      </td>
                      <td className="py-0.5">{spell.level === 0 ? 'Cantrip' : '1st'}</td>
                      <td className="py-0.5">
                        {spell.damageOrEffect}
                        {/* The screen says this at pick time; paper says it at the table. */}
                        {spell.effect === undefined && spell.attack === undefined && (
                          <span className="italic opacity-70"> — story magic</span>
                        )}
                      </td>
                      <td className="py-0.5">{spell.range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <SectionTitle>Skills</SectionTitle>
            <div className="grid grid-cols-2 gap-x-3">
              {SKILL_NAMES.map((skill) => {
                const proficient = character.skillProficiencies.includes(skill)
                const bonus = skillBonus(
                  character.scores,
                  skill,
                  character.level,
                  character.skillProficiencies,
                )
                return (
                  <div key={skill} className="flex items-center gap-1.5 text-[7.5pt] leading-snug">
                    <span aria-hidden style={{ color: proficient ? INK : RULE_SOFT }}>
                      {proficient ? '●' : '○'}
                    </span>
                    <span className="w-7 font-mono font-bold">{formatModifier(bonus)}</span>
                    <span className={proficient ? 'font-bold' : undefined}>
                      {SKILL_LABELS[skill]}
                    </span>
                    <span style={{ color: RULE }} className="text-[6pt] uppercase">
                      {ABILITY_LABELS[SKILL_ABILITY[skill]].slice(0, 3)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <SectionTitle>Features &amp; Traits</SectionTitle>
            <div style={boxed} className="px-1.5 py-1 text-[7.5pt] leading-snug">
              <p>
                <span className="font-bold">{race.label}. </span>
                {race.trait}
              </p>
              <p className="mt-1">
                <span className="font-bold">{klass.label}. </span>
                {klass.description}
              </p>
              {/* Advanced-mode picks earned their ink: a Champion who prints
                  this sheet needs "crits on 19" at the table, not in the app. */}
              {subclass !== undefined && (
                <p className="mt-1">
                  <span className="font-bold">
                    {subclass.label} — {subclass.feature.name}.{' '}
                  </span>
                  {subclass.feature.description}
                </p>
              )}
              {feat !== undefined && (
                <p className="mt-1">
                  <span className="font-bold">{feat.label}. </span>
                  {feat.effectLabel}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <SectionTitle>Personality</SectionTitle>
              <div className="text-[7.5pt] leading-snug">
                <p>
                  <span className="font-bold">Ideal. </span>
                  <span className="italic">{character.personality.ideal}</span>
                </p>
                <p>
                  <span className="font-bold">Flaw. </span>
                  <span className="italic">{character.personality.flaw}</span>
                </p>
                <p>
                  <span className="font-bold">Bond. </span>
                  <span className="italic">{character.personality.bond}</span>
                </p>
              </div>
            </div>
            <div>
              <SectionTitle>Equipment</SectionTitle>
              <ul className="text-[7.5pt] leading-snug">
                {/* A wizard's loadout *is* their armour, so it is not listed twice. */}
                {[
                  character.loadoutName,
                  ...(character.armorName === character.loadoutName ? [] : [character.armorName]),
                  ...character.attacks.map((attack) => attack.name),
                  ...(character.potions !== undefined && character.potions > 0
                    ? [`Potion of Healing × ${character.potions}`]
                    : []),
                ].map((item, index) => (
                  <li key={`${item}-${index}`}>· {item}</li>
                ))}
              </ul>
              <div
                style={{ ...boxed, borderColor: RULE_SOFT }}
                className="mt-1.5 px-1.5 py-1 text-[7pt] leading-snug"
              >
                <span style={{ color: RULE }} className="font-bold uppercase">
                  Trinket ·{' '}
                </span>
                <span className="font-bold">{character.trinket.name}</span>
                <span className="block opacity-80">{character.trinket.description}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p style={{ color: RULE }} className="mt-2 text-center text-[6pt]">
        Hero Step · Level {character.level} · 5e SRD · every number on this sheet was worked out for
        you
      </p>
    </div>
  )
}
