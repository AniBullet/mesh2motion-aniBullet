# Retarget Enhancement (P0 + P1) — 6 Tasks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance mesh2motion's retargeting workflow with multi-pattern bone auto-mapping, mapping presets, batch export, bone validation, user animation preview, and Windows desktop packaging — inspired by BsRetargetTools' production-proven workflow ideas.

**Architecture:** Six feature areas that build on the existing `src/retarget/` module. Task 1-2 (P0) improve auto-mapping accuracy and add preset persistence. Task 3-4 (P1) add batch export and bone validation. Task 5 (P1) adds user FBX/GLB animation loading and preview. Task 6 (P1) packages the app as a Windows desktop application via Tauri. Each task is self-contained and can be merged independently.

**Tech Stack:** TypeScript, Three.js, Vitest, Vite, localStorage API, JSZip (already a dependency), Tauri v2 (Task 6).

**Tech Stack:** TypeScript, Three.js, Vitest, Vite, localStorage API, JSZip (already a dependency).

---

## Task 1: Multi-Pattern Bone Name Matching (P0)

### Background

Currently `BoneAutoMapper` uses simple `includes()` keyword detection for bone category classification, and `BoneCategoryMapper` only does exact name matching. This fails for most real-world rigs (UE Mannequin, Rigify, DAZ, iClone, etc.) that use different naming conventions.

BsRetargetTools solves this with a per-bone pattern table (`pattBipedNames`) that lists multiple wildcard patterns per standard bone. We adapt this idea using regex patterns instead of MaxScript wildcards.

### Files

- Create: `src/retarget/bone-automap/BonePatternTable.ts`
- Create: `src/retarget/bone-automap/BonePatternTable.test.ts`
- Modify: `src/retarget/bone-automap/BoneAutoMapper.ts`
- Modify: `src/retarget/bone-automap/BoneCategoryMapper.ts`
- Test: `src/retarget/bone-automap/BoneCategoryMapper.test.ts` (extend existing)

### Step 1: Create BonePatternTable with per-bone regex patterns

Create `src/retarget/bone-automap/BonePatternTable.ts`:

