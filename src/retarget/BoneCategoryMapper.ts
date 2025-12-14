import { BoneCategory, BoneMetadata, BoneSide } from './BoneAutoMapper'

/**
 * BoneCategoryMapper - Handles category-specific bone mapping logic
 * Contains the actual matching algorithms for each anatomical category
 */
export class BoneCategoryMapper {
  /**
   * Map torso bones (spine, chest, neck, head, hips, pelvis)
   */
  static map_torso_bones (source_bones: BoneMetadata[], target_bones: BoneMetadata[]): Map<string, string> {
    const category_mappings = new Map<string, string>()

    // go through each target bone and find the best matching source bone
    for (const target_bone_meta of target_bones) {
      // do simple match if bone is an exact match to start
      for (const source_bone_meta of source_bones) {
        if (source_bone_meta.name === target_bone_meta.name) {
          // add record to the category_mapping if exact match
          category_mappings.set(target_bone_meta.name, source_bone_meta.name)
          break
        }
      }
    }

    return category_mappings
  }

  /**
   * Map arm bones (shoulder, upper arm, elbow, forearm, wrist)
   */
  static map_arm_bones (source_bones: BoneMetadata[], target_bones: BoneMetadata[]): Map<string, string> {
    const category_mappings = new Map<string, string>()

    // go through each target bone and find the best matching source bone
    for (const target_bone_meta of target_bones) {
      // do simple match if bone is an exact match to start
      for (const source_bone_meta of source_bones) {
        if (source_bone_meta.name === target_bone_meta.name) {
          // add record to the category_mapping if exact match
          category_mappings.set(target_bone_meta.name, source_bone_meta.name)
          break
        }
      }
    }

    return category_mappings
  }

  /**
   * Map hand bones (hands, fingers, thumbs)
   */
  static map_hand_bones (source_bones: BoneMetadata[], target_bones: BoneMetadata[]): Map<string, string> {
    const category_mappings = new Map<string, string>()

    // go through each target bone and find the best matching source bone
    for (const target_bone_meta of target_bones) {
      // do simple match if bone is an exact match to start
      for (const source_bone_meta of source_bones) {
        if (source_bone_meta.name === target_bone_meta.name) {
          // add record to the category_mapping if exact match
          category_mappings.set(target_bone_meta.name, source_bone_meta.name)
          break
        }
      }
    }

    return category_mappings
  }

  /**
   * Map leg bones (hips, thighs, knees, calves, ankles, feet, toes)
   */
  static map_leg_bones (source_bones: BoneMetadata[], target_bones: BoneMetadata[]): Map<string, string> {
    const category_mappings = new Map<string, string>()

    // go through each target bone and find the best matching source bone
    for (const target_bone_meta of target_bones) {
      // do simple match if bone is an exact match to start
      for (const source_bone_meta of source_bones) {
        if (source_bone_meta.name === target_bone_meta.name) {
          // add record to the category_mapping if exact match
          category_mappings.set(target_bone_meta.name, source_bone_meta.name)
          break
        }
      }
    }

    return category_mappings
  }

  /**
   * Map wing bones (wings, feathers, pinions)
   */
  static map_wing_bones (source_bones: BoneMetadata[], target_bones: BoneMetadata[]): Map<string, string> {
    const category_mappings = new Map<string, string>()

    // go through each target bone and find the best matching source bone
    for (const target_bone_meta of target_bones) {
      // do simple match if bone is an exact match to start
      for (const source_bone_meta of source_bones) {
        if (source_bone_meta.name === target_bone_meta.name) {
          // add record to the category_mapping if exact match
          category_mappings.set(target_bone_meta.name, source_bone_meta.name)
          break
        }
      }
    }

    return category_mappings
  }

  /**
   * Map tail bones
   */
  static map_tail_bones (source_bones: BoneMetadata[], target_bones: BoneMetadata[]): Map<string, string> {
    const category_mappings = new Map<string, string>()

    // go through each target bone and find the best matching source bone
    for (const target_bone_meta of target_bones) {
      // do simple match if bone is an exact match to start
      for (const source_bone_meta of source_bones) {
        if (source_bone_meta.name === target_bone_meta.name) {
          // add record to the category_mapping if exact match
          category_mappings.set(target_bone_meta.name, source_bone_meta.name)
          break
        }
      }
    }

    return category_mappings
  }

  /**
   * Map unknown/uncategorized bones
   */
  static map_unknown_bones (source_bones: BoneMetadata[], target_bones: BoneMetadata[]): Map<string, string> {
    const category_mappings = new Map<string, string>()

    // go through each target bone and find the best matching source bone
    for (const target_bone_meta of target_bones) {
      // do simple match if bone is an exact match to start
      for (const source_bone_meta of source_bones) {
        if (source_bone_meta.name === target_bone_meta.name) {
          // add record to the category_mapping if exact match
          category_mappings.set(target_bone_meta.name, source_bone_meta.name)
          break
        }
      }
    }

    return category_mappings
  }
}
