import { describe, expect, it } from 'vitest'
import { clubName } from './teams'

describe('club names on the full-time screen', () => {
  it('recognises clubs and countries, fixing OCR slips in their lettering', () => {
    expect(clubName('FC Barcelona')).toBe('FC Barcelona')
    expect(clubName('IFC Barcelona')).toBe('FC Barcelona')
    expect(clubName('iC Barcelona')).toBe('FC Barcelona')
    expect(clubName('Manchester United iC')).toBe('Manchester United FC')
    expect(clubName('Manchester United i-C')).toBe('Manchester United FC')
    expect(clubName('Fenerbahce')).toBe('Fenerbahçe')
    expect(clubName('France')).toBe('France')
  })

  it('leaves players own team names alone', () => {
    expect(clubName('Unnal Mudiyath Thambi')).toBeNull()
    expect(clubName('pray!')).toBeNull()
    expect(clubName('Goatzabu FC')).toBeNull()
  })
})