```typescript
/**
 * Each entry maps a Mesh2Motion standard bone name to an array of regex patterns
 * that match common naming conventions for that bone across different DCC tools.
 * Patterns are tested in order; first match wins.
 * All patterns are case-insensitive.
 */
export interface BonePatternEntry {
  m2m_bone_name: string
  patterns: RegExp[]
}

export class BonePatternTable {
  static readonly HUMAN_PATTERNS: BonePatternEntry[] = [
    // Root / Hips
    { m2m_bone_name: 'pelvis', patterns: [
      /^pelvis$/i, /hips?$/i, /^root$/i,
    ]},

    // Spine chain
    { m2m_bone_name: 'spine_01', patterns: [
      /^spine[_.]?0?1?$/i, /^spine$/i, /waist/i, /spine[_.]?lower/i,
    ]},
    { m2m_bone_name: 'spine_02', patterns: [
      /^spine[_.]?0?2$/i, /^spine1$/i, /stomach/i, /spine[_.]?mid/i,
    ]},
    { m2m_bone_name: 'spine_03', patterns: [
      /^spine[_.]?0?3$/i, /^spine2$/i, /chest/i, /spine[_.]?upper/i,
    ]},

    // Neck / Head
    { m2m_bone_name: 'neck_01', patterns: [
      /^neck[_.]?0?1?$/i, /^neck$/i,
    ]},
    { m2m_bone_name: 'head', patterns: [
      /^head$/i,
    ]},

    // Left Leg
    { m2m_bone_name: 'thigh_l', patterns: [
      /^l[_. ]?thigh$/i, /thigh[_. ]?l$/i, /left[_ ]?(up[_ ]?leg|thigh)/i,
    ]},
    { m2m_bone_name: 'calf_l', patterns: [
      /^l[_. ]?(calf|shin)$/i, /(calf|shin)[_. ]?l$/i, /left[_ ]?(leg|knee|calf|shin)$/i,
    ]},
    { m2m_bone_name: 'foot_l', patterns: [
      /^l[_. ]?foot$/i, /foot[_. ]?l$/i, /left[_ ]?(foot|ankle)/i,
    ]},
    { m2m_bone_name: 'ball_l', patterns: [
      /^l[_. ]?toe/i, /toe[_. ]?l$/i, /left[_ ]?toe/i,
    ]},

    // Right Leg
    { m2m_bone_name: 'thigh_r', patterns: [
      /^r[_. ]?thigh$/i, /thigh[_. ]?r$/i, /right[_ ]?(up[_ ]?leg|thigh)/i,
    ]},
    { m2m_bone_name: 'calf_r', patterns: [
      /^r[_. ]?(calf|shin)$/i, /(calf|shin)[_. ]?r$/i, /right[_ ]?(leg|knee|calf|shin)$/i,
    ]},
    { m2m_bone_name: 'foot_r', patterns: [
      /^r[_. ]?foot$/i, /foot[_. ]?r$/i, /right[_ ]?(foot|ankle)/i,
    ]},
    { m2m_bone_name: 'ball_r', patterns: [
      /^r[_. ]?toe/i, /toe[_. ]?r$/i, /right[_ ]?toe/i,
    ]},

    // Left Arm
    { m2m_bone_name: 'clavicle_l', patterns: [
      /^l[_. ]?(clavicle|shoulder)$/i, /(clavicle|shoulder)[_. ]?l$/i, /left[_ ]?shoulder$/i,
    ]},
    { m2m_bone_name: 'upperarm_l', patterns: [
      /^l[_. ]?upper[_ ]?arm$/i, /upper[_ ]?arm[_. ]?l$/i, /left[_ ]?arm$/i,
    ]},
    { m2m_bone_name: 'lowerarm_l', patterns: [
      /^l[_. ]?(fore[_ ]?arm|lower[_ ]?arm)$/i, /fore[_ ]?arm[_. ]?l$/i, /left[_ ]?(fore[_ ]?arm|elbow)/i,
    ]},
    { m2m_bone_name: 'hand_l', patterns: [
      /^l[_. ]?hand$/i, /hand[_. ]?l$/i, /left[_ ]?(hand|wrist)/i,
    ]},

    // Right Arm
    { m2m_bone_name: 'clavicle_r', patterns: [
      /^r[_. ]?(clavicle|shoulder)$/i, /(clavicle|shoulder)[_. ]?r$/i, /right[_ ]?shoulder$/i,
    ]},
    { m2m_bone_name: 'upperarm_r', patterns: [
      /^r[_. ]?upper[_ ]?arm$/i, /upper[_ ]?arm[_. ]?r$/i, /right[_ ]?arm$/i,
    ]},
    { m2m_bone_name: 'lowerarm_r', patterns: [
      /^r[_. ]?(fore[_ ]?arm|lower[_ ]?arm)$/i, /fore[_ ]?arm[_. ]?r$/i, /right[_ ]?(fore[_ ]?arm|elbow)/i,
    ]},
    { m2m_bone_name: 'hand_r', patterns: [
      /^r[_. ]?hand$/i, /hand[_. ]?r$/i, /right[_ ]?(hand|wrist)/i,
    ]},

    // Left Fingers — Thumb
    { m2m_bone_name: 'thumb_01_l', patterns: [/^l[_. ]?thumb[_. ]?0?1$/i, /left.*thumb[_. ]?1/i]},
    { m2m_bone_name: 'thumb_02_l', patterns: [/^l[_. ]?thumb[_. ]?0?2$/i, /left.*thumb[_. ]?2/i]},
    { m2m_bone_name: 'thumb_03_l', patterns: [/^l[_. ]?thumb[_. ]?0?3$/i, /left.*thumb[_. ]?3/i]},
    // Left Fingers — Index
    { m2m_bone_name: 'index_01_l', patterns: [/^l[_. ]?(index|finger1)[_. ]?0?1$/i, /left.*index[_. ]?1/i]},
    { m2m_bone_name: 'index_02_l', patterns: [/^l[_. ]?(index|finger1)[_. ]?0?2$/i, /left.*index[_. ]?2/i]},
    { m2m_bone_name: 'index_03_l', patterns: [/^l[_. ]?(index|finger1)[_. ]?0?3$/i, /left.*index[_. ]?3/i]},
    // Left Fingers — Middle
    { m2m_bone_name: 'middle_01_l', patterns: [/^l[_. ]?(middle|finger2)[_. ]?0?1$/i, /left.*middle[_. ]?1/i]},
    { m2m_bone_name: 'middle_02_l', patterns: [/^l[_. ]?(middle|finger2)[_. ]?0?2$/i, /left.*middle[_. ]?2/i]},
    { m2m_bone_name: 'middle_03_l', patterns: [/^l[_. ]?(middle|finger2)[_. ]?0?3$/i, /left.*middle[_. ]?3/i]},
    // Left Fingers — Ring
    { m2m_bone_name: 'ring_01_l', patterns: [/^l[_. ]?(ring|finger3)[_. ]?0?1$/i, /left.*ring[_. ]?1/i]},
    { m2m_bone_name: 'ring_02_l', patterns: [/^l[_. ]?(ring|finger3)[_. ]?0?2$/i, /left.*ring[_. ]?2/i]},
    { m2m_bone_name: 'ring_03_l', patterns: [/^l[_. ]?(ring|finger3)[_. ]?0?3$/i, /left.*ring[_. ]?3/i]},
    // Left Fingers — Pinky
    { m2m_bone_name: 'pinky_01_l', patterns: [/^l[_. ]?(pinky|finger4)[_. ]?0?1$/i, /left.*pinky[_. ]?1/i]},
    { m2m_bone_name: 'pinky_02_l', patterns: [/^l[_. ]?(pinky|finger4)[_. ]?0?2$/i, /left.*pinky[_. ]?2/i]},
    { m2m_bone_name: 'pinky_03_l', patterns: [/^l[_. ]?(pinky|finger4)[_. ]?0?3$/i, /left.*pinky[_. ]?3/i]},

    // Right Fingers — Thumb
    { m2m_bone_name: 'thumb_01_r', patterns: [/^r[_. ]?thumb[_. ]?0?1$/i, /right.*thumb[_. ]?1/i]},
    { m2m_bone_name: 'thumb_02_r', patterns: [/^r[_. ]?thumb[_. ]?0?2$/i, /right.*thumb[_. ]?2/i]},
    { m2m_bone_name: 'thumb_03_r', patterns: [/^r[_. ]?thumb[_. ]?0?3$/i, /right.*thumb[_. ]?3/i]},
    // Right Fingers — Index
    { m2m_bone_name: 'index_01_r', patterns: [/^r[_. ]?(index|finger1)[_. ]?0?1$/i, /right.*index[_. ]?1/i]},
    { m2m_bone_name: 'index_02_r', patterns: [/^r[_. ]?(index|finger1)[_. ]?0?2$/i, /right.*index[_. ]?2/i]},
    { m2m_bone_name: 'index_03_r', patterns: [/^r[_. ]?(index|finger1)[_. ]?0?3$/i, /right.*index[_. ]?3/i]},
    // Right Fingers — Middle
    { m2m_bone_name: 'middle_01_r', patterns: [/^r[_. ]?(middle|finger2)[_. ]?0?1$/i, /right.*middle[_. ]?1/i]},
    { m2m_bone_name: 'middle_02_r', patterns: [/^r[_. ]?(middle|finger2)[_. ]?0?2$/i, /right.*middle[_. ]?2/i]},
    { m2m_bone_name: 'middle_03_r', patterns: [/^r[_. ]?(middle|finger2)[_. ]?0?3$/i, /right.*middle[_. ]?3/i]},
    // Right Fingers — Ring
    { m2m_bone_name: 'ring_01_r', patterns: [/^r[_. ]?(ring|finger3)[_. ]?0?1$/i, /right.*ring[_. ]?1/i]},
    { m2m_bone_name: 'ring_02_r', patterns: [/^r[_. ]?(ring|finger3)[_. ]?0?2$/i, /right.*ring[_. ]?2/i]},
    { m2m_bone_name: 'ring_03_r', patterns: [/^r[_. ]?(ring|finger3)[_. ]?0?3$/i, /right.*ring[_. ]?3/i]},
    // Right Fingers — Pinky
    { m2m_bone_name: 'pinky_01_r', patterns: [/^r[_. ]?(pinky|finger4)[_. ]?0?1$/i, /right.*pinky[_. ]?1/i]},
    { m2m_bone_name: 'pinky_02_r', patterns: [/^r[_. ]?(pinky|finger4)[_. ]?0?2$/i, /right.*pinky[_. ]?2/i]},
    { m2m_bone_name: 'pinky_03_r', patterns: [/^r[_. ]?(pinky|finger4)[_. ]?0?3$/i, /right.*pinky[_. ]?3/i]},
  ]

  /**
   * Strip common prefixes from a bone name before pattern matching.
   * e.g. "mixamorigHips" → "Hips", "DEF-spine" → "spine"
   */
  static strip_common_prefixes (bone_name: string): string {
    return bone_name
      .replace(/^mixamorig:?/i, '')
      .replace(/^DEF[-_]/i, '')
      .replace(/^ORG[-_]/i, '')
      .replace(/^MCH[-_]/i, '')
      .replace(/^CC_Base_/i, '')
  }

  /**
   * Try to match a target bone name against the pattern table.
   * Returns the M2M bone name if matched, or null.
   */
  static match_bone (target_bone_name: string): string | null {
    const stripped = this.strip_common_prefixes(target_bone_name)
    for (const entry of this.HUMAN_PATTERNS) {
      for (const pattern of entry.patterns) {
        if (pattern.test(stripped) || pattern.test(target_bone_name)) {
          return entry.m2m_bone_name
        }
      }
    }
    return null
  }
}
```

