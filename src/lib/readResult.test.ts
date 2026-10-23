import { describe, expect, it } from 'vitest'
import { cleanName, parseGoals, parseStats, type StatRow } from './readResult'

/** A table row read whole and as its two number columns, with confidences. */
const row = (text: string, home: string, away: string, confidence = 95, columns = 95): StatRow => ({
  row: { text, confidence },
  home: { text: home, confidence: columns },
  away: { text: away, confidence: columns },
})

describe('reading the score and names', () => {
  it('reads one or two digit scores and nothing else', () => {
    expect(parseGoals('3\n')).toBe(3)
    expect(parseGoals(' 10 ')).toBe(10)
    expect(parseGoals('')).toBeNull()
    expect(parseGoals('123')).toBeNull()
  })

  it('trims OCR noise from in-game names but keeps their own symbols', () => {
    expect(cleanName(' pray!\n')).toBe('pray!')
    expect(cleanName('| Unnal  Mudiyath Thambi _')).toBe('Unnal Mudiyath Thambi')
    expect(cleanName('x')).toBeNull()
  })
})

describe('reading the stats table', () => {
  it('keeps rows where both readings agree, matching labels loosely', () => {
    expect(
      parseStats([
        row('53% Possession 47%', '53%', '47%'),
        row('14 Shots 6', '14', '6'),
        row('7 Shots on Targey 4', '7', '4'),
        row('149 Passes 199', '149', '199'),
        row('126 Successful Passes 160', '126', '160'),
      ]),
    ).toEqual({ possession: [53, 47], shots: [14, 6], shots_on_target: [7, 4], passes: [149, 199], successful_passes: [126, 160] })
  })

  it('drops a number when the two readings disagree', () => {
    expect(parseStats([row('149 Passes 199', '189', '199')])).toEqual({})
  })

  it('trusts a single reading only when it is very confident', () => {
    expect(parseStats([row('4 Corner Kicks 0', '', '0', 94)])).toEqual({ corners: [4, 0] })
    expect(parseStats([row('4 Corner Kicks 0', '', '0', 82)])).toEqual({})
    expect(parseStats([row('a Corner Kicks [4]', '4', '0', 76, 92)])).toEqual({ corners: [4, 0] })
    expect(parseStats([row('a Corner Kicks [4]', '4', '0', 76, 87)])).toEqual({})
  })

  it('ignores rows that are not stats', () => {
    expect(parseStats([row('AN nl', '', ''), row('N 41', '', '41')])).toEqual({})
  })

  it('drops numbers that cannot be right', () => {
    expect(parseStats([row('53% Possession 57%', '53%', '57%')])).toEqual({})
    expect(parseStats([row('4 Shots 6', '4', '6'), row('7 Shots on Target 4', '7', '4')])).toEqual({ shots: [4, 6] })
  })
})