### Step 2: Write tests for BonePatternTable

Create `src/retarget/bone-automap/BonePatternTable.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { BonePatternTable } from './BonePatternTable'

describe('BonePatternTable', () => {
  describe('strip_common_prefixes', () => {
    it('should strip mixamorig prefix', () => {
      expect(BonePatternTable.strip_common_prefixes('mixamorigHips')).toBe('Hips')
    })
    it('should strip DEF- prefix', () => {
      expect(BonePatternTable.strip_common_prefixes('DEF-spine')).toBe('spine')
    })
    it('should strip CC_Base_ prefix', () => {
      expect(BonePatternTable.strip_common_prefixes('CC_Base_Hip')).toBe('Hip')
    })
    it('should leave normal names unchanged', () => {
      expect(BonePatternTable.strip_common_prefixes('Hips')).toBe('Hips')
    })
  })

  describe('match_bone', () => {
    // Hips / Pelvis
    it('should match "Hips" to pelvis', () => {
      expect(BonePatternTable.match_bone('Hips')).toBe('pelvis')
    })
    it('should match "mixamorigHips" to pelvis', () => {
      expect(BonePatternTable.match_bone('mixamorigHips')).toBe('pelvis')
    })
    it('should match "pelvis" to pelvis', () => {
      expect(BonePatternTable.match_bone('pelvis')).toBe('pelvis')
    })

    // Spine
    it('should match "Spine" to spine_01', () => {
      expect(BonePatternTable.match_bone('Spine')).toBe('spine_01')
    })
    it('should match "Spine1" to spine_02', () => {
      expect(BonePatternTable.match_bone('Spine1')).toBe('spine_02')
    })
    it('should match "Spine2" to spine_03', () => {
      expect(BonePatternTable.match_bone('Spine2')).toBe('spine_03')
    })

    // Left Leg
    it('should match "LeftUpLeg" to thigh_l', () => {
      expect(BonePatternTable.match_bone('LeftUpLeg')).toBe('thigh_l')
    })
    it('should match "L_Thigh" to thigh_l', () => {
      expect(BonePatternTable.match_bone('L_Thigh')).toBe('thigh_l')
    })

    // Right Arm
    it('should match "RightForeArm" to lowerarm_r', () => {
      expect(BonePatternTable.match_bone('RightForeArm')).toBe('lowerarm_r')
    })
    it('should match "R_Hand" to hand_r', () => {
      expect(BonePatternTable.match_bone('R_Hand')).toBe('hand_r')
    })

    // Fingers
    it('should match "LeftHandThumb1" to thumb_01_l', () => {
      expect(BonePatternTable.match_bone('LeftHandThumb1')).toBe('thumb_01_l')
    })

    // Unknown
    it('should return null for unknown bone names', () => {
      expect(BonePatternTable.match_bone('weapon_joint')).toBeNull()
    })
  })
})
```

### Step 3: Run tests

Run: `npx vitest run src/retarget/bone-automap/BonePatternTable.test.ts`
Expected: All pass.

### Step 4: Integrate pattern matching into BoneAutoMapper

Modify `src/retarget/bone-automap/BoneAutoMapper.ts`:

- In `auto_map_bones()`, after the existing Mixamo check, add a new fallback path that uses `BonePatternTable.match_bone()` for each target bone to attempt pattern-based mapping before falling back to the existing category-based approach.
- The pattern match produces `Map<string, string>` (target_bone → m2m_source_bone). If a match is found, use it; otherwise fall through to category matching.

Key change in `auto_map_bones()` — add between the Mixamo mapper and the category-based mapper:

```typescript
import { BonePatternTable } from './BonePatternTable'

// After MixamoMapper check, before category-based matching:
// Attempt pattern-based matching for all target bones
const pattern_mappings = new Map<string, string>()
for (const target_meta of target_bones_meta) {
  const matched_m2m_name = BonePatternTable.match_bone(target_meta.name)
  if (matched_m2m_name !== null) {
    // Verify this M2M bone exists in source
    const source_has_bone = source_bones_meta.some(s => s.name === matched_m2m_name)
    if (source_has_bone) {
      pattern_mappings.set(target_meta.name, matched_m2m_name)
    }
  }
}

if (pattern_mappings.size > 0) {
  console.log(`Pattern-matched ${pattern_mappings.size} bones`)
  return pattern_mappings
}

// ... existing category-based fallback
```

### Step 5: Run all existing tests to verify no regressions

Run: `npx vitest run`
Expected: All existing tests pass.

### Step 6: Commit

```bash
git add src/retarget/bone-automap/BonePatternTable.ts src/retarget/bone-automap/BonePatternTable.test.ts src/retarget/bone-automap/BoneAutoMapper.ts
git commit -m "feat(retarget): add multi-pattern bone name matching table"
```

---

## Task 2: Mapping Preset Save/Load (P0)

### Background

Users who retarget the same character type repeatedly must manually re-map every time. BsRetargetTools solves this with `.list` file presets. We implement this using JSON and `localStorage` + file download/upload for portability.

### Files

- Create: `src/retarget/MappingPresetService.ts`
- Create: `src/retarget/MappingPresetService.test.ts`
- Modify: `src/retarget/steps/StepBoneMapping.ts` (add save/load UI wiring)
- Modify: `src/retarget/index.html` (add save/load/preset buttons)

### Step 1: Create MappingPresetService

Create `src/retarget/MappingPresetService.ts`:

```typescript
export interface MappingPreset {
  name: string
  created_at: string
  skeleton_type: string
  mappings: Record<string, string>  // target_bone → source_bone
}

const STORAGE_KEY = 'm2m_mapping_presets'

export class MappingPresetService {
  /**
   * Get all saved presets from localStorage
   */
  static get_all_presets (): MappingPreset[] {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    try {
      return JSON.parse(raw) as MappingPreset[]
    } catch {
      return []
    }
  }

  /**
   * Save a mapping preset to localStorage
   */
  static save_preset (name: string, skeleton_type: string, mappings: Map<string, string>): void {
    const presets = this.get_all_presets()

    const existing_index = presets.findIndex(p => p.name === name)
    const preset: MappingPreset = {
      name,
      created_at: new Date().toISOString(),
      skeleton_type,
      mappings: Object.fromEntries(mappings)
    }

    if (existing_index >= 0) {
      presets[existing_index] = preset
    } else {
      presets.push(preset)
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  }

  /**
   * Delete a preset by name
   */
  static delete_preset (name: string): void {
    const presets = this.get_all_presets().filter(p => p.name !== name)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  }

  /**
   * Load a preset's mappings as a Map
   */
  static load_preset (name: string): Map<string, string> | null {
    const preset = this.get_all_presets().find(p => p.name === name)
    if (preset === undefined) return null
    return new Map(Object.entries(preset.mappings))
  }

  /**
   * Export a preset as a JSON file (for sharing/portability)
   */
  static export_preset_as_json (name: string): void {
    const preset = this.get_all_presets().find(p => p.name === name)
    if (preset === undefined) return

    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${name}.m2m-preset.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Import a preset from a JSON file
   * Returns the imported preset or null on failure
   */
  static import_preset_from_json (json_string: string): MappingPreset | null {
    try {
      const preset = JSON.parse(json_string) as MappingPreset
      if (preset.name === undefined || preset.mappings === undefined) return null

      const presets = this.get_all_presets()
      const existing_index = presets.findIndex(p => p.name === preset.name)
      if (existing_index >= 0) {
        presets[existing_index] = preset
      } else {
        presets.push(preset)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
      return preset
    } catch {
      return null
    }
  }
}
```

### Step 2: Write tests for MappingPresetService

Create `src/retarget/MappingPresetService.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { MappingPresetService } from './MappingPresetService'

describe('MappingPresetService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should return empty array when no presets saved', () => {
    expect(MappingPresetService.get_all_presets()).toEqual([])
  })

  it('should save and load a preset', () => {
    const mappings = new Map([['mixamorigHips', 'pelvis'], ['mixamorigSpine', 'spine_01']])
    MappingPresetService.save_preset('test-preset', 'human', mappings)

    const loaded = MappingPresetService.load_preset('test-preset')
    expect(loaded).not.toBeNull()
    expect(loaded!.get('mixamorigHips')).toBe('pelvis')
    expect(loaded!.size).toBe(2)
  })

  it('should overwrite preset with same name', () => {
    const mappings1 = new Map([['a', 'b']])
    const mappings2 = new Map([['c', 'd'], ['e', 'f']])
    MappingPresetService.save_preset('dupe', 'human', mappings1)
    MappingPresetService.save_preset('dupe', 'human', mappings2)

    const all = MappingPresetService.get_all_presets()
    expect(all.length).toBe(1)
    expect(all[0].mappings).toEqual({ c: 'd', e: 'f' })
  })

  it('should delete a preset', () => {
    MappingPresetService.save_preset('to-delete', 'human', new Map([['a', 'b']]))
    MappingPresetService.delete_preset('to-delete')
    expect(MappingPresetService.get_all_presets().length).toBe(0)
  })

  it('should import preset from JSON string', () => {
    const json = JSON.stringify({
      name: 'imported', created_at: '2026-01-01', skeleton_type: 'human',
      mappings: { x: 'y' }
    })
    const result = MappingPresetService.import_preset_from_json(json)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('imported')
    expect(MappingPresetService.load_preset('imported')!.get('x')).toBe('y')
  })

  it('should return null for invalid JSON import', () => {
    expect(MappingPresetService.import_preset_from_json('not json')).toBeNull()
  })
})
```

### Step 3: Run tests

Run: `npx vitest run src/retarget/MappingPresetService.test.ts`
Expected: All pass.

### Step 4: Add preset UI to retarget HTML

Modify `src/retarget/index.html` — add preset controls next to the existing "Auto-Map Bones" and "Clear Mappings" buttons inside the target bone map section (around line 116):

```html
<button id="save-preset-button" class="secondary-button" style="display: none;" title="Save current mapping as a preset">Save Preset</button>
<select id="preset-select" class="button" style="display: none;">
  <option value="">Load Preset...</option>
</select>
<button id="export-preset-button" class="secondary-button" style="display: none;" title="Export preset as JSON file">Export</button>
<input type="file" id="import-preset-file" accept=".json" style="display: none;" />
<label for="import-preset-file" class="secondary-button" id="import-preset-label" style="display: none;">Import</label>
```

### Step 5: Wire up preset UI in StepBoneMapping

Modify `src/retarget/steps/StepBoneMapping.ts`:

- Add DOM references for the new preset buttons/select
- In `add_event_listeners()`, wire up:
  - **Save Preset**: prompt for name via `window.prompt()`, call `MappingPresetService.save_preset()`
  - **Load Preset** (select change): call `MappingPresetService.load_preset()`, set mappings on `AnimationRetargetService`, refresh UI
  - **Export**: call `MappingPresetService.export_preset_as_json()` for the currently selected preset
  - **Import**: read file, call `MappingPresetService.import_preset_from_json()`, refresh preset list
- Add `refresh_preset_list()` method that populates the `<select>` dropdown
- Show/hide preset controls alongside the auto-map button (when both skeletons are loaded)

### Step 6: Run all tests

Run: `npx vitest run`
Expected: All pass.

### Step 7: Commit

```bash
git add src/retarget/MappingPresetService.ts src/retarget/MappingPresetService.test.ts src/retarget/steps/StepBoneMapping.ts src/retarget/index.html
git commit -m "feat(retarget): add mapping preset save/load/import/export"
```

---

## Task 3: Batch Animation Export (P1)

### Background

Currently the export step retargets and exports each selected animation into a single GLB file. For production use, users need to batch-export many animations individually (one GLB per animation) or as a ZIP archive. JSZip is already a project dependency.

### Files

- Modify: `src/retarget/steps/StepExportRetargetedAnimations.ts` (add batch modes)
- Modify: `src/retarget/RetargetAnimationListing.ts` (add "select all" and batch export trigger)
- Modify: `src/retarget/index.html` (add batch export UI controls)

### Step 1: Add batch export methods to StepExportRetargetedAnimations

Modify `src/retarget/steps/StepExportRetargetedAnimations.ts`:

Add a new method `export_batch_as_zip()` that:
1. Takes an array of `AnimationClip`s and an array of selected indices
2. Retargets each clip individually
3. Exports each retargeted clip as a separate GLB using the existing `GLTFExporter`
4. Packages all GLBs into a ZIP using `JSZip`
5. Triggers browser download of the ZIP

```typescript
import JSZip from 'jszip'

public async export_batch_as_zip (
  all_clips: AnimationClip[],
  selected_indices: number[],
  filename_prefix = 'retargeted'
): Promise<void> {
  const zip = new JSZip()
  const target_scene: Scene = AnimationRetargetService.getInstance().get_target_armature()
  const gltf_exporter = new GLTFExporter()

  for (const index of selected_indices) {
    const clip = all_clips[index].clone()
    const retargeted_clip = AnimationRetargetService.getInstance().retarget_animation_clip(clip)
    const clip_name = retargeted_clip.name.replace(/[^a-zA-Z0-9_-]/g, '_')

    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      gltf_exporter.parse(
        target_scene,
        (result: ArrayBuffer) => { resolve(result) },
        (error: any) => { reject(error) },
        { binary: true, onlyVisible: false, embedImages: true, animations: [retargeted_clip] }
      )
    })

    zip.file(`${clip_name}.glb`, buffer)
  }

  const zip_blob = await zip.generateAsync({ type: 'blob' })
  this.save_file(zip_blob, `${filename_prefix}.zip`)
}
```

### Step 2: Add "Select All" checkbox and batch export button to HTML

Modify `src/retarget/index.html` — add near the existing export button (around line 182):

```html
<button id="export-batch-zip-button" title="Export each selected animation as a separate GLB file inside a ZIP archive." disabled>
  <span class="button-icon-group">
    <span class="material-symbols-outlined">folder_zip</span>
    <span>Download ZIP <span id="batch-selection-count">0</span></span>
  </span>
</button>
```

### Step 3: Wire up batch export in RetargetAnimationListing

Modify `src/retarget/RetargetAnimationListing.ts` — in `add_event_listeners()`:

```typescript
const batch_zip_button = document.getElementById('export-batch-zip-button') as HTMLButtonElement
batch_zip_button?.addEventListener('click', () => {
  this.step_export_retargeted_animations.export_batch_as_zip(
    this.animation_clips_loaded.map(c => c.display_animation_clip),
    this.get_selected_animation_indices(),
    'retargeted_animations'
  ).catch(error => console.error('Batch export failed:', error))
})
```

Update `update_export_button_enabled_state()` to also toggle `export-batch-zip-button` and update `batch-selection-count`.

### Step 4: Run all tests

Run: `npx vitest run`
Expected: All pass.

### Step 5: Commit

```bash
git add src/retarget/steps/StepExportRetargetedAnimations.ts src/retarget/RetargetAnimationListing.ts src/retarget/index.html
git commit -m "feat(retarget): add batch animation export as ZIP"
```

---

## Task 4: Required/Optional Bone Validation (P1)

### Background

BsRetargetTools marks bones as `[可选]` (optional) to distinguish required vs nice-to-have mappings. Currently mesh2motion enables the Continue button when any single bone is mapped — no feedback on which bones are critical.

### Files

- Create: `src/retarget/bone-automap/BoneRequirements.ts`
- Create: `src/retarget/bone-automap/BoneRequirements.test.ts`
- Modify: `src/retarget/steps/StepBoneMapping.ts` (add validation display)
- Modify: `src/retarget/index.html` (add validation message area)
- Modify: `src/retarget/retarget.css` (styling for required/optional/warning states)

### Step 1: Create BoneRequirements definition

Create `src/retarget/bone-automap/BoneRequirements.ts`:

```typescript
export enum BoneImportance {
  Required = 'required',
  Optional = 'optional'
}

export interface BoneRequirement {
  m2m_bone_name: string
  importance: BoneImportance
  display_name: string
}

export class BoneRequirements {
  static readonly HUMAN_REQUIREMENTS: BoneRequirement[] = [
    // Required — core skeleton
    { m2m_bone_name: 'pelvis', importance: BoneImportance.Required, display_name: 'Pelvis / Hips' },
    { m2m_bone_name: 'spine_01', importance: BoneImportance.Required, display_name: 'Spine 1' },
    { m2m_bone_name: 'spine_02', importance: BoneImportance.Required, display_name: 'Spine 2' },
    { m2m_bone_name: 'spine_03', importance: BoneImportance.Required, display_name: 'Spine 3' },
    { m2m_bone_name: 'neck_01', importance: BoneImportance.Required, display_name: 'Neck' },
    { m2m_bone_name: 'head', importance: BoneImportance.Required, display_name: 'Head' },
    { m2m_bone_name: 'upperarm_l', importance: BoneImportance.Required, display_name: 'Left Upper Arm' },
    { m2m_bone_name: 'lowerarm_l', importance: BoneImportance.Required, display_name: 'Left Forearm' },
    { m2m_bone_name: 'hand_l', importance: BoneImportance.Required, display_name: 'Left Hand' },
    { m2m_bone_name: 'upperarm_r', importance: BoneImportance.Required, display_name: 'Right Upper Arm' },
    { m2m_bone_name: 'lowerarm_r', importance: BoneImportance.Required, display_name: 'Right Forearm' },
    { m2m_bone_name: 'hand_r', importance: BoneImportance.Required, display_name: 'Right Hand' },
    { m2m_bone_name: 'thigh_l', importance: BoneImportance.Required, display_name: 'Left Thigh' },
    { m2m_bone_name: 'calf_l', importance: BoneImportance.Required, display_name: 'Left Calf' },
    { m2m_bone_name: 'foot_l', importance: BoneImportance.Required, display_name: 'Left Foot' },
    { m2m_bone_name: 'thigh_r', importance: BoneImportance.Required, display_name: 'Right Thigh' },
    { m2m_bone_name: 'calf_r', importance: BoneImportance.Required, display_name: 'Right Calf' },
    { m2m_bone_name: 'foot_r', importance: BoneImportance.Required, display_name: 'Right Foot' },

    // Optional — clavicles
    { m2m_bone_name: 'clavicle_l', importance: BoneImportance.Optional, display_name: 'Left Clavicle' },
    { m2m_bone_name: 'clavicle_r', importance: BoneImportance.Optional, display_name: 'Right Clavicle' },

    // Optional — toes
    { m2m_bone_name: 'ball_l', importance: BoneImportance.Optional, display_name: 'Left Toe' },
    { m2m_bone_name: 'ball_r', importance: BoneImportance.Optional, display_name: 'Right Toe' },

    // Optional — all fingers (importance = Optional)
    // ... thumb, index, middle, ring, pinky for both hands
  ]

  /**
   * Validate current mappings against requirements.
   * Returns list of missing required bones and missing optional bones.
   */
  static validate (mappings: Map<string, string>, skeleton_type: string): {
    missing_required: BoneRequirement[]
    missing_optional: BoneRequirement[]
    mapped_count: number
    total_required: number
  } {
    const requirements = skeleton_type === 'human' ? this.HUMAN_REQUIREMENTS : []
    const mapped_source_bones = new Set(mappings.values())
    const required = requirements.filter(r => r.importance === BoneImportance.Required)
    const optional = requirements.filter(r => r.importance === BoneImportance.Optional)

    return {
      missing_required: required.filter(r => !mapped_source_bones.has(r.m2m_bone_name)),
      missing_optional: optional.filter(r => !mapped_source_bones.has(r.m2m_bone_name)),
      mapped_count: mappings.size,
      total_required: required.length
    }
  }
}
```

### Step 2: Write tests

Create `src/retarget/bone-automap/BoneRequirements.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { BoneRequirements } from './BoneRequirements'

describe('BoneRequirements', () => {
  it('should report all required bones missing when map is empty', () => {
    const result = BoneRequirements.validate(new Map(), 'human')
    expect(result.missing_required.length).toBe(result.total_required)
    expect(result.mapped_count).toBe(0)
  })

  it('should report no missing required when all required bones mapped', () => {
    const mappings = new Map<string, string>()
    const required = BoneRequirements.HUMAN_REQUIREMENTS
      .filter(r => r.importance === 'required')
    for (const req of required) {
      mappings.set(`target_${req.m2m_bone_name}`, req.m2m_bone_name)
    }
    const result = BoneRequirements.validate(mappings, 'human')
    expect(result.missing_required.length).toBe(0)
  })

  it('should return empty results for unknown skeleton type', () => {
    const result = BoneRequirements.validate(new Map(), 'dragon')
    expect(result.missing_required.length).toBe(0)
    expect(result.total_required).toBe(0)
  })
})
```

### Step 3: Run tests

Run: `npx vitest run src/retarget/bone-automap/BoneRequirements.test.ts`
Expected: All pass.

### Step 4: Add validation display to HTML

Modify `src/retarget/index.html` — add a validation message area before the Continue button (around line 133):

```html
<div id="mapping-validation" style="display: none; padding: 0.5rem; margin-top: 0.5rem; max-width: 30rem;">
  <div id="validation-required-status"></div>
  <div id="validation-optional-status" style="color: var(--text-secondary); font-size: 0.85rem;"></div>
</div>
```

### Step 5: Wire validation into StepBoneMapping

Modify `src/retarget/steps/StepBoneMapping.ts`:

- Import `BoneRequirements`
- Add `update_validation_display()` method that calls `BoneRequirements.validate()` and updates the DOM
- Call `update_validation_display()` from:
  - `handle_drop()` (after mapping set)
  - `auto_map_bones()` (after auto-mapping)
  - `clear_all_bone_mappings()`
  - `clear_bone_mapping()`

The validation display shows:
- Green check + "All N required bones mapped" when complete
- Yellow warning + "Missing N required bones: [list]" when incomplete
- Grey note + "N optional bones unmapped (fingers, toes)" as info

### Step 6: Add CSS styling

Modify `src/retarget/retarget.css` — add styles for validation states:

```css
#mapping-validation .validation-ok { color: #4caf50; }
#mapping-validation .validation-warn { color: #ff9800; }
.bone-item-source[data-required="true"] { border-left: 3px solid #4caf50; }
.bone-item-source[data-required="false"] { border-left: 3px solid var(--text-secondary); opacity: 0.7; }
```

### Step 7: Run all tests

Run: `npx vitest run`
Expected: All pass.

### Step 8: Commit

```bash
git add src/retarget/bone-automap/BoneRequirements.ts src/retarget/bone-automap/BoneRequirements.test.ts src/retarget/steps/StepBoneMapping.ts src/retarget/index.html src/retarget/retarget.css
git commit -m "feat(retarget): add required/optional bone validation with UI feedback"
```

---

## Task 5: User Animation Preview — FBX/GLB Resource Browser (P1)

### Background

Currently the retarget workflow only loads built-in M2M animation GLBs (`human-base-animations.glb`, etc.) via `AnimationLoader`. Users cannot preview their own FBX/GLB animation files on the target rig. This is a common need for animators who want to check if a batch of motions will retarget well before committing to full export.

BsRetargetTools addresses this with Tab 2's file list — browse a folder, select files, preview/retarget selected. We adapt this as a "User Animations" panel: upload one or more FBX/GLB files, see them listed, click to preview on the target rig with real-time retargeting.

### Files

- Create: `src/retarget/UserAnimationLoader.ts`
- Create: `src/retarget/UserAnimationLoader.test.ts`
- Modify: `src/retarget/RetargetAnimationListing.ts` (integrate user animations alongside built-in)
- Modify: `src/retarget/index.html` (add upload UI in the animation listing area)
- Modify: `src/retarget/retarget.css` (styling for user animation items)

### Step 1: Create UserAnimationLoader

Create `src/retarget/UserAnimationLoader.ts`:

This class handles loading animation clips from user-provided FBX/GLB files. Unlike `AnimationLoader` which reads from static paths, this reads from `File` objects via `URL.createObjectURL`.

```typescript
import { AnimationClip, type Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { AnimationUtility } from '../lib/processes/animations-listing/AnimationUtility'

export interface UserAnimationFile {
  file_name: string
  clips: AnimationClip[]
}

export class UserAnimationLoader {
  private readonly gltf_loader: GLTFLoader = new GLTFLoader()
  private readonly fbx_loader: FBXLoader = new FBXLoader()

  /**
   * Load animation clips from a user-provided File.
   * Supports .glb and .fbx formats.
   * Returns the file name and extracted AnimationClips.
   */
  async load_from_file (file: File): Promise<UserAnimationFile> {
    const url = URL.createObjectURL(file)
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

    try {
      let raw_clips: AnimationClip[] = []

      if (extension === 'glb' || extension === 'gltf') {
        raw_clips = await this.load_glb(url)
      } else if (extension === 'fbx') {
        raw_clips = await this.load_fbx(url)
      } else {
        throw new Error(`Unsupported animation file format: .${extension}`)
      }

      // Clean track data consistent with how M2M processes animations
      const cloned = AnimationUtility.deep_clone_animation_clips(raw_clips)
      AnimationUtility.clean_track_data(cloned)

      return {
        file_name: file.name,
        clips: cloned
      }
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  /**
   * Load multiple files at once.
   * Returns all successfully loaded files; logs errors for failures.
   */
  async load_multiple_files (files: FileList): Promise<UserAnimationFile[]> {
    const results: UserAnimationFile[] = []
    for (const file of Array.from(files)) {
      try {
        const loaded = await this.load_from_file(file)
        results.push(loaded)
      } catch (error) {
        console.error(`Failed to load animation from ${file.name}:`, error)
      }
    }
    return results
  }

  private async load_glb (url: string): Promise<AnimationClip[]> {
    return await new Promise((resolve, reject) => {
      this.gltf_loader.load(
        url,
        (gltf) => { resolve(gltf.animations ?? []) },
        undefined,
        (error) => { reject(error) }
      )
    })
  }

  private async load_fbx (url: string): Promise<AnimationClip[]> {
    return await new Promise((resolve, reject) => {
      this.fbx_loader.load(
        url,
        (fbx: Group) => { resolve(fbx.animations ?? []) },
        undefined,
        (error) => { reject(error) }
      )
    })
  }
}
```

### Step 2: Write tests for UserAnimationLoader

Create `src/retarget/UserAnimationLoader.test.ts`:

Since the loaders rely on browser APIs (FileReader, XHR), write unit tests for the non-IO parts and note the integration test requirements.

```typescript
import { describe, it, expect } from 'vitest'
import { UserAnimationLoader } from './UserAnimationLoader'

describe('UserAnimationLoader', () => {
  it('should be constructable', () => {
    const loader = new UserAnimationLoader()
    expect(loader).toBeDefined()
  })

  it('should reject unsupported file extensions', async () => {
    const loader = new UserAnimationLoader()
    const fake_file = new File([''], 'test.txt', { type: 'text/plain' })
    await expect(loader.load_from_file(fake_file)).rejects.toThrow('Unsupported animation file format')
  })
})
```

### Step 3: Run tests

Run: `npx vitest run src/retarget/UserAnimationLoader.test.ts`
Expected: All pass.

### Step 4: Add user animation upload UI to HTML

Modify `src/retarget/index.html` — inside the `#skinned-step-animation-export-options` section (around line 148), add a user animation upload area above or beside the built-in animation list:

```html
<div id="user-animations-panel" style="margin-bottom: 0.5rem;">
  <div style="display: flex; align-items: center; gap: 0.5rem;">
    <input type="file" id="upload-user-animations" accept=".glb,.fbx" multiple style="display: none;" />
    <label for="upload-user-animations" class="secondary-button" id="upload-user-anim-label">
      <span class="button-icon-group">
        <span class="material-symbols-outlined">upload_file</span>
        <span>Load Your Animations</span>
      </span>
    </label>
    <button id="clear-user-animations" class="secondary-button" style="display: none;">Clear</button>
    <span id="user-animation-count" style="color: var(--text-secondary); font-size: 0.85rem;"></span>
  </div>
  <div id="user-animations-items"></div>
</div>
```

### Step 5: Integrate UserAnimationLoader into RetargetAnimationListing

Modify `src/retarget/RetargetAnimationListing.ts`:

- Add `UserAnimationLoader` import and instance
- Add a `user_animation_clips: TransformedAnimationClipPair[]` array to track uploaded clips separately
- In `add_event_listeners()`:
  - Wire up `#upload-user-animations` file input change event → call `UserAnimationLoader.load_multiple_files()` → for each loaded `UserAnimationFile`, create `TransformedAnimationClipPair` entries → merge into the main animation list and re-render UI
  - Wire up `#clear-user-animations` → clear user clips, re-render
- The user animation items appear in the same `#animations-items` container, but are visually distinguished (e.g. a small "User" badge or different background color)
- Clicking a user animation plays it with retargeting, same as built-in animations
- User animations are also selectable for batch export (Task 3) and single export

Key integration in `add_event_listeners()`:

```typescript
const user_anim_input = document.getElementById('upload-user-animations') as HTMLInputElement
user_anim_input?.addEventListener('change', async (event) => {
  const files = (event.target as HTMLInputElement).files
  if (files === null || files.length === 0) return

  const loaded_files = await this.user_animation_loader.load_multiple_files(files)
  for (const user_file of loaded_files) {
    for (const clip of user_file.clips) {
      // Prefix clip name with filename for clarity
      const display_name = user_file.clips.length > 1
        ? `${user_file.file_name} / ${clip.name}`
        : user_file.file_name.replace(/\.(glb|fbx)$/i, '')
      clip.name = display_name

      this.animation_clips_loaded.push({
        original_animation_clip: clip,
        display_animation_clip: clip.clone()
      })
    }
  }

  // Re-render the full animation list
  this.on_all_animations_loaded()

  // Update count display
  const count_el = document.getElementById('user-animation-count')
  if (count_el !== null) {
    count_el.textContent = `${loaded_files.reduce((sum, f) => sum + f.clips.length, 0)} clips loaded`
  }
  const clear_btn = document.getElementById('clear-user-animations')
  if (clear_btn !== null) clear_btn.style.display = 'inline'
})
```

### Step 6: Add CSS styling for user animation items

Modify `src/retarget/retarget.css`:

```css
#user-animations-panel {
  border-bottom: 1px solid var(--border-color, #333);
  padding-bottom: 0.5rem;
}
```

### Step 7: Run all tests

Run: `npx vitest run`
Expected: All pass.

### Step 8: Commit

```bash
git add src/retarget/UserAnimationLoader.ts src/retarget/UserAnimationLoader.test.ts src/retarget/RetargetAnimationListing.ts src/retarget/index.html src/retarget/retarget.css
git commit -m "feat(retarget): add user FBX/GLB animation upload and preview"
```

---

## Task 6: Windows Desktop App Packaging via Tauri (P1)

### Background

The app currently runs as a web app deployed to Cloudflare. For offline use and native file system access (beneficial for animation workflows), packaging as a Windows desktop app is valuable. Tauri v2 is the recommended choice — it's lightweight (~5MB installer vs Electron's ~100MB+), uses the system WebView, and integrates well with Vite.

This task sets up Tauri scaffolding so the existing Vite-built web app can be run as a native Windows application. No app logic changes are needed — Tauri wraps the existing `dist/` build output.

### Files

- Create: `src-tauri/tauri.conf.json` (Tauri config)
- Create: `src-tauri/src/main.rs` (minimal Rust entry point)
- Create: `src-tauri/Cargo.toml` (Rust dependencies)
- Create: `src-tauri/icons/` (app icons — can use placeholder initially)
- Create: `src-tauri/build.rs` (Tauri build script)
- Create: `src-tauri/capabilities/default.json` (Tauri v2 permissions)
- Modify: `package.json` (add Tauri scripts)

### Step 1: Install Tauri CLI

Run:
```bash
npm install --save-dev @tauri-apps/cli@latest
```

### Step 2: Initialize Tauri project

Run:
```bash
npx tauri init
```

When prompted:
- App name: `Mesh2Motion`
- Window title: `Mesh2Motion - Animation Retargeting`
- Frontend dev URL: `http://localhost:5173` (Vite dev server)
- Frontend dist dir: `../dist`
- Frontend dev command: `npm run dev`
- Frontend build command: `npm run build`

This creates the `src-tauri/` directory structure.

### Step 3: Configure Tauri for the Vite multi-page setup

Modify `src-tauri/tauri.conf.json` — ensure the build section points to the correct Vite output:

```json
{
  "$schema": "https://raw.githubusercontent.com/nicoverbruggen/tauri-docs-v2/main/src/content/docs/references/config.json",
  "productName": "Mesh2Motion",
  "version": "0.1.0",
  "identifier": "org.mesh2motion.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "Mesh2Motion - Animation Retargeting",
        "width": 1280,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.ico"
    ]
  }
}
```

### Step 4: Add npm scripts for Tauri

Modify `package.json` — add to `"scripts"`:

```json
"tauri": "tauri",
"tauri:dev": "tauri dev",
"tauri:build": "tauri build"
```

### Step 5: Generate placeholder icons

Run:
```bash
npx tauri icon static/images/mesh2motion.svg
```

This generates all required icon sizes into `src-tauri/icons/`. If the SVG doesn't convert well, create a simple 1024x1024 PNG logo and use that instead.

### Step 6: Verify dev mode works

Run:
```bash
npm run tauri:dev
```

Expected: A native window opens showing the Mesh2Motion web app, with the 3D viewport and all functionality working as in the browser.

### Step 7: Build Windows installer

Run:
```bash
npm run tauri:build
```

Expected: Produces `src-tauri/target/release/bundle/nsis/Mesh2Motion_0.1.0_x64-setup.exe` (NSIS installer) and/or `msi/Mesh2Motion_0.1.0_x64.msi`.

### Step 8: Commit

```bash
git add src-tauri/ package.json package-lock.json
git commit -m "feat: add Tauri v2 scaffolding for Windows desktop app"
```

### Notes

- **Prerequisites**: Building Tauri requires:
  - Rust toolchain (`rustup` — install from https://rustup.rs)
  - Microsoft Visual Studio C++ Build Tools (for Windows)
  - WebView2 (included in Windows 10/11 by default)
- **No code changes needed**: The web app runs identically inside Tauri's WebView. All Three.js rendering, file uploads, and exports work the same way.
- **Future enhancement**: Once packaged as a desktop app, native file system dialogs (`@tauri-apps/plugin-dialog`) can replace the HTML `<input type="file">` for a more native feel. Folder-based animation browsing (like BsRetargetTools Tab 2's folder scanning) becomes possible via `@tauri-apps/plugin-fs`.
